"""Monthly carbon statements, Merkle anchoring and public verification (Docs/blockchain.md).

Issuing, sealing and reading statements need the engine key (only the app's server calls them, after its own
login and role checks; the numbers come from its database, never from a browser). Verifying is public.
"""

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import saltbox
from app.chain import ChainError, EvmChain, explorer_tx_url, get_chain
from app.db import AnchorBatch, Statement, get_session, utcnow
from app.engine import factors, merkle
from app.routers.bills import require_engine_key

router = APIRouter(tags=["statements"])


class StatementIn(BaseModel):
    household_ref: str = Field(min_length=1, max_length=64)
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    total_kg: float = Field(ge=0)
    by_category: dict[str, float] = Field(default_factory=dict)
    verified_reductions_kg: float = Field(default=0, ge=0)


class VerifyIn(BaseModel):
    statement: dict
    salt: str
    proof: list[str]
    batch_id: int


def _hex(b: bytes) -> str:
    return "0x" + b.hex()


def _unhex(s: str) -> bytes:
    return bytes.fromhex(s[2:] if s.startswith("0x") else s)


def _factor_set_hash() -> bytes:
    return merkle.keccak(merkle.canonical_json({"version": factors.FACTOR_SET_VERSION, "factors": factors.registry_as_dicts()}))


def _anchor_info(batch: AnchorBatch) -> dict:
    return {
        "merkle_root": batch.merkle_root,
        "chain": batch.chain,
        "tx_hash": batch.tx_hash,
        "factor_set": batch.factor_set_version,
        "anchored_at": batch.created_at.isoformat(),
        "chain_id": batch.chain_id,
        "contract": batch.contract,
        "chain_batch_id": batch.chain_batch_id,
        "block_number": batch.block_number,
        "explorer_url": explorer_tx_url(batch.chain, batch.tx_hash),
    }


def _bundle(st: Statement, batch: AnchorBatch | None) -> dict:
    return {
        "id": st.id,
        "statement": st.payload,
        "salt": saltbox.open_salt(st.salt),
        "leaf": st.leaf,
        "proof": st.proof or [],
        "batch_id": st.batch_id,
        "anchor": None if batch is None else _anchor_info(batch),
    }


@router.post("/statements", status_code=201)
def issue_statement(body: StatementIn, session: Session = Depends(get_session), x_engine_key: str | None = Header(default=None)) -> dict:
    require_engine_key(x_engine_key)
    payload = {
        "type": "CarbonStatement/v1",
        "household_ref": body.household_ref,
        "period": body.period,
        "total_kg": round(body.total_kg, 1),
        "by_category": {k: round(v, 1) for k, v in sorted(body.by_category.items())},
        "verified_reductions_kg": round(body.verified_reductions_kg, 1),
        "factor_set": factors.FACTOR_SET_VERSION,
        "grid_factor": factors.GRID_EF,
        "issued_at": utcnow().isoformat(timespec="seconds"),
    }
    salt = merkle.new_salt()
    st = Statement(
        id=str(uuid.uuid4()),
        household_ref=body.household_ref,
        period=body.period,
        payload=payload,
        statement_hash=_hex(merkle.statement_hash(payload)),
        salt=saltbox.seal(_hex(salt)),
        leaf=_hex(merkle.leaf(payload, salt)),
    )
    session.add(st)
    session.commit()
    return _bundle(st, None)


@router.post("/anchors", status_code=201)
def anchor_pending(session: Session = Depends(get_session), x_engine_key: str | None = Header(default=None)) -> dict:
    require_engine_key(x_engine_key)
    pending = session.scalars(select(Statement).where(Statement.batch_id.is_(None)).order_by(Statement.created_at)).all()
    if not pending:
        raise HTTPException(status_code=409, detail="no unanchored statements")
    leaves = [_unhex(s.leaf) for s in pending]
    root, proofs = merkle.build(leaves)
    fs_hash = _factor_set_hash()
    try:
        chain = get_chain()
    except Exception as exc:  # RPC unreachable, wrong chain id
        raise HTTPException(status_code=502, detail=f"Can't reach the chain: {exc}") from exc

    batch = AnchorBatch(
        merkle_root=_hex(root),
        factor_set_version=factors.FACTOR_SET_VERSION,
        factor_set_hash=_hex(fs_hash),
        chain=chain.name,
        tx_hash="pending",
        n_statements=len(pending),
        status="pending",
    )
    session.add(batch)
    session.flush()
    periods = ",".join(sorted({s.period for s in pending}))
    try:
        receipt = chain.anchor(root, fs_hash, batch.id, periods, factors.FACTOR_SET_VERSION)
    except ChainError as exc:
        session.rollback()  # the statements stay unanchored, ready for the next attempt
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    batch.tx_hash = receipt.tx_hash
    batch.chain_id = receipt.chain_id
    batch.contract = receipt.contract
    batch.chain_batch_id = receipt.chain_batch_id
    batch.block_number = receipt.block_number
    batch.status = "confirmed"
    for st, proof in zip(pending, proofs):
        st.batch_id = batch.id
        st.proof = [_hex(p) for p in proof]
    session.commit()
    return {
        "batch_id": batch.id,
        "merkle_root": batch.merkle_root,
        "n_statements": batch.n_statements,
        "chain": batch.chain,
        "tx_hash": batch.tx_hash,
        "factor_set": batch.factor_set_version,
        "factor_set_hash": batch.factor_set_hash,
        "chain_id": batch.chain_id,
        "contract": batch.contract,
        "chain_batch_id": batch.chain_batch_id,
        "block_number": batch.block_number,
        "explorer_url": explorer_tx_url(batch.chain, batch.tx_hash),
    }


@router.get("/anchors")
def list_anchors(session: Session = Depends(get_session)) -> list[dict]:
    rows = session.scalars(select(AnchorBatch).order_by(AnchorBatch.id.desc()).limit(20)).all()
    return [
        {
            "batch_id": b.id,
            "merkle_root": b.merkle_root,
            "n_statements": b.n_statements,
            "chain": b.chain,
            "tx_hash": b.tx_hash,
            "created_at": b.created_at.isoformat(),
        }
        for b in rows
    ]


@router.get("/statements")
def list_statement_status(household_ref: str, session: Session = Depends(get_session), x_engine_key: str | None = Header(default=None)) -> list[dict]:
    """Anchoring status per period for one household: no payloads or salts (the app's server fetches a bundle by
    statement id, after its own membership check)."""
    require_engine_key(x_engine_key)
    rows = session.scalars(
        select(Statement).where(Statement.household_ref == household_ref).order_by(Statement.created_at)
    ).all()
    latest: dict[str, Statement] = {}
    for st in rows:
        prev = latest.get(st.period)
        if prev is None or (st.batch_id is not None) or prev.batch_id is None:
            latest[st.period] = st
    out = []
    for period, st in sorted(latest.items()):
        batch = session.get(AnchorBatch, st.batch_id) if st.batch_id else None
        out.append(
            {
                "period": period,
                "anchored": batch is not None,
                "batch_id": st.batch_id,
                "merkle_root": batch.merkle_root if batch else None,
                "tx_hash": batch.tx_hash if batch else None,
                "chain": batch.chain if batch else None,
                "statement_id": st.id,
                "explorer_url": explorer_tx_url(batch.chain, batch.tx_hash) if batch else None,
            }
        )
    return out


@router.get("/statements/{statement_id}")
def get_statement(statement_id: str, session: Session = Depends(get_session), x_engine_key: str | None = Header(default=None)) -> dict:
    require_engine_key(x_engine_key)
    st = session.get(Statement, statement_id)
    if st is None:
        raise HTTPException(status_code=404, detail="statement not found")
    batch = session.get(AnchorBatch, st.batch_id) if st.batch_id else None
    return _bundle(st, batch)


@router.post("/verify")
def verify_statement(body: VerifyIn, session: Session = Depends(get_session)) -> dict:
    batch = session.get(AnchorBatch, body.batch_id)
    if batch is None:
        return {"valid": False, "reason": "No anchor batch with this id."}
    try:
        candidates = merkle.candidate_leaves(body.statement, _unhex(body.salt))
        proof = [_unhex(p) for p in body.proof]
    except ValueError:
        return {"valid": False, "reason": "Malformed salt or proof."}
    root = _unhex(batch.merkle_root)
    leaf = next((c for c in candidates if merkle.verify(proof, root, c)), candidates[0])
    ok = merkle.verify(proof, root, leaf)
    # Ask the contract too when this batch is on the public chain we're connected to
    onchain = None
    if ok and batch.chain_batch_id is not None:
        try:
            chain = get_chain()
            if isinstance(chain, EvmChain) and chain.chain_id == batch.chain_id:
                onchain = chain.verify_onchain(batch.chain_batch_id, proof, leaf)
        except Exception:
            onchain = None  # chain unreachable: the local check still stands, and we say so
    reason = (
        "Statement matches the anchored Merkle root."
        if ok
        else "Statement does not match the anchored root — it was altered or never issued."
    )
    if onchain is False:
        ok, reason = False, "The public chain does not confirm this statement."
    return {
        "onchain": onchain,
        "explorer_url": explorer_tx_url(batch.chain, batch.tx_hash),
        "block_number": batch.block_number,
        "valid": ok,
        "reason": reason,
        "merkle_root": batch.merkle_root,
        "chain": batch.chain,
        "tx_hash": batch.tx_hash,
        "factor_set": batch.factor_set_version,
        "anchored_at": batch.created_at.isoformat(),
    }


class ShredIn(BaseModel):
    household_ref: str = Field(min_length=1, max_length=64)


@router.post("/statements/shred")
def shred_statements(body: ShredIn, session: Session = Depends(get_session), x_engine_key: str | None = Header(default=None)) -> dict:
    """Erase a household's statements, salts included (Docs/blockchain.md: crypto-shredding). The Merkle roots
    stay on-chain, but without the salts nothing can ever be matched to this household again."""
    require_engine_key(x_engine_key)
    rows = session.scalars(select(Statement).where(Statement.household_ref == body.household_ref)).all()
    for st in rows:
        session.delete(st)
    session.commit()
    return {"deleted": len(rows)}
