import io

from PIL import Image, ImageDraw, ImageFont

from app.fuel import extract_fuel, parse_text, reconcile


def test_receipt_text_is_parsed_and_cross_checked():
    text = "INDIAN OIL\nPETROL (MS)\nRate Rs/L : 94.72\nVolume(L): 25.34\nAmount Rs: 2400.20\nDate: 09/10/2026"
    r = parse_text(text)
    assert r["fuel"] == "Petrol" and r["quantity"] == 25.34 and r["rate"] == 94.72 and r["amount_inr"] == 2400.20
    out, warnings, conf = reconcile(r)
    assert conf == "high" and not warnings
    assert r["date"] == "2026-10-09"


def test_two_of_three_give_the_third():
    out, _, conf = reconcile({"fuel": "Diesel", "quantity": 30.0, "amount_inr": None, "rate": 89.6, "date": None})
    assert out["amount_inr"] == 2688.0 and conf == "medium"  # derived, so only two independent readings


def test_disagreeing_numbers_are_flagged():
    _, warnings, conf = reconcile({"fuel": "Petrol", "quantity": 25.0, "amount_inr": 3000.0, "rate": 94.7, "date": None})
    assert conf == "medium" and "Please check" in warnings[0]


def test_unusual_rate_is_low_confidence():
    _, warnings, conf = reconcile({"fuel": "CNG", "quantity": 8.0, "amount_inr": 2000.0, "rate": 250.0, "date": None})
    assert conf == "low" and any("unusual" in w for w in warnings)


def test_printed_receipt_photo_end_to_end():
    img = Image.new("L", (900, 700), 255)
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Courier New.ttf", 34)
    except OSError:
        font = ImageFont.load_default(size=34)
    for i, line in enumerate(["HP PETROL PUMP", "PRODUCT: PETROL", "RATE Rs/L: 96.50", "VOLUME(L): 20.73", "AMOUNT Rs: 2000.45", "DATE: 08/10/2026"]):
        d.text((60, 60 + i * 90), line, fill=0, font=font)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    out = extract_fuel(buf.getvalue())
    assert out["quantity"] == 20.73 and out["amount_inr"] == 2000.45 and out["rate"] == 96.5
    assert out["confidence"] == "high" and out["fuel"] == "Petrol"
