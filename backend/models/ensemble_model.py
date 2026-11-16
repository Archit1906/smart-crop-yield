"""
E. Ensemble learning.

1. Random Forest (bagging + random feature subsets):
       f̂(x) = (1/B) Σ_b T_b(x),   each tree T_b grown on a bootstrap sample.
2. Voting ensemble: equal-weight average of the base models' predictions (t/ha).
3. Weighted ensemble: weights ∝ 1 / validation-MSE of each base model, normalised to sum to 1.
"""
import numpy as np
from sklearn.ensemble import RandomForestRegressor

import config

RF_PARAMS = dict(n_estimators=120, max_features=0.6, min_samples_leaf=8, max_samples=0.6,
                 n_jobs=-1, random_state=config.RANDOM_STATE)


def train_random_forest(X_tr, y_tr):
    m = RandomForestRegressor(**RF_PARAMS)
    m.fit(X_tr, y_tr)
    return m


def voting_weights(model_keys):
    return {k: 1.0 / len(model_keys) for k in model_keys}


def inverse_mse_weights(val_mse: dict):
    inv = {k: 1.0 / v for k, v in val_mse.items()}
    z = sum(inv.values())
    return {k: v / z for k, v in inv.items()}


def combine(preds: dict, weights: dict):
    """Σ_k w_k · prediction_k  (predictions already in t/ha)."""
    return sum(weights[k] * np.asarray(preds[k]) for k in weights)
