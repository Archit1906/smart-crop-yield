"""Central configuration for the Smart Crop Yield Prediction backend."""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SAVED_MODELS_DIR = BASE_DIR / "saved_models"

# Raw sources (see README for provenance)
DISTRICT_CSV = RAW_DIR / "crop_production_district.csv"      # data.gov.in / DES district APY
STATE_RAIN_CSV = RAW_DIR / "crop_yield_state_rainfall.csv"    # Kaggle "Crop Yield in Indian States" (IMD rainfall)

# Cleaned, merged dataset written by preprocessing and read by the API
CLEAN_CSV = PROCESSED_DIR / "crop_yield.csv"

RANDOM_STATE = 42
TEST_SIZE = 0.15          # held-out test set (all models evaluated here)
VAL_SIZE = 0.15           # validation set (used only for ensemble / BMA weights + CART tuning)

# Minimum number of district-season records a crop needs to be modelled
MIN_RECORDS_PER_CROP = 1000

# Crops removed because their production unit cannot be converted to tonnes reliably
EXCLUDED_CROPS = {
    "Coconut": "Production reported in number of nuts, not tonnes",
    "Sannhamp": "Production unit (bales vs tonnes) is ambiguous in the source",
    "Oilseeds total": "Aggregate of other crops, not a crop",
}

# Production reported in bales -> tonnes conversion (Directorate of Economics & Statistics convention)
BALE_TO_TONNES = {
    "Cotton(lint)": 0.170,   # bales of 170 kg
    "Jute": 0.180,           # bales of 180 kg
    "Mesta": 0.180,          # bales of 180 kg
}

# Model input features (the API and the frontend form are driven by this list)
CATEGORICAL_INPUTS = ["State", "District", "Crop", "Season"]
NUMERIC_INPUTS = ["Crop_Year", "Area", "Annual_Rainfall"]

# Engineered model features (output of the preprocessing pipeline, in order)
MODEL_FEATURES = [
    "crop_te",            # crop-level mean log-yield
    "crop_season_te",     # crop x season mean, shrunk to crop
    "state_crop_te",      # state x crop mean, shrunk to crop
    "district_crop_te",   # district x crop mean, shrunk to state x crop
    "district_index",     # district productivity relative to crop baseline
    "Crop_Year",
    "log_area",
    "Annual_Rainfall",
]

FEATURE_LABELS = {
    "crop_te": "Crop baseline",
    "crop_season_te": "Crop × Season",
    "state_crop_te": "State × Crop",
    "district_crop_te": "District × Crop",
    "district_index": "District productivity",
    "Crop_Year": "Crop year",
    "log_area": "Cultivated area (log)",
    "Annual_Rainfall": "Annual rainfall",
}

MODEL_NAMES = {
    "cart": "CART (Decision Tree)",
    "boosting": "Gradient Boosting",
    "basis": "Adaptive Basis Function (Splines)",
    "gam": "Generalized Additive Model",
    "random_forest": "Random Forest",
    "voting": "Voting Ensemble",
    "weighted": "Weighted Ensemble",
    "bma": "Bayesian Model Averaging",
}
BASE_MODELS = ["cart", "boosting", "basis", "gam", "random_forest"]
