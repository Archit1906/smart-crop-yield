"""
D. Generalized Additive Model (pyGAM LinearGAM).

    g(E[y]) = β0 + f1(x1) + f2(x2) + ... + fp(xp)       (identity link, Gaussian errors)

Each f_j is a penalised B-spline smooth. The fit minimises
    ||y - Xβ||² + Σ_j λ_j · β_jᵀ D_jᵀ D_j β_j
where D_j are second-difference matrices (wiggliness penalty). λ is chosen by grid-searching
the Generalised Cross-Validation (GCV) score. Partial-dependence curves f_j(x_j) with 95%
confidence intervals are exported for the frontend.
"""
import numpy as np
from pygam import LinearGAM, s

N_SPLINES = 15


def train(X_tr, y_tr, fit_rows=60000, random_state=42):
    X = np.asarray(X_tr, dtype=float)
    y = np.asarray(y_tr, dtype=float)
    terms = s(0, n_splines=N_SPLINES)
    for j in range(1, X.shape[1]):
        terms = terms + s(j, n_splines=N_SPLINES)
    gam = LinearGAM(terms)
    # Smoothing selection by GCV on a random subset (keeps the grid search fast), then refit on all rows.
    rng = np.random.default_rng(random_state)
    idx = rng.choice(len(X), size=min(fit_rows, len(X)), replace=False)
    gam.gridsearch(X[idx], y[idx], lam=np.logspace(-2, 3, 6), progress=False)
    best_lam = gam.lam
    gam = LinearGAM(terms, lam=best_lam).fit(X, y)
    return gam


def partial_effects(gam, feature_names, labels, x_transform=None):
    """Feature-wise partial dependence curves + 95% CI (on the log-yield scale)."""
    effects = []
    for i, f in enumerate(feature_names):
        XX = gam.generate_X_grid(term=i, n=60)
        pdp, ci = gam.partial_dependence(term=i, X=XX, width=0.95)
        x = XX[:, i]
        if x_transform and f in x_transform:
            x = x_transform[f](x)
        effects.append({"feature": f, "label": labels.get(f, f),
                        "points": [{"x": float(a), "effect": float(b), "lo": float(c[0]), "hi": float(c[1])}
                                   for a, b, c in zip(x, pdp, ci)]})
    return effects


def summary(gam):
    st = gam.statistics_
    return {"edof": float(st["edof"]), "GCV": float(st["GCV"]), "AIC": float(st["AIC"]),
            "pseudo_r2_explained_deviance": float(st["pseudo_r2"]["explained_deviance"]),
            "lam": [float(np.ravel(l)[0]) for l in gam.lam]}
