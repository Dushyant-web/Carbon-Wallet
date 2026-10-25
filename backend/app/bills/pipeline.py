"""End-to-end bill extraction: file bytes → fields with confidence, provenance and warnings."""

import base64
import time
from datetime import date

from app import config  # noqa: F401  (shared .env: hashing salt, AI key)

from . import fields as F
from .acquire import acquire
from .ai_fallback import AiUnavailable, ai_read, provider_name
from .discoms import detect
from .normalize import all_numbers, find_dates
from .types import Candidate, DocText, FieldResult
from .validate import overall_status, resolve


def _locate_number(doc: DocText, value: float) -> Candidate | None:
    """Finds where a number appears in the bill text, for highlighting AI-read values."""
    for page in doc.pages:
        for line in page:
            for seg in line.segments:
                for v, _, _ in all_numbers(seg.text):
                    if abs(v - value) <= 0.5:
                        return Candidate(value, 0.0, line.page, seg.bbox, seg.text, "")
    return None


# Same plausibility limits the OCR candidates use; an AI value outside them is dropped, not shown
_AI_RANGES = {
    "units_kwh": (1, 8000),
    "amount_inr": (1, 300_000),
    "previous_reading": (0, 9_999_999),
    "present_reading": (0, 9_999_999),
    "multiplying_factor": (0.01, 1000),
    "import_kwh": (0, 8000),
    "export_kwh": (0, 8000),
}


def _apply_ai(doc: DocText, fields: dict[str, FieldResult], ai: dict, warnings: list[str]) -> None:
    def put(name: str, value, *, numeric: bool = True) -> None:
        if value is None:
            return
        lo, hi = _AI_RANGES.get(name, (float("-inf"), float("inf")))
        if numeric and not lo <= float(value) <= hi:
            warnings.append(f"AI read {name.replace('_', ' ')} as {value:g}, which isn't plausible for a home; ignored.")
            return
        current = fields.get(name)
        if current and current.confidence == "high":
            return
        loc = _locate_number(doc, float(value)) if numeric else None
        conf = "high" if loc else "medium"
        fields[name] = FieldResult(
            name, value, conf, 0.9 if loc else 0.65, "ai",
            loc.page if loc else None, loc.bbox if loc else None, loc.snippet if loc else None,
            "read by AI and found in the bill text" if loc else "read by AI; not found in OCR text, please check",
        )

    put("units_kwh", ai.get("units_kwh"))
    put("amount_inr", ai.get("amount_payable_inr"))
    put("previous_reading", ai.get("previous_reading"))
    put("present_reading", ai.get("present_reading"))
    if ai.get("multiplying_factor"):
        put("multiplying_factor", ai.get("multiplying_factor"))
    put("import_kwh", ai.get("import_kwh"))
    put("export_kwh", ai.get("export_kwh"))
    for key in ("period_start", "period_end"):
        raw = ai.get(key)
        if raw and fields[key].confidence != "high":
            try:
                d = date.fromisoformat(raw)
            except ValueError:
                continue
            if abs((d - date.today()).days) > 3 * 366:
                warnings.append(f"AI read the {key.replace('_', ' ')} as {d.isoformat()}, which is too far from today; ignored.")
                continue
            in_text = any(dd == d for dd, _ in find_dates(doc.full_text))
            fields[key] = FieldResult(key, d, "high" if in_text else "medium", 0.88 if in_text else 0.65, "ai",
                                      reason="read by AI" + ("" if in_text else "; please check"))
    if ai.get("notes"):
        warnings.append(f"AI note: {ai['notes']}")


def extract(data: bytes, *, allow_ai: bool = False) -> dict:
    t0 = time.perf_counter()
    doc, kind = acquire(data)
    discom = detect(doc.full_text)

    fields, warnings, derived = resolve(
        source=doc.source,
        units=F.numeric_candidates(doc, F.merged_unit_labels(discom), F.UNIT_EXCLUDE, lo=1, hi=8000, unit_hint=F.unit_hint()),
        amount=F.numeric_candidates(doc, F.merged_amount_labels(discom), F.AMOUNT_EXCLUDE, lo=1, hi=300000,
                                    unit_hint=F.amount_hint(), prefer_decimal=True),
        prev_reading=F.numeric_candidates(doc, F.PREV_READING, F.READING_EXCLUDE, lo=0, hi=9_999_999),
        present_reading=F.numeric_candidates(doc, F.PRESENT_READING, F.READING_EXCLUDE, lo=0, hi=9_999_999),
        mf=F.numeric_candidates(doc, F.MF_LABELS, None, lo=0.01, hi=1000),
        imports=F.numeric_candidates(doc, F.IMPORT_LABELS, None, lo=0, hi=8000, unit_hint=F.unit_hint()),
        exports=F.numeric_candidates(doc, F.EXPORT_LABELS, None, lo=0, hi=8000, unit_hint=F.unit_hint()),
        table=F.meter_table(doc),
        period=F.date_candidates(doc, F.PERIOD_LABELS, want="range"),
        prev_date=F.date_candidates(doc, F.PREV_DATE_LABELS),
        present_date=F.date_candidates(doc, F.PRESENT_DATE_LABELS),
        bill_date=F.date_candidates(doc, F.BILL_DATE_LABELS),
        due_date=F.date_candidates(doc, F.DUE_DATE_LABELS),
        cycle=discom.cycle,
    )

    needs_ai = fields["units_kwh"].confidence == "low" or fields["period_start"].value is None
    ai_used = False
    if needs_ai and allow_ai:
        try:
            ai = ai_read(pdf_bytes=data if kind == "pdf" else None, page_pngs=doc.previews)
            _apply_ai(doc, fields, ai, warnings)
            ai_used = True
        except AiUnavailable as exc:
            warnings.append(str(exc))

    consumer = F.consumer_number(doc)
    status = overall_status(fields)
    return {
        "status": status,
        "needs_ai": needs_ai and not ai_used,
        "ai_used": ai_used,
        "ai_provider": provider_name(),  # named in the consent text; None when AI isn't configured
        "file_kind": kind,
        "text_source": doc.source,
        "ocr_mean_conf": round(doc.mean_conf, 1),
        "discom": {"id": discom.id, "name": discom.name, "state": discom.state, "region": discom.region, "cycle": discom.cycle},
        "fields": {k: v.as_dict() for k, v in fields.items()},
        "derived": derived,
        "consumer": {"masked": consumer["masked"], "hash": consumer["hash"]} if consumer else None,
        "warnings": warnings,
        "pages": len(doc.pages),
        "previews": [base64.b64encode(p).decode() for p in doc.previews],
        "elapsed_ms": round((time.perf_counter() - t0) * 1000),
    }
