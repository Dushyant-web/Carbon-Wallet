"""Plain-English insight bullets written by an LLM (NVIDIA NIM) from numbers we computed.

The model only words things; it never calculates. Every number in every bullet must appear in the facts
we sent (allowing the usual rounding), otherwise that bullet is dropped. If nothing survives, or the
service is unavailable, the caller shows its own template sentences instead.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import socket
import urllib.error
import urllib.request

from sqlalchemy.orm import Session

from app.db import WeatherCache  # generic key/value cache table

log = logging.getLogger(__name__)

URL = "https://integrate.api.nvidia.com/v1/chat/completions"
MODELS = [m for m in (os.getenv("NVIDIA_TEXT_MODEL"), "google/gemma-4-31b-it", "meta/llama-3.2-11b-vision-instruct") if m]
TIMEOUT_S = 30

PROMPT = (
    "You explain an Indian family's household carbon footprint in very simple English, like a friendly neighbour. "
    "Use ONLY numbers that appear in the facts, exactly as written. Do not calculate new numbers. "
    "Write exactly {n} short bullet points, each starting with '- ', at most 24 words each, no headings, no jargon "
    "(say 'electricity' not 'Scope 2', 'kg of CO2' not 'emissions intensity'). End with one practical tip.\n"
    "Facts (JSON): {facts}"
)

_NUM = re.compile(r"-?\d[\d,]*(?:\.\d+)?")


def _numbers_in(obj) -> set[float]:
    out: set[float] = set()
    for m in _NUM.findall(json.dumps(obj)):
        try:
            out.add(abs(float(m.replace(",", ""))))
        except ValueError:
            pass
    return out


def _allowed(n: float, facts: set[float]) -> bool:
    if n <= 10 and float(n).is_integer():  # small counts ("3 bills", "2 days") and list numbering
        return True
    return any(abs(n - f) <= max(0.051, 0.006 * f) or round(f) == n for f in facts)


def check_bullets(text: str, facts: dict) -> list[str]:
    """Keeps only bullets whose every number comes from the facts."""
    allowed = _numbers_in(facts)
    bullets = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith(("- ", "* ", "• ")):
            continue
        body = line[2:].strip().replace("**", "")
        nums = [abs(float(m.replace(",", ""))) for m in _NUM.findall(body)]
        if all(_allowed(n, allowed) for n in nums) and 3 <= len(body) <= 220:
            bullets.append(body)
    return bullets


def _call(model: str, prompt: str, key: str) -> str:
    body = {"model": model, "max_tokens": 500, "temperature": 0.2, "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request(
        URL,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:  # noqa: S310 (fixed https host)
        return json.load(res)["choices"][0]["message"].get("content") or ""


def narrate(session: Session, facts: dict, n: int = 4) -> dict:
    key = os.getenv("NVIDIA_API_KEY")
    if not key:
        return {"bullets": [], "model": None, "reason": "AI writing isn't configured on this server."}
    cache_key = "narrate:" + hashlib.sha256(json.dumps([facts, n, MODELS], sort_keys=True).encode()).hexdigest()
    hit = session.get(WeatherCache, cache_key)
    if hit is not None:
        return hit.value
    prompt = PROMPT.format(n=n, facts=json.dumps(facts, ensure_ascii=False))
    for model in MODELS:
        try:
            bullets = check_bullets(_call(model, prompt, key), facts)
        except (urllib.error.URLError, TimeoutError, socket.timeout, KeyError, IndexError, ValueError) as exc:
            log.warning("narrate via %s failed: %s", model, exc)
            continue
        if bullets:
            out = {"bullets": bullets[:n], "model": model, "reason": None}
            session.add(WeatherCache(key=cache_key, value=out))
            session.commit()
            return out
    return {"bullets": [], "model": None, "reason": "AI writing is unavailable right now."}
