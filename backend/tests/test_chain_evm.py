"""The real anchoring path, end to end, on an in-process EVM (eth-tester): the compiled CarbonAnchor contract is
deployed, Merkle roots are anchored by signed transactions, and proofs are checked by the contract itself."""

import pytest
from fastapi.testclient import TestClient
from web3 import EthereumTesterProvider, Web3

from app import config
from app.chain import EvmChain, deploy
from app.engine import merkle
from app.main import app
from app.routers import statements as statements_router

KEY = {"x-engine-key": "test-key"}


@pytest.fixture()
def evm():
    w3 = Web3(EthereumTesterProvider())
    signer = w3.eth.account.create()
    w3.eth.send_transaction({"from": w3.eth.accounts[0], "to": signer.address, "value": w3.to_wei(10, "ether")})
    address = deploy(w3, signer.key.hex())
    return EvmChain(w3, address, signer.key.hex(), "test-evm")


def test_contract_anchors_roots_and_checks_proofs_itself(evm):
    statements = [{"household_ref": f"hh_{i}", "period": "2026-05", "total_kg": 100 + i} for i in range(3)]
    salts = [merkle.new_salt() for _ in statements]
    leaves = [merkle.leaf(s, salt) for s, salt in zip(statements, salts)]
    root, proofs = merkle.build(leaves)
    fs_hash = merkle.keccak(b"factor-set")

    first = evm.anchor(root, fs_hash, 1, "2026-05", "IN-2026.1")
    assert first.tx_hash.startswith("0x") and len(first.tx_hash) == 66
    assert first.chain_batch_id == 0
    assert first.block_number > 0 and first.contract == evm.address

    # the contract's own MerkleProof.verify agrees with ours (sorted pairs, double-hashed leaves)
    assert evm.verify_onchain(0, proofs[1], leaves[1]) is True
    tampered = merkle.leaf(dict(statements[1], total_kg=999), salts[1])
    assert evm.verify_onchain(0, proofs[1], tampered) is False

    # the factor set is published once; later batches just anchor
    second = evm.anchor(merkle.keccak(b"other root"), fs_hash, 2, "2026-06", "IN-2026.1")
    assert second.chain_batch_id == 1


def test_seal_and_verify_through_the_api_on_chain(evm, monkeypatch):
    monkeypatch.setattr(config, "ENGINE_API_KEY", "test-key")
    monkeypatch.setattr(statements_router, "get_chain", lambda: evm)
    with TestClient(app) as client:
        sid = client.post("/api/v1/statements", json={"household_ref": "hh_chain", "period": "2026-05", "total_kg": 286.1}, headers=KEY).json()["id"]
        client.post("/api/v1/statements", json={"household_ref": "hh_chain2", "period": "2026-05", "total_kg": 148}, headers=KEY)
        anchored = client.post("/api/v1/anchors", headers=KEY).json()
        assert anchored["chain"] == "test-evm" and anchored["chain_batch_id"] is not None and anchored["block_number"] > 0

        bundle = client.get(f"/api/v1/statements/{sid}", headers=KEY).json()
        body = {k: bundle[k] for k in ("statement", "salt", "proof", "batch_id")}
        ok = client.post("/api/v1/verify", json=body).json()
        assert ok["valid"] is True and ok["onchain"] is True

        body["statement"] = dict(bundle["statement"], total_kg=200.0)
        bad = client.post("/api/v1/verify", json=body).json()
        assert bad["valid"] is False


def test_a_failed_chain_call_leaves_statements_ready_to_retry(evm, monkeypatch):
    from app.chain import ChainError

    class Down:
        name = "down"

        def anchor(self, *a, **k):
            raise ChainError("RPC unreachable")

    monkeypatch.setattr(config, "ENGINE_API_KEY", "test-key")
    monkeypatch.setattr(statements_router, "get_chain", lambda: Down())
    with TestClient(app) as client:
        sid = client.post("/api/v1/statements", json={"household_ref": "hh_retry", "period": "2026-07", "total_kg": 1}, headers=KEY).json()["id"]
        assert client.post("/api/v1/anchors", headers=KEY).status_code == 502
        assert client.get(f"/api/v1/statements/{sid}", headers=KEY).json()["batch_id"] is None
        monkeypatch.setattr(statements_router, "get_chain", lambda: evm)
        assert client.post("/api/v1/anchors", headers=KEY).status_code == 201
        assert client.get(f"/api/v1/statements/{sid}", headers=KEY).json()["batch_id"] is not None
