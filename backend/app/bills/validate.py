"""Chooses the best candidate per field and cross-validates them against each other.

Two independent signals agreeing (e.g. "Billed Units 240" and readings 12345 → 12585 × MF 1)
lifts a field to high confidence; disagreement is surfaced as a warning instead of being hidden.
"""

from datetime import date, timedelta

from .types import Candidate, FieldResult, Source, confidence_for


def _best(cands: list[Candidate]) -> Candidate | None:
    return max(cands, key=lambda c: c.score) if cands else None


def _alternates(cands: list[Candidate], chosen: object, n: int = 3) -> list[object]:
    seen, out = {chosen}, []
    for c in sorted(cands, key=lambda c: c.score, reverse=True):
        if c.value not in seen and c.score > 0.3:
            seen.add(c.value)
            out.append(c.value)
        if len(out) >= n:
            break
    return out


def _field(name: str, cand: Candidate | None, source: Source, cands: list[Candidate] | None = None) -> FieldResult:
    if cand is None:
        return FieldResult(name, None, "low", 0.0, source)
    score = max(0.0, min(1.0, cand.score))
    return FieldResult(
        name, cand.value, confidence_for(score), score, source, cand.page, cand.bbox, cand.snippet, cand.reason,
        _alternates(cands or [], cand.value),
    )


def agrees(a: float, b: float) -> bool:
    return abs(a - b) <= max(1.0, 0.02 * max(a, b))


def resolve(
    *,
    source: Source,
    units: list[Candidate],
    amount: list[Candidate],
    prev_reading: list[Candidate],
    present_reading: list[Candidate],
    mf: list[Candidate],
    imports: list[Candidate],
    exports: list[Candidate],
    table: dict,
    period: list[Candidate],
    prev_date: list[Candidate],
    present_date: list[Candidate],
    bill_date: list[Candidate],
    due_date: list[Candidate],
    cycle: str,
) -> tuple[dict[str, FieldResult], list[str], dict]:
    warnings: list[str] = []
    derived: dict = {}

    # --- meter readings (a reading table beats loose labels)
    def table_cand(key: str, score: float) -> Candidate | None:
        if key not in table:
            return None
        t = table[key]
        return Candidate(t["value"], score, t["page"], t["bbox"], f"meter table · {key}", "meter-reading table column")

    prev = table_cand("prev", 0.9) or _best(prev_reading)
    pres = table_cand("present", 0.9) or _best(present_reading)
    mf_c = table_cand("mf", 0.88) or _best(mf)
    mf_value = float(mf_c.value) if mf_c and 0 < float(mf_c.value) <= 1000 else 1.0

    from_readings: float | None = None
    if prev and pres and float(pres.value) >= float(prev.value):
        from_readings = round((float(pres.value) - float(prev.value)) * mf_value, 2)
        derived["units_from_readings"] = from_readings
    elif prev and pres:
        warnings.append("Present reading is lower than the previous one (meter replaced or rolled over?).")

    # --- units: label candidates, the table's units column, and the reading difference vote together
    unit_cands = list(units)
    tu = table_cand("units", 0.88)
    if tu:
        unit_cands.append(tu)
    if from_readings is not None:
        for c in unit_cands:
            if agrees(float(c.value), from_readings):
                c.score += 0.3
    # Solar net metering: the meter counts import, the bill charges net = import − export.
    imp, exp = _best(imports), _best(exports)
    solar = bool(imp and exp and imp.score > 0.7 and exp.score > 0.7)
    if solar:
        net = round(float(imp.value) - float(exp.value), 2)
        derived["net_kwh"] = net
        for c in unit_cands:
            if agrees(float(c.value), net):
                c.score += 0.3
            elif agrees(float(c.value), float(imp.value)):
                c.score -= 0.3  # that's gross import, not what was billed
    chosen = _best(unit_cands)
    if chosen is None and from_readings is not None and 0 < from_readings <= 8000:
        chosen = Candidate(from_readings, 0.75, pres.page, pres.bbox, pres.snippet, "computed from meter readings × MF")
    solar_explains = solar and from_readings is not None and agrees(from_readings, float(imp.value))
    if chosen and from_readings is not None and not agrees(float(chosen.value), from_readings) and not solar_explains:
        warnings.append(
            f"Meter readings give {from_readings:g} kWh but the bill says {float(chosen.value):g} kWh "
            "(could be an adjustment or assessed units). Please check."
        )

    if solar and chosen and not agrees(float(chosen.value), derived["net_kwh"]):
        warnings.append(f"Solar bill: import {float(imp.value):g} − export {float(exp.value):g} = {derived['net_kwh']:g} kWh net.")

    # --- billing period: explicit range > reading dates > bill date − typical cycle
    period_c = _best(period)
    start = end = None
    if period_c:
        start, end = period_c.value  # type: ignore[misc]
    else:
        pd_c, cd_c = _best(prev_date), _best(present_date)
        if pd_c and cd_c and pd_c.value < cd_c.value:
            start, end = pd_c.value, cd_c.value
            period_c = Candidate((start, end), min(pd_c.score, cd_c.score), cd_c.page, cd_c.bbox,
                                 f"{pd_c.snippet} / {cd_c.snippet}", "previous and present reading dates")
        else:
            bd = _best(bill_date)
            if bd:
                span = 60 if cycle == "bimonthly" else 30
                end = bd.value
                start = end - timedelta(days=span)  # type: ignore[operator]
                period_c = Candidate((start, end), 0.45, bd.page, bd.bbox, bd.snippet,
                                     f"estimated: {span} days before the bill date")
                warnings.append("Billing period wasn't printed clearly; estimated from the bill date. Please check the dates.")

    fields: dict[str, FieldResult] = {}
    fields["units_kwh"] = _field("units_kwh", chosen, source, unit_cands)
    fields["amount_inr"] = _field("amount_inr", _best(amount), source, amount)
    fields["previous_reading"] = _field("previous_reading", prev, source)
    fields["present_reading"] = _field("present_reading", pres, source)
    fields["multiplying_factor"] = (
        _field("multiplying_factor", mf_c, source)
        if mf_c
        else FieldResult("multiplying_factor", 1.0, "medium", 0.6, source, reason="not printed; assumed 1")
    )
    fields["import_kwh"] = _field("import_kwh", imp, source) if imp and imp.score > 0.7 else FieldResult("import_kwh", None, "low", 0, source)
    fields["export_kwh"] = _field("export_kwh", exp, source) if exp and exp.score > 0.7 else FieldResult("export_kwh", None, "low", 0, source)

    if period_c and start and end:
        pscore = max(0.0, min(1.0, period_c.score))
        common = dict(confidence=confidence_for(pscore), score=pscore, source=source, page=period_c.page,
                      bbox=period_c.bbox, snippet=period_c.snippet, reason=period_c.reason)
        fields["period_start"] = FieldResult("period_start", start, **common)
        fields["period_end"] = FieldResult("period_end", end, **common)
        days = (end - start).days  # type: ignore[operator]
        derived["days"] = days
        if not 20 <= days <= 70:
            warnings.append(f"The billing period is {days} days, which is unusual (expected about 30 or 60).")
            fields["period_start"].confidence = fields["period_end"].confidence = "low"
    else:
        fields["period_start"] = FieldResult("period_start", None, "low", 0, source)
        fields["period_end"] = FieldResult("period_end", None, "low", 0, source)

    fields["bill_date"] = _field("bill_date", _best(bill_date), source)
    fields["due_date"] = _field("due_date", _best(due_date), source)

    # --- sanity across fields
    u, a = fields["units_kwh"].value, fields["amount_inr"].value
    if isinstance(u, (int, float)) and isinstance(a, (int, float)) and u > 0:
        ratio = a / u
        derived["inr_per_kwh"] = round(ratio, 2)
        if u >= 30 and not 1.5 <= ratio <= 25:
            warnings.append(f"₹{a:,.0f} for {u:g} kWh is ₹{ratio:.1f}/kWh, which is unusual. Please check both numbers.")
            fields["amount_inr"].confidence = "low" if fields["amount_inr"].confidence == "low" else "medium"
    if isinstance(u, (int, float)) and not 1 <= u <= 8000:
        warnings.append(f"{u:g} kWh is outside the range expected for a home.")
        fields["units_kwh"].confidence = "low"

    return fields, warnings, derived


def overall_status(fields: dict[str, FieldResult]) -> str:
    ok = (
        fields["units_kwh"].confidence == "high"
        and fields["period_start"].confidence in ("high", "medium")
        and fields["amount_inr"].value is not None
    )
    return "ok" if ok else "review"


def as_iso(d: date | None) -> str | None:
    return d.isoformat() if d else None
