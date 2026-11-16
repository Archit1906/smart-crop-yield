"""
C. Adaptive Basis Function Model - spline basis expansion + ridge regression.

    f(x) = w0 + Σ_j Σ_m  w_jm · φ_jm(x_j)

Each numeric feature x_j is expanded into cubic B-spline basis functions φ_jm whose knots are
placed at the *quantiles of the training data* (so basis resolution adapts to where data is
dense). A single ridge penalty α·||w||² (chosen by cross-validation) is applied to all weights.

How this differs from the GAM (gam_model.py):
  * Basis model : fixed B-spline basis, ONE global L2 penalty on coefficients, solved in closed
                  form by RidgeCV. No smoothness penalty, no per-term smoothing, no CIs.
  * GAM (pyGAM) : penalised regression splines with a *roughness* penalty on second differences
                  of each term, a separate smoothing parameter λ_j per term chosen by GCV,
                  fitted with PIRLS, and gives confidence intervals for each partial effect.
"""
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import SplineTransformer, StandardScaler
from sklearn.linear_model import RidgeCV

PARAMS = dict(n_knots=8, degree=3, knots="quantile")


def train(X_tr, y_tr):
    m = Pipeline([
        ("scale", StandardScaler()),
        ("splines", SplineTransformer(**PARAMS, extrapolation="linear")),
        ("ridge", RidgeCV(alphas=np.logspace(-3, 3, 13))),
    ])
    m.fit(X_tr, y_tr)
    return m


def n_basis(model):
    return int(model.named_steps["splines"].n_features_out_)
