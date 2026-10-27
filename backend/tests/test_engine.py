"""Golden tests: hand-computed numbers from Docs/system_design.md (Sharma household, Delhi)."""

from datetime import date

import pytest

from app.engine import merkle
from app.engine.calibration import Bill, ac_breakdown, calibrate
from app.engine.decomposition import AcPeriod, decompose
from app.engine.factors import GRID_EF, GWP_AR6
from app.engine.simulate import Scenario, refrigerant_kg, simulate

JAN = Bill(date(2026, 1, 1), date(2026, 2, 1), kwh=180, ac_hours=0)
MAY = Bill(date(2026, 5, 1), date(2026, 6, 1), kwh=420, ac_hours=186)


def test_grid_factor_is_cea_v22():
    assert GRID_EF == 0.6781  # CEA 0.675 kg CO2 + CH4 and N2O from the coal, in CO2e


def test_two_bill_calibration_matches_design_doc():
    cal = calibrate([JAN, MAY])
    assert cal.method == "regression"
    assert cal.baseload_kwh_day == pytest.approx(180 / 31, rel=1e-6)
    assert cal.ac_kw == pytest.approx(1.29, abs=0.005)
    br = ac_breakdown(MAY, cal)
    assert br["ac_kwh"] == pytest.approx(240.0, abs=0.1)
    assert br["ac_kg"] == pytest.approx(240.0 * GRID_EF, abs=0.1)  # 162.7 kg CO2e
    assert br["electricity_kg"] == pytest.approx(420.0 * GRID_EF, abs=0.1)  # the May bill: 420 kWh
    assert br["ac_share_pct"] == pytest.approx(57.1, abs=0.1)
    assert br["ac_kg_low"] <= br["ac_kg"] <= br["ac_kg_high"]


def test_single_bill_falls_back_with_wider_range():
    cal = calibrate([MAY], baseload_hint=5.8)
    assert cal.method == "single_bill"
    assert cal.ac_kw_high / cal.ac_kw > 1.3


def test_no_ac_bills_give_default_tier():
    assert calibrate([JAN]).method == "default"


def test_calibrated_kw_is_clamped():
    absurd = Bill(date(2026, 5, 1), date(2026, 6, 1), kwh=5000, ac_hours=10)
    assert calibrate([JAN, absurd]).ac_kw == 2.5


def test_lmdi_splits_heat_and_habit_exactly():
    before = AcPeriod(cdd=150, ac_hours=3.2 * 30, kw=1.29, ef=GRID_EF)
    after = AcPeriod(cdd=210, ac_hours=5.1 * 31, kw=1.29, ef=GRID_EF)
    out = decompose(before, after)
    eff = out["effects_kg"]
    assert eff["weather"] == pytest.approx(36.5 * GRID_EF / 0.675, abs=0.1)  # design doc used CO2 only
    assert eff["behaviour"] == pytest.approx(17.6, abs=0.1)
    assert eff["equipment"] == 0 and eff["grid"] == 0
    assert sum(eff.values()) == pytest.approx(out["total_change_kg"], abs=0.15)


def test_simulator_two_hours_less_matches_doc():
    out = simulate(Scenario(ac_kw=1.29, ac_hours_per_day=6, days=31, hours_reduction_per_day=2))
    assert out["ac_saved_kwh"] == pytest.approx(80.0, abs=0.1)
    assert out["ac_saved_kg"] == pytest.approx(80.0 * GRID_EF, abs=0.1)
    assert out["inr_saved"] == 560


def test_simulator_no_change_saves_nothing():
    out = simulate(Scenario(ac_kw=1.29, ac_hours_per_day=6))
    assert out["total_saved_kg"] == 0


def test_setpoint_range_brackets_central():
    out = simulate(Scenario(ac_kw=1.29, ac_hours_per_day=6, setpoint_from_c=22, setpoint_to_c=25))
    assert out["ac_saved_kg_low"] < out["ac_saved_kg"] < out["ac_saved_kg_high"]


def test_refrigerant_top_up():
    assert refrigerant_kg("R32", 1.0, GWP_AR6) == 771.0


@pytest.mark.parametrize("n", [1, 2, 3, 7, 16, 33])
def test_merkle_proofs_verify_and_reject_tampering(n):
    statements = [{"household_ref": f"hh_{i}", "total_kg": 100 + i} for i in range(n)]
    salts = [merkle.new_salt() for _ in statements]
    leaves = [merkle.leaf(s, salt) for s, salt in zip(statements, salts)]
    root, proofs = merkle.build(leaves)
    for i in range(n):
        assert merkle.verify(proofs[i], root, leaves[i])
    tampered = dict(statements[0], total_kg=1)
    assert not merkle.verify(proofs[0], root, merkle.leaf(tampered, salts[0]))
