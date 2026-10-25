"""Real cooling degree days for bill periods. Server-to-server (engine key): it calls out to Open-Meteo."""

from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import weather
from app.db import get_session
from app.routers.bills import require_engine_key

router = APIRouter(tags=["weather"])


class Period(BaseModel):
    start: date
    end: date


class CddRequest(BaseModel):
    city: str = Field(min_length=2, max_length=80)
    state: str | None = Field(default=None, max_length=80)
    periods: list[Period] = Field(min_length=1, max_length=24)
    base_c: float = Field(default=weather.BASE_C, ge=15, le=30)


@router.post("/weather/cdd")
def cooling_degree_days(
    body: CddRequest,
    session: Session = Depends(get_session),
    x_engine_key: str | None = Header(default=None),
) -> dict:
    require_engine_key(x_engine_key)
    try:
        loc = weather.geocode(session, body.city, body.state)
        periods = [weather.period_cdd(session, loc, p.start, p.end, body.base_c) for p in body.periods]
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except weather.WeatherUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"location": loc, "base_c": body.base_c, "source": weather.SOURCE, "periods": periods}


class HeatRequest(BaseModel):
    city: str = Field(min_length=2, max_length=80)
    state: str | None = Field(default=None, max_length=80)
    periods: list[Period] = Field(min_length=1, max_length=24)


@router.post("/weather/heat-days")
def heatwave_days(
    body: HeatRequest,
    session: Session = Depends(get_session),
    x_engine_key: str | None = Header(default=None),
) -> dict:
    require_engine_key(x_engine_key)
    try:
        loc = weather.geocode(session, body.city, body.state)
        periods = [weather.heat_days(session, loc, p.start, p.end) for p in body.periods]
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except weather.WeatherUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"location": loc, "rule": weather.HEAT_RULE, "source": weather.SOURCE, "periods": periods}
