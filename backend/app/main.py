from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.engine import factors
from app import config  # noqa: F401  (loads the shared .env)
from app.routers import bills, engine, insights, statements, weather


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> dict:
    return {"status": "ok", "factor_set": factors.FACTOR_SET_VERSION, "grid_factor": factors.GRID_EF}


app.include_router(engine.router, prefix="/api/v1")
app.include_router(statements.router, prefix="/api/v1")
app.include_router(bills.router, prefix="/api/v1")
app.include_router(weather.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")
