"""Read a fuel fill-up from a photo: the pump's display or the printed receipt.

Finds litres (kg for CNG), amount in rupees and the rate per litre, and cross-checks them:
amount ≈ litres × rate. Any two of the three give the third. Printed receipts usually OCR cleanly;
pump displays use 7-segment digits that OCR often misreads, so the (consented) AI reader helps there.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request

from app.bills.acquire import acquire
from app.bills.ai_fallback import AiUnavailable
from app.bills.ai_nvidia import URL as NVIDIA_URL, _jpeg_data_url, _num
from app.bills.normalize import find_dates, parse_number

VOL_LABELS = re.compile(r"\b(volume|vol|litres?|liters?|ltrs?|qty|quantity)\b", re.I)
AMT_LABELS = re.compile(r"\b(amount|amt|sale|total|value|paid)\b", re.I)
RATE_LABELS = re.compile(r"\b(rate|price|per\s*l(itre)?|unit\s*price)\b|(rs|₹)\.?\s*/\s*(l|kg)", re.I)
NUM = re.compile(r"(\d[\d,]*\.?\d*)")
FUELS = {"petrol": "Petrol", "ms ": "Petrol", "speed": "Petrol", "power": "Petrol", "xp95": "Petrol",
         "diesel": "Diesel", "hsd": "Diesel", "cng": "CNG"}

RATE_RANGE = {"Petrol": (80, 130), "Diesel": (75, 120), "CNG": (60, 110)}


def _number_after(label: re.Pattern, line: str) -> float | None:
    m = label.search(line)
    if not m:
        return None
    n = NUM.search(line[m.end():])
    return parse_number(n.group(1)) if n else None


def parse_text(text: str) -> dict:
    """Line by line, most specific label first: a "Rate Rs/L" line is never read as the amount."""
    low = text.lower()
    fuel = next((v for k, v in FUELS.items() if k in low), None)
    litres = amount = rate = None
    for line in text.splitlines():
        if rate is None and RATE_LABELS.search(line):
            rate = _number_after(RATE_LABELS, line)
        elif litres is None and VOL_LABELS.search(line):
            litres = _number_after(VOL_LABELS, line)
        elif amount is None and (AMT_LABELS.search(line) or re.search(r"(rs|₹)\.?\s*:?\s*\d", line, re.I)):
            amount = _number_after(AMT_LABELS, line) if AMT_LABELS.search(line) else parse_number(NUM.search(line).group(1))
    if litres is None:
        m = re.search(r"(\d{1,3}\.\d{1,3})\s*(l|ltr|litres?|kg)\b", text, re.I)
        litres = float(m.group(1)) if m else None
    dates = find_dates(text)
    return {"fuel": fuel, "quantity": litres, "amount_inr": amount, "rate": rate, "date": dates[0][0].isoformat() if dates else None}


def reconcile(r: dict) -> tuple[dict, list[str], str]:
    """Fills the missing one of quantity/amount/rate and grades confidence by how well they agree."""
    q, a, p = r.get("quantity"), r.get("amount_inr"), r.get("rate")
    warnings: list[str] = []
    read = sum(1 for v in (q, a, p) if v)
    if q and a and not p:
        p = round(a / q, 2)
    elif q and p and not a:
        a = round(q * p, 2)
    elif a and p and not q:
        q = round(a / p, 2)
    # high: all three were read and agree; medium: two read (third derived) or three that disagree
    confidence = "medium" if read == 2 else "low"
    if read == 3 and q and a and p:
        agree = abs(q * p - a) <= max(2.0, 0.02 * a)
        confidence = "high" if agree else "medium"
        if not agree:
            warnings.append(f"{q} × ₹{p} = ₹{q * p:.0f}, but the amount reads ₹{a:.0f}. Please check.")
    fuel = r.get("fuel")
    if p and fuel in RATE_RANGE and not (RATE_RANGE[fuel][0] <= p <= RATE_RANGE[fuel][1]):
        warnings.append(f"₹{p} per {'kg' if fuel == 'CNG' else 'litre'} is unusual for {fuel.lower()}. Please check.")
        confidence = "low"
    if q is not None and not (0.5 <= q <= 200):
        warnings.append(f"{q} looks wrong for one fill-up.")
        confidence = "low"
    return {**r, "quantity": q, "amount_inr": a, "rate": p}, warnings, confidence


AI_PROMPT = (
    "This photo shows an Indian fuel pump display or a fuel receipt. Reply with ONLY a JSON object: "
    '{"fuel": "Petrol"|"Diesel"|"CNG"|null, "quantity": number|null, "amount_inr": number|null, "rate": number|null, '
    '"date": "YYYY-MM-DD"|null}. quantity is litres (kg for CNG), amount_inr is rupees paid, rate is rupees per litre/kg. '
    "Pump displays usually show three rows: Amount (Rs), Volume (L), Rate (Rs/L). Use null if unreadable; never guess."
)


def _ai_read(png: bytes) -> dict:
    key = os.getenv("NVIDIA_API_KEY")
    if not key:
        raise AiUnavailable("AI reading isn't configured on this server.")
    body = {
        "model": os.getenv("NVIDIA_BILL_MODEL", "meta/llama-3.2-11b-vision-instruct"),
        "max_tokens": 300,
        "temperature": 0,
        "messages": [{"role": "user", "content": [{"type": "text", "text": AI_PROMPT}, {"type": "image_url", "image_url": {"url": _jpeg_data_url(png)}}]}],
    }
    req = urllib.request.Request(NVIDIA_URL, data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:  # noqa: S310
            text = json.load(res)["choices"][0]["message"]["content"] or ""
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError) as exc:
        raise AiUnavailable("AI reading couldn't reach the service.") from exc
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise AiUnavailable("AI returned an unreadable result.")
    try:
        raw = json.loads(re.sub(r"(:\s*)(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?)", lambda g: g[1] + g[2].replace(",", ""), m.group()))
    except json.JSONDecodeError as exc:
        raise AiUnavailable("AI returned an unreadable result.") from exc
    fuel = raw.get("fuel") if raw.get("fuel") in ("Petrol", "Diesel", "CNG") else None
    date = raw.get("date") if isinstance(raw.get("date"), str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw["date"]) else None
    return {"fuel": fuel, "quantity": _num(raw.get("quantity")), "amount_inr": _num(raw.get("amount_inr")), "rate": _num(raw.get("rate")), "date": date}


def extract_fuel(data: bytes, *, allow_ai: bool = False) -> dict:
    doc, kind = acquire(data)
    text = doc.full_text
    ocr = parse_text(text)
    result, warnings, confidence = reconcile(ocr)
    source = "ocr"
    ai_used = False
    if confidence != "high" and allow_ai and doc.previews:
        try:
            ai = _ai_read(doc.previews[0])
            merged = {k: (ai.get(k) if ai.get(k) is not None else ocr.get(k)) for k in ocr}
            result, warnings, confidence = reconcile(merged)
            source, ai_used = "ai", True
            if confidence == "high":
                warnings.append("Read by AI; the three numbers agree with each other.")
        except AiUnavailable as exc:
            warnings.append(str(exc))
    return {
        **result,
        "confidence": confidence,
        "source": source,
        "ai_used": ai_used,
        "needs_ai": confidence != "high" and not ai_used,
        "warnings": warnings,
        "file_kind": kind,
        "ocr_text": text[:600],
    }
