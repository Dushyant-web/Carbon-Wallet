"""Bill calibration: fit baseload `b` (kWh/day) and effective AC power `k` (kW) from bills.

    kWh_m = b * days_m + k * H_m          (H_m = AC hours in bill period m)

Two or more bills with different AC hours give a least-squares fit. One bill falls back to
an appliance-inventory baseload. See Docs/system_design.md §5.3.
"""

from dataclasses import dataclass
from datetime import date

from .factors import GRID_EF

K_MIN, K_MAX = 0.3, 2.5
DEFAULT_BASELOAD_KWH_DAY = 5.0


@dataclass(frozen=True)
class Bill:
    period_start: date
    period_end: date
    kwh: float
    ac_hours: float

    @property
    def days(self) -> int:
        return (self.period_end - self.period_start).days


@dataclass(frozen=True)
class Calibration:
    baseload_kwh_day: float
    ac_kw: float
    ac_kw_low: float
    ac_kw_high: float
    method: str
    n_bills: int


def calibrate(bills: list[Bill], baseload_hint: float | None = None) -> Calibration:
    if not bills:
        raise ValueError("at least one bill is required")
    if any(b.days <= 0 for b in bills):
        raise ValueError("bill period_end must be after period_start")

    with_ac = [b for b in bills if b.ac_hours > 0]
    distinct_hours = {round(b.ac_hours / b.days, 3) for b in bills}

    if len(bills) >= 2 and with_ac and len(distinct_hours) >= 2:
        # Least squares on [days, H] without intercept, via 2x2 normal equations.
        sdd = sum(b.days * b.days for b in bills)
        sdh = sum(b.days * b.ac_hours for b in bills)
        shh = sum(b.ac_hours * b.ac_hours for b in bills)
        sdy = sum(b.days * b.kwh for b in bills)
        shy = sum(b.ac_hours * b.kwh for b in bills)
        det = sdd * shh - sdh * sdh
        if abs(det) > 1e-9:
            b_hat = (shh * sdy - sdh * shy) / det
            k_hat = (sdd * shy - sdh * sdy) / det
            if b_hat < 0:  # constrain baseload to be non-negative
                b_hat = 0.0
                k_hat = shy / shh
            k = _clamp(k_hat)
            spread = 0.15 if len(bills) == 2 else _relative_se(bills, b_hat, k)
            return Calibration(b_hat, k, k * (1 - spread), k * (1 + spread), "regression", len(bills))

    if not with_ac:
        b_only = sum(b.kwh for b in bills) / sum(b.days for b in bills)
        return Calibration(b_only, 1.0, 0.45, 1.40, "default", len(bills))

    # Single informative bill: assume baseload, attribute the rest to AC.
    base = baseload_hint if baseload_hint is not None else DEFAULT_BASELOAD_KWH_DAY
    latest = max(with_ac, key=lambda b: b.period_end)
    k = _clamp((latest.kwh - base * latest.days) / latest.ac_hours)
    return Calibration(base, k, k * 0.65, k * 1.35, "single_bill", len(bills))


def ac_breakdown(bill: Bill, cal: Calibration, ef: float = GRID_EF) -> dict:
    ac_kwh = min(bill.kwh, cal.ac_kw * bill.ac_hours)
    return {
        "electricity_kwh": round(bill.kwh, 2),
        "electricity_kg": round(bill.kwh * ef, 1),
        "ac_kwh": round(ac_kwh, 1),
        "ac_kg": round(ac_kwh * ef, 1),
        "ac_kg_low": round(min(bill.kwh, cal.ac_kw_low * bill.ac_hours) * ef, 1),
        "ac_kg_high": round(min(bill.kwh, cal.ac_kw_high * bill.ac_hours) * ef, 1),
        "ac_share_pct": round(100 * ac_kwh / bill.kwh, 1) if bill.kwh else 0.0,
        "residual_kwh": round(bill.kwh - ac_kwh, 1),
    }


def _clamp(k: float) -> float:
    return max(K_MIN, min(K_MAX, k))


def _relative_se(bills: list[Bill], b: float, k: float) -> float:
    n = len(bills)
    resid = [bl.kwh - (b * bl.days + k * bl.ac_hours) for bl in bills]
    rmse = (sum(r * r for r in resid) / max(1, n - 2)) ** 0.5
    mean_ac = sum(k * bl.ac_hours for bl in bills) / n or 1.0
    return max(0.08, min(0.5, rmse / mean_ac))
