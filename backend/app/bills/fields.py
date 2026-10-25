"""Candidate generation for each bill field.

A label (English or Hindi, exact or OCR-fuzzy) anchors a search for the value in three places:
the rest of the label's own cell, the next cell on the same line, and the cell directly below
(table layouts). Every candidate keeps its page, bounding box and snippet for the review UI.
Distractors common on Indian bills are penalised: the 6/12-month consumption history table,
sanctioned load (kW, not kWh), per-unit tariff rates, late-payment amounts, arrears.
"""

import hashlib
import os
import re
from dataclasses import dataclass
from datetime import date

from rapidfuzz import fuzz

from .discoms import Discom
from .normalize import all_numbers, contains_month_name, find_dates, mask_dates
from .types import Candidate, DocText, Line, Segment


@dataclass(frozen=True)
class Label:
    text: str
    weight: float


def _labels(pairs: list[tuple[str, float]]) -> list[Label]:
    return [Label(t, w) for t, w in pairs]


UNIT_LABELS = _labels([
    ("net billed units", 0.93), ("billed units", 0.9), ("units billed", 0.9), ("total units consumed", 0.9),
    ("units consumed", 0.88), ("consumed units", 0.88), ("consumption (kwh)", 0.9), ("consumption (units)", 0.88),
    ("units consumed (kwh)", 0.92), ("kwh consumed", 0.88), ("energy consumed", 0.84), ("energy consumption", 0.84),
    ("billed energy", 0.84), ("total consumption", 0.82), ("units (kwh)", 0.85), ("total units", 0.8),
    ("net units", 0.8), ("consumption", 0.7), ("units", 0.55), ("kwh", 0.6),
    ("बिल की गई यूनिट", 0.88), ("उपभोग", 0.75), ("खपत", 0.75), ("यूनिट", 0.55),
])
UNIT_EXCLUDE = re.compile(
    r"\b(avg|average|last year|previous year|same month|rate|per unit|/unit|slab|sanction|load|contract|demand|kva\b|"
    r"subsid|free|history|connected|tariff|charge|duty|fixed|import|export|imported|exported)\b|\bkw\b(?!h)",
    re.IGNORECASE,
)

AMOUNT_LABELS = _labels([
    ("amount payable before due date", 0.94), ("amount payable by due date", 0.94), ("payable by due date", 0.92),
    ("payable on or before", 0.92), ("net amount payable", 0.92), ("total amount payable", 0.9),
    ("amount payable", 0.88), ("net payable", 0.88), ("total payable", 0.86), ("payable amount", 0.86),
    ("net amt due", 0.86), ("net amount due", 0.86), ("total amount due", 0.86), ("amount due", 0.8),
    ("current bill amount", 0.8), ("total bill amount", 0.8), ("total amount", 0.8), ("bill amount", 0.78), ("grand total", 0.74),
    ("कुल देय", 0.86), ("देय राशि", 0.85),
])
AMOUNT_EXCLUDE = re.compile(
    r"\b(after|late|lpsc|surcharge|delay|previous|last pay|paid|subsid|security|deposit|rebate|advance|arrear|"
    r"rate|per unit|energy charge|fixed charge|duty|tax|meter rent)\b",
    re.IGNORECASE,
)

PREV_READING = _labels([("previous reading", 0.9), ("prev reading", 0.9), ("prev. reading", 0.9), ("last reading", 0.85),
                        ("old reading", 0.85), ("opening reading", 0.85), ("initial reading", 0.8), ("पिछली रीडिंग", 0.85)])
PRESENT_READING = _labels([("present reading", 0.9), ("current reading", 0.9), ("curr reading", 0.88), ("new reading", 0.85),
                           ("closing reading", 0.85), ("final reading", 0.8), ("वर्तमान रीडिंग", 0.85)])
MF_LABELS = _labels([("multiplying factor", 0.9), ("multiplication factor", 0.9), ("meter constant", 0.8), ("m.f", 0.85), ("mf", 0.75)])
READING_EXCLUDE = re.compile(r"\bdate\b|\bdt\b|तिथि|दिनांक", re.IGNORECASE)

PERIOD_LABELS = _labels([("billing period", 0.92), ("bill period", 0.92), ("period of bill", 0.9), ("consumption period", 0.9),
                         ("reading period", 0.88), ("बिल अवधि", 0.88), ("period", 0.7)])
PREV_DATE_LABELS = _labels([("previous reading date", 0.9), ("prev reading date", 0.9), ("last reading date", 0.88),
                            ("previous read date", 0.88), ("date of previous reading", 0.9)])
PRESENT_DATE_LABELS = _labels([("present reading date", 0.9), ("current reading date", 0.9), ("present read date", 0.88),
                               ("meter reading date", 0.82), ("reading date", 0.78), ("date of reading", 0.8)])
BILL_DATE_LABELS = _labels([("bill date", 0.9), ("bill issue date", 0.9), ("date of bill", 0.88), ("issue date", 0.8), ("bill dt", 0.85)])
DUE_DATE_LABELS = _labels([("due date", 0.9), ("pay by", 0.85), ("last date", 0.8)])
CONSUMER_LABELS = _labels([("consumer no", 0.9), ("consumer number", 0.9), ("consumer id", 0.88), ("ca no", 0.9), ("ca number", 0.9),
                           ("contract account", 0.88), ("account no", 0.85), ("account number", 0.85), ("k no", 0.85), ("k. no", 0.85),
                           ("service connection no", 0.88), ("sc no", 0.82), ("service no", 0.82), ("bp no", 0.85), ("uscno", 0.88)])
IMPORT_LABELS = _labels([("import (kwh)", 0.9), ("import kwh", 0.9), ("import units", 0.88), ("energy imported", 0.88), ("import", 0.6)])
EXPORT_LABELS = _labels([("export (kwh)", 0.9), ("export kwh", 0.9), ("export units", 0.88), ("energy exported", 0.88), ("export", 0.6)])


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower()).strip()


def _match(segment_text: str, labels: list[Label]) -> tuple[Label, int] | None:
    """Best label found in the segment, with the char index where its text ends."""
    low = _norm(segment_text)
    best: tuple[Label, int] | None = None
    for lab in labels:
        m = re.search(rf"(?<![a-z]){re.escape(lab.text)}(?![a-z])", low)
        if m and (best is None or lab.weight > best[0].weight):
            best = (lab, m.end())
    if best:
        return best
    # OCR-noisy labels ("Bi11ed Unlts"): fuzzy match only multi-word labels to avoid junk hits
    for lab in labels:
        if " " in lab.text and len(low) <= len(lab.text) + 30 and fuzz.partial_ratio(lab.text, low) >= 88:
            if best is None or lab.weight > best[0].weight:
                best = (Label(lab.text, lab.weight - 0.08), len(low))
    return best


def _is_history_line(line: Line) -> bool:
    nums = all_numbers(mask_dates(line.text))
    return contains_month_name(line.text) and len(nums) >= 2


def _seg_after(segment: Segment, end_char: int) -> str:
    return segment.text[end_char:] if end_char < len(segment.text) else ""


def _below(lines: list[Line], line: Line, seg: Segment, max_rows: int = 3) -> list[tuple[Line, Segment]]:
    x0, _, x1, _ = seg.bbox
    out = []
    for nxt in lines[line.index + 1 : line.index + 1 + max_rows]:
        for s in nxt.segments:
            sx0, _, sx1, _ = s.bbox
            overlap = min(x1, sx1) - max(x0, sx0)
            if overlap > 0.3 * min(x1 - x0, sx1 - sx0) or abs((sx0 + sx1) / 2 - (x0 + x1) / 2) < 0.06:
                out.append((nxt, s))
    return out


def _right(line: Line, seg_index: int, max_segments: int = 2) -> list[Segment]:
    return line.segments[seg_index + 1 : seg_index + 1 + max_segments]


def numeric_candidates(
    doc: DocText,
    labels: list[Label],
    exclude: re.Pattern | None,
    *,
    lo: float,
    hi: float,
    unit_hint: re.Pattern | None = None,
    prefer_decimal: bool = False,
) -> list[Candidate]:
    out: list[Candidate] = []
    for page in doc.pages:
        for line in page:
            history = _is_history_line(line)
            for si, seg in enumerate(line.segments):
                found = _match(seg.text, labels)
                if not found:
                    continue
                label, end = found
                if exclude and exclude.search(seg.text[:end + 12]):
                    continue
                places: list[tuple[Segment, str, float, str]] = [(seg, _seg_after(seg, end), 1.0, "same cell")]
                places += [(s, s.text, 0.97, "right of label") for s in _right(line, si)]
                places += [(s, s.text, 0.93, "below label") for _, s in _below(page, line, seg)]
                for where, text, factor, reason in places:
                    nums = all_numbers(mask_dates(text))
                    if not nums:
                        continue
                    if prefer_decimal:
                        nums.sort(key=lambda n: 0 if (n[0] % 1 or "." in text[n[1]:n[2]]) else 1)
                    value = nums[0][0]
                    score = label.weight * factor
                    if not (lo <= value <= hi):
                        score -= 0.5
                    if unit_hint and unit_hint.search(seg.text + " " + where.text):
                        score += 0.05
                    if history and not re.search(r"current|this month|present", seg.text, re.I):
                        score -= 0.35
                    wconf = min(w.conf for w in where.words)
                    if wconf < 60:
                        score -= 0.2
                    out.append(
                        Candidate(value, score, line.page, where.bbox, f"{seg.text} → {where.text}".strip(),
                                  f"{label.text!r} label, value {reason}", wconf)
                    )
                    break  # first place with a number wins for this label occurrence
    return out


def meter_table(doc: DocText) -> dict:
    """Reads a meter-reading table by column: Previous | Present | MF | Units."""
    header_rx = {
        "prev": re.compile(r"prev|previous|last|old|opening|पिछली", re.I),
        "present": re.compile(r"present|current|curr|new|closing|वर्तमान", re.I),
        "mf": re.compile(r"\bm\.?f\.?\b|multipl", re.I),
        "units": re.compile(r"units|consum|kwh|यूनिट|खपत", re.I),
    }
    for page in doc.pages:
        for line in page:
            cols: dict[str, float] = {}
            for seg in line.segments:
                for key, rx in header_rx.items():
                    if key not in cols and rx.search(seg.text):
                        cols[key] = (seg.bbox[0] + seg.bbox[2]) / 2
                        break
            if not {"prev", "present"} <= cols.keys() or READING_EXCLUDE.search(line.text):
                continue  # a "Previous Reading Date / Present Reading Date" line is not the table header
            for row in page[line.index + 1 : line.index + 4]:
                found: dict[str, tuple[float, tuple]] = {}
                for seg in row.segments:
                    nums = all_numbers(mask_dates(seg.text))
                    if not nums:
                        continue
                    xc = (seg.bbox[0] + seg.bbox[2]) / 2
                    key = min(cols, key=lambda k: abs(cols[k] - xc))
                    if abs(cols[key] - xc) < 0.12 and key not in found:
                        found[key] = (nums[0][0], seg.bbox)
                if "prev" in found and "present" in found:
                    return {k: {"value": v, "bbox": b, "page": row.page} for k, (v, b) in found.items()}
    return {}


def date_candidates(doc: DocText, labels: list[Label], *, want: str = "single") -> list[Candidate]:
    """Dates near a label. want='range' returns candidates whose value is a (start, end) tuple."""
    out: list[Candidate] = []
    for page in doc.pages:
        for line in page:
            for si, seg in enumerate(line.segments):
                found = _match(seg.text, labels)
                if not found:
                    continue
                label, end = found
                texts = [(seg, _seg_after(seg, end), 1.0)] + [(s, s.text, 0.95) for s in _right(line, si, 3)]
                texts += [(s, s.text, 0.9) for _, s in _below(page, line, seg, 2)]
                if want == "range":
                    # Try each place on its own, plus "rest of cell + next cell" for split layouts.
                    places = [(seg, texts[0][1], 1.0)]
                    if len(texts) > 1:
                        places.append((texts[1][0], f"{texts[0][1]} {texts[1][1]}", 0.97))
                    places += texts[1:]
                    for where, text, factor in places:
                        dates = [d for d, _ in find_dates(text)]
                        if len(dates) >= 2 and dates[0] < dates[1]:
                            out.append(Candidate((dates[0], dates[1]), label.weight * factor, line.page, where.bbox,
                                                 f"{seg.text} → {text.strip()}", f"{label.text!r} label with two dates"))
                            break
                    continue
                for where, text, factor in texts:
                    dates = find_dates(text)
                    if dates:
                        out.append(Candidate(dates[0][0], label.weight * factor, line.page, where.bbox,
                                             f"{seg.text} → {where.text}", f"{label.text!r} label"))
                        break
    return out


def consumer_number(doc: DocText) -> dict | None:
    for page in doc.pages:
        for line in page:
            for si, seg in enumerate(line.segments):
                found = _match(seg.text, CONSUMER_LABELS)
                if not found:
                    continue
                _, end = found
                for text in [_seg_after(seg, end)] + [s.text for s in _right(line, si)]:
                    m = re.search(r"\b([A-Z0-9][A-Z0-9/-]{5,17})\b", text.upper())
                    if m and sum(c.isdigit() for c in m.group(1)) >= 5:
                        raw = re.sub(r"[^A-Z0-9]", "", m.group(1))
                        salt = os.getenv("BILL_HASH_SALT", "carbon-wallet-dev")
                        return {
                            "masked": f"••••{raw[-4:]}",
                            "hash": hashlib.sha256(f"{salt}:{raw}".encode()).hexdigest(),
                        }
    return None


def amount_hint() -> re.Pattern:
    return re.compile(r"₹|rs\.?|inr|amount|payable", re.I)


def unit_hint() -> re.Pattern:
    return re.compile(r"kwh|units?|यूनिट", re.I)


def _boost(labels: tuple[str, ...]) -> list[Label]:
    # Specific multi-word wording from the discom template wins; single generic words only get a nudge.
    return [Label(t, 0.95 if " " in t else 0.72) for t in labels]


def merged_unit_labels(discom: Discom) -> list[Label]:
    return _boost(discom.unit_labels) + UNIT_LABELS


def merged_amount_labels(discom: Discom) -> list[Label]:
    return _boost(discom.amount_labels) + AMOUNT_LABELS


def days_between(a: date, b: date) -> int:
    return (b - a).days
