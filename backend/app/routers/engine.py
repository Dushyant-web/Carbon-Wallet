from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.engine import factors
from app.engine.calibration import K_MAX, K_MIN, Bill, ac_breakdown, calibrate
from app.engine.decomposition import AcPeriod, decompose
from app.engine.simulate import Scenario, refrigerant_kg, simulate

router = APIRouter(tags=["engine"])


class BillIn(BaseModel):
    period_start: date
    period_end: date
    kwh: float = Field(ge=0, le=20000)
    ac_hours: float = Field(ge=0, le=24 * 95)


class CalibrationIn(BaseModel):
    bills: list[BillIn] = Field(min_length=1, max_length=24)
    baseload_hint_kwh_day: float | None = Field(default=None, ge=0, le=100)


class AcPeriodIn(BaseModel):
    cdd: float = Field(gt=0)
    ac_hours: float = Field(gt=0)
    kw: float = Field(gt=0, le=5)
    ef: float = Field(default=factors.GRID_EF, gt=0)


class DecompositionIn(BaseModel):
    before: AcPeriodIn
    after: AcPeriodIn


class SimulationIn(BaseModel):
    ac_kw: float = Field(gt=0, le=5)
    ac_hours_per_day: float = Field(ge=0, le=24)
    days: int = Field(default=30, ge=1, le=366)
    setpoint_from_c: float = Field(default=24, ge=16, le=30)
    setpoint_to_c: float = Field(default=24, ge=16, le=30)
    hours_reduction_per_day: float = Field(default=0, ge=0, le=24)
    car_km_per_trip_day: float = Field(default=0, ge=0, le=500)
    metro_days_per_week: float = Field(default=0, ge=0, le=7)
    tariff_inr_per_kwh: float = Field(default=7.0, ge=0, le=50)


class RefrigerantIn(BaseModel):
    refrigerant: str = Field(pattern="^(R32|R410A|R22)$")
    kg_added: float = Field(ge=0, le=10)


@router.get("/factors")
def list_factors() -> dict:
    return {
        "factor_set": factors.FACTOR_SET_VERSION,
        "grid_by_fy": factors.GRID_AVG_BY_FY,
        "factors": factors.registry_as_dicts(),
    }


@router.post("/calibration")
def run_calibration(body: CalibrationIn) -> dict:
    bills = [Bill(b.period_start, b.period_end, b.kwh, b.ac_hours) for b in body.bills]
    try:
        cal = calibrate(bills, body.baseload_hint_kwh_day)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    latest = max(bills, key=lambda b: b.period_end)
    return {
        "method": cal.method,
        "n_bills": cal.n_bills,
        "baseload_kwh_per_day": round(cal.baseload_kwh_day, 2),
        "ac_kw": round(cal.ac_kw, 2),
        "ac_kw_range": [round(cal.ac_kw_low, 2), round(cal.ac_kw_high, 2)],
        # True when the fit hit the plausible-AC bounds: the bills' AC hours probably need checking
        "at_limit": cal.method != "default" and (cal.ac_kw <= K_MIN or cal.ac_kw >= K_MAX),
        "latest_bill": ac_breakdown(latest, cal),
        "grid_factor": factors.GRID_EF,
        "factor_set": factors.FACTOR_SET_VERSION,
    }


@router.post("/decomposition")
def run_decomposition(body: DecompositionIn) -> dict:
    try:
        return decompose(AcPeriod(**body.before.model_dump()), AcPeriod(**body.after.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/simulation")
def run_simulation(body: SimulationIn) -> dict:
    return simulate(Scenario(**body.model_dump()))


@router.post("/refrigerant")
def run_refrigerant(body: RefrigerantIn) -> dict:
    kg = refrigerant_kg(body.refrigerant, body.kg_added, factors.GWP_AR6)
    return {"refrigerant": body.refrigerant, "kg_added": body.kg_added, "kg_co2e": kg, "gwp_set": "IPCC AR6"}
