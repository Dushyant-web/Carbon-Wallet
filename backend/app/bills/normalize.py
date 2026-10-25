"""Text normalisation for Indian electricity bills: OCR digit fixes, Indian number format, dates."""

import re
import unicodedata
from datetime import date

# Hindi digits ० १ २ … ९ → ASCII
_DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

# Only applied inside tokens that are mostly digits, so words like "BILL" are never touched.
_OCR_DIGIT_FIX = str.maketrans({"O": "0", "o": "0", "D": "0", "l": "1", "I": "1", "|": "1", "S": "5", "B": "8", "Z": "2"})

NUMBER_RE = re.compile(r"(?<![\w.])(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d+))?(?!\d)")
_CURRENCY = re.compile(r"(₹|\bRs\.?|\bINR\b|/-)", re.IGNORECASE)

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "sept": 9,
    "oct": 10, "nov": 11, "dec": 12,
    # Hindi month names as printed on bilingual bills
    "जनवरी": 1, "फरवरी": 2, "मार्च": 3, "अप्रैल": 4, "मई": 5, "जून": 6, "जुलाई": 7, "अगस्त": 8,
    "सितंबर": 9, "सितम्बर": 9, "अक्टूबर": 10, "नवंबर": 11, "नवम्बर": 11, "दिसंबर": 12, "दिसम्बर": 12,
}

_DMY = re.compile(r"(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?!\d)")
_D_MON_Y = re.compile(r"(?<!\d)(\d{1,2})[-\s.]?([A-Za-z]{3,9}|[ऀ-ॿ]+)[-\s.,']*(\d{2,4})(?!\d)")
_MON_D_Y = re.compile(r"\b([A-Za-z]{3,9})[-\s.]+(\d{1,2}),?[-\s.]+(\d{4})(?!\d)")
_YMD = re.compile(r"(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)")


def normalize_text(text: str) -> str:
    return unicodedata.normalize("NFKC", text).translate(_DEVANAGARI_DIGITS)


def fix_ocr_token(token: str) -> str:
    """Repairs common OCR confusions inside numeric-looking tokens (e.g. '24O' → '240', '1,2S0' → '1,250')."""
    core = token.strip("₹:()[]")
    if not core:
        return token
    digits = sum(c.isdigit() for c in core)
    fixable = sum(c in "OoDlI|SBZ" for c in core)
    if digits >= 1 and digits + fixable == sum(c.isalnum() or c == "|" for c in core) and digits >= fixable:
        return token.translate(_OCR_DIGIT_FIX)
    return token


_SPLIT_GROUP = re.compile(r"(\d),\s+(?=\d{2,3}(?:\.\d+)?\b)")


def _prep(text: str) -> str:
    # OCR often inserts a space after a grouping comma: "6, 198.54" → "6,198.54"
    return _SPLIT_GROUP.sub(r"\1,", _CURRENCY.sub(" ", text))


def parse_number(text: str) -> float | None:
    """First number in text; understands Indian grouping (1,23,456.78) and Rs./₹ prefixes."""
    m = NUMBER_RE.search(_prep(text))
    if not m:
        return None
    whole = m.group(1).replace(",", "")
    frac = m.group(2)
    try:
        return float(f"{whole}.{frac}") if frac else float(whole)
    except ValueError:
        return None


def all_numbers(text: str) -> list[tuple[float, int, int]]:
    """All numbers with their character span."""
    out = []
    for m in NUMBER_RE.finditer(_prep(text)):
        whole = m.group(1).replace(",", "")
        frac = m.group(2)
        try:
            out.append((float(f"{whole}.{frac}") if frac else float(whole), m.start(), m.end()))
        except ValueError:
            continue
    return out


def _year(y: str) -> int:
    v = int(y)
    return 2000 + v if v < 100 else v


def _safe_date(y: int, m: int, d: int) -> date | None:
    try:
        dt = date(y, m, d)
    except ValueError:
        return None
    return dt if 2010 <= dt.year <= 2040 else None


def find_dates(text: str) -> list[tuple[date, int]]:
    """All plausible dates in text, day-first (Indian convention), with their position."""
    found: list[tuple[date, int]] = []
    for m in _YMD.finditer(text):
        d = _safe_date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if d:
            found.append((d, m.start()))
    for m in _DMY.finditer(text):
        if any(abs(pos - m.start()) < 3 for _, pos in found):
            continue
        d = _safe_date(_year(m.group(3)), int(m.group(2)), int(m.group(1)))
        if d:
            found.append((d, m.start()))
    for m in _D_MON_Y.finditer(text):
        mon = MONTHS.get(m.group(2).lower()[:4].rstrip(".")) or MONTHS.get(m.group(2).lower()[:3]) or MONTHS.get(m.group(2))
        if mon:
            d = _safe_date(_year(m.group(3)), mon, int(m.group(1)))
            if d:
                found.append((d, m.start()))
    for m in _MON_D_Y.finditer(text):
        mon = MONTHS.get(m.group(1).lower()[:3])
        if mon:
            d = _safe_date(int(m.group(3)), mon, int(m.group(2)))
            if d:
                found.append((d, m.start()))
    found.sort(key=lambda t: t[1])
    return found


def contains_month_name(text: str) -> bool:
    low = text.lower()
    return any(re.search(rf"\b{m}\b", low) for m in ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"))


def mask_dates(text: str) -> str:
    """Blanks out date substrings (same length) so their digits aren't read as quantities."""
    out = text
    for rx in (_YMD, _DMY, _D_MON_Y, _MON_D_Y):
        out = rx.sub(lambda m: " " * len(m.group(0)), out)
    return out
