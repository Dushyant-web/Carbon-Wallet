"""Database setup. PostgreSQL in deployment (DATABASE_URL=postgresql+psycopg://...),
SQLite file by default so the API runs locally with zero setup."""

import os
from collections.abc import Iterator
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./carbon_wallet.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class AnchorBatch(Base):
    __tablename__ = "anchor_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    merkle_root: Mapped[str] = mapped_column(String(66))
    factor_set_version: Mapped[str] = mapped_column(String(32))
    factor_set_hash: Mapped[str] = mapped_column(String(66))
    chain: Mapped[str] = mapped_column(String(32))
    tx_hash: Mapped[str] = mapped_column(String(66))
    n_statements: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # on a public chain (null on the local devnet)
    chain_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contract: Mapped[str | None] = mapped_column(String(42), nullable=True)
    chain_batch_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # the contract's batch index
    block_number: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Statement(Base):
    __tablename__ = "statements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    household_ref: Mapped[str] = mapped_column(String(64), index=True)
    period: Mapped[str] = mapped_column(String(7))
    payload: Mapped[dict] = mapped_column(JSON)
    statement_hash: Mapped[str] = mapped_column(String(66))
    salt: Mapped[str] = mapped_column(String(128))  # AES-GCM encrypted (app/saltbox.py); deleting it crypto-shreds the leaf
    leaf: Mapped[str] = mapped_column(String(66))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("anchor_batches.id"), nullable=True)
    proof: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WeatherCache(Base):
    """Geocodes and daily temperatures from Open-Meteo. Past weather never changes, so entries don't expire."""

    __tablename__ = "weather_cache"

    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


def init_db() -> None:
    Base.metadata.create_all(engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """create_all never alters existing tables: add any newer nullable columns to a database made before them."""
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name not in have and col.nullable:
                    conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN "{col.name}" {col.type.compile(engine.dialect)}'))


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
