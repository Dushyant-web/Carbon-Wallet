"""Synthetic Indian electricity bills for measuring extraction accuracy (dev/test only; needs reportlab).

Five layouts × many discom headers, each with the distractors real bills carry: a consumption
history table, sanctioned load in kW, per-unit tariff rates, an after-due-date amount, arrears.
`photo()` turns a bill into a phone-camera shot (tilt, perspective, background, blur, JPEG noise).
"""

import io
import random
from dataclasses import dataclass
from datetime import date, timedelta

import cv2
import numpy as np
import pypdfium2 as pdfium
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

DISCOM_HEADERS = {
    "bses_rajdhani": "BSES Rajdhani Power Limited",
    "tpddl": "Tata Power-DDL (Tata Power Delhi Distribution Ltd)",
    "pvvnl": "Paschimanchal Vidyut Vitran Nigam Ltd (PVVNL) - UPPCL",
    "npcl": "Noida Power Company Limited (NPCL)",
    "dhbvn": "Dakshin Haryana Bijli Vitran Nigam (DHBVN)",
    "msedcl": "Maharashtra State Electricity Distribution Co. Ltd (MSEDCL)",
    "aeml": "Adani Electricity Mumbai Limited",
    "torrent": "Torrent Power Limited",
    "bescom": "BESCOM - Bangalore Electricity Supply Company",
    "tangedco": "TANGEDCO - Tamil Nadu Generation and Distribution Corporation",
    "kseb": "KSEB - Kerala State Electricity Board",
    "tgspdcl": "TGSPDCL - Southern Power Distribution Company of Telangana",
}
BIMONTHLY = {"tangedco", "kseb"}
LAYOUTS = ("label_value", "meter_table", "stacked", "south_compact", "solar_net")


@dataclass
class Truth:
    discom: str
    layout: str
    units: float
    amount: float
    start: date
    end: date
    prev: int
    present: int


def _fmt_inr(x: float) -> str:
    whole, frac = f"{x:.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    return f"{whole}.{frac}"


def _d(d: date, style: int) -> str:
    return [d.strftime("%d-%m-%Y"), d.strftime("%d/%m/%Y"), d.strftime("%d-%b-%Y"), d.strftime("%d %b %Y")][style % 4]


def make_bill(seed: int, discom: str | None = None, layout: str | None = None) -> tuple[bytes, Truth]:
    rnd = random.Random(seed)
    discom = discom or rnd.choice(list(DISCOM_HEADERS))
    layout = layout or rnd.choice(LAYOUTS)
    days = 60 if discom in BIMONTHLY else rnd.choice([29, 30, 31])
    start = date(2025, 1, 1) + timedelta(days=rnd.randint(0, 600))
    end = start + timedelta(days=days)
    units = rnd.randint(80, 900) * (2 if discom in BIMONTHLY else 1)
    prev = rnd.randint(10000, 60000)
    present = prev + units
    rate = rnd.uniform(4.5, 8.5)
    fixed = rnd.choice([50, 110, 125, 200, 250])
    amount = round(units * rate + fixed, 2)
    after_due = round(amount * 1.02, 2)
    ds = rnd.randint(0, 3)
    export = rnd.randint(50, 300) if layout == "solar_net" else 0
    if layout == "solar_net":
        imported = units + export
        present = prev + imported
    truth = Truth(discom, layout, float(units), amount, start, end, prev, present)

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 50

    def text(x, yy, s, size=10, bold=False):
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(x, yy, s)

    text(40, y, DISCOM_HEADERS[discom], 14, True)
    y -= 18
    text(40, y, "ELECTRICITY BILL", 11, True)
    text(330, y, f"Bill Date: {_d(end + timedelta(days=3), ds)}")
    y -= 16
    text(40, y, f"Consumer No: {rnd.randint(10**9, 10**10 - 1)}")
    text(330, y, f"Due Date: {_d(end + timedelta(days=18), ds)}")
    y -= 16
    text(40, y, f"Sanctioned Load: {rnd.choice([2, 3, 4, 5])} kW")
    text(330, y, "Tariff: Domestic (DS-II)")
    y -= 28

    if layout in ("label_value", "solar_net"):
        rows = [
            ("Billing Period", f"{_d(start, ds)} to {_d(end, ds)}"),
            ("Previous Reading", f"{prev}"),
            ("Present Reading", f"{present}"),
            ("Multiplying Factor", "1"),
        ]
        if layout == "solar_net":
            rows += [("Import (kWh)", f"{units + export}"), ("Export (kWh)", f"{export}"), ("Net Billed Units", f"{units}")]
        else:
            rows += [("Units Consumed", f"{units} kWh")]
        rows += [
            ("Energy Charge Rate", f"Rs. {rate:.2f} /unit"),
            ("Fixed Charges", f"Rs. {fixed:.2f}"),
            ("Net Amount Payable", f"Rs. {_fmt_inr(amount)}"),
            ("Amount Payable after Due Date", f"Rs. {_fmt_inr(after_due)}"),
        ]
        for label, value in rows:
            text(40, y, label)
            text(250, y, f": {value}")
            y -= 17
    elif layout == "meter_table":
        text(40, y, f"Previous Reading Date: {_d(start, ds)}")
        text(330, y, f"Present Reading Date: {_d(end, ds)}")
        y -= 24
        cols = [40, 140, 260, 380, 440]
        for x, head in zip(cols, ["Meter No", "Previous Reading", "Present Reading", "MF", "Units Consumed"]):
            text(x, y, head, 9, True)
        y -= 15
        for x, val in zip(cols, [f"M{rnd.randint(100000, 999999)}", str(prev), str(present), "1", str(units)]):
            text(x, y, val, 10)
        y -= 28
        text(40, y, f"Energy Charges @ Rs {rate:.2f} per unit")
        text(330, y, f"Rs. {_fmt_inr(units * rate)}")
        y -= 17
        text(40, y, "Fixed Charges")
        text(330, y, f"Rs. {_fmt_inr(fixed)}")
        y -= 17
        text(40, y, "Total Amount Payable", 11, True)
        text(330, y, f"Rs. {_fmt_inr(amount)}", 11, True)
        y -= 17
        text(40, y, "Amount payable after due date")
        text(330, y, f"Rs. {_fmt_inr(after_due)}")
        y -= 17
    elif layout == "stacked":
        cells = [("BILL PERIOD", f"{_d(start, ds)} - {_d(end, ds)}"), ("BILLED UNITS", f"{units}"), ("NET PAYABLE", f"Rs {_fmt_inr(amount)}")]
        for i, (head, val) in enumerate(cells):
            x = 40 + i * 180
            text(x, y, head, 9, True)
            text(x, y - 16, val, 12)
        y -= 50
        text(40, y, f"Previous Reading {prev}    Present Reading {present}    MF 1")
        y -= 17
        text(40, y, f"Late payment surcharge applies after due date: Rs {_fmt_inr(after_due)}")
        y -= 17
    else:  # south_compact
        text(40, y, f"Period: {_d(start, ds)} to {_d(end, ds)}")
        y -= 17
        text(40, y, f"Units: {units}")
        text(250, y, f"Avg Units/Day: {units / days:.1f}")
        y -= 17
        text(40, y, f"Total Amount: Rs.{_fmt_inr(amount)}")
        y -= 17

    # distractor: consumption history table with month names
    y -= 18
    text(40, y, "CONSUMPTION HISTORY (Last 6 months)", 9, True)
    y -= 14
    for i in range(6):
        m = start - timedelta(days=30 * (i + 1))
        text(40 + i * 85, y, m.strftime("%b-%y"), 8)
        text(40 + i * 85, y - 12, str(rnd.randint(60, 950)), 8)
    y -= 40
    text(40, y, "Pay online at the discom portal. This is a computer generated bill.", 8)
    c.showPage()
    c.save()
    return buf.getvalue(), truth


def photo(pdf_bytes: bytes, seed: int, severity: float = 1.0) -> bytes:
    """Renders the bill and makes it look like a phone photo of paper on a table."""
    rnd = np.random.default_rng(seed)
    pdf = pdfium.PdfDocument(pdf_bytes)
    page = np.array(pdf[0].render(scale=200 / 72).to_pil().convert("RGB"))
    pdf.close()
    h, w = page.shape[:2]
    pad = int(0.08 * max(h, w))
    bg = int(rnd.integers(60, 110))
    canvas_img = np.full((h + 2 * pad, w + 2 * pad, 3), bg, dtype=np.uint8)
    canvas_img[pad : pad + h, pad : pad + w] = page
    # perspective tilt
    j = 0.03 * severity * max(h, w)
    src = np.float32([[pad, pad], [pad + w, pad], [pad + w, pad + h], [pad, pad + h]])
    dst = src + rnd.uniform(-j, j, src.shape).astype(np.float32)
    canvas_img = cv2.warpPerspective(canvas_img, cv2.getPerspectiveTransform(src, dst), canvas_img.shape[1::-1],
                                     borderMode=cv2.BORDER_CONSTANT, borderValue=(bg, bg, bg))
    # small rotation
    angle = float(rnd.uniform(-4, 4) * severity)
    m = cv2.getRotationMatrix2D((canvas_img.shape[1] / 2, canvas_img.shape[0] / 2), angle, 1)
    canvas_img = cv2.warpAffine(canvas_img, m, canvas_img.shape[1::-1], borderMode=cv2.BORDER_CONSTANT,
                                borderValue=(bg, bg, bg))
    # lighting gradient, blur, noise
    gx = np.linspace(0.85, 1.05, canvas_img.shape[1])[None, :, None]
    canvas_img = np.clip(canvas_img * gx, 0, 255).astype(np.uint8)
    k = 3 if severity < 1.2 else 5
    canvas_img = cv2.GaussianBlur(canvas_img, (k, k), 0.8 * severity)
    noise = rnd.normal(0, 4 * severity, canvas_img.shape)
    canvas_img = np.clip(canvas_img + noise, 0, 255).astype(np.uint8)
    out = io.BytesIO()
    Image.fromarray(canvas_img).save(out, format="JPEG", quality=int(70 - 10 * (severity - 1)))
    return out.getvalue()
