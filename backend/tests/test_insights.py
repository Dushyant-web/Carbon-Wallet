import numpy as np
import pytest

from app.engine import attribution
from app.engine.narrate import check_bullets


def test_shap_values_add_up_and_match_the_shapley_formula():
    rng = np.random.default_rng(7)
    X = rng.uniform(5, 120, size=(12, 6)).round(1)
    out = attribution.shapley([f"s{i}" for i in range(6)], X.tolist())
    vals = np.array(out["values"])
    # efficiency: base + sum of Shapley values = each month's total
    assert np.allclose(out["base_kg"] + vals.sum(axis=1), X.sum(axis=1), atol=0.1)
    # for an additive model each value is that source's kg minus its average
    assert np.allclose(vals, X - X.mean(axis=0), atol=0.02)
    assert "SHAP" in out["method"]


def test_many_sources_are_pooled_into_everything_else():
    X = np.arange(1, 13 * 15 + 1, dtype=float).reshape(13, 15)
    out = attribution.shapley([f"s{i}" for i in range(15)], X.tolist())
    assert len(out["sources"]) == attribution.MAX_SOURCES and out["sources"][-1] == "Everything else"
    assert sum(out["source_totals"]) == pytest.approx(X.sum(), abs=1)


def test_needs_at_least_two_months():
    with pytest.raises(ValueError):
        attribution.shapley(["a"], [[1.0]])


def test_llm_bullets_with_invented_numbers_are_dropped():
    facts = {"total_kg": 286, "avg_kg": 301.5, "drivers": [{"source": "Car", "kg": 4.8}], "share_pct": 52}
    text = (
        "Here you go:\n- Your home made 286 kg of CO2 this month.\n- That is 15.5 kg below your 301.5 kg average.\n"
        "- Your car added 4.8 kg.\n- Electricity is 52% of the total.\n- You could save 999 kg by magic."
    )
    out = check_bullets(text, facts)
    assert "Your home made 286 kg of CO2 this month." in out
    assert "Your car added 4.8 kg." in out
    assert not any("999" in b for b in out)
    assert not any("15.5" in b for b in out)  # computed by the model, not in the facts
