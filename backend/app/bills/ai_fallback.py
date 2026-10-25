"""Consented AI fallback: an AI model reads a bill page when local OCR isn't confident.

Provider: NVIDIA NIM when NVIDIA_API_KEY is set (see ai_nvidia.py), otherwise Claude (ANTHROPIC_API_KEY).
BILL_AI_PROVIDER=anthropic|nvidia forces one.

Only called when the user ticks "let AI read this bill". The model's answer is never trusted
blindly: its kWh must also appear in the bill's own OCR text to reach high confidence; otherwise
it is marked medium and the UI asks the user to check it against the highlighted preview.
"""

import base64
import json
import logging
import os

import anthropic

log = logging.getLogger(__name__)

MODEL = os.getenv("BILL_AI_MODEL", "claude-opus-5-5")

_NUM = {"anyOf": [{"type": "number"}, {"type": "null"}]}
_DATE = {"anyOf": [{"type": "string", "description": "YYYY-MM-DD"}, {"type": "null"}]}
SCHEMA = {
    "type": "object",
    "properties": {
        "units_kwh": {**_NUM, "description": "Electricity consumed in this billing period (billed/consumed units, kWh)"},
        "period_start": _DATE,
        "period_end": _DATE,
        "amount_payable_inr": {**_NUM, "description": "Amount payable on or before the due date, in rupees"},
        "previous_reading": _NUM,
        "present_reading": _NUM,
        "multiplying_factor": _NUM,
        "import_kwh": _NUM,
        "export_kwh": _NUM,
        "discom_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "notes": {"type": "string", "description": "Anything ambiguous, in one sentence"},
    },
    "required": [
        "units_kwh", "period_start", "period_end", "amount_payable_inr", "previous_reading", "present_reading",
        "multiplying_factor", "import_kwh", "export_kwh", "discom_name", "notes",
    ],
    "additionalProperties": False,
}

PROMPT = (
    "This is an Indian residential electricity bill. Extract the fields in the schema for the CURRENT billing "
    "period only. Do not use the consumption-history table (previous months), sanctioned load (kW), per-unit "
    "tariff rates, or the late-payment amount. If a value is not printed, return null rather than guessing. "
    "Dates are day-first (DD-MM-YYYY) unless written otherwise."
)


class AiUnavailable(RuntimeError):
    pass


def provider_name() -> str | None:
    """Who an AI read would be sent to, for the user's consent text (None if AI isn't configured)."""
    provider = os.getenv("BILL_AI_PROVIDER") or ("nvidia" if os.getenv("NVIDIA_API_KEY") else "anthropic")
    if provider == "nvidia":
        return "NVIDIA" if os.getenv("NVIDIA_API_KEY") else None
    return "Anthropic" if os.getenv("ANTHROPIC_API_KEY") else None


def ai_read(*, pdf_bytes: bytes | None, page_pngs: list[bytes]) -> dict:
    """Returns the parsed JSON object, or raises AiUnavailable with a user-safe reason."""
    provider = os.getenv("BILL_AI_PROVIDER") or ("nvidia" if os.getenv("NVIDIA_API_KEY") else "anthropic")
    if provider == "nvidia":
        key = os.getenv("NVIDIA_API_KEY")
        if not key:
            raise AiUnavailable("AI reading isn't configured on this server.")
        from .ai_nvidia import nvidia_read  # local import: ai_nvidia imports AiUnavailable from here

        return nvidia_read(page_pngs=page_pngs, api_key=key)
    return _claude_read(pdf_bytes=pdf_bytes, page_pngs=page_pngs)


def _claude_read(*, pdf_bytes: bytes | None, page_pngs: list[bytes]) -> dict:
    try:
        client = anthropic.Anthropic()
    except Exception as exc:  # no credentials configured
        raise AiUnavailable("AI reading isn't configured on this server.") from exc

    if pdf_bytes is not None and len(pdf_bytes) < 8 * 1024 * 1024:
        source_block = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": base64.standard_b64encode(pdf_bytes).decode()},
        }
        blocks = [source_block]
    else:
        blocks = [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64.standard_b64encode(p).decode()}}
            for p in page_pngs[:2]
        ]

    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=2000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
            messages=[{"role": "user", "content": [*blocks, {"type": "text", "text": PROMPT}]}],
        )
    except anthropic.AuthenticationError as exc:
        raise AiUnavailable("AI reading isn't configured on this server.") from exc
    except anthropic.RateLimitError as exc:
        raise AiUnavailable("AI reading is busy right now. Please try again in a minute.") from exc
    except anthropic.APIStatusError as exc:
        log.warning("bill AI read failed: %s %s", exc.status_code, getattr(exc, "message", ""))
        raise AiUnavailable("AI reading failed for this bill.") from exc
    except anthropic.APIConnectionError as exc:
        raise AiUnavailable("AI reading couldn't reach the service.") from exc

    if response.stop_reason == "refusal":
        raise AiUnavailable("AI declined to read this file.")
    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        raise AiUnavailable("AI returned no result.")
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise AiUnavailable("AI returned an unreadable result.") from exc
