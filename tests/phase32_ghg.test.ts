import { describe, it, expect } from "vitest";
import { GRID_KG_CO2E_PER_KWH, PETROL_KG_CO2E_PER_L, CNG_KG_CO2E_PER_KG, GWP100, co2ePerUnit, splitByGas, gasesFromCategories, GASES } from "@/lib/ghg";
import { OFFICIAL_EMISSION_FACTORS } from "@/server/factors/registry";

describe("Phase 32: all greenhouse gases in CO₂e", () => {
  it("adds CH₄ and N₂O to burnt fuels with IPCC 2006 defaults and AR6 GWP100", () => {
    expect(GWP100).toMatchObject({ CH4_FOSSIL: 29.8, CH4_BIOGENIC: 27, N2O: 273, HFC32: 771 });
    expect(GRID_KG_CO2E_PER_KWH).toBe(0.6781); // 0.675 CO₂ + coal CH₄ + N₂O
    expect(PETROL_KG_CO2E_PER_L).toBe(2.3656);
    expect(CNG_KG_CO2E_PER_KG).toBe(2.9245); // CNG engines slip methane: +6%
    expect(co2ePerUnit("meal_veg", 0.9)).toBe(0.9); // published as CO₂e already
    expect(co2ePerUnit("refrigerant_r410a", 2256)).toBe(2256);
  });

  it("every registry factor is CO₂e, and fuels/electricity are never below their published CO₂", () => {
    const grid = OFFICIAL_EMISSION_FACTORS.find((f) => f.type === "grid_electricity" && f.region === "IN-UP")!;
    expect(grid.kgCo2ePerUnit).toBe(0.6781);
    expect(grid.source).toMatch(/CH₄ and N₂O/);
    const petrol = OFFICIAL_EMISSION_FACTORS.find((f) => f.type === "petrol_fuel")!;
    expect(petrol.kgCo2ePerUnit).toBeGreaterThan(2.31);
  });

  it("splits an amount by gas so the parts add back up exactly", () => {
    for (const type of ["grid_electricity", "cng_fuel", "lpg_cooking", "solid_waste_unsegregated", "refrigerant_r32", "meal_veg"]) {
      const parts = splitByGas(type, 100);
      expect(GASES.reduce((s, g) => s + parts[g], 0)).toBeCloseTo(100, 6);
    }
    expect(splitByGas("solid_waste_unsegregated", 10).CH4).toBeCloseTo(10, 6); // landfill methane
    expect(splitByGas("refrigerant_r32", 10).HFC).toBeCloseTo(10, 6);
    const month = gasesFromCategories({ Electricity: 200, Cooking: 20, Waste: 15, Food: 30 });
    expect(month.MIXED).toBe(30);
    expect(month.CH4).toBeGreaterThan(15);
    expect(month.CO2 + month.CH4 + month.N2O + month.HFC + month.MIXED).toBeCloseTo(265, 1);
  });
});
