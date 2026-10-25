"""What-if simulator. Same factors as the footprint math, so savings can't disagree with it."""

from dataclasses import dataclass

from .factors import GRID_EF, SETPOINT_SAVING_PER_C, SETPOINT_SAVING_RANGE, TRANSPORT

MAX_SETPOINT_SAVING = 0.6


@dataclass(frozen=True)
class Scenario:
    ac_kw: float
    ac_hours_per_day: float
    days: int = 30
    setpoint_from_c: float = 24
    setpoint_to_c: float = 24
    hours_reduction_per_day: float = 0
    car_km_per_trip_day: float = 0  # round-trip km on a commute day
    car_factor: float = TRANSPORT["car_petrol_hatch_lt1400"]
    metro_days_per_week: float = 0
    tariff_inr_per_kwh: float = 7.0
    ef: float = GRID_EF


def _setpoint_fraction(delta_c: float, per_c: float) -> float:
    return min(MAX_SETPOINT_SAVING, max(0.0, delta_c) * per_c)


def simulate(s: Scenario) -> dict:
    base_kwh = s.ac_kw * s.ac_hours_per_day * s.days
    hours_after = max(0.0, s.ac_hours_per_day - s.hours_reduction_per_day)
    delta_c = s.setpoint_to_c - s.setpoint_from_c

    def ac_after(per_c: float) -> float:
        return s.ac_kw * hours_after * s.days * (1 - _setpoint_fraction(delta_c, per_c))

    ac_saved_kwh = base_kwh - ac_after(SETPOINT_SAVING_PER_C)
    ac_saved_low = base_kwh - ac_after(SETPOINT_SAVING_RANGE[0])
    ac_saved_high = base_kwh - ac_after(SETPOINT_SAVING_RANGE[1])

    commute_days = s.metro_days_per_week * s.days / 7
    transport_saved_kg = s.car_km_per_trip_day * commute_days * (s.car_factor - TRANSPORT["metro_delhi_pkm"])

    ac_kg = ac_saved_kwh * s.ef
    total_kg = ac_kg + transport_saved_kg
    return {
        "baseline_ac_kwh": round(base_kwh, 1),
        "baseline_ac_kg": round(base_kwh * s.ef, 1),
        "ac_saved_kwh": round(ac_saved_kwh, 1),
        "ac_saved_kg": round(ac_kg, 1),
        "ac_saved_kg_low": round(ac_saved_low * s.ef, 1),
        "ac_saved_kg_high": round(ac_saved_high * s.ef, 1),
        "transport_saved_kg": round(transport_saved_kg, 1),
        "total_saved_kg": round(total_kg, 1),
        "inr_saved": round(ac_saved_kwh * s.tariff_inr_per_kwh),
        "annualised_kg": round(total_kg * 365 / s.days),
    }


def refrigerant_kg(refrigerant: str, kg_added: float, gwp: dict[str, float]) -> float:
    if refrigerant not in gwp:
        raise ValueError(f"unknown refrigerant {refrigerant}")
    if kg_added < 0:
        raise ValueError("kg_added must be non-negative")
    return round(kg_added * gwp[refrigerant], 1)
