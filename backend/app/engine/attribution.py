"""Which sources made a month high or low: Shapley values (SHAP) over a household's own months.

Model: a month's total kg = sum over sources (bills, each vehicle, flights, food, waste, ...). Background:
the household's own months, so the base value is its average month and each source's Shapley value says how
many kg that source added or removed compared with an average month. Values always add up exactly:
base + sum(values) = that month's total.

We use the `shap` library's exact explainer. For an additive model the Shapley value of a source is
also available in closed form (its kg minus its average), which is the fallback and what the tests check.
"""

from __future__ import annotations

import numpy as np

MAX_SOURCES = 10  # beyond this, the smallest sources are pooled into "Everything else"


def _pool(sources: list[str], matrix: np.ndarray) -> tuple[list[str], np.ndarray]:
    if len(sources) <= MAX_SOURCES:
        return sources, matrix
    order = np.argsort(-matrix.sum(axis=0))
    keep, rest = order[: MAX_SOURCES - 1], order[MAX_SOURCES - 1 :]
    pooled = np.column_stack([matrix[:, keep], matrix[:, rest].sum(axis=1)])
    return [sources[i] for i in keep] + ["Everything else"], pooled


def _total(x: np.ndarray) -> np.ndarray:
    return np.asarray(x).sum(axis=1)


def shapley(sources: list[str], matrix: list[list[float]]) -> dict:
    """matrix[m][s] = kg from source s in month m. Returns base value and per-month Shapley values."""
    X = np.asarray(matrix, dtype=float)
    if X.ndim != 2 or X.shape[0] < 2 or X.shape[1] != len(sources):
        raise ValueError("need at least two months and one column per source")
    names, X = _pool(list(sources), X)
    try:
        import shap

        masker = shap.maskers.Independent(X, max_samples=X.shape[0])
        explanation = shap.explainers.Exact(_total, masker)(X)
        values = np.asarray(explanation.values)
        base = float(np.asarray(explanation.base_values).reshape(-1)[0])
        method = f"SHAP {shap.__version__} exact explainer"
    except Exception:  # library unavailable: same numbers from the Shapley formula for an additive model
        base = float(X.sum(axis=1).mean())
        values = X - X.mean(axis=0)
        method = "Shapley values (closed form for an additive model)"
    return {
        "sources": names,
        "base_kg": round(base, 1),
        "values": [[round(float(v), 2) for v in row] for row in values],
        "totals": [round(float(t), 1) for t in X.sum(axis=1)],
        "source_totals": [round(float(t), 1) for t in X.sum(axis=0)],
        "method": method,
    }
