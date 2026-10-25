"""Insight endpoints: Shapley attribution (pure maths) and plain-English bullets (LLM, engine key)."""

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.db import get_session
from app.engine.attribution import shapley
from app.engine.narrate import narrate
from app.routers.bills import require_engine_key

router = APIRouter(tags=["insights"])


class ShapleyIn(BaseModel):
    months: list[str] = Field(min_length=2, max_length=36)
    sources: list[str] = Field(min_length=1, max_length=40)
    matrix: list[list[float]]  # months × sources, kg CO2e


@router.post("/insights/shapley")
async def shapley_attribution(body: ShapleyIn) -> dict:
    if len(body.matrix) != len(body.months) or any(len(r) != len(body.sources) for r in body.matrix):
        raise HTTPException(status_code=422, detail="matrix must be months × sources")
    try:
        out = await run_in_threadpool(shapley, body.sources, body.matrix)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"months": body.months, **out}


class NarrateIn(BaseModel):
    facts: dict
    bullets: int = Field(default=4, ge=2, le=6)


@router.post("/insights/narrate")
async def narrate_facts(
    body: NarrateIn,
    session: Session = Depends(get_session),
    x_engine_key: str | None = Header(default=None),
) -> dict:
    require_engine_key(x_engine_key)
    return await run_in_threadpool(narrate, session, body.facts, body.bullets)
