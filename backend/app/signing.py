"""Signed calls from the website's server to the engine (HMAC-SHA256).

The Next.js server signs  "<unix ts>\\n<nonce>\\n<METHOD>\\n<path?query>\\n<sha256(body)>"  with ENGINE_API_KEY
and sends x-engine-ts, x-engine-nonce and x-engine-sig, so the key itself never travels. A signature that is
present but wrong is refused outright (401). This middleware checks the signature, the
5-minute window and replays, then marks the request as coming from the website (the routers' existing
`require_engine_key` check). With ENGINE_REQUIRE_SIGNATURE=1 (production) a bare x-engine-key header is ignored.
"""
import hashlib
import hmac
import os
import time
from collections import OrderedDict

from app import config

WINDOW_S = 300
_seen: "OrderedDict[str, float]" = OrderedDict()


def _require_signature() -> bool:
    return os.getenv("ENGINE_REQUIRE_SIGNATURE", "0") == "1"


def expected_signature(key: str, ts: str, nonce: str, method: str, path: str, body: bytes) -> str:
    msg = f"{ts}\n{nonce}\n{method.upper()}\n{path}\n{hashlib.sha256(body).hexdigest()}".encode()
    return hmac.new(key.encode(), msg, hashlib.sha256).hexdigest()


def _fresh(sig: str, now: float) -> bool:
    while _seen and next(iter(_seen.values())) < now - WINDOW_S:
        _seen.popitem(last=False)
    if sig in _seen:
        return False
    _seen[sig] = now
    return True


class EngineSignatureMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = [(k, v) for k, v in scope["headers"]]
        lookup = {k.decode().lower(): v.decode() for k, v in headers}
        sig, ts, nonce = lookup.get("x-engine-sig"), lookup.get("x-engine-ts"), lookup.get("x-engine-nonce", "")
        if _require_signature():
            headers = [(k, v) for k, v in headers if k.lower() != b"x-engine-key"]
        if not (sig and ts and config.ENGINE_API_KEY):
            scope = {**scope, "headers": headers}
            return await self.app(scope, receive, send)

        # buffer the body to check its hash, then hand the same bytes to the route
        chunks, more = [], True
        while more:
            message = await receive()
            chunks.append(message.get("body", b""))
            more = message.get("more_body", False)
        body = b"".join(chunks)
        path = scope.get("raw_path", scope["path"].encode()).decode()
        if scope.get("query_string"):
            path = f"{path}?{scope['query_string'].decode()}"
        now = time.time()
        ok = (
            ts.isdigit()
            and abs(now - int(ts)) <= WINDOW_S
            and 16 <= len(nonce) <= 64
            and hmac.compare_digest(sig, expected_signature(config.ENGINE_API_KEY, ts, nonce, scope["method"], path, body))
            and _fresh(sig, now)
        )
        if not ok:
            payload = b'{"detail":"Invalid or expired engine signature."}'
            await send({"type": "http.response.start", "status": 401, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(payload)).encode())]})
            await send({"type": "http.response.body", "body": payload})
            return
        headers = [(k, v) for k, v in headers if k.lower() != b"x-engine-key"]
        headers.append((b"x-engine-key", config.ENGINE_API_KEY.encode()))

        sent = False

        async def replay():
            nonlocal sent
            if sent:
                return {"type": "http.disconnect"}
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}

        return await self.app({**scope, "headers": headers}, replay, send)
