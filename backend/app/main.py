from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.engine import factors
from app import config  # noqa: F401  (loads the shared .env)
import os

from app.routers import bills, engine, events, insights, ml, statements, weather
from app.signing import EngineSignatureMiddleware


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Carbon Wallet API",
    version="0.1.0",
    description="Calculation engine (calibration, LMDI, simulation) and statement anchoring.",
    lifespan=lifespan,
)

# Browsers reach the engine only through the website (same origin); list extra origins in CORS_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)
app.add_middleware(EngineSignatureMiddleware)


@app.get("/api/v1/health")
def health() -> dict:
    return {"status": "ok", "factor_set": factors.FACTOR_SET_VERSION, "grid_factor": factors.GRID_EF}


app.include_router(engine.router, prefix="/api/v1")
app.include_router(statements.router, prefix="/api/v1")
app.include_router(bills.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(weather.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")
app.include_router(ml.router, prefix="/api/v1")
