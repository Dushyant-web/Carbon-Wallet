"""Benchmark extraction on real bills (kept out of git).

    uv run python -m app.bills.bench ../private-bills

Optional `labels.json` in that folder gives the truth per file:
    {"bses_jan.pdf": {"units": 240, "amount": 1876.0, "start": "2026-01-01", "end": "2026-01-31"}}
Without labels it prints what was extracted so you can eyeball it. A JSON report is written to
`<folder>/_report.json` (also git-ignored).
"""

import json
import sys
import time
from pathlib import Path

from .acquire import UnsupportedFile
from .pipeline import extract

EXTS = {".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif"}


def _ok(got, want, tol) -> bool:
    if want is None:
        return True
    if got is None:
        return False
    if isinstance(want, (int, float)):
        return abs(float(got) - float(want)) <= tol
    return str(got) == str(want)


def main(folder: str) -> int:
    root = Path(folder)
    files = sorted(p for p in root.iterdir() if p.suffix.lower() in EXTS)
    if not files:
        print(f"No bills found in {root.resolve()} (PDF/JPG/PNG/HEIC).")
        return 1
    labels = json.loads((root / "labels.json").read_text()) if (root / "labels.json").exists() else {}
    report, passed, labelled = [], 0, 0
    for path in files:
        t0 = time.perf_counter()
        try:
            r = extract(path.read_bytes())
        except UnsupportedFile as exc:
            print(f"✗ {path.name}: {exc}")
            continue
        f = r["fields"]
        row = {
            "file": path.name,
            "discom": r["discom"]["name"],
            "source": r["text_source"],
            "ocr_conf": r["ocr_mean_conf"],
            "units": f["units_kwh"]["value"],
            "units_conf": f["units_kwh"]["confidence"],
            "amount": f["amount_inr"]["value"],
            "start": f["period_start"]["value"],
            "end": f["period_end"]["value"],
            "status": r["status"],
            "warnings": r["warnings"],
            "seconds": round(time.perf_counter() - t0, 1),
        }
        verdict = ""
        if path.name in labels:
            labelled += 1
            want = labels[path.name]
            checks = {
                "units": _ok(row["units"], want.get("units"), 1),
                "amount": _ok(row["amount"], want.get("amount"), 1),
                "start": _ok(row["start"], want.get("start"), 0),
                "end": _ok(row["end"], want.get("end"), 0),
            }
            row["checks"] = checks
            if all(checks.values()):
                passed += 1
                verdict = "PASS"
            else:
                verdict = "FAIL " + ",".join(k for k, v in checks.items() if not v)
        report.append(row)
        print(
            f"{verdict or '·':<22} {path.name[:34]:<34} {row['discom'][:26]:<26} "
            f"{row['units']!s:>8} kWh ({row['units_conf']:<6}) ₹{row['amount']!s:>10}  "
            f"{row['start']}..{row['end']}  [{row['source']}, {row['seconds']}s]"
        )
        for w in row["warnings"]:
            print(f"{'':<22}   ⚠ {w}")
    (root / "_report.json").write_text(json.dumps(report, indent=2, default=str))
    if labelled:
        print(f"\n{passed}/{labelled} labelled bills fully correct.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "../private-bills"))
