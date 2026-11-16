"""Dataset analytics computed from the cleaned, real dataset (no synthetic values)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def _yield(g: pd.DataFrame) -> float:
    """Aggregate yield = total production / total area (area-weighted, the standard definition)."""
    return float(g["Production"].sum() / g["Area"].sum()) if len(g) else float("nan")


class Analytics:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        # National median yield per crop -> lets us compare productivity ACROSS crops with a unitless index
        med = self.df.groupby("Crop")["Yield"].median()
        self.df["yield_index"] = self.df["Yield"] / self.df["Crop"].map(med)
        self.nat_crop_yield = self.df.groupby("Crop").apply(_yield, include_groups=False)
        # Years with far fewer records than usual (e.g. 2015: partial reporting in the source) are
        # excluded from trend lines, because their aggregates are not comparable with complete years.
        counts = self.df["Crop_Year"].value_counts()
        self.partial_years = sorted(int(y) for y, c in counts.items() if c < 0.25 * counts.median())

    def filter(self, state=None, crop=None, season=None, year=None, district=None):
        d = self.df
        if state:
            d = d[d.State == state]
        if district:
            d = d[d.District == district]
        if crop:
            d = d[d.Crop == crop]
        if season:
            d = d[d.Season == season]
        if year:
            d = d[d.Crop_Year == int(year)]
        return d

    def _by(self, d: pd.DataFrame, col: str, crop_selected: bool):
        rows = []
        for key, g in d.groupby(col):
            rows.append({"name": key if not isinstance(key, (np.integer,)) else int(key),
                         "value": _yield(g) if crop_selected else float(g["yield_index"].median()),
                         "records": int(len(g))})
        return rows

    def summary(self, state=None, crop=None, season=None, year=None):
        d_all = self.filter(state, crop, season, None)       # year trend ignores the year filter
        d = d_all if not year else d_all[d_all.Crop_Year == int(year)]
        crop_selected = bool(crop)
        metric = {"key": "yield_tha", "label": "Yield (t/ha)"} if crop_selected else \
                 {"key": "yield_index", "label": "Relative yield index (1.0 = national median for each crop)"}

        kpis = {
            "records": int(len(d)),
            "crops": int(d["Crop"].nunique()),
            "states": int(d["State"].nunique()),
            "districts": int(d.groupby(["State", "District"]).ngroups) if len(d) else 0,
            "seasons": int(d["Season"].nunique()),
            "years": [int(d["Crop_Year"].min()), int(d["Crop_Year"].max())] if len(d) else None,
            "avg_yield_tha": _yield(d) if crop_selected and len(d) else None,
            "yield_index": float(d["yield_index"].median()) if len(d) else None,
            "total_area_ha": float(d["Area"].sum()),
        }
        if not len(d):
            return {"kpis": kpis, "metric": metric, "empty": True}

        # Crop-wise aggregate yield (t/ha) - always per crop, so always meaningful
        crop_yield = sorted([{"name": c, "value": _yield(g), "records": int(len(g))}
                             for c, g in d.groupby("Crop")], key=lambda r: -r["value"])

        # Top-performing crops in the selection relative to their national yield
        top = []
        for c, g in d.groupby("Crop"):
            if len(g) >= 10:
                top.append({"name": c, "value": _yield(g) / float(self.nat_crop_yield[c]),
                            "yield_tha": _yield(g), "national_tha": float(self.nat_crop_yield[c])})
        top = sorted(top, key=lambda r: -r["value"])[:10]
        top_mode = "relative_to_national"
        if not state and not crop:
            # No region selected: "top performers" = crops whose yield grew most over the period
            top, top_mode = [], "yield_growth"
            for c, g in d.groupby("Crop"):
                yrs = sorted(g["Crop_Year"].unique())
                if len(yrs) < 8:
                    continue
                early, late = g[g.Crop_Year.isin(yrs[:3])], g[g.Crop_Year.isin(yrs[-3:])]
                top.append({"name": c, "value": (_yield(late) / _yield(early) - 1) * 100,
                            "early_tha": _yield(early), "late_tha": _yield(late),
                            "period": f"{yrs[0]}-{yrs[2]} vs {yrs[-3]}-{yrs[-1]}"})
            top = sorted(top, key=lambda r: -r["value"])[:10]

        state_rows = sorted(self._by(d, "State", crop_selected), key=lambda r: -r["value"])
        season_rows = sorted(self._by(d, "Season", crop_selected), key=lambda r: -r["value"])
        year_rows = sorted(self._by(d_all[~d_all.Crop_Year.isin(self.partial_years)], "Crop_Year", crop_selected),
                           key=lambda r: r["name"])
        for r in year_rows:
            g = d_all[d_all.Crop_Year == r["name"]]
            r["area_kha"] = float(g["Area"].sum() / 1000)

        # Rainfall vs yield: needs a single crop to be meaningful
        rcrop = crop or d["Crop"].value_counts().index[0]
        rd = d[d.Crop == rcrop]
        sample = rd.sample(min(700, len(rd)), random_state=0)
        bins = np.quantile(rd["Annual_Rainfall"], np.linspace(0, 1, 11)) if len(rd) > 20 else None
        binned = []
        if bins is not None:
            bins = np.unique(bins)
            cut = pd.cut(rd["Annual_Rainfall"], bins, include_lowest=True)
            for iv, g in rd.groupby(cut, observed=True):
                binned.append({"x": float(g["Annual_Rainfall"].mean()), "y": _yield(g), "records": int(len(g))})

        return {
            "kpis": kpis,
            "metric": metric,
            "crop_yield": crop_yield,
            "top_crops": top,
            "top_crops_mode": top_mode,
            "state_productivity": state_rows,
            "season_yield": season_rows,
            "year_trend": year_rows,
            "partial_years_excluded": self.partial_years,
            "rainfall_vs_yield": {
                "crop": rcrop, "crop_was_selected": crop_selected,
                "points": [{"x": float(r.Annual_Rainfall), "y": float(r.Yield)} for r in sample.itertuples()],
                "binned": binned,
                "correlation": float(np.corrcoef(rd["Annual_Rainfall"], rd["Yield"])[0, 1]) if len(rd) > 2 else None,
            },
            "temperature_vs_yield": {"available": False,
                                     "reason": "The source datasets contain no temperature measurements that "
                                               "can be matched by district and year, so this chart is not shown "
                                               "rather than built from invented values."},
            "empty": False,
        }

    def trends(self, crop="Rice", state=None, district=None):
        d = self.filter(state=state, crop=crop, district=district)
        d = d[~d.Crop_Year.isin(self.partial_years)]
        rows = []
        for y, g in d.groupby("Crop_Year"):
            rows.append({"year": int(y), "yield_tha": _yield(g), "area_kha": float(g["Area"].sum() / 1000),
                         "production_kt": float(g["Production"].sum() / 1000), "records": int(len(g)),
                         "rainfall_mm": float(g.drop_duplicates("State")["Annual_Rainfall"].mean())})
        slope = None
        if len(rows) >= 3:
            ys = np.array([r["yield_tha"] for r in rows]); xs = np.array([r["year"] for r in rows])
            slope = float(np.polyfit(xs, ys, 1)[0])
        return {"crop": crop, "state": state, "district": district, "series": rows,
                "trend_tha_per_year": slope, "partial_years_excluded": self.partial_years}
