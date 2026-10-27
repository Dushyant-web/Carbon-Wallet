"""Machine-learned forecasts. Server-to-server only (engine key): the website sends anonymous per-home rows."""

from __future__ import annotations

import threading
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_session
from app.ml import forecast
from app.ml.weather_features import FALLBACK_SOURCE, city_cdd
from app.routers.bills import require_engine_key
from app import weather

router = APIRouter(tags=["ml"])


class MonthKg(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    kg: float = Field(ge=0, le=100_000)


class HomeIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(default="", max_length=80)
    people: int = Field(ge=1, le=50)
    ac_kw: float = Field(default=0, ge=0, le=100)
    ac_count: int = Field(default=0, ge=0, le=50)
    appliance_kw: float = Field(default=0, ge=0, le=500)
    months: list[MonthKg] = Field(max_length=120)


class TrainIn(BaseModel):
    homes: list[HomeIn] = Field(min_length=1, max_length=20_000)


class PredictIn(BaseModel):
    homes: list[HomeIn] = Field(min_length=1, max_length=500)


def _homes(rows: list[HomeIn]) -> list[forecast.Home]:
    return [
        forecast.Home(r.id, r.city, r.state, r.people, r.ac_kw, r.ac_count, r.appliance_kw, {m.month: m.kg for m in r.months})
        for r in rows
    ]


def _cdd(session: Session, homes: list[forecast.Home], extra_month: bool) -> tuple[dict[str, dict[str, float]], str]:
    by_city: dict[str, tuple[str, set[str]]] = {}
    for h in homes:
        state, months = by_city.setdefault(h.city.lower(), (h.state, set()))
        for m in h.kg:
            months.update({m, forecast.month_add(m, -1)})
        if extra_month and h.kg:
            months.add(forecast.month_add(max(h.kg), 1))
    out, real = {}, []
    for city, (state, months) in by_city.items():
        out[city], ok = city_cdd(session, city, state, sorted(months))
        real.append(ok)
    source = weather.SOURCE + ", base 24 °C" if real and all(real) else FALLBACK_SOURCE if not any(real) else "mixed: weather archive where reachable, climate normals elsewhere"
    return out, source


# one training at a time; serverless callers (Netlify) can't wait, so they ask for it to run in the background
_training: dict = {"running": False, "started_at": None, "finished_at": None, "error": None}
_training_lock = threading.Lock()


def _train(homes: list[forecast.Home], session: Session) -> dict:
    cdd, source = _cdd(session, homes, extra_month=False)
    model = forecast.train(homes, cdd, source)
    forecast.save(model)
    return model.info


def _train_in_background(homes: list[forecast.Home]) -> None:
    try:
        with SessionLocal() as session:
            _train(homes, session)
        _training["error"] = None
    except Exception as exc:  # reported on the status endpoint
        _training["error"] = str(exc)[:300]
    finally:
        _training["running"] = False
        _training["finished_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")


@router.post("/ml/forecast/train")
def train(
    body: TrainIn,
    background: bool = Query(default=False),
    session: Session = Depends(get_session),
    x_engine_key: str | None = Header(default=None),
) -> dict:
    require_engine_key(x_engine_key)
    homes = _homes(body.homes)
    if background:
        with _training_lock:
            if _training["running"]:
                return {"started": False, "running": True, "started_at": _training["started_at"]}
            _training.update(running=True, started_at=datetime.now(timezone.utc).isoformat(timespec="seconds"), error=None)
        threading.Thread(target=_train_in_background, args=(homes,), daemon=True).start()
        return {"started": True, "running": True, "started_at": _training["started_at"]}
    try:
        return _train(homes, session)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/ml/forecast/status")
def status(x_engine_key: str | None = Header(default=None)) -> dict:
    require_engine_key(x_engine_key)
    model = forecast.load()
    return {"trained": model is not None, "info": model.info if model else None, "training": dict(_training)}


@router.post("/ml/forecast/predict")
def predict(body: PredictIn, session: Session = Depends(get_session), x_engine_key: str | None = Header(default=None)) -> dict:
    require_engine_key(x_engine_key)
    model = forecast.load()
    if model is None:
        raise HTTPException(status_code=409, detail="The forecast model hasn't been trained yet.")
    homes = _homes(body.homes)
    cdd, source = _cdd(session, homes, extra_month=True)
    out = []
    for h in homes:
        if not h.kg:
            continue
        p = forecast.predict(model, h, forecast.month_add(max(h.kg), 1), cdd.get(h.city.lower(), {}))
        if p:
            out.append(p)
    return {"forecasts": out, "weather": source, "model": {k: model.info[k] for k in ("version", "trained_at", "beats_baseline", "held_out")}}
