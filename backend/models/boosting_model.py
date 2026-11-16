"""
B. Boosting - Gradient Boosting Regressor.

Additive model built stage-wise:  F_m(x) = F_{m-1}(x) + ν · h_m(x)
where each weak learner h_m (a shallow regression tree) is fitted to the negative gradient of
the squared-error loss, i.e. the current residuals  r_i = y_i - F_{m-1}(x_i).
ν is the learning rate (shrinkage). `subsample < 1` gives stochastic gradient boosting.
"""
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

import config

PARAMS = dict(n_estimators=400, learning_rate=0.08, max_depth=5, subsample=0.8,
              min_samples_leaf=20, random_state=config.RANDOM_STATE)


def train(X_tr, y_tr):
    m = GradientBoostingRegressor(**PARAMS)
    m.fit(X_tr, y_tr)
    return m


def staged_curve(model, X_tr, y_tr, X_va, y_va, every=10):
    """Validation / training MSE after each boosting stage -> shows sequential improvement."""
    out = []
    tr_iter = model.staged_predict(X_tr)
    for i, (p_va, p_tr) in enumerate(zip(model.staged_predict(X_va), tr_iter), start=1):
        if i == 1 or i % every == 0:
            out.append({"stage": i,
                        "val_mse_log": float(np.mean((y_va - p_va) ** 2)),
                        "train_mse_log": float(np.mean((y_tr - p_tr) ** 2))})
    return out
