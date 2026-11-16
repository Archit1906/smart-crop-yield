"""
A. CART - Classification and Regression Trees (regression variant).

A DecisionTreeRegressor recursively splits the feature space with axis-aligned thresholds,
choosing at each node the split that maximises the reduction in squared error:
    Δ = SSE(parent) - [SSE(left) + SSE(right)]
Leaves predict the mean (log-)yield of their training samples.
"""
import numpy as np
from sklearn.tree import DecisionTreeRegressor
from sklearn.metrics import mean_squared_error

import config


def tune_and_train(X_tr, y_tr, X_va, y_va):
    """Pick max_depth / min_samples_leaf on the validation set (simple grid search)."""
    grid = [(d, l) for d in (6, 8, 10, 12, 14, 18) for l in (5, 20, 50)]
    results = []
    best, best_mse = None, np.inf
    for depth, leaf in grid:
        m = DecisionTreeRegressor(max_depth=depth, min_samples_leaf=leaf, random_state=config.RANDOM_STATE)
        m.fit(X_tr, y_tr)
        mse = mean_squared_error(y_va, m.predict(X_va))
        results.append({"max_depth": depth, "min_samples_leaf": leaf, "val_mse_log": float(mse)})
        if mse < best_mse:
            best, best_mse = m, mse
    return best, results


def export_tree(model, feature_names, labels, max_depth=3):
    """Export the top `max_depth` levels of the fitted tree as nested JSON for the frontend."""
    t = model.tree_

    def node(i, depth):
        value_log = float(t.value[i][0][0])
        n = {"samples": int(t.n_node_samples[i]),
             "value_log": round(value_log, 4),
             "value_tha": round(float(np.expm1(value_log)), 3)}
        if t.children_left[i] == -1 or depth >= max_depth:
            n["leaf"] = bool(t.children_left[i] == -1)
            n["truncated"] = bool(t.children_left[i] != -1)
            return n
        f = feature_names[t.feature[i]]
        n.update({"feature": f, "label": labels.get(f, f), "threshold": round(float(t.threshold[i]), 4),
                  "left": node(t.children_left[i], depth + 1),
                  "right": node(t.children_right[i], depth + 1)})
        return n

    return node(0, 0)
