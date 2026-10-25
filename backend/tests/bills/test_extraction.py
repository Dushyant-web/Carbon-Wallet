"""Bill extraction accuracy and safety. Synthetic bills only; real bills run via `python -m app.bills.bench`."""

import itertools
import os
import zlib

import pytest
from fastapi.testclient import TestClient

from app.bills import pipeline
from app.bills.normalize import find_dates, fix_ocr_token, parse_number
from app.bills.synthetic import DISCOM_HEADERS, LAYOUTS, make_bill, photo
from app.bills.types import DocText, FieldResult

FULL = os.getenv("BILLS_FULL") == "1"


def check(result: dict, truth, *, tol_units: float = 0.0) -> list[str]:
    f = result["fields"]
    errs = []
    if f["units_kwh"]["value"] is None or abs(f["units_kwh"]["value"] - truth.units) > tol_units:
        errs.append(f"units {f['units_kwh']['value']} != {truth.units}")
    if f["amount_inr"]["value"] is None or abs(f["amount_inr"]["value"] - truth.amount) > 0.5:
        errs.append(f"amount {f['amount_inr']['value']} != {truth.amount}")
    if f["period_start"]["value"] != truth.start.isoformat() or f["period_end"]["value"] != truth.end.isoformat():
        errs.append(f"period {f['period_start']['value']}..{f['period_end']['value']} != {truth.start}..{truth.end}")
    return errs


def test_normaliser_handles_indian_formats_and_ocr_noise():
    assert parse_number("Rs.1,23,456.78") == 123456.78
    assert parse_number("₹ 1,876.00") == 1876.0
    assert parse_number("240kWh") == 240
    assert parse_number("Rs.6, 198.54") == 6198.54  # OCR space after grouping comma
    assert fix_ocr_token("24O") == "240" and fix_ocr_token("BILL") == "BILL"
    got = [d.isoformat() for d, _ in find_dates("Period 01-Apr-2026 to 30/04/2026, read 2026-05-02")]
    assert got == ["2026-04-01", "2026-04-30", "2026-05-02"]


@pytest.mark.parametrize("layout,discom", list(itertools.product(LAYOUTS, list(DISCOM_HEADERS))))
def test_digital_pdfs_extract_exactly(layout, discom):
    pdf, truth = make_bill(zlib.crc32(f"{layout}:{discom}".encode()) % 100000, discom, layout)
    result = pipeline.extract(pdf)
    assert check(result, truth) == []
    assert result["text_source"] == "pdf_text"
    assert result["fields"]["units_kwh"]["confidence"] in ("high", "medium")
    assert result["fields"]["units_kwh"]["bbox"] is not None  # UI can highlight where it was found


PHOTO_CASES = list(itertools.product(LAYOUTS, list(DISCOM_HEADERS)))[:: (1 if FULL else 10)]


@pytest.mark.parametrize("layout,discom", PHOTO_CASES)
def test_phone_photos_extract_within_one_kwh(layout, discom):
    seed = zlib.crc32(f"{layout}:{discom}:photo".encode()) % 100000
    pdf, truth = make_bill(seed, discom, layout)
    result = pipeline.extract(photo(pdf, seed, 1.2))
    assert result["text_source"] == "ocr"
    assert check(result, truth, tol_units=1) == []


def test_consumer_number_is_masked_and_hashed_never_raw():
    pdf, _ = make_bill(42, "bses_rajdhani", "label_value")
    result = pipeline.extract(pdf)
    consumer = result["consumer"]
    assert consumer["masked"].startswith("••••") and len(consumer["hash"]) == 64
    import json
    import re

    raw = re.search(r"Consumer No: (\d+)", " ".join(pipeline.acquire(pdf)[0].full_text.split()))
    assert raw and raw.group(1) not in json.dumps({k: v for k, v in result.items() if k != "previews"})


def test_ai_fallback_is_trusted_only_when_the_number_is_in_the_bill(monkeypatch):
    pdf, truth = make_bill(7, "pvvnl", "south_compact")
    calls = {}

    def fake_ai(**kwargs):
        calls["n"] = calls.get("n", 0) + 1
        return {"units_kwh": truth.units, "period_start": None, "period_end": None, "amount_payable_inr": 7777.77,
                "previous_reading": None, "present_reading": None, "multiplying_factor": None,
                "import_kwh": None, "export_kwh": None, "discom_name": "PVVNL", "notes": ""}

    monkeypatch.setattr(pipeline, "ai_read", fake_ai)
    # force the AI path by pretending local units were unreadable
    original = pipeline.resolve

    def weak_resolve(**kw):
        fields, warnings, derived = original(**kw)
        fields["units_kwh"].confidence = "low"
        fields["amount_inr"].confidence = "low"
        return fields, warnings, derived

    monkeypatch.setattr(pipeline, "resolve", weak_resolve)
    no_consent = pipeline.extract(pdf, allow_ai=False)
    assert no_consent["needs_ai"] is True and "n" not in calls  # never called without consent

    result = pipeline.extract(pdf, allow_ai=True)
    assert calls["n"] == 1 and result["ai_used"] is True
    units = result["fields"]["units_kwh"]
    assert units["value"] == truth.units and units["source"] == "ai" and units["confidence"] == "high"
    amount = result["fields"]["amount_inr"]  # 999999 is nowhere on the bill → not trusted
    assert amount["confidence"] == "medium" and "please check" in amount["reason"]


def test_endpoint_requires_engine_key_and_rejects_bad_files(monkeypatch):
    from app import config
    from app.main import app

    monkeypatch.setattr(config, "ENGINE_API_KEY", "test-key")
    pdf, truth = make_bill(11, "tpddl", "meter_table")
    with TestClient(app) as client:
        assert client.post("/api/v1/bills/extract", content=pdf).status_code == 401
        assert client.post("/api/v1/bills/extract", content=pdf, headers={"x-engine-key": "nope"}).status_code == 401
        bad = client.post("/api/v1/bills/extract", content=b"GIF89a....", headers={"x-engine-key": "test-key"})
        assert bad.status_code == 415
        ok = client.post("/api/v1/bills/extract", content=pdf, headers={"x-engine-key": "test-key"})
        assert ok.status_code == 200
        assert ok.json()["fields"]["units_kwh"]["value"] == truth.units
        assert ok.json()["previews"] and ok.json()["discom"]["id"] == "tpddl"


def test_nvidia_reply_parsing_keeps_only_clean_values():
    from app.bills.ai_nvidia import parse_reply

    out = parse_reply('```json\n{"units_kwh": "97 kWh", "amount_payable_inr": "Rs. 7,55.52", "period_start": "Feb-25", '
                      '"period_end": "2025-04-26", "previous_reading": 48799, "present_reading": 48896}\n```.')
    assert out["units_kwh"] == 97.0
    assert out["previous_reading"] == 48799.0
    assert out["period_start"] is None  # "Feb-25" has no day: dropped, never guessed
    assert out["period_end"] == "2025-04-26"
    assert out["discom_name"] is None and out["notes"] == ""


def test_ai_provider_follows_the_configured_key(monkeypatch):
    from app.bills import ai_fallback, ai_nvidia

    seen = {}
    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-test")
    monkeypatch.delenv("BILL_AI_PROVIDER", raising=False)
    monkeypatch.setattr(ai_nvidia, "nvidia_read", lambda **kw: seen.update(kw) or {"units_kwh": 1.0})
    assert ai_fallback.ai_read(pdf_bytes=None, page_pngs=[b"png"]) == {"units_kwh": 1.0}
    assert seen["api_key"] == "nvapi-test"


def test_nvidia_reply_with_indian_numbers_and_text_dates():
    from app.bills.ai_nvidia import parse_reply

    out = parse_reply('The JSON object is as follows:\n\n{"units_kwh": 683, "period_start": "12-Jan-2026", '
                      '"period_end": "10/02/2026", "amount_payable_inr": 3,376.26, "previous_reading": null, '
                      '"present_reading": null, "multiplying_factor": null, "import_kwh": null, "export_kwh": null, '
                      '"discom_name": "BESCOM", "notes": null}')
    assert out["amount_payable_inr"] == 3376.26
    assert out["period_start"] == "2026-01-12" and out["period_end"] == "2026-02-10"
    assert out["units_kwh"] == 683.0 and out["notes"] == ""


def test_ai_values_outside_plausible_ranges_are_dropped():
    fields = {"units_kwh": FieldResult("units_kwh", None, "low", 0, "ocr"), "period_start": FieldResult("period_start", None, "low", 0, "ocr"),
              "period_end": FieldResult("period_end", None, "low", 0, "ocr")}
    doc = DocText(pages=[], source="ocr", mean_conf=40)
    warnings: list[str] = []
    pipeline._apply_ai(doc, fields, {"units_kwh": 62172, "period_start": "2020-01-12"}, warnings)
    assert fields["units_kwh"].value is None and fields["period_start"].value is None
    assert any("isn't plausible" in w for w in warnings) and any("too far from today" in w for w in warnings)


@pytest.mark.parametrize("discom", list(DISCOM_HEADERS))
def test_solar_bills_extract_import_and_export(discom):
    """Net-metering bills: the app counts grid import for emissions, so import and export must both be read."""
    pdf, truth = make_bill(zlib.crc32(f"solar_net:{discom}:import".encode()) % 100000, discom, "solar_net")
    f = pipeline.extract(pdf)["fields"]
    imp, exp = f["import_kwh"]["value"], f["export_kwh"]["value"]
    assert imp is not None and exp is not None
    assert imp - exp == pytest.approx(truth.units)  # billed units are the net
    assert f["units_kwh"]["value"] == pytest.approx(truth.units)
