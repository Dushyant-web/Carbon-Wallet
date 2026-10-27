import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app

KEY = {"x-engine-key": "test-key"}


@pytest.fixture(autouse=True)
def engine_key(monkeypatch):
    monkeypatch.setattr(config, "ENGINE_API_KEY", "test-key")


def test_full_statement_lifecycle():
    with TestClient(app) as client:
        assert client.get("/api/v1/health").json()["grid_factor"] == 0.6781

        cal = client.post(
            "/api/v1/calibration",
            json={
                "bills": [
                    {"period_start": "2026-01-01", "period_end": "2026-02-01", "kwh": 180, "ac_hours": 0},
                    {"period_start": "2026-05-01", "period_end": "2026-06-01", "kwh": 420, "ac_hours": 186},
                ]
            },
        ).json()
        assert cal["ac_kw"] == 1.29
        assert cal["latest_bill"]["ac_kg"] == 162.7  # 240 kWh x 0.6781 kg CO2e

        issued = client.post(
            "/api/v1/statements",
            json={"household_ref": "hh_sharma", "period": "2026-05", "total_kg": 448, "by_category": {"Electricity": 283.5}},
            headers=KEY,
        )
        assert issued.status_code == 201
        sid = issued.json()["id"]
        client.post(
            "/api/v1/statements",
            json={"household_ref": "hh_khan", "period": "2026-05", "total_kg": 148},
            headers=KEY,
        )

        anchored = client.post("/api/v1/anchors", headers=KEY)
        assert anchored.status_code == 201
        assert anchored.json()["chain"] == "local-devnet"
        assert anchored.json()["n_statements"] >= 2

        bundle = client.get(f"/api/v1/statements/{sid}", headers=KEY).json()
        assert bundle["anchor"]["merkle_root"] == anchored.json()["merkle_root"]

        body = {k: bundle[k] for k in ("statement", "salt", "proof", "batch_id")}
        assert client.post("/api/v1/verify", json=body).json()["valid"] is True

        body["statement"] = dict(bundle["statement"], total_kg=300.0)
        assert client.post("/api/v1/verify", json=body).json()["valid"] is False


def test_status_list_reports_anchoring_without_leaking_payloads():
    with TestClient(app) as client:
        ref = "hh_status_test"
        client.post("/api/v1/statements", json={"household_ref": ref, "period": "2026-08", "total_kg": 300}, headers=KEY)
        client.post("/api/v1/anchors", headers=KEY)
        client.post("/api/v1/statements", json={"household_ref": ref, "period": "2026-09", "total_kg": 290}, headers=KEY)

        rows = client.get("/api/v1/statements", params={"household_ref": ref}, headers=KEY).json()
        by_period = {r["period"]: r for r in rows}
        assert by_period["2026-08"]["anchored"] is True
        assert by_period["2026-08"]["merkle_root"].startswith("0x")
        assert by_period["2026-09"]["anchored"] is False
        for r in rows:
            assert "salt" not in r and "statement" not in r


def test_only_the_app_server_can_issue_seal_or_read_statements():
    """A browser (no engine key) can't put its own numbers into a seal, spend chain gas, or read salts."""
    with TestClient(app) as client:
        body = {"household_ref": "hh_x", "period": "2026-05", "total_kg": 1}
        assert client.post("/api/v1/statements", json=body).status_code == 401
        assert client.post("/api/v1/statements", json=body, headers={"x-engine-key": "wrong"}).status_code == 401
        assert client.post("/api/v1/anchors").status_code == 401
        assert client.get("/api/v1/statements", params={"household_ref": "hh_x"}).status_code == 401
        assert client.get("/api/v1/statements/whatever").status_code == 401
        # verifying stays public: it needs nothing secret
        assert client.post("/api/v1/verify", json={"statement": {}, "salt": "0x00", "proof": [], "batch_id": 999}).status_code == 200


def test_salts_are_encrypted_at_rest_and_old_plain_ones_still_read():
    from app import saltbox
    from app.db import SessionLocal, Statement

    with TestClient(app) as client:
        issued = client.post("/api/v1/statements", json={"household_ref": "hh_salt", "period": "2026-06", "total_kg": 9}, headers=KEY).json()
        with SessionLocal() as s:
            row = s.get(Statement, issued["id"])
            assert row.salt.startswith("enc:v1:")
            assert saltbox.open_salt(row.salt) == issued["salt"] and issued["salt"].startswith("0x")
    assert saltbox.open_salt("0xabc") == "0xabc"  # stored before encryption


def test_validation_rejects_bad_input():
    with TestClient(app) as client:
        assert client.post("/api/v1/refrigerant", json={"refrigerant": "R404", "kg_added": 1}).status_code == 422
        assert client.post("/api/v1/calibration", json={"bills": []}).status_code == 422


def _through_a_browser(v):
    """What JSON.parse + JSON.stringify do to Python's JSON: whole-number floats lose their ".0"."""
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, dict):
        return {k: _through_a_browser(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_through_a_browser(x) for x in v]
    return v


def test_whole_number_totals_still_verify_after_a_trip_through_a_browser():
    with TestClient(app) as client:
        sid = client.post(
            "/api/v1/statements",
            json={"household_ref": "hh_whole", "period": "2026-03", "total_kg": 286.0, "by_category": {"Electricity": 150.0, "Food": 25.4}},
            headers=KEY,
        ).json()["id"]
        client.post("/api/v1/anchors", headers=KEY)
        bundle = client.get(f"/api/v1/statements/{sid}", headers=KEY).json()
        body = {k: bundle[k] for k in ("statement", "salt", "proof", "batch_id")}
        body["statement"] = _through_a_browser(body["statement"])
        assert body["statement"]["total_kg"] == 286 and isinstance(body["statement"]["total_kg"], int)
        assert client.post("/api/v1/verify", json=body).json()["valid"] is True
        body["statement"]["total_kg"] = 287
        assert client.post("/api/v1/verify", json=body).json()["valid"] is False


def test_statements_sealed_in_the_older_all_floats_form_still_verify():
    import uuid

    from app import saltbox
    from app.db import SessionLocal, Statement
    from app.engine import merkle

    payload = {"type": "CarbonStatement/v1", "household_ref": "hh_legacy", "period": "2026-01", "total_kg": 300.0, "by_category": {"Electricity": 200.0}}
    salt = merkle.new_salt()
    legacy_leaf = merkle.keccak(merkle.keccak(salt + merkle.keccak(merkle.canonical_json(payload))))  # hashed as before
    with SessionLocal() as s:
        s.add(Statement(id=str(uuid.uuid4()), household_ref="hh_legacy", period="2026-01", payload=payload,
                        statement_hash="0x" + merkle.keccak(merkle.canonical_json(payload)).hex(),
                        salt=saltbox.seal("0x" + salt.hex()), leaf="0x" + legacy_leaf.hex()))
        s.commit()
    with TestClient(app) as client:
        client.post("/api/v1/anchors", headers=KEY)
        rows = client.get("/api/v1/statements", params={"household_ref": "hh_legacy"}, headers=KEY).json()
        bundle = client.get(f"/api/v1/statements/{rows[0]['statement_id']}", headers=KEY).json()
        body = {k: bundle[k] for k in ("statement", "salt", "proof", "batch_id")}
        body["statement"] = _through_a_browser(body["statement"])
        assert client.post("/api/v1/verify", json=body).json()["valid"] is True


def test_shredding_a_household_leaves_its_proofs_uncheckable_and_others_intact():
    with TestClient(app) as client:
        gone = client.post("/api/v1/statements", json={"household_ref": "hh_gone", "period": "2026-04", "total_kg": 120.5}, headers=KEY).json()
        kept = client.post("/api/v1/statements", json={"household_ref": "hh_kept", "period": "2026-04", "total_kg": 99.5}, headers=KEY).json()
        client.post("/api/v1/anchors", headers=KEY)
        kept_bundle = client.get(f"/api/v1/statements/{kept['id']}", headers=KEY).json()

        assert client.post("/api/v1/statements/shred", json={"household_ref": "hh_gone"}).status_code == 401
        assert client.post("/api/v1/statements/shred", json={"household_ref": "hh_gone"}, headers=KEY).json() == {"deleted": 1}
        assert client.get(f"/api/v1/statements/{gone['id']}", headers=KEY).status_code == 404
        assert client.get("/api/v1/statements", params={"household_ref": "hh_gone"}, headers=KEY).json() == []
        # the other household in the same sealed batch still verifies
        body = {k: kept_bundle[k] for k in ("statement", "salt", "proof", "batch_id")}
        assert client.post("/api/v1/verify", json=body).json()["valid"] is True
