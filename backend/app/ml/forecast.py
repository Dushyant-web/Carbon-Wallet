"""Next month's CO₂ for each home: a machine-learned forecast with its reasons.

What it learns
    For every home and month it sees the three months before, the same month a year earlier, how many people
    live there, the cooling power of its ACs, and how hot that month and the one before were (cooling degree
    days from the ERA5 weather archive at the home's city). It predicts the *change* from last month, so one
    model serves small flats and big houses alike: forecast = last month + predicted change.

Model
    scikit-learn histogram gradient-boosted trees (fast enough to retrain on tens of thousands of home-months in a
    few seconds): one for the expected change, two quantile models (10th and 90th percentile) for a likely range. SHAP (TreeExplainer) splits each forecast's change into reasons in kg
    ("hotter month +38 kg"), and the reasons add up exactly to the predicted change.

Honesty
    Every training run is scored on months it never saw (each home's last two months), against two simple
    baselines: "same as last month" and "same as this month last year". The model is only worth showing if it
    beats them; the scores are returned so the admin page can say so. On the demo data the homes are
    synthetic; real bills are needed before the numbers mean anything about real homes.
"""

from __future__ import annotations

import calendar
import math
import os
import threading
from dataclasses import dataclass
from datetime import date, datetime, timezone

import numpy as np

FEATURES = [
    "lag1", "lag2", "lag3", "known_lags", "lag12", "has_lag12", "trend", "month_sin", "month_cos",
    "people", "ac_kw", "ac_count", "appliance_kw", "cdd", "cdd_prev", "cdd_change",
]
LABELS = {
    "lag1": "Last month's level",
    "lag2": "Two months ago",
    "lag3": "Three months ago",
    "known_lags": "Months of recent history",
    "lag12": "Same month last year",
    "has_lag12": "A year of history",
    "trend": "Recent trend",
    "month_sin": "Time of year",
    "month_cos": "Time of year",
    "people": "People in the home",
    "ac_kw": "AC cooling power",
    "ac_count": "Number of ACs",
    "appliance_kw": "Other appliances",
    "cdd": "How hot the month is",
    "cdd_prev": "How hot last month was",
    "cdd_change": "Hotter or cooler than last month",
}
LABELS_HI = {
    "Last month's level": "पिछले महीने का स्तर",
    "Two months ago": "दो महीने पहले",
    "Three months ago": "तीन महीने पहले",
    "Months of recent history": "हाल के महीनों का रिकॉर्ड",
    "Same month last year": "पिछले साल इसी महीने",
    "A year of history": "एक साल का रिकॉर्ड",
    "Recent trend": "हाल का रुझान",
    "Time of year": "मौसम / साल का समय",
    "People in the home": "घर में लोग",
    "AC cooling power": "एसी की ताक़त",
    "Number of ACs": "एसी की संख्या",
    "Other appliances": "दूसरे उपकरण",
    "How hot the month is": "महीने की गर्मी",
    "How hot last month was": "पिछले महीने की गर्मी",
    "Hotter or cooler than last month": "पिछले महीने से ज़्यादा/कम गर्मी",
}

MIN_ROWS = 60
MIN_TRAIN_LAGS = 2  # training rows need last month and at least one more; predictions only need last month
TEST_MONTHS = 2


def month_add(m: str, k: int) -> str:
    y, mo = int(m[:4]), int(m[5:7])
    idx = y * 12 + (mo - 1) + k
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


def month_days(m: str) -> int:
    return calendar.monthrange(int(m[:4]), int(m[5:7]))[1]


@dataclass
class Home:
    id: str
    city: str
    state: str
    people: int
    ac_kw: float
    ac_count: int
    appliance_kw: float
    kg: dict[str, float]  # month → kg CO₂


def features_for(home: Home, target: str, cdd: dict[str, float]) -> list[float] | None:
    """The feature row for predicting `target` from what was known before it (None without last month).
    Real homes skip months (a bill not added yet): a missing month two or three back takes the nearer one."""
    lag1 = home.kg.get(month_add(target, -1))
    if lag1 is None:
        return None
    raw2, raw3 = home.kg.get(month_add(target, -2)), home.kg.get(month_add(target, -3))
    lag2 = raw2 if raw2 is not None else lag1
    lag3 = raw3 if raw3 is not None else lag2
    known = 1 + (raw2 is not None) + (raw3 is not None)
    lag12 = home.kg.get(month_add(target, -12))
    mo = int(target[5:7])
    c, cp = cdd.get(target, 0.0), cdd.get(month_add(target, -1), 0.0)
    return [
        lag1, lag2, lag3, float(known), lag12 if lag12 is not None else lag1, 1.0 if lag12 is not None else 0.0, lag1 - lag3,
        math.sin(2 * math.pi * mo / 12), math.cos(2 * math.pi * mo / 12),
        float(home.people), home.ac_kw, float(home.ac_count), home.appliance_kw, c, cp, c - cp,
    ]


def _models():
    from sklearn.ensemble import HistGradientBoostingRegressor

    common = {"max_iter": 300, "max_depth": 4, "learning_rate": 0.05, "min_samples_leaf": 20, "random_state": 7}
    return (
        HistGradientBoostingRegressor(loss="squared_error", **common),
        HistGradientBoostingRegressor(loss="quantile", quantile=0.1, **common),
        HistGradientBoostingRegressor(loss="quantile", quantile=0.9, **common),
    )


def _dataset(homes: list[Home], cdd_by_city: dict[str, dict[str, float]], months_filter=None):
    X, y, base, meta = [], [], [], []
    for h in homes:
        for m in sorted(h.kg):
            if months_filter and not months_filter(h, m):
                continue
            row = features_for(h, m, cdd_by_city.get(h.city.lower(), {}))
            if row is None or row[FEATURES.index("known_lags")] < MIN_TRAIN_LAGS:
                continue
            X.append(row)
            y.append(h.kg[m] - row[0])  # change from last month
            base.append(row[0])
            meta.append((h.id, m))
    return np.array(X, dtype=float), np.array(y, dtype=float), np.array(base, dtype=float), meta


def _scores(actual: np.ndarray, pred: np.ndarray) -> dict:
    err = np.abs(actual - pred)
    mape = float(np.mean(err / np.maximum(actual, 1.0)) * 100)
    ss_res = float(np.sum((actual - pred) ** 2))
    ss_tot = float(np.sum((actual - actual.mean()) ** 2)) or 1.0
    return {"mae_kg": round(float(err.mean()), 1), "mape_pct": round(mape, 1), "r2": round(1 - ss_res / ss_tot, 3)}


class ForecastModel:
    def __init__(self, models, info: dict):
        self.mean, self.low, self.high = models
        self.info = info
        self._explainer = None

    def explainer(self):
        if self._explainer is None:
            import shap

            self._explainer = shap.TreeExplainer(self.mean)
        return self._explainer


def train(homes: list[Home], cdd_by_city: dict[str, dict[str, float]], weather_source: str) -> ForecastModel:
    last_month = {h.id: max(h.kg) for h in homes if h.kg}

    def is_test(h: Home, m: str) -> bool:
        return m > month_add(last_month[h.id], -TEST_MONTHS)

    Xtr, ytr, _, _ = _dataset(homes, cdd_by_city, lambda h, m: not is_test(h, m))
    Xte, yte, bte, meta_te = _dataset(homes, cdd_by_city, is_test)
    if len(Xtr) < MIN_ROWS:
        raise ValueError(f"Need at least {MIN_ROWS} home-months with three months of history before them; have {len(Xtr)}.")

    held_out = None
    if len(Xte):
        mean, _, _ = _models()
        mean.fit(Xtr, ytr)
        actual = bte + yte
        model_pred = bte + mean.predict(Xte)
        naive = bte  # same as last month
        seasonal = np.where(Xte[:, FEATURES.index("has_lag12")] > 0, Xte[:, FEATURES.index("lag12")], bte)
        held_out = {
            "rows": int(len(Xte)),
            "model": _scores(actual, model_pred),
            "same_as_last_month": _scores(actual, naive),
            "same_month_last_year": _scores(actual, seasonal),
        }

    # the model that is used: refit on everything
    Xall, yall, _, meta_all = _dataset(homes, cdd_by_city)
    models = _models()
    for m in models:
        m.fit(Xall, yall)
    # what it pays attention to: each feature's share of the mean |SHAP| over a sample of rows
    import shap

    sample = Xall[np.random.default_rng(7).choice(len(Xall), size=min(2000, len(Xall)), replace=False)]
    mean_abs = np.abs(np.asarray(shap.TreeExplainer(models[0]).shap_values(sample))).mean(axis=0)
    shares = mean_abs / (mean_abs.sum() or 1)
    importances = sorted(
        ({"feature": f, "label": LABELS[f], "importance": round(float(v), 4)} for f, v in zip(FEATURES, shares)),
        key=lambda d: -d["importance"],
    )
    months = sorted({m for _, m in meta_all})
    info = {
        "version": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "algorithm": "Gradient-boosted trees (scikit-learn HistGradientBoostingRegressor), 10th/90th percentile range, SHAP reasons",
        "target": "Change in a home's monthly kg CO₂ from the month before",
        "homes": len({h for h, _ in meta_all}),
        "rows": int(len(Xall)),
        "months": {"from": months[0], "to": months[-1]} if months else None,
        "weather": weather_source,
        "held_out": held_out,
        "beats_baseline": bool(held_out and held_out["model"]["mae_kg"] < held_out["same_as_last_month"]["mae_kg"]),
        "importances": importances,
    }
    return ForecastModel(models, info)


def predict(model: ForecastModel, home: Home, target: str, cdd: dict[str, float]) -> dict | None:
    row = features_for(home, target, cdd)
    if row is None:
        return None
    X = np.array([row], dtype=float)
    change = float(model.mean.predict(X)[0])
    lo, hi = float(model.low.predict(X)[0]), float(model.high.predict(X)[0])
    lo, hi = min(lo, change), max(hi, change)
    last = row[0]
    shap_values = np.asarray(model.explainer().shap_values(X))[0]
    base_change = float(np.ravel(model.explainer().expected_value)[0])

    # reasons in kg; the two "time of year" features are one reason to a reader
    by_label: dict[str, float] = {}
    for f, v in zip(FEATURES, shap_values):
        by_label[LABELS[f]] = by_label.get(LABELS[f], 0.0) + float(v)
    reasons = sorted(({"label": k, "label_hi": LABELS_HI.get(k, k), "kg": round(v, 1)} for k, v in by_label.items()), key=lambda r: -abs(r["kg"]))
    top = [r for r in reasons if abs(r["kg"]) >= 0.5][:5]
    return {
        "home_id": home.id,
        "month": target,
        "last_month": month_add(target, -1),
        "last_kg": round(last, 1),
        "kg": round(max(0.0, last + change), 1),
        "low_kg": round(max(0.0, last + lo), 1),
        "high_kg": round(max(0.0, last + hi), 1),
        "change_kg": round(change, 1),
        "typical_change_kg": round(base_change, 1),
        "reasons": top,
        "model_version": model.info["version"],
    }


# --- the trained model, kept in memory and on disk -----------------------------------------------------------
_lock = threading.Lock()
_current: ForecastModel | None = None


def _path() -> str:
    d = os.getenv("ML_MODEL_DIR") or os.path.join(os.path.dirname(__file__), "..", "..", ".models")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "forecast.joblib")


def save(model: ForecastModel) -> None:
    import joblib

    global _current
    with _lock:
        _current = model
        joblib.dump({"models": (model.mean, model.low, model.high), "info": model.info}, _path())


def load() -> ForecastModel | None:
    global _current
    with _lock:
        if _current is None and os.path.exists(_path()):
            import joblib

            try:
                saved = joblib.load(_path())  # only ever a file this engine wrote itself
                _current = ForecastModel(saved["models"], saved["info"])
            except Exception:
                _current = None
        return _current


def next_month(today: date | None = None) -> str:
    t = today or date.today()
    return f"{t.year:04d}-{t.month:02d}"
