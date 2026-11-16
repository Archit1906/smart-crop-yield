"""Loads saved artifacts once and serves predictions. No model is retrained at request time."""
from __future__ import annotations

import json

import joblib
import numpy as np
import pandas as pd

import config
from preprocessing.preprocess import from_log_target

FIELD_HELP = {
    "State": "Indian state. Only states with an official rainfall record in the source data are available.",
    "District": "District within the selected state, as named in the Ministry of Agriculture statistics.",
    "Crop": "Crop to predict. Only crops with at least 1,000 district-season records are modelled.",
    "Season": "Cropping season. The list is limited to seasons in which this crop appears in the data.",
    "Crop_Year": "Agricultural year. Limited to the years covered by the data, because tree models cannot extrapolate.",
    "Area": "Cultivated area for this crop, in hectares.",
    "Annual_Rainfall": "Annual rainfall for the state in millimetres (IMD). Pre-filled with the recorded value for the chosen state and year.",
}


class Predictor:
    def __init__(self):
        d = config.SAVED_MODELS_DIR
        self.fb = joblib.load(d / "feature_builder.joblib")
        self.models = {k: joblib.load(d / f"{k}.joblib") for k in config.BASE_MODELS}
        self.weights = json.loads((d / "ensemble_weights.json").read_text())
        self.metrics = json.loads((d / "metrics.json").read_text())
        self.insights = json.loads((d / "insights.json").read_text())
        self.meta = json.loads((d / "metadata.json").read_text())
        self.report = json.loads((d / "data_report.json").read_text())
        self.df = pd.read_csv(config.CLEAN_CSV)
        self.district_set = {s: set(v) for s, v in self.meta["districts"].items()}

    # ------------------------------------------------------------------ metadata
    def form_schema(self):
        m = self.meta
        yr = m["year_range"]
        return [
            {"name": "State", "type": "select", "group": "Location", "required": True, "help": FIELD_HELP["State"]},
            {"name": "District", "type": "select", "group": "Location", "required": True, "depends_on": "State",
             "help": FIELD_HELP["District"]},
            {"name": "Crop", "type": "select", "group": "Crop", "required": True, "help": FIELD_HELP["Crop"]},
            {"name": "Season", "type": "select", "group": "Crop", "required": True, "depends_on": "Crop",
             "help": FIELD_HELP["Season"]},
            {"name": "Crop_Year", "type": "number", "group": "Crop", "required": True, "min": yr[0], "max": yr[1],
             "step": 1, "unit": "year", "help": FIELD_HELP["Crop_Year"]},
            {"name": "Area", "type": "number", "group": "Farming", "required": True, "min": m["area_range"][0],
             "max": m["area_range"][1], "step": "any", "unit": "ha", "help": FIELD_HELP["Area"]},
            {"name": "Annual_Rainfall", "type": "number", "group": "Environment", "required": True,
             "min": m["rainfall_range"][0], "max": m["rainfall_range"][1], "step": "any", "unit": "mm",
             "help": FIELD_HELP["Annual_Rainfall"]},
        ]

    # ------------------------------------------------------------------ validation
    def validate(self, payload: dict):
        errors, clean = {}, {}
        if not isinstance(payload, dict):
            return None, {"_": "Request body must be a JSON object."}
        m = self.meta

        def get(name, alt):
            for k in (name, alt):
                if k in payload and payload[k] not in (None, ""):
                    return payload[k]
            return None

        state = get("State", "state")
        if state is None:
            errors["State"] = "State is required."
        elif state not in self.district_set:
            errors["State"] = f"Unknown state '{state}'."
        clean["State"] = state

        district = get("District", "district")
        if district is None:
            errors["District"] = "District is required."
        elif state in self.district_set and district not in self.district_set[state]:
            errors["District"] = f"'{district}' is not a district of {state} in the dataset."
        clean["District"] = district

        crop = get("Crop", "crop")
        if crop is None:
            errors["Crop"] = "Crop is required."
        elif crop not in m["crop_seasons"]:
            errors["Crop"] = f"Unsupported crop '{crop}'."
        clean["Crop"] = crop

        season = get("Season", "season")
        if season is None:
            errors["Season"] = "Season is required."
        elif crop in m["crop_seasons"] and season not in m["crop_seasons"][crop]:
            errors["Season"] = f"{crop} is not grown in the '{season}' season in the dataset."
        clean["Season"] = season

        for name, alt, lo, hi, as_int in (
            ("Crop_Year", "crop_year", *m["year_range"], True),
            ("Area", "area", *m["area_range"], False),
            ("Annual_Rainfall", "annual_rainfall", *m["rainfall_range"], False),
        ):
            v = get(name, alt)
            if v is None:
                errors[name] = f"{name.replace('_', ' ')} is required."
                continue
            try:
                v = float(v)
            except (TypeError, ValueError):
                errors[name] = "Must be a number."
                continue
            if not np.isfinite(v):
                errors[name] = "Must be a finite number."
            elif as_int and v != int(v):
                errors[name] = "Must be a whole year."
            elif v < lo or v > hi:
                errors[name] = f"Must be between {lo:g} and {hi:g}."
            clean[name] = int(v) if as_int else v
        return (None, errors) if errors else (clean, None)

    # ------------------------------------------------------------------ prediction
    def _predict_raw(self, X_raw: pd.DataFrame):
        Xf = self.fb.transform(X_raw)
        out = {}
        for k, mdl in self.models.items():
            z = mdl.predict(np.asarray(Xf, dtype=float)) if k == "gam" else mdl.predict(Xf)
            out[k] = from_log_target(z)
        return out, Xf

    def predict(self, clean: dict):
        X_raw = pd.DataFrame([clean])[config.CATEGORICAL_INPUTS + config.NUMERIC_INPUTS]
        base, Xf = self._predict_raw(X_raw)
        base = {k: float(v[0]) for k, v in base.items()}
        combined = {name: float(sum(w[k] * base[k] for k in w)) for name, w in self.weights.items()}
        allp = {**base, **combined}

        best_key = self.metrics["best_model"]["key"]
        vals = np.array([base[k] for k in config.BASE_MODELS])
        metric_by_key = {r["key"]: r for r in self.metrics["metrics"]}

        # Rainfall sensitivity for this exact input (all base models)
        # Sweep over the rainfall actually observed in this state (+/-15%), not the national range,
        # so the curve does not extrapolate far outside the data the models have seen for this state.
        srain = self.df.loc[self.df.State == clean["State"], "Annual_Rainfall"]
        glo, ghi = self.meta["rainfall_range"]
        lo = max(glo, min(srain.min(), clean["Annual_Rainfall"]) * 0.85)
        hi = min(ghi, max(srain.max(), clean["Annual_Rainfall"]) * 1.15)
        grid = np.linspace(lo, hi, 25)
        sweep = pd.concat([X_raw] * len(grid), ignore_index=True)
        sweep["Annual_Rainfall"] = grid
        sp, _ = self._predict_raw(sweep)
        rain_curve = [{"x": float(g), **{k: float(sp[k][i]) for k in sp}} for i, g in enumerate(grid)]

        # Historical context from the real data
        d = self.df
        hist = d[(d.State == clean["State"]) & (d.District == clean["District"]) &
                 (d.Crop == clean["Crop"]) & (d.Season == clean["Season"])].sort_values("Crop_Year")
        st = d[(d.State == clean["State"]) & (d.Crop == clean["Crop"])]
        nat = d[d.Crop == clean["Crop"]]

        def agg_yield(x):
            return float(x["Production"].sum() / x["Area"].sum()) if len(x) else None

        return {
            "input": clean,
            "predicted_yield_tha": allp[best_key],
            "prediction_model": {"key": best_key, "name": config.MODEL_NAMES[best_key]},
            "estimated_production_t": allp[best_key] * clean["Area"],
            "predictions": [
                {"key": k, "name": config.MODEL_NAMES[k], "yield_tha": allp[k],
                 "family": "base" if k in config.BASE_MODELS else "combined",
                 "test_r2": metric_by_key[k]["r2"], "test_rmse": metric_by_key[k]["rmse"]}
                for k in config.MODEL_NAMES
            ],
            "spread": {"min": float(vals.min()), "max": float(vals.max()), "range": float(vals.max() - vals.min()),
                       "std": float(vals.std()), "cv_percent": float(vals.std() / vals.mean() * 100) if vals.mean() else 0.0},
            "bma": {"weights": self.weights["bma"],
                    "contributions": {k: self.weights["bma"][k] * base[k] for k in config.BASE_MODELS}},
            "weighted": {"weights": self.weights["weighted"]},
            "engineered_features": {config.FEATURE_LABELS[k]: float(v) for k, v in Xf.iloc[0].items()},
            "rainfall_sensitivity": rain_curve,
            "history": {
                "has_district_history": bool(len(hist)),
                "records": [{"year": int(r.Crop_Year), "yield_tha": float(r.Yield), "area": float(r.Area),
                             "rainfall": float(r.Annual_Rainfall)} for r in hist.itertuples()],
                "district_mean_tha": float(hist["Yield"].mean()) if len(hist) else None,
                "state_crop_yield_tha": agg_yield(st),
                "national_crop_yield_tha": agg_yield(nat),
            },
            "disclaimer": "Predictions are statistical estimates learned from historical district statistics "
                          "(1997-2015). They are not guaranteed agricultural outcomes and do not account for "
                          "irrigation, soil, pests, prices or weather within the season.",
        }
