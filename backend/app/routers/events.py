"""Blockchain v2: one Merkle root a day over the platform's own events (PLAN-V2 §13).

The website's server sends 32-byte leaf hashes (shop registrations, removal decisions, scheme help, area
totals); names, places, photos and numbers never leave it. The engine builds the same sorted-pair keccak tree
as for monthly statements, anchors the root through CarbonAnchor.sol (or the labelled local devnet), and hands
back the proofs so each event can later be checked against the chain.
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.chain import ChainError, explorer_tx_url, get_chain
from app.db import AnchorBatch, get_session
from app.engine import factors, merkle
from app.routers.bills import require_engine_key
from app.routers.statements import _factor_set_hash, _hex

router = APIRouter(tags=["events"])


class EventsIn(BaseModel):
    day: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    leaves: list[str] = Field(min_length=1, max_length=5000)


class ProofIn(BaseModel):
    root: str = Field(pattern=r"^0x[0-9a-f]{64}$")
    leaf: str = Field(pattern=r"^0x[0-9a-f]{64}$")
    proof: list[str] = Field(max_length=64)


def _leaf(h: str) -> bytes:
    raw = bytes.fromhex(h.removeprefix("0x"))
    if len(raw) != 32:
        raise HTTPException(status_code=422, detail="each leaf must be a 32-byte hash")
    return raw


@router.post("/events/anchor", status_code=201)
def anchor_events(body: EventsIn, session: Session = Depends(get_session), x_engine_key: str | None = Header(default=None)) -> dict:
    require_engine_key(x_engine_key)
    leaves = [_leaf(h) for h in body.leaves]
    root, proofs = merkle.build(leaves)
    fs_hash = _factor_set_hash()
    try:
        chain = get_chain()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Can't reach the chain: {exc}") from exc
    batch = AnchorBatch(
        merkle_root=_hex(root),
        factor_set_version=factors.FACTOR_SET_VERSION,
        factor_set_hash=_hex(fs_hash),
        chain=chain.name,
        tx_hash="pending",
        n_statements=0,
        status="pending",
    )
    session.add(batch)
    session.flush()
    try:
        receipt = chain.anchor(root, fs_hash, batch.id, f"events:{body.day}", factors.FACTOR_SET_VERSION)
    except ChainError as exc:
        session.rollback()
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    batch.tx_hash = receipt.tx_hash
    batch.chain_id = receipt.chain_id
    batch.contract = receipt.contract
    batch.chain_batch_id = receipt.chain_batch_id
    batch.block_number = receipt.block_number
    batch.status = "confirmed"
    session.commit()
    return {
        "batch_id": batch.id,
        "root": _hex(root),
        "proofs": [[_hex(p) for p in pr] for pr in proofs],
        "chain": batch.chain,
        "tx_hash": batch.tx_hash,
        "explorer_url": explorer_tx_url(batch.chain, batch.tx_hash),
    }


@router.post("/events/verify")
def verify_event(body: ProofIn) -> dict:
    """Public: does this leaf, with this proof, lead to this root?"""
    return {"valid": merkle.verify([_leaf(p) for p in body.proof], _leaf(body.root), _leaf(body.leaf))}
