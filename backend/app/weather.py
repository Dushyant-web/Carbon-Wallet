"""Real weather for bill periods (Open-Meteo: ERA5 archive, recent days from the forecast model's past data).

- Cooling degree days: CDD = Σ max(0, daily mean °C − base), base 24 °C as in the LMDI model.
- Heatwave days, by the India Meteorological Department's criteria (see `heat_days`).

Location comes from the household's city via Open-Meteo geocoding. Everything is cached in the engine DB.
"""

import json
import urllib.parse
import urllib.request
from collections.abc import Callable
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.db import WeatherCache

BASE_C = 24.0
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
RECENT_URL = "https://api.open-meteo.com/v1/forecast"
SOURCE = "Open-Meteo (ERA5 reanalysis; last few days from the forecast model)"


class WeatherUnavailable(Exception):
    pass


def _get_json(url: str, params: dict) -> dict:
    full = f"{url}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(full, timeout=12) as res:  # noqa: S310 (fixed https hosts)
            return json.load(res)
    except Exception as exc:  # network, HTTP or JSON errors all mean "no weather right now"
        raise WeatherUnavailable(f"Weather service unreachable: {exc}") from exc


Fetch = Callable[[str, dict], dict]


def _cached(session: Session, key: str, compute: Callable[[], dict | None]) -> dict | None:
    hit = session.get(WeatherCache, key)
    if hit is not None:
        return hit.value
    value = compute()
    if value is not None:
        session.add(WeatherCache(key=key, value=value))
        session.commit()
    return value


def geocode(session: Session, city: str, state: str | None = None, fetch: Fetch = _get_json) -> dict:
    key = f"geo:{city.strip().lower()}|{(state or '').strip().lower()}"

    def compute() -> dict | None:
        data = fetch(GEOCODE_URL, {"name": city.strip(), "count": 10, "countryCode": "IN", "language": "en"})
        results = data.get("results") or []
        if state:
            in_state = [r for r in results if (r.get("admin1") or "").lower() == state.strip().lower()]
            results = in_state or results
        if not results:
            return None
        r = results[0]
        return {"name": r["name"], "admin1": r.get("admin1"), "lat": r["latitude"], "lon": r["longitude"], "elevation": r.get("elevation")}

    loc = _cached(session, key, compute)
    if loc is None:
        raise LookupError(f"Couldn't find '{city}' to look up its weather.")
    return loc


_CACHE_PREFIX = {"temperature_2m_mean": "tmean", "temperature_2m_max": "tmax"}


def daily_means(session: Session, lat: float, lon: float, start: date, end: date, fetch: Fetch = _get_json) -> dict[str, float]:
    """Daily mean temperature for each day in [start, end)."""
    return daily_series(session, lat, lon, start, end, "temperature_2m_mean", fetch)


def daily_series(
    session: Session, lat: float, lon: float, start: date, end: date, variable: str, fetch: Fetch = _get_json
) -> dict[str, float]:
    """One daily variable for each day in [start, end). Cached only once every day has data."""
    last = end - timedelta(days=1)
    key = f"{_CACHE_PREFIX[variable]}:{lat:.3f},{lon:.3f}:{start.isoformat()}:{end.isoformat()}"
    hit = session.get(WeatherCache, key)
    if hit is not None:
        return hit.value

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start.isoformat(),
        "end_date": last.isoformat(),
        "daily": variable,
        "timezone": "Asia/Kolkata",
    }
    temps: dict[str, float] = {}

    def merge(data: dict) -> None:
        daily = data.get("daily") or {}
        for day, t in zip(daily.get("time", []), daily.get(variable, [])):
            if t is not None:
                temps.setdefault(day, float(t))

    merge(fetch(ARCHIVE_URL, params))
    n_days = (end - start).days
    if len(temps) < n_days and last >= date.today() - timedelta(days=90):
        try:
            merge(fetch(RECENT_URL, params))  # the archive lags a few days behind
        except WeatherUnavailable:
            pass
    if len(temps) == n_days:
        session.add(WeatherCache(key=key, value=temps))
        session.commit()
    return temps


def period_cdd(session: Session, loc: dict, start: date, end: date, base_c: float = BASE_C, fetch: Fetch = _get_json) -> dict:
    if end <= start:
        raise ValueError("period end must be after start")
    if start > date.today():
        raise ValueError("period is in the future")
    temps = daily_means(session, loc["lat"], loc["lon"], start, end, fetch)
    n_days = (end - start).days
    if not temps:
        raise WeatherUnavailable("No temperature data for this period yet.")
    cdd_known = sum(max(0.0, t - base_c) for t in temps.values())
    # Scale up for any missing days (only possible for the last few days before today)
    cdd = cdd_known * n_days / len(temps)
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "days": n_days,
        "days_with_data": len(temps),
        "cdd": round(cdd, 1),
        "mean_temp_c": round(sum(temps.values()) / len(temps), 1),
        "max_daily_mean_c": round(max(temps.values()), 1),
    }


# --- Heatwave days -------------------------------------------------------------------------------------
# IMD heat-wave criteria: a day isn't considered until the maximum reaches 40 °C on the plains, 37 °C on the
# coast or 30 °C in the hills. It is then a heatwave day when the maximum is at least 4.5 °C above normal,
# or (plains) when it reaches 45 °C outright. IMD declares a heat wave for a sub-division after two such
# days at two stations; for one home we apply the day test to its city's own grid cell.
# "Normal" here is the same calendar day (±3 days) over the previous 10 years of the same ERA5 archive.
HEAT_MIN_C = {"plains": 40.0, "coastal": 37.0, "hills": 30.0}
HEAT_DEPARTURE_C = 4.5
HEAT_ABSOLUTE_C = 45.0
NORMAL_YEARS = 10
NORMAL_WINDOW = 3
HEAT_RULE = (
    "IMD heat-wave criteria: max ≥ 40 °C (37 °C coast, 30 °C hills) and ≥ 4.5 °C above normal, "
    "or ≥ 45 °C on the plains. Normal = same days over the previous 10 years."
)

COASTAL_CITIES = {
    "mumbai", "navi mumbai", "thane", "chennai", "kochi", "ernakulam", "thiruvananthapuram", "kollam", "alappuzha",
    "kozhikode", "kannur", "mangaluru", "mangalore", "udupi", "karwar", "panaji", "margao", "goa", "puducherry",
    "visakhapatnam", "kakinada", "puri", "thoothukudi", "nagapattinam", "porbandar", "dwarka", "veraval",
    "daman", "diu", "port blair",
}
HILL_CITIES = {
    "shimla", "manali", "dharamshala", "darjeeling", "gangtok", "shillong", "srinagar", "leh", "mussoorie",
    "nainital", "ooty", "kodaikanal", "munnar", "kohima", "aizawl", "itanagar",
}


def climate_zone(city: str, elevation: float | None = None) -> str:
    name = city.strip().lower()
    if name in HILL_CITIES or (elevation is not None and elevation >= 1000):
        return "hills"
    if name in COASTAL_CITIES:
        return "coastal"
    return "plains"


def _years_back(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year - years)
    except ValueError:  # 29 February
        return d.replace(year=d.year - years, day=28)


def heat_days(session: Session, loc: dict, start: date, end: date, zone: str | None = None, fetch: Fetch = _get_json) -> dict:
    """Heatwave days in [start, end) by the IMD criteria above, with each day's max, normal and departure."""
    if end <= start:
        raise ValueError("period end must be after start")
    if start > date.today():
        raise ValueError("period is in the future")
    zone = zone or climate_zone(loc.get("name", ""), loc.get("elevation"))
    tmax = daily_series(session, loc["lat"], loc["lon"], start, end, "temperature_2m_max", fetch)
    if not tmax:
        raise WeatherUnavailable("No temperature data for this period yet.")

    # One request covers the window in all ten earlier years (cached, so it's paid once per period)
    hist_start = _years_back(start, NORMAL_YEARS) - timedelta(days=NORMAL_WINDOW)
    hist_end = _years_back(end, 1) + timedelta(days=NORMAL_WINDOW)
    try:
        hist = daily_series(session, loc["lat"], loc["lon"], hist_start, hist_end, "temperature_2m_max", fetch)
    except WeatherUnavailable:
        hist = {}

    def normal(d: date) -> float | None:
        vals = []
        for y in range(1, NORMAL_YEARS + 1):
            base = _years_back(d, y)
            for k in range(-NORMAL_WINDOW, NORMAL_WINDOW + 1):
                v = hist.get((base + timedelta(days=k)).isoformat())
                if v is not None:
                    vals.append(v)
        return sum(vals) / len(vals) if len(vals) >= 30 else None  # at least ~4 years of the window

    out = []
    for day, t in sorted(tmax.items()):
        if t < HEAT_MIN_C[zone]:
            continue
        n = normal(date.fromisoformat(day))
        departure = None if n is None else t - n
        if zone == "plains" and t >= HEAT_ABSOLUTE_C:
            why = f"{t:.1f} °C, at or above 45 °C"
        elif departure is not None and departure >= HEAT_DEPARTURE_C:
            why = f"{t:.1f} °C, {departure:.1f} °C above normal"
        else:
            continue
        out.append({
            "date": day,
            "tmax_c": round(t, 1),
            "normal_c": None if n is None else round(n, 1),
            "departure_c": None if departure is None else round(departure, 1),
            "why": why,
        })
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "zone": zone,
        "days_checked": len(tmax),
        "count": len(out),
        "days": out,
    }
