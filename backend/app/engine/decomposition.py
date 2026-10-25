"""LMDI decomposition of AC emission change into weather, behaviour, equipment and grid effects.

    E = CDD x (hours / CDD) x kW x EF
    dE_x = L(E1, E0) * ln(x1 / x0),   L(a, b) = (a - b) / (ln a - ln b)

The effects sum exactly to E1 - E0 (Ang, 2004). See Docs/system_design.md §7.1.
"""

from dataclasses import dataclass
from math import log


@dataclass(frozen=True)
class AcPeriod:
    cdd: float
    ac_hours: float
    kw: float
    ef: float

    @property
    def emissions(self) -> float:
        return self.ac_hours * self.kw * self.ef


def _logmean(a: float, b: float) -> float:
    if abs(a - b) < 1e-12:
        return a
    return (a - b) / (log(a) - log(b))


def decompose(before: AcPeriod, after: AcPeriod) -> dict:
    for p in (before, after):
        if min(p.cdd, p.ac_hours, p.kw, p.ef) <= 0:
            raise ValueError("all LMDI drivers must be positive")
    e0, e1 = before.emissions, after.emissions
    lm = _logmean(e1, e0)
    effects = {
        "weather": lm * log(after.cdd / before.cdd),
        "behaviour": lm * log((after.ac_hours / after.cdd) / (before.ac_hours / before.cdd)),
        "equipment": lm * log(after.kw / before.kw),
        "grid": lm * log(after.ef / before.ef),
    }
    return {
        "before_kg": round(e0, 1),
        "after_kg": round(e1, 1),
        "total_change_kg": round(e1 - e0, 1),
        "effects_kg": {name: round(v, 1) for name, v in effects.items()},
        "controllable_kg": round(effects["behaviour"] + effects["equipment"], 1),
    }
