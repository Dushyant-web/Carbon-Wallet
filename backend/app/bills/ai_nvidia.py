"""AI bill reading through NVIDIA NIM (OpenAI-compatible chat completions with an image).

Same contract as the Claude reader in `ai_fallback.py`: returns a dict with the SCHEMA keys, or raises
AiUnavailable with a user-safe message. The pipeline still only trusts a number at high confidence when
it can also find it in the bill's own text, so a wrong read is caught there.
"""

import base64
import io
import json
import logging
import os
import re
import socket
import urllib.error
import urllib.request

from PIL import Image

from .ai_fallback import AiUnavailable
from .normalize import find_dates

log = logging.getLogger(__name__)

URL = "https://integrate.api.nvidia.com/v1/chat/completions"
# Fast, available on the free tier, and reads Indian bills well in testing (2-4 s per page)
MODEL = os.getenv("NVIDIA_BILL_MODEL", "meta/llama-3.2-11b-vision-instruct")
TIMEOUT_S = 60
MAX_SIDE = 1000  # px; keeps the inline image well under the API's request size limit

KEYS = (
    "units_kwh", "period_start", "period_end", "amount_payable_inr", "previous_reading", "present_reading",
    "multiplying_factor", "import_kwh", "export_kwh", "discom_name", "notes",
)
NUMERIC = {"units_kwh", "amount_payable_inr", "previous_reading", "present_reading", "multiplying_factor", "import_kwh", "export_kwh"}

PROMPT = (
    "This is an Indian residential electricity bill. Read the CURRENT billing period only. Do not use the "
    "consumption-history table (previous months), sanctioned load (kW), per-unit tariff rates, or the "
    "late-payment amount. Reply with ONLY a JSON object with exactly these keys: "
    '{"units_kwh": number|null, "period_start": "YYYY-MM-DD"|null, "period_end": "YYYY-MM-DD"|null, '
    '"amount_payable_inr": number|null, "previous_reading": number|null, "present_reading": number|null, '
    '"multiplying_factor": number|null, "import_kwh": number|null, "export_kwh": number|null, '
    '"discom_name": string|null, "notes": string}. '
    "units_kwh is the billed/consumed units, not a meter reading. Bill dates are day-first (DD-MM-YYYY); "
    "convert them to YYYY-MM-DD. Use null for anything not printed; never guess."
)



def nvidia_key() -> str | None:
    """NVIDIA_API_KEY, with its "nvapi-" start added if it was pasted without it."""
    key = (os.getenv("NVIDIA_API_KEY") or "").strip()
    if not key:
        return None
    return key if key.startswith("nvapi-") else f"nvapi-{key}"

def _jpeg_data_url(png: bytes) -> str:
    img = Image.open(io.BytesIO(png)).convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE * 1.5))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _num(v):
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"-?\d[\d,]*\.?\d*", str(v))
    return float(m.group().replace(",", "")) if m else None


def parse_reply(text: str) -> dict:
    """Pulls the JSON object out of the model's reply (it sometimes adds a fence or a trailing full stop)."""
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise AiUnavailable("AI returned an unreadable result.")
    blob = m.group()
    # Models sometimes write Indian-format numbers unquoted ("amount": 3,376.28), which isn't JSON
    blob = re.sub(r'(:\s*)(-?\d{1,3}(?:,\d{2,3})+(?:\.\d+)?)(\s*[,}])', lambda g: g[1] + g[2].replace(",", "") + g[3], blob)
    try:
        raw = json.loads(blob)
    except json.JSONDecodeError as exc:
        raise AiUnavailable("AI returned an unreadable result.") from exc
    out = {k: raw.get(k) for k in KEYS}
    for k in NUMERIC:
        out[k] = _num(out[k])
    for k in ("period_start", "period_end"):
        v = out[k]
        if isinstance(v, str) and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            found = find_dates(v)  # same day-first parser as the OCR path ("12-Jan-2026", "12/01/2026")
            v = found[0][0].isoformat() if found else None
        out[k] = v if isinstance(v, str) else None  # unparseable dates are dropped, never guessed
    out["notes"] = str(out.get("notes") or "")[:200]
    return out


def nvidia_read(*, page_pngs: list[bytes], api_key: str) -> dict:
    if not page_pngs:
        raise AiUnavailable("No page image to read.")
    body = {
        "model": MODEL,
        "max_tokens": 500,
        "temperature": 0,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    # These vision models take one image per request: the first page holds the bill summary
                    {"type": "image_url", "image_url": {"url": _jpeg_data_url(page_pngs[0])}},
                ],
            }
        ],
    }
    req = urllib.request.Request(
        URL,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:  # noqa: S310 (fixed https host)
            data = json.load(res)
    except urllib.error.HTTPError as exc:
        log.warning("NVIDIA bill read failed: HTTP %s", exc.code)
        if exc.code in (401, 403):
            raise AiUnavailable("AI reading isn't configured on this server.") from exc
        if exc.code == 429:
            raise AiUnavailable("AI reading is busy right now. Please try again in a minute.") from exc
        raise AiUnavailable("AI reading failed for this bill.") from exc
    except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
        raise AiUnavailable("AI reading couldn't reach the service.") from exc

    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AiUnavailable("AI returned no result.") from exc
    return parse_reply(text or "")
