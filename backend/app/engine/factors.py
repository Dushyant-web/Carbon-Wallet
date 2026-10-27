"""Emission-factor registry, seed set IN-2026.1 (see Docs/system_design.md §4)."""

from dataclasses import asdict, dataclass

FACTOR_SET_VERSION = "IN-2026.1"


@dataclass(frozen=True)
class Factor:
    key: str
    central: float
    low: float
    high: float
    unit: str
    source: str
    verified: bool = True


# All greenhouse gases as CO2e, IPCC AR6 GWP100 (same as src/lib/ghg.ts on the website).
GWP_CH4_FOSSIL = 29.8
GWP_N2O = 273.0


def with_ch4_n2o(co2: float, co2_per_tj: float, ch4_per_tj: float, n2o_per_tj: float) -> float:
    """Adds the CH4 and N2O from burning the same fuel (IPCC 2006 default kg/TJ) to a CO2 factor, in CO2e."""
    tj = co2 / co2_per_tj
    return round(co2 + tj * (ch4_per_tj * GWP_CH4_FOSSIL + n2o_per_tj * GWP_N2O), 4)


# CEA CO2 Baseline Database: weighted average incl. RE + captive injection, by fiscal year (kg CO2 per kWh).
GRID_AVG_BY_FY = {
    "FY2023-24": 0.727,  # CEA v20.0
    "FY2024-25": 0.710,  # CEA v21.0
    "FY2025-26": 0.675,  # CEA v22.0 (Aug 2026)
}
GRID_CURRENT_FY = "FY2025-26"
GRID_CO2 = GRID_AVG_BY_FY[GRID_CURRENT_FY]
# + CH4 and N2O from the coal burnt (IPCC 2006 Vol.2 Table 2.2, coal in energy industries: 95,800 / 1 / 1.5 kg per TJ)
GRID_EF = with_ch4_n2o(GRID_CO2, 95_800, 1.0, 1.5)  # 0.6781 kg CO2e/kWh
GRID_OM = 0.963  # CEA v22 simple operating margin, marginal view only
TD_LOSS = 0.15  # national AT&C FY 2024-25 (15.04%)

SETPOINT_SAVING_PER_C = 0.06  # BEE/MoP claim, ~6% per degree C
SETPOINT_SAVING_RANGE = (0.03, 0.07)

GWP_AR6 = {"R32": 771.0, "R410A": 2256.0, "R22": 1960.0}

LPG_KG_CO2_PER_KG = with_ch4_n2o(2.985, 63_100, 5.0, 0.1)  # IPCC 2006: 63.1 kg/GJ x 47.3 MJ/kg, + CH4, N2O (residential)
LPG_CYLINDER_KG = 14.2

TRANSPORT = {
    "car_petrol_hatch_lt1400": 0.140,
    "car_petrol_hatch_lt1000": 0.127,
    "car_petrol_sedan_lt1600": 0.153,
    "car_diesel_suv_lt2500": 0.210,
    "car_cng_small": 0.068,
    "moto_lt125": 0.0319,
    "scooter_lt110": 0.0368,
    "bus_intracity_pkm": 0.0152,
    "metro_delhi_pkm": 0.025,
    "auto_cng_vkm": 0.1077,
}

REGISTRY: list[Factor] = [
    Factor("grid.in.avg", GRID_EF, 0.64, 0.71, "kgCO2e/kWh", "CEA CO2 Baseline Database v22.0 (Aug 2026), FY 2025-26, + CH4 and N2O (IPCC 2006, AR6 GWP100)"),
    Factor("grid.in.om", GRID_OM, GRID_OM, GRID_OM, "kgCO2/kWh", "CEA v22.0 simple operating margin (marginal view only)"),
    Factor("grid.td_loss.in", TD_LOSS, 0.08, 0.20, "fraction", "MoP 14th Integrated Rating, AT&C FY 2024-25"),
    Factor("ac.setpoint.saving_per_c", SETPOINT_SAVING_PER_C, 0.03, 0.07, "fraction/°C", "BEE/MoP claim; verify on next bill"),
    Factor("refrigerant.gwp.R32", GWP_AR6["R32"], 677, 771, "kgCO2e/kg", "IPCC AR6 GWP100"),
    Factor("refrigerant.gwp.R410A", GWP_AR6["R410A"], 1924, 2256, "kgCO2e/kg", "IPCC AR6 GWP100"),
    Factor("refrigerant.gwp.R22", GWP_AR6["R22"], 1760, 1960, "kgCO2e/kg", "IPCC AR6 GWP100"),
    Factor("fuel.lpg", LPG_KG_CO2_PER_KG, 2.9, 3.05, "kgCO2e/kg", "IPCC 2006 default, CO2 + CH4 + N2O"),
    Factor("veh.car.petrol.hatch.lt1400", TRANSPORT["car_petrol_hatch_lt1400"], 0.126, 0.175, "kgCO2/vkm", "India GHG Program 2015 (+10% uplift)"),
    Factor("veh.2w.moto.lt125", TRANSPORT["moto_lt125"], 0.029, 0.040, "kgCO2/vkm", "India GHG Program 2015 (+10% uplift)"),
    Factor("pt.bus.intracity", TRANSPORT["bus_intracity_pkm"], 0.0106, 0.0198, "kgCO2/pkm", "India GHG Program 2015"),
    Factor("pt.metro.delhi", TRANSPORT["metro_delhi_pkm"], 0.020, 0.030, "kgCO2/pkm", "TERI 2019-20 via secondary sources", verified=False),
]


def registry_as_dicts() -> list[dict]:
    return [asdict(f) for f in REGISTRY]
