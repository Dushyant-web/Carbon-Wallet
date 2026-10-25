"""Statement hashing and an OpenZeppelin-compatible Merkle tree (sorted-pair keccak256).

See Docs/blockchain.md §2–4. Leaves are double-hashed and salted so low-entropy carbon numbers
can't be guessed from on-chain data.
"""

import json
import secrets

from Crypto.Hash import keccak as _keccak


def keccak(data: bytes) -> bytes:
    h = _keccak.new(digest_bits=256)
    h.update(data)
    return h.digest()


def canonical_json(obj: dict) -> bytes:
    # Sorted keys, no whitespace: a practical subset of RFC 8785 for our flat payloads.
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def new_salt() -> bytes:
    return secrets.token_bytes(32)


def _js_stable(v):
    """Numbers as a browser writes them: 286.0 → 286. A statement shown on a web page and sent back for
    checking goes through JavaScript, which drops the ".0"; hashing this form makes that round trip harmless."""
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, dict):
        return {k: _js_stable(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_js_stable(x) for x in v]
    return v


def _as_floats(v):
    """The form statements were hashed in before the JavaScript-stable one: every number a float."""
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, int):
        return float(v)
    if isinstance(v, dict):
        return {k: _as_floats(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_as_floats(x) for x in v]
    return v


def statement_hash(statement: dict) -> bytes:
    return keccak(canonical_json(_js_stable(statement)))


def leaf(statement: dict, salt: bytes) -> bytes:
    return keccak(keccak(salt + statement_hash(statement)))


def candidate_leaves(statement: dict, salt: bytes) -> list[bytes]:
    """Leaves a genuine statement can have: today's form, then the older all-floats form (statements sealed
    before the change). Both encode the very same numbers, so accepting either can't let anyone alter one."""
    legacy = keccak(keccak(salt + keccak(canonical_json(_as_floats(statement)))))
    current = leaf(statement, salt)
    return [current] if legacy == current else [current, legacy]


def _parent(a: bytes, b: bytes) -> bytes:
    return keccak(min(a, b) + max(a, b))


def build(leaves: list[bytes]) -> tuple[bytes, list[list[bytes]]]:
    """Return (root, proof for each leaf)."""
    if not leaves:
        raise ValueError("cannot build a tree with no leaves")
    level = list(leaves)
    proofs: list[list[bytes]] = [[] for _ in leaves]
    idx = list(range(len(leaves)))
    while len(level) > 1:
        nxt = [
            _parent(level[i], level[i + 1]) if i + 1 < len(level) else level[i]
            for i in range(0, len(level), 2)
        ]
        for j, p in enumerate(idx):
            sib = p ^ 1
            if sib < len(level):
                proofs[j].append(level[sib])
            idx[j] = p // 2
        level = nxt
    return level[0], proofs


def verify(proof: list[bytes], root: bytes, leaf_hash: bytes) -> bool:
    h = leaf_hash
    for p in proof:
        h = _parent(h, p)
    return h == root
