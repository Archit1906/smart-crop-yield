# Smart Crop Yield Prediction System

An ML-powered agricultural analytics web app for **Unit 5 – Combining Models**. It predicts the yield (**tonnes per hectare**) of a crop for an Indian district, season and year. It runs five trained regression models and three model-combination methods, all in a Python/Flask backend, and shows the results in a React dashboard.

> Every number in the app (predictions, metrics, charts, landing-page statistics) is computed from real data by the backend. Nothing is hard-coded.

---

## 1. Dataset

| Source | What it gives | Rows |
|---|---|---|
| **Crop Production in India** – Directorate of Economics & Statistics, Ministry of Agriculture (data.gov.in; identical to Kaggle `crop_production.csv`) | State, District, Crop_Year, Season, Crop, Area (ha), Production (t) – 1997–2015 | 246,091 |
| **Crop Yield in Indian States** (Kaggle, akshatgupta7) | `Annual_Rainfall` (mm) per **state and year** (IMD-derived) | 19,689 |

The two are joined on **State + Crop_Year**. Raw files: `backend/data/raw/`. Cleaned, merged file: `backend/data/processed/crop_yield.csv`.

**Why this dataset:** it is the only openly available real source with **district-level** detail, which the prediction form needs. The rainfall join adds a real environmental variable without inventing anything.

### Target
`Yield = Production / Area`, recomputed for every row (t/ha). Models are trained on `log(1 + Yield)` because yields range from about 0.1 t/ha (pulses) to about 100 t/ha (sugarcane). Predictions are converted back, and **all metrics are reported in t/ha**.

### Features used (7 raw inputs → 8 model features)
| Raw input | Model feature(s) |
|---|---|
| Crop | `crop_te` – smoothed mean log-yield of the crop |
| Crop + Season | `crop_season_te` (shrunk toward crop) |
| State + Crop | `state_crop_te` (shrunk toward crop) |
| District + Crop | `district_crop_te` (shrunk toward state × crop) |
| District | `district_index` – district productivity relative to crop baselines |
| Crop_Year | `Crop_Year` |
| Area (ha) | `log_area` |
| Annual_Rainfall (mm) | `Annual_Rainfall` |

Categories are encoded with a **hierarchical, smoothed target encoder** (`backend/preprocessing/preprocess.py`): `enc = (n·mean + m·enc(parent)) / (n + m)`, with m = 10. During training it uses **5-fold cross-fitting**, so a row never sees its own target value (no target leakage). Unseen combinations at prediction time fall back up the hierarchy. The same saved pipeline object is used for training and prediction.

### What was deliberately NOT used (and why)
| Column | Reason |
|---|---|
| Production | Used to compute the target → **data leakage** |
| Kaggle `Fertilizer`, `Pesticide` | They are exactly `Area × one constant per year` (correlation with Area = 0.9733), so they are not real measurements |
| Kaggle `Yield` | Does not equal Production/Area for most rows; recomputed instead |
| Temperature, humidity, soil N/P/K, pH | **Not available** in any source that can be matched by district and year. They are not invented, and the form does not ask for them |

### Cleaning log (from the actual run)
| Step | Removed | Remaining | Note |
|---|---|---|---|
| missing production | 3,730 | 242,361 | Rows with missing Production/Area dropped (target cannot be computed). |
| duplicates | 0 | 242,361 | Exact duplicates and duplicate State/District/Year/Season/Crop keys removed. |
| zero values | 3,523 | 238,838 | Rows with zero Production or Area dropped (ambiguous: failure vs. non-reporting). |
| unit exclusions | 4,511 | 234,327 | Coconut: Production reported in number of nuts, not tonnes; Sannhamp: Production unit (bales vs tonnes) is ambiguous in the source; Oilseeds total: Aggregate of other crops, not a crop |
| rainfall join | 17,498 | 216,829 | Inner join on State + Crop_Year. States/years without a rainfall record (e.g. Rajasthan, Chandigarh, A&N Islands, Dadra & Nagar Haveli, Telangana before 2013) are excluded rather than imputed. |
| rare crops | 9,912 | 206,917 | Crops with fewer than 1000 records removed. |
| outliers | 936 | 205,981 | Area < 1 ha removed; per-crop log-yield outside [Q1 - 3·IQR, Q3 + 3·IQR] removed. |

Unit conversions: Cotton (lint) bales × 0.17 t; Jute and Mesta bales × 0.18 t. Final dataset: **205,981 records, 43 crops, 613 districts, 29 states/UTs, 1997–2015.**

---

## 2. Unit 5 algorithms

| Topic | File | Implementation |
|---|---|---|
| **CART** | `models/cart_model.py` | `DecisionTreeRegressor`, depth/leaf size tuned on validation; top 3 levels exported for the tree visual |
| **Boosting** | `models/boosting_model.py` | `GradientBoostingRegressor` (400 trees, lr 0.08, depth 5, subsample 0.8); stage-wise validation curve |
| **Adaptive basis functions** | `models/basis_function_model.py` | `StandardScaler → SplineTransformer(8 knots at data quantiles, cubic) → RidgeCV` |
| **GAM** | `models/gam_model.py` | pyGAM `LinearGAM`, one penalised spline per feature, λ by GCV grid search; partial-dependence curves with 95% CIs |
| **Ensembles** | `models/ensemble_model.py` | Random Forest (bagging) + **Voting** (equal weights) + **Weighted** (∝ 1/validation MSE) |
| **BMA** | `models/bayesian_averaging.py` | Approximate BMA, described below |

**Splines vs GAM:** the basis model uses a fixed B-spline basis with one global L2 penalty, solved in closed form. The GAM adds a roughness (second-difference) penalty to each term, picks λ per term by GCV, fits with PIRLS, and provides confidence intervals.

**Approximate Bayesian Model Averaging:** each fitted model is treated as a Gaussian predictive model on the log scale, `y ~ N(f_k(x), σ_k²)`, with σ_k² = mean squared validation residual. The validation log-likelihood `ℓ_k = −(n/2)[log(2πσ_k²) + 1]` stands in for the marginal likelihood, and the prior is uniform. Posterior weights are `softmax(ℓ_k)`, and the final prediction is `Σ_k P(M_k|D) · ŷ_k`. No parameter posterior is integrated, so this is an **approximation**. With n = 30,898 validation rows the likelihood gaps are thousands of units, so the posterior puts its weight on one model (Random Forest = 1.0000). This is the expected behaviour of BMA with large n: it selects rather than mixes. The app also shows "tempered" per-observation weights as a diagnostic only.

Split: train 144,185 / validation 30,898 / test 30,898 (stratified by crop). Combination weights use **validation only**, and every model is scored on the **same test set**.

---

## 3. Results (test set, yield in t/ha)

| Algorithm | R² | MAE | MSE | RMSE | R² (log scale) |
|---|---|---|---|---|---|
| CART (Decision Tree) | 0.9294 | 0.804 | 10.635 | 3.261 | 0.9594 |
| Gradient Boosting | 0.9341 | 0.759 | 9.941 | 3.153 | 0.9639 |
| Adaptive Basis Function (Splines) | 0.9177 | 0.870 | 12.403 | 3.522 | 0.9542 |
| Generalized Additive Model | 0.9178 | 0.869 | 12.389 | 3.520 | 0.9543 |
| Random Forest | 0.9346 | 0.716 | 9.860 | 3.140 | 0.9667 |
| Voting Ensemble | 0.9319 | 0.764 | 10.265 | 3.204 | 0.9627 |
| Weighted Ensemble | 0.9327 | 0.757 | 10.150 | 3.186 | 0.9632 |
| Bayesian Model Averaging | 0.9346 | 0.716 | 9.860 | 3.140 | 0.9667 |

How to read these results:
- **Best single model: Random Forest.** BMA ties with it because its posterior weight is ≈ 1.
- The voting and weighted ensembles beat CART, the spline model and the GAM, but **not** Random Forest or Gradient Boosting. Combining models does not always improve accuracy, and the app shows the real numbers.
- The overall R² is high partly because yields differ hugely *between* crops. **Within one crop**, the best model's R² ranges from about 0.45 (potato) to 0.88 (wheat), with a median absolute error of 9–19%. The Models page has the full per-crop table.
- The strongest predictor by far is the district's historical yield for that crop. Rainfall (state-level annual) adds only a little.

---

## 4. Running the project locally

### Prerequisites
- Python 3.10+ (tested on 3.13)
- Node.js 18+ (tested on 22)

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

# Train (≈3 min). Pre-trained models are already in saved_models/, but retrain if your
# scikit-learn version differs from the one used to train them (see metrics.json → versions).
python -m training.train

python app.py          # → http://127.0.0.1:5000/api/health
```

### Frontend (second terminal)
```bash
cd frontend
npm install
npm run dev            # → http://localhost:5173  (proxies /api to port 5000)
```
For a production build: `npm run build && npm run preview` (http://localhost:4173, also proxied). To point at a backend on another host, set `VITE_API_URL=http://host:5000` before building.

### Tests
```bash
cd backend
python -m unittest discover -s tests -v     # 11 API tests
```

> **Pickle compatibility:** joblib model files are tied to the scikit-learn version that created them (here 1.9.1). If `app.py` logs a version warning or fails to load the models, run `python -m training.train` again. The data and code are deterministic (random_state = 42), so you get the same results.

---

## 5. API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Backend and model status |
| GET | `/api/metadata` | States, districts per state, crops, seasons per crop, valid ranges, recorded state-year rainfall, form schema, unsupported features, cleaning log |
| POST | `/api/predict` | Body: `{"State","District","Crop","Season","Crop_Year","Area","Annual_Rainfall"}` → predictions from all 8 models, BMA/ensemble weights, model spread, rainfall sensitivity curve, district history. Returns **422** with field-level errors for invalid input |
| GET | `/api/model-metrics` | Test metrics + all visualisation data (tree, boosting curve, GAM effects, residuals, actual-vs-predicted, BMA details, per-crop errors) |
| GET | `/api/analytics?state=&crop=&season=&year=` | KPIs and chart data from the real dataset |
| GET | `/api/feature-importance` | Impurity (tree models) and permutation importance (all base models) + partial dependence |
| GET | `/api/historical-trends?crop=&state=&district=` | Year-wise yield, area and production |

Example:
```bash
curl -X POST http://127.0.0.1:5000/api/predict -H "Content-Type: application/json" \
  -d '{"State":"Punjab","District":"Ludhiana","Crop":"Wheat","Season":"Rabi","Crop_Year":2012,"Area":250000,"Annual_Rainfall":620}'
```

---

## 6. Project structure
```
smart-crop-yield/
├── backend/
│   ├── app.py                     Flask REST API
│   ├── config.py                  paths, constants, feature lists
│   ├── requirements.txt
│   ├── data/raw/                  original CSVs (district statistics, state rainfall)
│   ├── data/processed/            cleaned merged dataset (written by training)
│   ├── preprocessing/preprocess.py   cleaning + CropFeatureBuilder (target encoder)
│   ├── models/                    one module per Unit 5 algorithm
│   ├── training/train.py          end-to-end training / evaluation / export
│   ├── saved_models/              *.joblib models + metrics/insights/metadata JSON
│   ├── utils/predictor.py         loads artifacts, validates input, predicts
│   ├── utils/analytics.py         dataset analytics
│   └── tests/test_api.py
├── frontend/
│   ├── src/pages/                 Landing, Predict, Analytics, Models, HowItWorks
│   ├── src/components/            Navbar, Footer, UI primitives, SVG illustration
│   ├── src/charts/                Recharts components (tree, effects, residuals, …)
│   ├── src/services/              API client, data hook, theme
│   ├── package.json, vite.config.js
└── README.md
```

## 7. Limitations
- Data covers **1997–2015**. The models cannot extrapolate to later years, so the year input is limited to this range. **2015 is only partly reported** in the source and is left out of trend charts.
- Rainfall is a **state-level annual** figure: every district in a state shares one value per year.
- States without rainfall records (Rajasthan, Chandigarh, A&N Islands, Dadra & Nagar Haveli, and Telangana before 2013) are excluded.
- Predictions are statistical estimates based on history, **not guaranteed outcomes**. They ignore irrigation, soil, pests, input use and in-season weather.
