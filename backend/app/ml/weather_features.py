"""Monthly cooling degree days (base 24 °C) per city, for the forecast model.

Past months come from the ERA5 archive (the same cached Open-Meteo lookups as bill-period CDD). A month that
hasn't happened yet gets its normal: the average of the same month over the last three years at that city.
Without network, every month falls back to a north-India climate normal, so the model still trains and the
result says which source it used.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app import weather
from app.ml.forecast import month_add, month_days

# Approximate monthly mean temperature normals, °C, for the north Indian plains (New Delhi; rounded)
NORMAL_MEAN_C = {1: 14.3, 2: 17.6, 3: 22.9, 4: 29.0, 5: 32.8, 6: 33.4, 7: 31.4, 8: 30.4, 9: 29.6, 10: 26.2, 11: 20.6, 12: 15.8}
DAILY_SPREAD_C = 3.0  # day-to-day spread of the daily mean around the monthly mean
FALLBACK_SOURCE = "approximate climate normals for the north Indian plains (weather archive unreachable)"


def normal_cdd(month: str, base_c: float = weather.BASE_C) -> float:
    """Expected CDD of a month whose daily means scatter normally around the monthly normal."""
    mu, s = NORMAL_MEAN_C[int(month[5:7])], DAILY_SPREAD_C
    z = (mu - base_c) / s
    pdf = math.exp(-z * z / 2) / math.sqrt(2 * math.pi)
    cdf = 0.5 * (1 + math.erf(z / math.sqrt(2)))
    return round((s * pdf + (mu - base_c) * cdf) * month_days(month), 1)


def city_cdd(session: Session, city: str, state: str, months: list[str]) -> tuple[dict[str, float], bool]:
    """CDD for each month at a city; True when it came from the real weather archive."""
    if not months:
        return {}, False
    first = month_add(min(months), -36)  # three years back, for the normals of future months
    today = date.today()
    this_month = f"{today.year:04d}-{today.month:02d}"
    start = date(int(first[:4]), int(first[5:7]), 1)
    end = date(today.year, today.month, 1)  # complete months only: the cache key stays the same all month
    try:
        loc = weather.geocode(session, city, state)
        temps = weather.daily_means(session, loc["lat"], loc["lon"], start, end)
    except (LookupError, weather.WeatherUnavailable, ValueError):
        return {m: normal_cdd(m) for m in months}, False

    by_month: dict[str, list[float]] = defaultdict(list)
    for day, t in temps.items():
        by_month[day[:7]].append(max(0.0, t - weather.BASE_C))
    observed = {m: sum(v) * month_days(m) / len(v) for m, v in by_month.items() if len(v) >= 20}
    out: dict[str, float] = {}
    for m in months:
        if m in observed and m < this_month:
            out[m] = round(observed[m], 1)
        else:
            same = [observed[month_add(m, -12 * k)] for k in (1, 2, 3) if month_add(m, -12 * k) in observed]
            out[m] = round(sum(same) / len(same), 1) if same else normal_cdd(m)
    return out, True
