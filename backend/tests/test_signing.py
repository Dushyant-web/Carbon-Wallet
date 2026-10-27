"""Signed calls from the website's server: a valid HMAC opens the engine-only routes, a bad, stale or replayed
one doesn't, and with ENGINE_REQUIRE_SIGNATURE=1 the bare key header stops working."""
import json
import secrets
import time

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.signing import expected_signature

PATH = "/api/v1/statements?household_ref=hh_sig_test"


@pytest.fixture(autouse=True)
def engine_key(monkeypatch):
    monkeypatch.setattr(config, "ENGINE_API_KEY", "test-key")


def signed(path=PATH, method="GET", body=b"", ts=None, key="test-key"):
    ts = str(ts if ts is not None else int(time.time()))
    nonce = secrets.token_hex(16)
    return {"x-engine-ts": ts, "x-engine-nonce": nonce, "x-engine-sig": expected_signature(key, ts, nonce, method, path, body)}


def test_valid_signature_is_accepted_and_cannot_be_replayed():
    with TestClient(app) as client:
        h = signed()
        assert client.get(PATH, headers=h).status_code == 200
        assert client.get(PATH, headers=h).status_code == 401  # same signature again


def test_wrong_key_stale_time_and_tampered_path_are_refused():
    with TestClient(app) as client:
        assert client.get(PATH, headers=signed(key="other")).status_code == 401
        assert client.get(PATH, headers=signed(ts=int(time.time()) - 3600)).status_code == 401
        assert client.get(PATH.replace("hh_sig_test", "hh_other"), headers=signed()).status_code == 401


def test_signed_post_body_is_checked_and_still_reaches_the_route():
    with TestClient(app) as client:
        body = json.dumps({"household_ref": "hh_sig_test", "period": "2026-03", "rows": []}).encode()
        tampered = client.post("/api/v1/statements", content=body + b" ", headers={**signed("/api/v1/statements", "POST", body), "content-type": "application/json"})
        assert tampered.status_code == 401
        ok = client.post("/api/v1/statements", content=body, headers={**signed("/api/v1/statements", "POST", body), "content-type": "application/json"})
        assert ok.status_code != 401  # signature accepted; the route then validates the body itself
        # two identical calls in the same second are both fine: each has its own nonce
        assert client.get(PATH, headers=signed()).status_code == 200
        assert client.get(PATH, headers=signed()).status_code == 200


def test_bare_key_is_ignored_when_signatures_are_required(monkeypatch):
    with TestClient(app) as client:
        assert client.get(PATH, headers={"x-engine-key": "test-key"}).status_code == 200
        monkeypatch.setenv("ENGINE_REQUIRE_SIGNATURE", "1")
        assert client.get(PATH, headers={"x-engine-key": "test-key"}).status_code == 401
        assert client.get(PATH, headers=signed()).status_code == 200
