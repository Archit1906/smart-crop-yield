"""
Data loading, cleaning and feature engineering.

Pipeline overview
-----------------
1. load_and_clean()   : merge district crop statistics with state-year rainfall, compute
                        Yield = Production / Area (t/ha), handle missing values, duplicates,
                        unit conversions and outliers. Returns a tidy DataFrame + a report.
2. CropFeatureBuilder : sklearn transformer used *identically* at training and prediction time.
                        Converts raw inputs (State, District, Crop, Season, Crop_Year, Area,
                        Annual_Rainfall) into numeric model features using a cross-fitted,
                        hierarchical (smoothed) target encoding.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import KFold

import config


# ----------------------------------------------------------------------------------------
# 1. Loading + cleaning
# ----------------------------------------------------------------------------------------
def load_and_clean(save: bool = True):
    report: dict = {"steps": []}

    def log(step, before, after, note):
        report["steps"].append({"step": step, "rows_before": int(before), "rows_after": int(after),
                                "removed": int(before - after), "note": note})

    d = pd.read_csv(config.DISTRICT_CSV)
    report["raw_district_rows"] = int(len(d))
    report["raw_district_columns"] = d.columns.tolist()

    # Normalise text columns (the source has trailing spaces in Season / Crop)
    for c in ["State_Name", "District_Name", "Season", "Crop"]:
        d[c] = d[c].astype(str).str.strip()
    d = d.rename(columns={"State_Name": "State", "District_Name": "District"})
    d["District"] = d["District"].str.title()

    # --- Missing values: Production is missing for some rows. Yield cannot be computed
    #     without it, and imputing the target would fabricate data -> drop.
    n = len(d)
    d = d[d["Production"].notna() & d["Area"].notna()]
    log("missing_production", n, len(d), "Rows with missing Production/Area dropped (target cannot be computed).")

    # --- Duplicates
    n = len(d)
    d = d.drop_duplicates()
    d = d.drop_duplicates(subset=["State", "District", "Crop_Year", "Season", "Crop"], keep="first")
    log("duplicates", n, len(d), "Exact duplicates and duplicate State/District/Year/Season/Crop keys removed.")

    # --- Zero production / area: ambiguous (crop failure vs. non-reporting) -> drop
    n = len(d)
    d = d[(d["Production"] > 0) & (d["Area"] > 0)]
    log("zero_values", n, len(d), "Rows with zero Production or Area dropped (ambiguous: failure vs. non-reporting).")

    # --- Crops whose units cannot be converted to tonnes
    n = len(d)
    d = d[~d["Crop"].isin(config.EXCLUDED_CROPS.keys())]
    log("unit_exclusions", n, len(d), "; ".join(f"{k}: {v}" for k, v in config.EXCLUDED_CROPS.items()))

    # --- Unit conversion: bales -> tonnes
    for crop, factor in config.BALE_TO_TONNES.items():
        d.loc[d["Crop"] == crop, "Production"] = d.loc[d["Crop"] == crop, "Production"] * factor
    report["unit_conversions"] = {k: f"bales x {v} t" for k, v in config.BALE_TO_TONNES.items()}

    # --- Merge real state-year annual rainfall (IMD-derived, from the Kaggle state dataset)
    rain = pd.read_csv(config.STATE_RAIN_CSV)
    rain["State"] = rain["State"].str.strip()
    rain = rain.groupby(["State", "Crop_Year"], as_index=False)["Annual_Rainfall"].first()
    n = len(d)
    d = d.merge(rain, on=["State", "Crop_Year"], how="inner")
    log("rainfall_join", n, len(d),
        "Inner join on State + Crop_Year. States/years without a rainfall record "
        "(e.g. Rajasthan, Chandigarh, A&N Islands, Dadra & Nagar Haveli, Telangana before 2013) "
        "are excluded rather than imputed.")

    # --- Target: yield in tonnes per hectare
    d["Yield"] = d["Production"] / d["Area"]

    # --- Keep crops with enough records to learn from
    n = len(d)
    counts = d["Crop"].value_counts()
    keep = counts[counts >= config.MIN_RECORDS_PER_CROP].index
    d = d[d["Crop"].isin(keep)]
    log("rare_crops", n, len(d), f"Crops with fewer than {config.MIN_RECORDS_PER_CROP} records removed.")

    # --- Outliers: per-crop IQR fence on log-yield (3 x IQR). Very small plots (< 1 ha) are
    #     dropped too because their yields are dominated by rounding in the source data.
    n = len(d)
    d = d[d["Area"] >= 1]
    ly = np.log1p(d["Yield"])
    q1 = ly.groupby(d["Crop"]).transform(lambda s: s.quantile(0.25))
    q3 = ly.groupby(d["Crop"]).transform(lambda s: s.quantile(0.75))
    iqr = q3 - q1
    mask = (ly >= q1 - 3 * iqr) & (ly <= q3 + 3 * iqr)
    d = d[mask]
    log("outliers", n, len(d), "Area < 1 ha removed; per-crop log-yield outside [Q1 - 3·IQR, Q3 + 3·IQR] removed.")

    d = d[["State", "District", "Crop", "Season", "Crop_Year", "Area", "Production",
           "Annual_Rainfall", "Yield"]].reset_index(drop=True)

    report["final_rows"] = int(len(d))
    report["n_states"] = int(d["State"].nunique())
    report["n_districts"] = int(d.groupby(["State", "District"]).ngroups)
    report["n_crops"] = int(d["Crop"].nunique())
    report["years"] = [int(d["Crop_Year"].min()), int(d["Crop_Year"].max())]

    # --- Feature-selection evidence: why the Kaggle Fertilizer / Pesticide columns were dropped
    r = pd.read_csv(config.STATE_RAIN_CSV)
    ratio = (r["Fertilizer"] / r["Area"]).groupby(r["Crop_Year"]).agg(["min", "max"])
    report["feature_selection"] = {
        "dropped": {
            "Production": "Used to compute the target (Yield = Production / Area) -> data leakage.",
            "Fertilizer, Pesticide": "In the Kaggle state file these equal Area x a single constant per year "
                                     f"(Fertilizer/Area identical for every row in a year: e.g. 1997 = "
                                     f"{ratio.loc[1997, 'min']:.2f}). They carry no information beyond Area "
                                     "and Year and are not real measurements.",
            "Kaggle Yield column": "Does not equal Production/Area for most rows; Yield is recomputed.",
            "Temperature, humidity, soil N/P/K, pH": "Not present in any source that can be matched by "
                                                     "district and year; not used and not invented.",
        },
        "corr_fertilizer_area": float(np.corrcoef(r["Fertilizer"], r["Area"])[0, 1]),
    }

    if save:
        config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        d.to_csv(config.CLEAN_CSV, index=False)
    return d, report


# ----------------------------------------------------------------------------------------
# 2. Feature engineering transformer
# ----------------------------------------------------------------------------------------
def _smoothed(stats: pd.DataFrame, prior: pd.Series, m: float) -> pd.Series:
    """Empirical-Bayes style shrinkage: (n * mean + m * prior) / (n + m)."""
    return (stats["sum"] + m * prior) / (stats["count"] + m)


class CropFeatureBuilder(BaseEstimator, TransformerMixin):
    """
    Hierarchical, smoothed target encoder for crop-yield data.

    Learns (on log1p(yield)) the following lookup tables and falls back up the hierarchy
    for unseen combinations:
        crop  ->  crop x season
        crop  ->  state x crop  ->  district x crop
        district productivity index = mean residual of the district after removing crop baseline

    `fit_transform` uses K-fold *cross-fitting* so that a training row never sees its own target
    value in its encoding (prevents target leakage). `transform` (validation / test / API inputs)
    uses tables fitted on the full training set.
    """

    def __init__(self, smoothing: float = 10.0, n_splits: int = 5, random_state: int = 42):
        self.smoothing = smoothing
        self.n_splits = n_splits
        self.random_state = random_state

    # -- helpers ---------------------------------------------------------------------
    @staticmethod
    def _keys(X: pd.DataFrame) -> pd.DataFrame:
        k = pd.DataFrame(index=X.index)
        k["crop"] = X["Crop"].astype(str)
        k["crop_season"] = k["crop"] + "|" + X["Season"].astype(str)
        k["state_crop"] = X["State"].astype(str) + "|" + k["crop"]
        k["district"] = X["State"].astype(str) + "|" + X["District"].astype(str)
        k["district_crop"] = k["district"] + "|" + k["crop"]
        return k

    def _fit_tables(self, keys: pd.DataFrame, y: np.ndarray) -> dict:
        m = self.smoothing
        y = pd.Series(y, index=keys.index)
        t = {"global": float(y.mean())}
        g = t["global"]

        def stats(col):
            return y.groupby(keys[col]).agg(["sum", "count"])

        s = stats("crop")
        t["crop"] = _smoothed(s, g, m).to_dict()
        crop_val = keys["crop"].map(t["crop"]).fillna(g)

        s = stats("crop_season")
        parent = pd.Series([t["crop"].get(i.split("|")[0], g) for i in s.index], index=s.index)
        t["crop_season"] = _smoothed(s, parent, m).to_dict()

        s = stats("state_crop")
        parent = pd.Series([t["crop"].get(i.split("|")[1], g) for i in s.index], index=s.index)
        t["state_crop"] = _smoothed(s, parent, m).to_dict()

        s = stats("district_crop")
        parent = pd.Series([t["state_crop"].get(i.split("|")[0] + "|" + i.split("|")[2],
                                                t["crop"].get(i.split("|")[2], g)) for i in s.index], index=s.index)
        t["district_crop"] = _smoothed(s, parent, m).to_dict()

        resid = (y - crop_val)
        s = resid.groupby(keys["district"]).agg(["sum", "count"])
        t["district_index"] = _smoothed(s, 0.0, m).to_dict()
        return t

    def _apply(self, keys: pd.DataFrame, X: pd.DataFrame, t: dict) -> pd.DataFrame:
        g = t["global"]
        out = pd.DataFrame(index=keys.index)
        crop = keys["crop"].map(t["crop"]).fillna(g)
        out["crop_te"] = crop
        out["crop_season_te"] = keys["crop_season"].map(t["crop_season"]).fillna(crop)
        state_crop = keys["state_crop"].map(t["state_crop"]).fillna(crop)
        out["state_crop_te"] = state_crop
        out["district_crop_te"] = keys["district_crop"].map(t["district_crop"]).fillna(state_crop)
        out["district_index"] = keys["district"].map(t["district_index"]).fillna(0.0)
        out["Crop_Year"] = X["Crop_Year"].astype(float)
        out["log_area"] = np.log1p(X["Area"].astype(float))
        out["Annual_Rainfall"] = X["Annual_Rainfall"].astype(float)
        return out[config.MODEL_FEATURES]

    # -- sklearn API ------------------------------------------------------------------
    def fit(self, X: pd.DataFrame, y):
        self.tables_ = self._fit_tables(self._keys(X), np.asarray(y, dtype=float))
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        return self._apply(self._keys(X), X, self.tables_)

    def fit_transform(self, X: pd.DataFrame, y=None, **_):
        y = np.asarray(y, dtype=float)
        keys = self._keys(X)
        out = pd.DataFrame(index=X.index, columns=config.MODEL_FEATURES, dtype=float)
        kf = KFold(self.n_splits, shuffle=True, random_state=self.random_state)
        for tr, va in kf.split(X):
            t = self._fit_tables(keys.iloc[tr], y[tr])
            out.iloc[va] = self._apply(keys.iloc[va], X.iloc[va], t).values
        self.fit(X, y)  # final tables on the whole training set (used for transform)
        return out

    def get_feature_names_out(self, input_features=None):
        return np.array(config.MODEL_FEATURES)


def to_log_target(y):
    return np.log1p(np.asarray(y, dtype=float))


def from_log_target(z):
    return np.expm1(np.asarray(z, dtype=float)).clip(min=0)
