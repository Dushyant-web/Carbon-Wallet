"""Turns an uploaded file (digital PDF, scanned PDF, photo) into positioned words + page previews.

Digital PDFs are read directly (exact text, no OCR). Scans and phone photos go through document
detection, perspective correction, deskew and Tesseract with several variants; the best-scoring
variant wins. Preview PNGs share the coordinate space of the returned words, so the UI can draw
highlight boxes exactly where a value was found.
"""

import io
import math
import os
import re
from pathlib import Path

import cv2
import numpy as np
import pdfplumber
import pypdfium2 as pdfium
import pytesseract
from PIL import Image, ImageOps

from .layout import build_lines
from .types import DocText, Word

try:  # iPhone photos
    import pillow_heif

    pillow_heif.register_heif_opener()
except Exception:  # pragma: no cover - optional
    pass

TESSDATA = Path(os.getenv("TESSDATA_DIR", Path(__file__).resolve().parents[2] / "tessdata"))
MAX_PAGES = 3
PREVIEW_WIDTH = 1100
MIN_PDF_WORDS = 25


class UnsupportedFile(ValueError):
    pass


def sniff(data: bytes) -> str:
    if data[:5] == b"%PDF-":
        return "pdf"
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[4:12] in (b"ftypheic", b"ftypheix", b"ftypmif1", b"ftyphevc", b"ftypmsf1"):
        return "heic"
    raise UnsupportedFile("Upload a PDF, JPG, PNG or HEIC bill.")


def _lang() -> str:
    return "eng+hin" if (TESSDATA / "hin.traineddata").exists() else "eng"


def _tess_config(psm: int) -> str:
    return f'--oem 1 --psm {psm} --tessdata-dir "{TESSDATA}"' if TESSDATA.exists() else f"--oem 1 --psm {psm}"


def _png(img: np.ndarray | Image.Image) -> bytes:
    pil = img if isinstance(img, Image.Image) else Image.fromarray(img)
    if pil.width > PREVIEW_WIDTH:
        pil = pil.resize((PREVIEW_WIDTH, round(pil.height * PREVIEW_WIDTH / pil.width)), Image.LANCZOS)
    buf = io.BytesIO()
    pil.convert("RGB").save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------- digital PDF


def _pdf_text(data: bytes) -> DocText | None:
    words: list[Word] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = pdf.pages[:MAX_PAGES]
        for p, page in enumerate(pages):
            for w in page.extract_words(keep_blank_chars=False, use_text_flow=False):
                words.append(
                    Word(w["text"], w["x0"] / page.width, w["top"] / page.height, w["x1"] / page.width, w["bottom"] / page.height, p)
                )
        n_pages = len(pages)
    if len(words) < MIN_PDF_WORDS:
        return None
    previews = _render_pdf(data, n_pages)
    return DocText(pages=[build_lines(words, p) for p in range(n_pages)], source="pdf_text", mean_conf=100.0, previews=previews)


def _render_pdf(data: bytes, n_pages: int, dpi: int = 110) -> list[bytes]:
    pdf = pdfium.PdfDocument(data)
    out = [_png(pdf[i].render(scale=dpi / 72).to_pil()) for i in range(min(n_pages, len(pdf)))]
    pdf.close()
    return out


def _pdf_pages_as_images(data: bytes, dpi: int = 300) -> list[Image.Image]:
    pdf = pdfium.PdfDocument(data)
    imgs = [pdf[i].render(scale=dpi / 72).to_pil() for i in range(min(MAX_PAGES, len(pdf)))]
    pdf.close()
    return imgs


# ---------------------------------------------------------------- image cleanup


def _order_quad(pts: np.ndarray) -> np.ndarray:
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], dtype="float32")


def _flatten_document(gray: np.ndarray) -> np.ndarray:
    """If a photo shows the bill on a background, find its 4 corners and warp it flat."""
    h, w = gray.shape
    small_scale = 800 / max(h, w)
    small = cv2.resize(gray, (round(w * small_scale), round(h * small_scale)))
    edges = cv2.Canny(cv2.GaussianBlur(small, (5, 5), 0), 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
        area = cv2.contourArea(approx)
        if len(approx) == 4 and 0.35 * small.size < area < 0.97 * small.size:
            quad = _order_quad(approx.reshape(4, 2).astype("float32") / small_scale)
            tl, tr, br, bl = quad
            width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
            height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
            dst = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype="float32")
            return cv2.warpPerspective(gray, cv2.getPerspectiveTransform(quad, dst), (width, height))
    return gray


def _orient(gray: np.ndarray) -> np.ndarray:
    """Fix 90/180/270° rotations with Tesseract's orientation detection."""
    try:
        osd = pytesseract.image_to_osd(gray, config=f'--psm 0 --tessdata-dir "{TESSDATA}"' if TESSDATA.exists() else "--psm 0")
        m = re.search(r"Rotate: (\d+)", osd)
        conf = re.search(r"Orientation confidence: ([\d.]+)", osd)
        rotate = int(m.group(1)) if m else 0
        if rotate and conf and float(conf.group(1)) > 1.5:
            k = {90: 3, 180: 2, 270: 1}[rotate]  # Tesseract reports clockwise degrees to correct
            return np.ascontiguousarray(np.rot90(gray, k))
    except pytesseract.TesseractError:
        pass
    return gray


def _line_blob_angle(gray: np.ndarray) -> float | None:
    """Skew from text lines: merge characters into line blobs, fit each blob's axis, take the weighted median.

    Table borders and logos are ignored because only long, thin, line-shaped blobs vote.
    """
    h, w = gray.shape
    scale = 1400 / max(h, w)
    small = cv2.resize(gray, (round(w * scale), round(h * scale)))
    binv = cv2.adaptiveThreshold(small, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 25, 15)
    # drop long straight rules (table lines) so they don't dominate
    horiz = cv2.morphologyEx(binv, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (60, 1)))
    binv = cv2.subtract(binv, horiz)
    blobs = cv2.dilate(binv, cv2.getStructuringElement(cv2.MORPH_RECT, (21, 3)), iterations=1)
    contours, _ = cv2.findContours(blobs, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    votes: list[tuple[float, float]] = []
    for c in contours:
        x, y, bw, bh = cv2.boundingRect(c)
        if bw < 60 or bh > 50 or bw < 5 * bh:
            continue
        vx, vy, _, _ = cv2.fitLine(c.astype(np.float32), cv2.DIST_L2, 0, 0.01, 0.01).ravel()
        angle = math.degrees(math.atan2(vy, vx))
        if angle > 45:
            angle -= 180
        elif angle < -45:
            angle += 180
        if abs(angle) <= 15:
            votes.append((angle, float(bw)))
    if len(votes) < 5:
        return None
    votes.sort()
    total = sum(wt for _, wt in votes)
    acc = 0.0
    for angle, wt in votes:
        acc += wt
        if acc >= total / 2:
            return angle
    return None


def _profile_angle(gray: np.ndarray) -> float:
    """Fallback skew: the angle that maximises the variance of row ink profiles."""
    h, w = gray.shape
    scale = 900 / max(h, w)
    small = cv2.resize(gray, (round(w * scale), round(h * scale)))
    binv = cv2.threshold(small, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

    def score_at(angle: float) -> float:
        m = cv2.getRotationMatrix2D((binv.shape[1] / 2, binv.shape[0] / 2), angle, 1)
        rot = cv2.warpAffine(binv, m, (binv.shape[1], binv.shape[0]), flags=cv2.INTER_NEAREST)
        return float(np.var(rot.sum(axis=1)))

    coarse = max(np.arange(-7, 7.01, 0.5), key=score_at)
    return float(max(np.arange(coarse - 0.5, coarse + 0.51, 0.1), key=score_at))


def _deskew(gray: np.ndarray) -> np.ndarray:
    angle = _line_blob_angle(gray)
    if angle is None:
        angle = _profile_angle(gray)
    if abs(angle) < 0.15:
        return gray
    h, w = gray.shape
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1)
    return cv2.warpAffine(gray, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def prepare_image(img: Image.Image) -> np.ndarray:
    img = ImageOps.exif_transpose(img).convert("RGB")
    gray = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
    long_side = max(gray.shape)
    if long_side < 1800:
        f = 2200 / long_side
        gray = cv2.resize(gray, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC)
    elif long_side > 4200:
        f = 3600 / long_side
        gray = cv2.resize(gray, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
    gray = _flatten_document(gray)
    gray = _orient(gray)
    gray = _deskew(gray)
    return gray


# ---------------------------------------------------------------- OCR


def _ocr_words(img: np.ndarray, page: int, psm: int) -> tuple[list[Word], float]:
    data = pytesseract.image_to_data(img, lang=_lang(), config=_tess_config(psm), output_type=pytesseract.Output.DICT)
    h, w = img.shape[:2]
    words, confs = [], []
    for i, text in enumerate(data["text"]):
        conf = float(data["conf"][i])
        if conf < 0 or not text.strip():
            continue
        x, y, bw, bh = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
        words.append(Word(text, x / w, y / h, (x + bw) / w, (y + bh) / h, page, conf))
        confs.append(conf)
    mean = sum(confs) / len(confs) if confs else 0.0
    return words, mean


def ocr_page(gray: np.ndarray, page: int) -> tuple[list[Word], float]:
    """Tries plain grey and adaptive-binarised variants at two layouts; keeps the best."""
    denoised = cv2.medianBlur(gray, 3)
    binary = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)
    best: tuple[list[Word], float] = ([], 0.0)
    best_score = -1.0
    for img, psm in ((gray, 6), (binary, 6), (gray, 4)):
        words, mean = _ocr_words(img, page, psm)
        score = mean * math.log(len(words) + 1)
        if score > best_score:
            best, best_score = (words, mean), score
    return best


def _ocr_images(images: list[Image.Image]) -> DocText:
    pages, previews, confs = [], [], []
    for p, img in enumerate(images[:MAX_PAGES]):
        gray = prepare_image(img)
        words, mean = ocr_page(gray, p)
        pages.append(build_lines(words, p))
        previews.append(_png(gray))
        confs.append(mean)
    return DocText(pages=pages, source="ocr", mean_conf=sum(confs) / len(confs) if confs else 0.0, previews=previews)


def acquire(data: bytes) -> tuple[DocText, str]:
    kind = sniff(data)
    if kind == "pdf":
        digital = _pdf_text(data)
        if digital:
            return digital, kind
        return _ocr_images(_pdf_pages_as_images(data)), kind
    img = Image.open(io.BytesIO(data))
    return _ocr_images([img]), kind
