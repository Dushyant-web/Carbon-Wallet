from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import weather
from app.db import Base


@pytest.fixture()
def session():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    with sessionmaker(bind=eng)() as s:
        yield s


def fake_fetch(calls):
    def fetch(url, params):
        calls.append(url)
        if url == weather.GEOCODE_URL:
            return {"results": [
                {"name": "Aurangabad", "admin1": "Bihar", "latitude": 24.7, "longitude": 84.4},
                {"name": "Aurangabad", "admin1": "Maharashtra", "latitude": 19.9, "longitude": 75.3},
            ]}
        start = date.fromisoformat(params["start_date"])
        end = date.fromisoformat(params["end_date"])
        days = [(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)]
        # 30 °C every day -> 6 CDD/day at base 24
        return {"daily": {"time": days, "temperature_2m_mean": [30.0] * len(days)}}
    return fetch


def test_geocode_prefers_the_households_state_and_caches(session):
    calls: list[str] = []
    loc = weather.geocode(session, "Aurangabad", "Maharashtra", fetch=fake_fetch(calls))
    assert loc["admin1"] == "Maharashtra" and loc["lat"] == 19.9
    weather.geocode(session, "Aurangabad", "Maharashtra", fetch=fake_fetch(calls))
    assert calls.count(weather.GEOCODE_URL) == 1


def test_cdd_sums_degrees_above_base_over_the_half_open_period(session):
    calls: list[str] = []
    loc = {"name": "X", "admin1": None, "lat": 28.6, "lon": 77.2}
    out = weather.period_cdd(session, loc, date(2025, 5, 1), date(2025, 6, 1), fetch=fake_fetch(calls))
    assert out["days"] == 31 and out["days_with_data"] == 31
    assert out["cdd"] == pytest.approx(31 * 6.0)
    weather.period_cdd(session, loc, date(2025, 5, 1), date(2025, 6, 1), fetch=fake_fetch(calls))
    assert calls.count(weather.ARCHIVE_URL) == 1  # complete periods are cached


def test_cool_days_contribute_nothing(session):
    def cold(url, params):
        return {"daily": {"time": [params["start_date"]], "temperature_2m_mean": [18.0]}}
    loc = {"name": "X", "admin1": None, "lat": 30.0, "lon": 78.0}
    out = weather.period_cdd(session, loc, date(2025, 1, 1), date(2025, 1, 2), fetch=cold)
    assert out["cdd"] == 0


def test_rejects_future_and_inverted_periods(session):
    loc = {"name": "X", "admin1": None, "lat": 30.0, "lon": 78.0}
    with pytest.raises(ValueError):
        weather.period_cdd(session, loc, date(2025, 2, 1), date(2025, 1, 1))
    with pytest.raises(ValueError):
        weather.period_cdd(session, loc, date.today() + timedelta(days=5), date.today() + timedelta(days=40))


# --- heatwave days (IMD criteria) ----------------------------------------------------------------------

def heat_fetch(calls, period_temps: dict[str, float], normal_c: float = 40.0, history_years: int = 10):
    """Earlier years sit at `normal_c` every day; the period itself uses `period_temps` (default normal)."""
    def fetch(url, params):
        calls.append((url, params["start_date"]))
        start = date.fromisoformat(params["start_date"])
        end = date.fromisoformat(params["end_date"])
        days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
        cutoff = date(2025, 5, 1).year - history_years
        vals = [period_temps.get(d.isoformat(), normal_c) if d.year == 2025 else (normal_c if d.year >= cutoff else None) for d in days]
        return {"daily": {"time": [d.isoformat() for d in days], "temperature_2m_max": vals}}
    return fetch


LOC = {"name": "Delhi", "admin1": "Delhi", "lat": 28.6, "lon": 77.2, "elevation": 216}


def test_heat_days_follow_the_imd_rule_on_the_plains(session):
    temps = {"2025-05-02": 41.0, "2025-05-03": 44.6, "2025-05-04": 45.5, "2025-05-05": 39.9}
    out = weather.heat_days(session, LOC, date(2025, 5, 1), date(2025, 5, 8), fetch=heat_fetch([], temps))
    assert out["zone"] == "plains"
    got = {d["date"]: d for d in out["days"]}
    assert set(got) == {"2025-05-03", "2025-05-04"}  # +1 °C isn't a heatwave; 39.9 °C is below the 40 °C floor
    assert got["2025-05-03"]["departure_c"] == pytest.approx(4.6)
    assert "45 °C" in got["2025-05-04"]["why"]
    assert out["count"] == 2 and out["days_checked"] == 7


def test_coastal_cities_use_37_degrees_and_hills_by_elevation(session):
    temps = {"2025-05-02": 37.6, "2025-05-03": 36.9}
    mumbai = {"name": "Mumbai", "admin1": "Maharashtra", "lat": 19.1, "lon": 72.9, "elevation": 14}
    out = weather.heat_days(session, mumbai, date(2025, 5, 1), date(2025, 5, 5), fetch=heat_fetch([], temps, normal_c=33.0))
    assert out["zone"] == "coastal"
    assert [d["date"] for d in out["days"]] == ["2025-05-02"]  # 37.6 is 4.6 above a 33 °C normal; 36.9 is below 37
    assert weather.climate_zone("Some Town", elevation=1450) == "hills"
    assert weather.climate_zone("Jaipur", elevation=431) == "plains"


def test_without_enough_history_only_the_45_degree_test_applies(session):
    temps = {"2025-05-02": 44.9, "2025-05-03": 45.1}
    out = weather.heat_days(session, LOC, date(2025, 5, 1), date(2025, 5, 4), fetch=heat_fetch([], temps, normal_c=38.0, history_years=2))
    assert [d["date"] for d in out["days"]] == ["2025-05-03"]
    assert out["days"][0]["normal_c"] is None


def test_heat_days_are_cached(session):
    calls: list = []
    f = heat_fetch(calls, {"2025-05-03": 46.0})
    weather.heat_days(session, LOC, date(2025, 5, 1), date(2025, 5, 8), fetch=f)
    n = len(calls)
    weather.heat_days(session, LOC, date(2025, 5, 1), date(2025, 5, 8), fetch=f)
    assert len(calls) == n
