"""The next-month forecast: learns a weather-driven pattern, beats the naive guess, and explains itself."""

import math
import random

import numpy as np

from app.ml import forecast
from app.ml.weather_features import normal_cdd


def _cdd(month: str) -> float:
    return normal_cdd(month)


def _homes(n=40, months=26, seed=3):  # two years: it must have seen each season change once
    rnd = random.Random(seed)
    homes, cdd = [], {}
    all_months = [forecast.month_add("2025-01", k) for k in range(months)]
    for m in all_months + [forecast.month_add(all_months[-1], 1)]:
        cdd[m] = _cdd(m)
    for i in range(n):
        ac_kw = rnd.choice([0, 1.2, 1.6, 2.4, 3.2])
        people = rnd.randint(2, 6)
        base = 60 * people
        kg = {}
        for m in all_months:
            kg[m] = base + ac_kw * cdd[m] * 0.9 + rnd.gauss(0, 6)  # hotter months → more AC
        homes.append(forecast.Home(f"h{i}", "Noida", "Uttar Pradesh", people, ac_kw, 1 if ac_kw else 0, 1.0, kg))
    return homes, {"noida": cdd}


def test_learns_and_beats_the_naive_guess():
    homes, cdd = _homes()
    model = forecast.train(homes, cdd, "test normals")
    ho = model.info["held_out"]
    assert ho and ho["rows"] > 0
    assert ho["model"]["mae_kg"] < ho["same_as_last_month"]["mae_kg"]
    assert model.info["beats_baseline"] is True
    top = [i["feature"] for i in model.info["importances"][:4]]
    assert any(f in top for f in ("cdd_change", "cdd", "ac_kw"))


def test_prediction_has_range_and_reasons_that_add_up():
    homes, cdd = _homes()
    model = forecast.train(homes, cdd, "test normals")
    h = max(homes, key=lambda x: x.ac_kw)
    target = forecast.month_add(max(h.kg), 1)
    p = forecast.predict(model, h, target, cdd["noida"])
    assert p and p["month"] == target
    assert p["low_kg"] <= p["kg"] <= p["high_kg"]
    # SHAP: typical change + every reason = predicted change (reasons shown are the biggest five)
    X = np.array([forecast.features_for(h, target, cdd["noida"])])
    shap_sum = float(np.asarray(model.explainer().shap_values(X))[0].sum())
    assert math.isclose(p["typical_change_kg"] + shap_sum, p["change_kg"], abs_tol=0.2)
    assert all({"label", "label_hi", "kg"} <= set(r) for r in p["reasons"])


def test_missing_months_still_forecast_but_need_last_month():
    homes, cdd = _homes(n=1)
    h = homes[0]
    last = max(h.kg)
    del h.kg[forecast.month_add(last, -1)]  # a gap two months before the target
    row = forecast.features_for(h, forecast.month_add(last, 1), cdd["noida"])
    assert row is not None and row[forecast.FEATURES.index("known_lags")] == 2
    assert forecast.features_for(h, forecast.month_add(last, 3), cdd["noida"]) is None


def test_normal_cdd_is_seasonal():
    assert normal_cdd("2026-06") > normal_cdd("2026-03") > normal_cdd("2026-01") >= 0
