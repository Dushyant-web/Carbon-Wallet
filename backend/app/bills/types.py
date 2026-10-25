"""Shared data types for bill extraction. Coordinates are normalised to 0..1 of the page."""

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

Source = Literal["pdf_text", "ocr", "ai"]
Confidence = Literal["high", "medium", "low"]


@dataclass(frozen=True)
class Word:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    page: int
    conf: float = 100.0  # OCR confidence 0..100; digital PDF text is 100

    @property
    def xc(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def yc(self) -> float:
        return (self.y0 + self.y1) / 2


@dataclass
class Segment:
    """A run of words on one line with no large horizontal gap: usually one label or one cell."""

    words: list[Word]

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)

    @property
    def bbox(self) -> tuple[float, float, float, float]:
        return (
            min(w.x0 for w in self.words),
            min(w.y0 for w in self.words),
            max(w.x1 for w in self.words),
            max(w.y1 for w in self.words),
        )


@dataclass
class Line:
    segments: list[Segment]
    page: int
    index: int  # order within the page

    @property
    def words(self) -> list[Word]:
        return [w for s in self.segments for w in s.words]

    @property
    def text(self) -> str:
        return "  ".join(s.text for s in self.segments)

    @property
    def bbox(self) -> tuple[float, float, float, float]:
        ws = self.words
        return (min(w.x0 for w in ws), min(w.y0 for w in ws), max(w.x1 for w in ws), max(w.y1 for w in ws))


@dataclass
class DocText:
    pages: list[list[Line]]
    source: Source
    mean_conf: float
    previews: list[bytes] = field(default_factory=list)  # PNG per page, same geometry as the coordinates

    @property
    def lines(self) -> list[Line]:
        return [ln for page in self.pages for ln in page]

    @property
    def full_text(self) -> str:
        return "\n".join(ln.text for ln in self.lines)


@dataclass
class Candidate:
    value: object
    score: float
    page: int
    bbox: tuple[float, float, float, float]
    snippet: str
    reason: str
    min_word_conf: float = 100.0


@dataclass
class FieldResult:
    name: str
    value: object | None
    confidence: Confidence
    score: float
    source: Source
    page: int | None = None
    bbox: tuple[float, float, float, float] | None = None
    snippet: str | None = None
    reason: str | None = None
    alternates: list[object] = field(default_factory=list)

    def as_dict(self) -> dict:
        v = self.value.isoformat() if isinstance(self.value, date) else self.value
        alts = [a.isoformat() if isinstance(a, date) else a for a in self.alternates]
        return {
            "value": v,
            "confidence": self.confidence,
            "score": round(self.score, 3),
            "source": self.source,
            "page": self.page,
            "bbox": [round(c, 4) for c in self.bbox] if self.bbox else None,
            "snippet": self.snippet,
            "reason": self.reason,
            "alternates": alts,
        }


def confidence_for(score: float) -> Confidence:
    if score >= 0.85:
        return "high"
    if score >= 0.6:
        return "medium"
    return "low"
