"""Groups positioned words into lines, and lines into segments (cells) split at large horizontal gaps."""

from statistics import median

from .normalize import fix_ocr_token, normalize_text
from .types import Line, Segment, Word

SEGMENT_GAP = 0.035  # fraction of page width that separates two cells on the same line


def clean_words(words: list[Word]) -> list[Word]:
    out = []
    for w in words:
        t = fix_ocr_token(normalize_text(w.text)).strip()
        if t:
            out.append(Word(t, w.x0, w.y0, w.x1, w.y1, w.page, w.conf))
    return out


def build_lines(words: list[Word], page: int) -> list[Line]:
    """Chains words left→right onto the nearest line by the y of that line's latest word.

    Following each line's own drift (instead of one global y) keeps rows intact on photos with
    residual tilt or keystone, where a value at the far right sits a little higher or lower than
    its label at the far left.
    """
    ws = sorted(clean_words([w for w in words if w.page == page]), key=lambda w: (w.x0, w.yc))
    if not ws:
        return []
    h = median(w.y1 - w.y0 for w in ws) or 0.01
    rows: list[list[Word]] = []
    for w in ws:
        best_i, best_d = -1, 0.6 * h
        for i, row in enumerate(rows):
            last = row[-1]
            if w.x0 < last.x0:  # rows only grow rightwards
                continue
            d = abs(w.yc - last.yc)
            if d < best_d:
                best_i, best_d = i, d
        if best_i >= 0:
            rows[best_i].append(w)
        else:
            rows.append([w])
    rows.sort(key=lambda r: sum(w.yc for w in r) / len(r))
    lines = []
    for i, row in enumerate(rows):
        row.sort(key=lambda w: w.x0)
        segments: list[Segment] = [Segment([row[0]])]
        for prev, cur in zip(row, row[1:]):
            gap = cur.x0 - prev.x1
            if gap > max(SEGMENT_GAP, 2.2 * h):
                segments.append(Segment([cur]))
            else:
                segments[-1].words.append(cur)
        lines.append(Line(segments=segments, page=page, index=i))
    return lines


def _row_yc(row: list[Word]) -> float:
    return sum(w.yc for w in row) / len(row)
