"""
F. Bayesian Model Averaging (approximate).

Exact BMA:   p(y | x, D) = Σ_k p(y | x, M_k, D) · p(M_k | D),
             p(M_k | D) ∝ p(D | M_k) · p(M_k)

We do NOT integrate over each model's parameters (that would need a full posterior for trees,
boosting, etc.). Instead, following the common "predictive BMA" approximation:

  * Each fitted model M_k is treated as a Gaussian predictive model on the log1p(yield) scale:
        y_i ~ N( f_k(x_i), σ_k² ),   σ_k² = mean squared validation residual of M_k (MLE).
  * Its marginal likelihood is approximated by the held-out (validation) log-likelihood:
        log p(D_val | M_k) ≈ Σ_i log N(y_i ; f_k(x_i), σ_k²)
                           = -n/2 · [ log(2π σ_k²) + 1 ]
  * Uniform prior p(M_k) = 1/K.
  * Posterior weights:  w_k = exp(ℓ_k - max ℓ) / Σ_j exp(ℓ_j - max ℓ)   (softmax, numerically stable)
  * Final prediction (t/ha):  ŷ = Σ_k w_k · ŷ_k

Because the validation set is large, the likelihood differences are large and the posterior
concentrates on the best model - this is the expected behaviour of BMA (it selects rather than
mixes as n grows). We additionally report per-observation weights (ℓ_k / n) for interpretability;
those are a "tempered" diagnostic only and are not used for the BMA prediction.
"""
import numpy as np


def compute_weights(y_val_log, val_preds_log: dict, prior: dict | None = None):
    keys = list(val_preds_log)
    K = len(keys)
    prior = prior or {k: 1.0 / K for k in keys}
    n = len(y_val_log)
    details = {}
    loglik = {}
    for k in keys:
        r = np.asarray(y_val_log) - np.asarray(val_preds_log[k])
        sigma2 = float(np.mean(r ** 2))
        ll = float(-0.5 * n * (np.log(2 * np.pi * sigma2) + 1.0))
        loglik[k] = ll + np.log(prior[k])
        details[k] = {"sigma2_log": sigma2, "log_likelihood": ll, "prior": prior[k],
                      "mean_loglik_per_obs": ll / n}
    mx = max(loglik.values())
    unnorm = {k: np.exp(v - mx) for k, v in loglik.items()}
    z = sum(unnorm.values())
    weights = {k: float(v / z) for k, v in unnorm.items()}

    # Tempered (per-observation) diagnostic weights
    per_obs = {k: details[k]["mean_loglik_per_obs"] for k in keys}
    mx2 = max(per_obs.values())
    t = {k: np.exp(v - mx2) for k, v in per_obs.items()}
    z2 = sum(t.values())
    for k in keys:
        details[k]["posterior_weight"] = weights[k]
        details[k]["tempered_weight"] = float(t[k] / z2)
    return weights, details, n


def predict(preds_tha: dict, weights: dict):
    return sum(weights[k] * np.asarray(preds_tha[k]) for k in weights)
