"""
Training pipeline - run once:   python -m training.train   (from the backend/ folder)

1. Clean + merge the raw data                      (preprocessing/preprocess.py)
2. Split 70 / 15 / 15  -> train / validation / test (same split for every model)
3. Fit the feature builder on TRAIN only (cross-fitted target encoding)
4. Train the five base models on TRAIN              (CART, Boosting, Splines, GAM, Random Forest)
5. Use VALIDATION to compute ensemble + BMA weights (and to tune CART)
6. Evaluate every model and combiner on TEST        (R², MAE, MSE, RMSE in t/ha)
7. Save models, metrics and visualisation data to saved_models/
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import joblib
import sklearn
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config  # noqa: E402
from models import (bayesian_averaging, basis_function_model, boosting_model, cart_model,  # noqa: E402
                    ensemble_model, gam_model)
from preprocessing.preprocess import (CropFeatureBuilder, from_log_target, load_and_clean,  # noqa: E402
                                      to_log_target)

OUT = config.SAVED_MODELS_DIR
RAW_COLS = config.CATEGORICAL_INPUTS + config.NUMERIC_INPUTS


def _json_default(o):
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return float(o)
    raise TypeError(type(o))


def metrics(y_true, y_pred, y_true_log=None, y_pred_log=None):
    mse = mean_squared_error(y_true, y_pred)
    m = {"r2": float(r2_score(y_true, y_pred)), "mae": float(mean_absolute_error(y_true, y_pred)),
         "mse": float(mse), "rmse": float(np.sqrt(mse))}
    if y_true_log is not None:
        m["r2_log"] = float(r2_score(y_true_log, y_pred_log))
    return m


def predict_log(model_key, model, X):
    return np.asarray(model.predict(np.asarray(X, dtype=float) if model_key == "gam" else X), dtype=float)


def main():
    t0 = time.time()
    OUT.mkdir(parents=True, exist_ok=True)

    # ---------------------------------------------------------------- 1. data
    print("[1/7] Loading and cleaning data ...")
    df, report = load_and_clean(save=True)
    for s in report["steps"]:
        print(f"   {s['step']:<18} -{s['removed']:>7}  -> {s['rows_after']:>7}")
    print(f"   final rows: {report['final_rows']}, crops: {report['n_crops']}, states: {report['n_states']}")

    # ---------------------------------------------------------------- 2. split
    print("[2/7] Splitting train/val/test ...")
    X = df[RAW_COLS]
    y = df["Yield"].values
    X_tmp, X_te_raw, y_tmp, y_te = train_test_split(X, y, test_size=config.TEST_SIZE,
                                                    random_state=config.RANDOM_STATE, stratify=df["Crop"])
    val_frac = config.VAL_SIZE / (1 - config.TEST_SIZE)
    X_tr_raw, X_va_raw, y_tr, y_va = train_test_split(X_tmp, y_tmp, test_size=val_frac,
                                                      random_state=config.RANDOM_STATE,
                                                      stratify=X_tmp["Crop"])
    z_tr, z_va, z_te = to_log_target(y_tr), to_log_target(y_va), to_log_target(y_te)
    split = {"train": len(X_tr_raw), "validation": len(X_va_raw), "test": len(X_te_raw)}
    print("  ", split)

    # ---------------------------------------------------------------- 3. features
    print("[3/7] Building features (cross-fitted hierarchical target encoding) ...")
    fb = CropFeatureBuilder(smoothing=10.0, n_splits=5, random_state=config.RANDOM_STATE)
    X_tr = fb.fit_transform(X_tr_raw, z_tr)
    X_va = fb.transform(X_va_raw)
    X_te = fb.transform(X_te_raw)

    # ---------------------------------------------------------------- 4. base models
    print("[4/7] Training base models ...")
    models, train_time, extra = {}, {}, {}

    s = time.time(); models["cart"], cart_grid = cart_model.tune_and_train(X_tr, z_tr, X_va, z_va)
    train_time["cart"] = time.time() - s; print(f"   CART            {train_time['cart']:.1f}s  depth={models['cart'].get_depth()}")

    s = time.time(); models["boosting"] = boosting_model.train(X_tr, z_tr)
    train_time["boosting"] = time.time() - s; print(f"   Boosting        {train_time['boosting']:.1f}s")

    s = time.time(); models["basis"] = basis_function_model.train(X_tr, z_tr)
    train_time["basis"] = time.time() - s; print(f"   Spline basis    {train_time['basis']:.1f}s")

    s = time.time(); models["gam"] = gam_model.train(X_tr, z_tr, random_state=config.RANDOM_STATE)
    train_time["gam"] = time.time() - s; print(f"   GAM             {train_time['gam']:.1f}s")

    s = time.time(); models["random_forest"] = ensemble_model.train_random_forest(X_tr, z_tr)
    train_time["random_forest"] = time.time() - s; print(f"   Random Forest   {train_time['random_forest']:.1f}s")

    # ---------------------------------------------------------------- 5. combination weights (validation)
    print("[5/7] Computing ensemble and BMA weights on validation set ...")
    va_log = {k: predict_log(k, m, X_va) for k, m in models.items()}
    te_log = {k: predict_log(k, m, X_te) for k, m in models.items()}
    va_tha = {k: from_log_target(v) for k, v in va_log.items()}
    te_tha = {k: from_log_target(v) for k, v in te_log.items()}

    val_mse_tha = {k: float(mean_squared_error(y_va, v)) for k, v in va_tha.items()}
    w_vote = ensemble_model.voting_weights(config.BASE_MODELS)
    w_weighted = ensemble_model.inverse_mse_weights(val_mse_tha)
    w_bma, bma_details, n_val = bayesian_averaging.compute_weights(z_va, va_log)
    for k in config.BASE_MODELS:
        print(f"   {k:<14} weighted={w_weighted[k]:.3f}  bma={w_bma[k]:.4f}  tempered={bma_details[k]['tempered_weight']:.3f}")

    te_tha["voting"] = ensemble_model.combine(te_tha, w_vote)
    te_tha["weighted"] = ensemble_model.combine(te_tha, w_weighted)
    te_tha["bma"] = bayesian_averaging.predict(te_tha, w_bma)
    for k in ("voting", "weighted", "bma"):
        te_log[k] = to_log_target(te_tha[k])

    # ---------------------------------------------------------------- 6. evaluation (test)
    print("[6/7] Evaluating on the shared test set ...")
    table = []
    for k in list(config.MODEL_NAMES):
        m = metrics(y_te, te_tha[k], z_te, te_log[k])
        m.update({"key": k, "name": config.MODEL_NAMES[k], "train_time_s": round(train_time.get(k, 0.0), 2),
                  "family": "base" if k in config.BASE_MODELS else "combined"})
        table.append(m)
        print(f"   {config.MODEL_NAMES[k]:<36} R²={m['r2']:.4f}  MAE={m['mae']:.3f}  RMSE={m['rmse']:.3f}  R²(log)={m['r2_log']:.4f}")
    best = max(table, key=lambda r: r["r2"])
    best_base = max([r for r in table if r["family"] == "base"], key=lambda r: r["r2"])

    # ---------------------------------------------------------------- 7. insights + save
    print("[7/7] Generating visualisation data and saving artifacts ...")
    rng = np.random.default_rng(config.RANDOM_STATE)
    labels = config.FEATURE_LABELS
    feats = config.MODEL_FEATURES

    # Actual vs predicted sample (same points for every model)
    idx = rng.choice(len(y_te), size=600, replace=False)
    te_crops = X_te_raw["Crop"].values
    avp = [{"actual": float(y_te[i]), "crop": te_crops[i], **{k: float(te_tha[k][i]) for k in config.MODEL_NAMES}}
           for i in idx]

    # Residual histograms (t/ha), common bins
    all_res = np.concatenate([te_tha[k] - y_te for k in config.MODEL_NAMES])
    lo, hi = np.percentile(all_res, [1, 99])
    bins = np.linspace(lo, hi, 41)
    residuals = {}
    for k in config.MODEL_NAMES:
        r = te_tha[k] - y_te
        h, _ = np.histogram(np.clip(r, lo, hi), bins=bins)
        residuals[k] = {"counts": h.tolist(), "mean": float(r.mean()), "std": float(r.std()),
                        "median_abs": float(np.median(np.abs(r)))}
    residual_bins = [float((bins[i] + bins[i + 1]) / 2) for i in range(len(bins) - 1)]

    # Feature importance: impurity (tree models) + permutation on a test subsample (all base models)
    fi = {}
    for k in ("cart", "boosting", "random_forest"):
        fi[k] = {"impurity": dict(zip(feats, map(float, models[k].feature_importances_)))}
    pidx = rng.choice(len(X_te), size=4000, replace=False)
    Xp, zp = X_te.iloc[pidx], z_te[pidx]
    for k, m in models.items():
        # Permutation importance = drop in R² (log scale) when one feature column is shuffled.
        base = r2_score(zp, predict_log(k, m, Xp))
        imp = {}
        for f in feats:
            drops = []
            for rep in range(4):
                Xs = Xp.copy()
                Xs[f] = rng.permutation(Xs[f].values)
                drops.append(base - r2_score(zp, predict_log(k, m, Xs)))
            imp[f] = float(np.mean(drops))
        fi.setdefault(k, {})["permutation"] = imp

    # Partial dependence of the *raw* inputs (rainfall, year, area) for every base model, in t/ha
    pd_rows = X_te_raw.sample(1500, random_state=config.RANDOM_STATE)
    grids = {
        "Annual_Rainfall": np.linspace(df["Annual_Rainfall"].quantile(0.02), df["Annual_Rainfall"].quantile(0.98), 30),
        "Crop_Year": np.arange(df["Crop_Year"].min(), df["Crop_Year"].max() + 1),
        "Area": np.geomspace(max(1, df["Area"].quantile(0.02)), df["Area"].quantile(0.98), 30),
    }
    pdp = {}
    for feat, grid in grids.items():
        curve = []
        for v in grid:
            tmp = pd_rows.copy(); tmp[feat] = v
            Xg = fb.transform(tmp)
            row = {"x": float(v)}
            for k, m in models.items():
                row[k] = float(np.mean(from_log_target(predict_log(k, m, Xg))))
            curve.append(row)
        pdp[feat] = curve

    # Crop-specific rainfall response curves from the spline (basis) model and GAM
    crop_curves = {}
    top_crops = df["Crop"].value_counts().head(8).index.tolist()
    rain_grid = grids["Annual_Rainfall"]
    for c in top_crops:
        rows = X_te_raw[X_te_raw["Crop"] == c]
        rows = rows.sample(min(400, len(rows)), random_state=config.RANDOM_STATE)
        pts = []
        for v in rain_grid:
            tmp = rows.copy(); tmp["Annual_Rainfall"] = v
            Xg = fb.transform(tmp)
            pts.append({"x": float(v),
                        "basis": float(np.mean(from_log_target(models["basis"].predict(Xg)))),
                        "gam": float(np.mean(from_log_target(models["gam"].predict(np.asarray(Xg, dtype=float)))))})
        crop_curves[c] = pts

    # Per-crop error of the best base model (helps interpret the global R²)
    per_crop = []
    bk = best_base["key"]
    for c in df["Crop"].value_counts().head(20).index:
        msk = te_crops == c
        yt, yp = y_te[msk], te_tha[bk][msk]
        per_crop.append({"crop": c, "n": int(msk.sum()), "mean_yield": float(yt.mean()),
                         "mae": float(mean_absolute_error(yt, yp)),
                         "median_ape": float(np.median(np.abs(yp - yt) / yt) * 100),
                         "r2": float(r2_score(yt, yp))})

    gam_effects = gam_model.partial_effects(models["gam"], feats, labels,
                                            x_transform={"log_area": np.expm1})

    insights = {
        "cart": {"tree": cart_model.export_tree(models["cart"], feats, labels, max_depth=3),
                 "depth": int(models["cart"].get_depth()), "leaves": int(models["cart"].get_n_leaves()),
                 "params": {k: models["cart"].get_params()[k] for k in ("max_depth", "min_samples_leaf")},
                 "grid": cart_grid},
        "boosting": {"params": boosting_model.PARAMS,
                     "staged": boosting_model.staged_curve(models["boosting"], X_tr.iloc[:20000], z_tr[:20000], X_va, z_va)},
        "basis": {"params": {**basis_function_model.PARAMS, "ridge_alpha": float(models["basis"].named_steps["ridge"].alpha_)},
                  "n_basis_functions": basis_function_model.n_basis(models["basis"]),
                  "crop_rainfall_curves": crop_curves},
        "gam": {"summary": gam_model.summary(models["gam"]), "n_splines_per_term": gam_model.N_SPLINES,
                "effects": gam_effects},
        "random_forest": {"params": {k: v for k, v in ensemble_model.RF_PARAMS.items() if k != "n_jobs"}},
        "ensemble": {"voting_weights": w_vote, "weighted_weights": w_weighted, "val_mse_tha": val_mse_tha},
        "bma": {"weights": w_bma, "details": bma_details, "n_validation": n_val},
        "partial_dependence": pdp,
        "feature_importance": fi,
        "actual_vs_predicted": avp,
        "residuals": {"bins": residual_bins, "models": residuals},
        "per_crop_best_model": {"model": bk, "rows": per_crop},
    }

    # Metadata for the API / form (derived from the cleaned data)
    clean = df
    states = sorted(clean["State"].unique())
    meta = {
        "states": states,
        "districts": {s_: sorted(clean.loc[clean["State"] == s_, "District"].unique()) for s_ in states},
        "crops": sorted(clean["Crop"].unique()),
        "seasons": sorted(clean["Season"].unique()),
        "crop_seasons": {c: sorted(g["Season"].unique()) for c, g in clean.groupby("Crop")},
        "year_range": [int(clean["Crop_Year"].min()), int(clean["Crop_Year"].max())],
        "area_range": [1.0, float(clean["Area"].max())],
        "area_typical": {c: float(g["Area"].median()) for c, g in clean.groupby("Crop")},
        "rainfall_range": [float(clean["Annual_Rainfall"].min()), float(clean["Annual_Rainfall"].max())],
        "rainfall_state_mean": {s_: float(g.drop_duplicates("Crop_Year")["Annual_Rainfall"].mean())
                                for s_, g in clean.groupby("State")},
        "rainfall_state_year": {s_: {int(y_): float(r) for y_, r in g.groupby("Crop_Year")["Annual_Rainfall"].first().items()}
                                for s_, g in clean.groupby("State")},
    }

    summary = {
        "metrics": table,
        "best_model": {"key": best["key"], "name": best["name"], "r2": best["r2"]},
        "best_base_model": {"key": best_base["key"], "name": best_base["name"], "r2": best_base["r2"]},
        "split": split,
        "target": "Yield (t/ha) = Production / Area; models trained on log1p(Yield), metrics reported in t/ha",
        "features": feats,
        "feature_labels": labels,
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "versions": {"scikit-learn": sklearn.__version__, "numpy": np.__version__, "pandas": pd.__version__},
    }

    joblib.dump(fb, OUT / "feature_builder.joblib", compress=3)
    for k, m in models.items():
        joblib.dump(m, OUT / f"{k}.joblib", compress=3)
    (OUT / "ensemble_weights.json").write_text(json.dumps({"voting": w_vote, "weighted": w_weighted, "bma": w_bma}, indent=2))
    (OUT / "metrics.json").write_text(json.dumps(summary, indent=2, default=_json_default))
    (OUT / "insights.json").write_text(json.dumps(insights, default=_json_default))
    (OUT / "metadata.json").write_text(json.dumps(meta, default=_json_default))
    (OUT / "data_report.json").write_text(json.dumps(report, indent=2, default=_json_default))
    sizes = {p.name: f"{p.stat().st_size / 1e6:.1f} MB" for p in OUT.glob("*.joblib")}
    print("   saved:", sizes)
    print(f"Done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
