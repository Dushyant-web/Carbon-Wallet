"""Bill extraction endpoint. Server-to-server only: the Next app calls it with the engine key."""

import hmac

from fastapi import APIRouter, Header, HTTPException, Query, Request

from app import config
from app.bills.acquire import UnsupportedFile
from app.bills.pipeline import extract

router = APIRouter(tags=["bills"])


def require_engine_key(x_engine_key: str | None) -> None:
    if not config.ENGINE_API_KEY:
        raise HTTPException(status_code=503, detail="ENGINE_API_KEY is not configured on the engine.")
    if not x_engine_key or not hmac.compare_digest(x_engine_key, config.ENGINE_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid engine key.")


@router.post("/bills/extract")
async def extract_bill(
    request: Request,
    allow_ai: bool = Query(default=False),
    x_engine_key: str | None = Header(default=None),
) -> dict:
    require_engine_key(x_engine_key)
    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload.")
    if len(data) > config.MAX_BILL_BYTES:
        raise HTTPException(status_code=413, detail="Bill files must be under 10 MB.")
    try:
        # CPU-bound OCR runs in a worker thread so the event loop stays responsive
        from starlette.concurrency import run_in_threadpool

        return await run_in_threadpool(extract, data, allow_ai=allow_ai)
    except UnsupportedFile as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc


@router.post("/fuel/extract")
async def extract_fuel_photo(
    request: Request,
    allow_ai: bool = Query(default=False),
    x_engine_key: str | None = Header(default=None),
) -> dict:
    """Reads litres, rupees and rate from a fuel pump display or receipt photo (server-to-server)."""
    require_engine_key(x_engine_key)
    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload.")
    if len(data) > config.MAX_BILL_BYTES:
        raise HTTPException(status_code=413, detail="Photos must be under 10 MB.")
    from starlette.concurrency import run_in_threadpool

    from app.fuel import extract_fuel

    try:
        return await run_in_threadpool(extract_fuel, data, allow_ai=allow_ai)
    except UnsupportedFile as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
