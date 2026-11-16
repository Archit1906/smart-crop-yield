"""
Smart Crop Yield Prediction System - Flask REST API.

Run:   python app.py        (after `python -m training.train` has created saved_models/)
"""
from __future__ import annotations

import logging
import math

from flask import Flask, jsonify, request
from flask_cors import CORS

import config
from utils.analytics import Analytics
from utils.predictor import Predictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("crop-api")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

try:
    predictor = Predictor()
    analytics = Analytics(predictor.df)
    LOAD_ERROR = None
    log.info("Loaded %d models and %d records", len(predictor.models), len(predictor.df))
    import sklearn
    trained_with = predictor.metrics.get("versions", {}).get("scikit-learn")
    if trained_with and trained_with != sklearn.__version__:
        log.warning("Models were trained with scikit-learn %s but %s is installed. If predictions fail, "
                    "retrain with `python -m training.train`.", trained_with, sklearn.__version__)
except FileNotFoundError as e:  # models not trained yet
    predictor = analytics = None
    LOAD_ERROR = f"Saved models not found ({e}). Run `python -m training.train` first."
    log.error(LOAD_ERROR)


def _clean(o):
    """Replace NaN/inf with None so responses are valid JSON."""
    if isinstance(o, float):
        return None if (math.isnan(o) or math.isinf(o)) else o
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean(v) for v in o]
    return o


def ok(data, status=200):
    return jsonify(_clean(data)), status


def err(message, status=400, details=None):
    body = {"error": message}
    if details:
        body["details"] = details
    return jsonify(body), status


@app.before_request
def require_models():
    if request.path.startswith("/api/") and request.path != "/api/health" and predictor is None:
        return err(LOAD_ERROR, 503)


@app.get("/api/health")
def health():
    return ok({"status": "ok" if predictor else "models_missing",
               "models_loaded": list(predictor.models) if predictor else [],
               "records": int(len(predictor.df)) if predictor else 0,
               "error": LOAD_ERROR})


@app.get("/api/metadata")
def metadata():
    m = predictor.meta
    r = predictor.report
    return ok({
        "states": m["states"], "districts": m["districts"], "crops": m["crops"], "seasons": m["seasons"],
        "crop_seasons": m["crop_seasons"], "year_range": m["year_range"], "area_range": m["area_range"],
        "area_typical": m["area_typical"], "rainfall_range": m["rainfall_range"],
        "rainfall_state_mean": m["rainfall_state_mean"], "rainfall_state_year": m["rainfall_state_year"],
        "features": predictor.form_schema(),
        "unsupported_features": [
            {"name": "Average temperature", "reason": "Not available in the source data at district/year level."},
            {"name": "Humidity", "reason": "Not available in the source data."},
            {"name": "Soil N, P, K", "reason": "Not available for matching districts and years."},
            {"name": "Soil pH", "reason": "Not available for matching districts and years."},
        ],
        "model_names": config.MODEL_NAMES,
        "dataset": {"rows": r["final_rows"], "states": r["n_states"], "districts": r["n_districts"],
                    "crops": r["n_crops"], "years": r["years"], "cleaning_steps": r["steps"],
                    "raw_rows": r["raw_district_rows"], "feature_selection": r["feature_selection"],
                    "unit_conversions": r["unit_conversions"]},
    })


@app.post("/api/predict")
def predict():
    payload = request.get_json(silent=True)
    if payload is None:
        return err("Request body must be valid JSON.", 400)
    clean, errors = predictor.validate(payload)
    if errors:
        return err("Invalid input.", 422, errors)
    try:
        return ok(predictor.predict(clean))
    except Exception as e:  # pragma: no cover - surfaced to the client
        log.exception("prediction failed")
        return err(f"Prediction failed: {e}", 500)


@app.get("/api/model-metrics")
def model_metrics():
    i = predictor.insights
    return ok({**predictor.metrics, "insights": i, "model_names": config.MODEL_NAMES})


@app.get("/api/feature-importance")
def feature_importance():
    return ok({"features": config.MODEL_FEATURES, "labels": config.FEATURE_LABELS,
               "importance": predictor.insights["feature_importance"],
               "partial_dependence": predictor.insights["partial_dependence"],
               "note": "Impurity importance is available for tree models only. Permutation importance (drop in "
                       "test R² on the log scale when a feature is shuffled) is computed for all base models."})


def _args():
    a = request.args
    year = a.get("year") or None
    if year is not None:
        try:
            year = int(year)
        except ValueError:
            return None, "year must be an integer"
    return {"state": a.get("state") or None, "crop": a.get("crop") or None,
            "season": a.get("season") or None, "year": year}, None


@app.get("/api/analytics")
def analytics_ep():
    f, e = _args()
    if e:
        return err(e)
    m = predictor.meta
    if f["state"] and f["state"] not in m["states"]:
        return err(f"Unknown state '{f['state']}'")
    if f["crop"] and f["crop"] not in m["crops"]:
        return err(f"Unknown crop '{f['crop']}'")
    return ok({"filters": f, **analytics.summary(**f)})


@app.get("/api/historical-trends")
def historical_trends():
    a = request.args
    crop = a.get("crop") or "Rice"
    if crop not in predictor.meta["crops"]:
        return err(f"Unknown crop '{crop}'")
    return ok(analytics.trends(crop=crop, state=a.get("state") or None, district=a.get("district") or None))


@app.errorhandler(404)
def not_found(_):
    return err("Endpoint not found.", 404)


@app.errorhandler(405)
def bad_method(_):
    return err("Method not allowed.", 405)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
