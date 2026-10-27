/*
 * Greenhouse gases, not just CO₂. Every emission factor is a mix of gases, each turned into CO₂-equivalent
 * (CO₂e) with its 100-year global warming potential from the IPCC's Sixth Assessment Report (AR6 WG1, Table 7.15):
 *
 *   CO₂ 1 · CH₄ (fossil) 29.8 · CH₄ (biogenic) 27.0 · N₂O 273 · HFC-32 771 · R-410A 2,256 · HCFC-22 1,960
 *
 * Fuel burning gives mostly CO₂ plus small amounts of CH₄ and N₂O. Those come from the IPCC 2006 Guidelines'
 * default emission factors per terajoule of fuel (Vol. 2: Table 2.2 stationary, Table 3.2.2 road), with the fuel
 * energy worked out from the CO₂ factor and IPCC's CO₂ per TJ, so the three gases always describe the same fuel.
 * AC refrigerant leaks are HFCs (or HCFC-22). Landfilled waste is biogenic CH₄. Food and travel factors are
 * published as CO₂e already (CO₂, CH₄ and N₂O together) and are kept as such ("mixed").
 */

export const GWP100 = {
  CO2: 1,
  CH4_FOSSIL: 29.8,
  CH4_BIOGENIC: 27.0,
  N2O: 273,
  HFC32: 771,
  R410A: 2256,
  HCFC22: 1960,
} as const;

export type Gas = "CO2" | "CH4" | "N2O" | "HFC" | "MIXED";
export const GASES: Gas[] = ["CO2", "CH4", "N2O", "HFC", "MIXED"];

/** kg of each gas per unit of activity (kWh, litre, kg, km…). `hfcCo2e` and `mixedCo2e` are already in CO₂e. */
type Profile = { co2: number; ch4?: number; ch4Biogenic?: number; n2o?: number; hfcCo2e?: number; mixedCo2e?: number };

// IPCC 2006 defaults used below (kg per TJ of fuel): CO₂ / CH₄ / N₂O
//   coal in power plants 95,800 / 1 / 1.5 · motor petrol 69,300 / 3.8 / 5.7 (3-way catalyst cars)
//   motorcycles CH₄ 77, N₂O 2 · diesel 74,100 / 3.9 / 3.9 · CNG vehicles 56,100 / 92 / 3 · LPG in homes 63,100 / 5 / 0.1
const perFuel = (co2: number, co2PerTj: number, ch4PerTj: number, n2oPerTj: number): Profile => {
  const tj = co2 / co2PerTj;
  return { co2, ch4: tj * ch4PerTj, n2o: tj * n2oPerTj };
};

export const GAS_PROFILES: Record<string, Profile> = {
  grid_electricity: perFuel(0.675, 95_800, 1, 1.5), // India's grid is ~75% coal; CEA's 0.675 kg CO₂/kWh
  petrol_fuel: perFuel(2.31, 69_300, 3.8, 5.7),
  petrol_car: perFuel(0.165, 69_300, 3.8, 5.7),
  two_wheeler_petrol: perFuel(0.045, 69_300, 77, 2),
  diesel_fuel: perFuel(2.68, 74_100, 3.9, 3.9),
  diesel_car: perFuel(0.206, 74_100, 3.9, 3.9),
  cng_fuel: perFuel(2.75, 56_100, 92, 3),
  cng_car: perFuel(0.11, 56_100, 92, 3),
  electric_vehicle: perFuel(0.101, 95_800, 1, 1.5), // charged from the same grid
  lpg_cooking: perFuel(2.98, 63_100, 5, 0.1),
  refrigerant_r32: { co2: 0, hfcCo2e: GWP100.HFC32 },
  refrigerant_r410a: { co2: 0, hfcCo2e: GWP100.R410A },
  refrigerant_r22: { co2: 0, hfcCo2e: GWP100.HCFC22 },
  solid_waste_unsegregated: { co2: 0, ch4Biogenic: 0.55 / GWP100.CH4_BIOGENIC }, // landfill methane
};
GAS_PROFILES.test_grid_electricity = GAS_PROFILES.grid_electricity;

/** CO₂e of one unit, split by gas. Types without a profile are published as CO₂e already (food, travel). */
export function gasesPerUnit(type: string, publishedCo2e: number): Record<Gas, number> {
  const p = GAS_PROFILES[type];
  if (!p) return { CO2: 0, CH4: 0, N2O: 0, HFC: 0, MIXED: publishedCo2e };
  return {
    CO2: p.co2,
    CH4: (p.ch4 ?? 0) * GWP100.CH4_FOSSIL + (p.ch4Biogenic ?? 0) * GWP100.CH4_BIOGENIC,
    N2O: (p.n2o ?? 0) * GWP100.N2O,
    HFC: p.hfcCo2e ?? 0,
    MIXED: p.mixedCo2e ?? 0,
  };
}

const sum = (g: Record<Gas, number>) => GASES.reduce((s, k) => s + g[k], 0);

/** kg CO₂e per unit for a factor type, all gases included (falls back to the published value). */
export function co2ePerUnit(type: string, publishedCo2e: number): number {
  return Math.round(sum(gasesPerUnit(type, publishedCo2e)) * 10_000) / 10_000;
}

/** Splits an amount of CO₂e from one kind of activity into its gases, in kg CO₂e. */
export function splitByGas(type: string, kgCo2e: number): Record<Gas, number> {
  const per = gasesPerUnit(type, 1);
  const total = sum(per) || 1;
  return Object.fromEntries(GASES.map((g) => [g, (kgCo2e * per[g]) / total])) as Record<Gas, number>;
}

/** What each category of a monthly summary is mostly made of, for months that were added as totals. */
export const CATEGORY_TYPE: Record<string, string> = {
  Electricity: "grid_electricity",
  Transport: "petrol_fuel",
  Vehicles: "petrol_fuel",
  Cooking: "lpg_cooking",
  Waste: "solid_waste_unsegregated",
  Refrigerant: "refrigerant_r32",
};

export function addGases(into: Record<Gas, number>, more: Record<Gas, number>) {
  for (const g of GASES) into[g] = (into[g] ?? 0) + (more[g] ?? 0);
  return into;
}

export const emptyGases = (): Record<Gas, number> => ({ CO2: 0, CH4: 0, N2O: 0, HFC: 0, MIXED: 0 });

/** Gas breakdown of a month from its category totals (each category split by its typical source). */
export function gasesFromCategories(byCategory: Record<string, number>): Record<Gas, number> {
  const out = emptyGases();
  for (const [cat, kg] of Object.entries(byCategory)) addGases(out, splitByGas(CATEGORY_TYPE[cat] ?? "mixed", kg));
  return roundGases(out);
}

export const roundGases = (g: Record<Gas, number>) =>
  Object.fromEntries(GASES.map((k) => [k, Math.round((g[k] ?? 0) * 100) / 100])) as Record<Gas, number>;

/** kg CO₂e per kWh from India's grid, all gases: CO₂ 0.675 + CH₄ and N₂O from burning the coal ≈ 0.678. */
export const GRID_KG_CO2E_PER_KWH = co2ePerUnit("grid_electricity", 0.675);
export const PETROL_KG_CO2E_PER_L = co2ePerUnit("petrol_fuel", 2.31);
export const DIESEL_KG_CO2E_PER_L = co2ePerUnit("diesel_fuel", 2.68);
export const CNG_KG_CO2E_PER_KG = co2ePerUnit("cng_fuel", 2.75);
export const LPG_KG_CO2E_PER_KG = co2ePerUnit("lpg_cooking", 2.98);

export const GAS_INFO: Record<Gas, { formula: string; en: string; hi: string; from: string; fromHi: string; gwp: string }> = {
  CO2: { formula: "CO₂", en: "Carbon dioxide", hi: "कार्बन डाइऑक्साइड", from: "Burning coal for electricity, petrol, diesel, CNG and LPG", fromHi: "बिजली के लिए कोयला, पेट्रोल, डीज़ल, सीएनजी, एलपीजी जलाने से", gwp: "1" },
  CH4: { formula: "CH₄", en: "Methane", hi: "मीथेन", from: "Rotting waste in landfills, CNG engines, unburnt fuel", fromHi: "कूड़े के ढेर, सीएनजी इंजन, अधजला ईंधन", gwp: "29.8 (fossil), 27 (waste)" },
  N2O: { formula: "N₂O", en: "Nitrous oxide", hi: "नाइट्रस ऑक्साइड", from: "Car catalytic converters and coal burning", fromHi: "गाड़ियों के कैटेलिटिक कनवर्टर और कोयला जलाने से", gwp: "273" },
  HFC: { formula: "HFCs", en: "AC refrigerant gases", hi: "एसी की गैस", from: "AC gas leaks and refills (R-32, R-410A, R-22)", fromHi: "एसी की गैस का रिसाव और रीफ़िल", gwp: "771 – 2,256" },
  MIXED: { formula: "CO₂e", en: "Food and travel (all gases)", hi: "खाना और यात्रा (सभी गैसें)", from: "Published as one CO₂e figure: farming methane and N₂O, flights, trains", fromHi: "खेती की मीथेन और N₂O, उड़ानें, ट्रेनें", gwp: "—" },
};
