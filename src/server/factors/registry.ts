import { db } from "@/server/db";
import { Category } from "@/types";
import { co2ePerUnit } from "@/lib/ghg";

export interface FactorDefinition {
  category: Category;
  type: string;
  unit: string;
  kgCo2ePerUnit: number;
  region: string;
  source: string;
  validFrom: Date;
}

// As published: CO₂ only for fuels and electricity, CO₂e for food, travel, waste and refrigerants.
const PUBLISHED_FACTORS: FactorDefinition[] = [
  // --- ELECTRICITY: CEA CO2 Baseline Database v22.0 (Aug 2026), FY 2025-26 ---
  // India runs one synchronised national grid; CEA publishes a single all-India weighted
  // average (0.675 tCO2/MWh). Regions are kept as lookup keys and all resolve to it.
  {
    category: "Electricity",
    type: "grid_electricity",
    unit: "kWh",
    kgCo2ePerUnit: 0.675,
    region: "IN-UP",
    source: "CEA CO2 Baseline Database v22.0 (Aug 2026) - FY 2025-26 all-India weighted average",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Electricity",
    type: "grid_electricity",
    unit: "kWh",
    kgCo2ePerUnit: 0.675,
    region: "IN-DL",
    source: "CEA CO2 Baseline Database v22.0 (Aug 2026) - FY 2025-26 all-India weighted average",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Electricity",
    type: "grid_electricity",
    unit: "kWh",
    kgCo2ePerUnit: 0.675,
    region: "IN-HR",
    source: "CEA CO2 Baseline Database v22.0 (Aug 2026) - FY 2025-26 all-India weighted average",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Electricity",
    type: "grid_electricity",
    unit: "kWh",
    kgCo2ePerUnit: 0.675,
    region: "IN-MH",
    source: "CEA CO2 Baseline Database v22.0 (Aug 2026) - FY 2025-26 all-India weighted average",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Electricity",
    type: "grid_electricity",
    unit: "kWh",
    kgCo2ePerUnit: 0.675,
    region: "IN-KA",
    source: "CEA CO2 Baseline Database v22.0 (Aug 2026) - FY 2025-26 all-India weighted average",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Electricity",
    type: "grid_electricity",
    unit: "kWh",
    kgCo2ePerUnit: 0.675,
    region: "IN-TN",
    source: "CEA CO2 Baseline Database v22.0 (Aug 2026) - FY 2025-26 all-India weighted average",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Electricity",
    type: "grid_electricity",
    unit: "kWh",
    kgCo2ePerUnit: 0.675,
    region: "IN-RJ",
    source: "CEA CO2 Baseline Database v22.0 (Aug 2026) - FY 2025-26 all-India weighted average",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Electricity",
    type: "grid_electricity",
    unit: "kWh",
    kgCo2ePerUnit: 0.675,
    region: "IN-WB",
    source: "CEA CO2 Baseline Database v22.0 (Aug 2026) - FY 2025-26 all-India weighted average",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Electricity",
    type: "grid_electricity",
    unit: "kWh",
    kgCo2ePerUnit: 0.675,
    region: "IN-NATIONAL",
    source: "CEA CO2 Baseline Database v22.0 (Aug 2026) - FY 2025-26 all-India weighted average",
    validFrom: new Date("2024-01-01"),
  },

  // --- TRANSPORT: Fuels & Direct Vehicle Travel ---
  {
    category: "Transport",
    type: "petrol_fuel",
    unit: "L",
    kgCo2ePerUnit: 2.31,
    region: "IN-NATIONAL",
    source: "India GHG Program / IPCC Mobile Combustion Guidelines",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Transport",
    type: "petrol_car",
    unit: "km",
    kgCo2ePerUnit: 0.165, // ~14 km/L Indian Sedan
    region: "IN-NATIONAL",
    source: "India GHG Program - Average Petrol Passenger Car (14 km/L)",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Transport",
    type: "diesel_fuel",
    unit: "L",
    kgCo2ePerUnit: 2.68,
    region: "IN-NATIONAL",
    source: "India GHG Program / IPCC Mobile Combustion Guidelines",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Transport",
    type: "diesel_car",
    unit: "km",
    kgCo2ePerUnit: 0.206, // ~13 km/L Indian Diesel SUV
    region: "IN-NATIONAL",
    source: "India GHG Program - Average Diesel SUV/MPV (13 km/L)",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Transport",
    type: "cng_fuel",
    unit: "kg",
    kgCo2ePerUnit: 2.75,
    region: "IN-NATIONAL",
    source: "Petroleum Planning & Analysis Cell (PPAC) / India GHG",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Transport",
    type: "cng_car",
    unit: "km",
    kgCo2ePerUnit: 0.110, // ~25 km/kg Indian CNG Hatchback
    region: "IN-NATIONAL",
    source: "India GHG Program - Compact CNG Vehicle (25 km/kg)",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Transport",
    type: "two_wheeler_petrol",
    unit: "km",
    kgCo2ePerUnit: 0.045, // ~50 km/L commuter motorbike
    region: "IN-NATIONAL",
    source: "India GHG Program - Two-Wheeler 100-150cc",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Transport",
    type: "electric_vehicle",
    unit: "km",
    kgCo2ePerUnit: 0.101, // 0.14 kWh/km × 0.727 kg/kWh national average
    region: "IN-NATIONAL",
    source: "BEE India Electric Mobility Guidelines (0.14 kWh/km avg grid)",
    validFrom: new Date("2024-01-01"),
  },

  // --- TRAVEL: Aviation and Public Mass Transit ---
  {
    category: "Travel",
    type: "flight_domestic_economy",
    unit: "km",
    kgCo2ePerUnit: 0.140,
    region: "IN-NATIONAL",
    source: "DGCA / UK DEFRA Short-Haul Passenger Aviation (Economy)",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Travel",
    type: "flight_domestic_business",
    unit: "km",
    kgCo2ePerUnit: 0.210,
    region: "IN-NATIONAL",
    source: "DGCA / UK DEFRA Short-Haul Passenger Aviation (Business)",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Travel",
    type: "metro_transit",
    unit: "km",
    kgCo2ePerUnit: 0.028,
    region: "IN-NATIONAL",
    source: "Delhi Metro Rail Corporation (DMRC) Annual Sustainability Report 2023",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Travel",
    type: "intercity_train",
    unit: "km",
    kgCo2ePerUnit: 0.035,
    region: "IN-NATIONAL",
    source: "Indian Railways Environmental Directorate (Electrified Route)",
    validFrom: new Date("2024-01-01"),
  },

  // --- FOOD & COOKING ---
  {
    category: "Food",
    type: "lpg_cooking",
    unit: "kg",
    kgCo2ePerUnit: 2.98,
    region: "IN-NATIONAL",
    source: "Ministry of Petroleum & Natural Gas / IPCC Guidelines for LPG",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Food",
    type: "meal_non_veg",
    unit: "meal",
    kgCo2ePerUnit: 2.80,
    region: "IN-NATIONAL",
    source: "WRI Food Systems Carbon Accounting (Indian Urban Basket)",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Food",
    type: "meal_veg",
    unit: "meal",
    kgCo2ePerUnit: 0.90,
    region: "IN-NATIONAL",
    source: "WRI Food Systems Carbon Accounting (Indian Urban Vegetarian Basket)",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Food",
    type: "grocery_basket",
    unit: "basket",
    kgCo2ePerUnit: 3.40,
    region: "IN-NATIONAL",
    source: "CarbonOS Calibrated Diet & Grocery Metric",
    validFrom: new Date("2024-01-01"),
  },

  // --- PUBLIC TRANSPORT ---
  {
    category: "Travel",
    type: "city_bus",
    unit: "km",
    kgCo2ePerUnit: 0.0152, // per passenger-km
    region: "IN-NATIONAL",
    source: "India GHG Program 2015 - Urban bus, per passenger-km",
    validFrom: new Date("2024-01-01"),
  },

  // --- REFRIGERANT (AC gas top-ups: every kg added replaces a kg that leaked out) ---
  // Same GWP100 values as the engine (backend/app/engine/factors.py, GWP_AR6)
  {
    category: "Refrigerant",
    type: "refrigerant_r32",
    unit: "kg",
    kgCo2ePerUnit: 771,
    region: "IN-NATIONAL",
    source: "IPCC AR6 GWP100 - HFC-32 (R-32)",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Refrigerant",
    type: "refrigerant_r410a",
    unit: "kg",
    kgCo2ePerUnit: 2256,
    region: "IN-NATIONAL",
    source: "IPCC AR6 GWP100 - R-410A blend",
    validFrom: new Date("2024-01-01"),
  },
  {
    category: "Refrigerant",
    type: "refrigerant_r22",
    unit: "kg",
    kgCo2ePerUnit: 1960,
    region: "IN-NATIONAL",
    source: "IPCC AR6 GWP100 - HCFC-22 (R-22)",
    validFrom: new Date("2024-01-01"),
  },

  // --- WASTE ---
  {
    category: "Waste",
    type: "solid_waste_unsegregated",
    unit: "kg",
    kgCo2ePerUnit: 0.55,
    region: "IN-NATIONAL",
    source: "CPCB Municipal Solid Waste Characterisation Study",
    validFrom: new Date("2024-01-01"),
  },
];

/**
 * The factors the app uses: all greenhouse gases in CO₂e. Fuels and electricity get the CH₄ and N₂O from burning
 * added to the published CO₂ (IPCC 2006 defaults, AR6 GWP100; see src/lib/ghg.ts); the rest are CO₂e already.
 */
export const OFFICIAL_EMISSION_FACTORS: FactorDefinition[] = PUBLISHED_FACTORS.map((f) => {
  const all = co2ePerUnit(f.type, f.kgCo2ePerUnit);
  return all === f.kgCo2ePerUnit ? f : { ...f, kgCo2ePerUnit: all, source: `${f.source}; + CH₄ and N₂O (IPCC 2006 defaults, AR6 GWP100)` };
});

/**
 * Seed or update all official emission factors in the database.
 */
export async function seedEmissionFactors() {
  for (const factor of OFFICIAL_EMISSION_FACTORS) {
    await db.emissionFactor.upsert({
      where: {
        category_type_region: {
          category: factor.category,
          type: factor.type,
          region: factor.region,
        },
      },
      update: {
        unit: factor.unit,
        kgCo2ePerUnit: factor.kgCo2ePerUnit,
        source: factor.source,
        validFrom: factor.validFrom,
      },
      create: {
        category: factor.category,
        type: factor.type,
        unit: factor.unit,
        kgCo2ePerUnit: factor.kgCo2ePerUnit,
        region: factor.region,
        source: factor.source,
        validFrom: factor.validFrom,
      },
    });
  }
}

/**
 * Helper to map household state / code to factor region code.
 */
/** kg CO₂e per kWh of grid electricity for a state (the national figure when the state has none of its own). */
export function gridFactor(state?: string | null): number {
  const region = stateToRegion(state);
  const grid = OFFICIAL_EMISSION_FACTORS.filter((f) => f.type === "grid_electricity");
  return (grid.find((f) => f.region === region) ?? grid.find((f) => f.region === "IN-NATIONAL") ?? grid[0]).kgCo2ePerUnit;
}

export function stateToRegion(state?: string | null): string {
  if (!state) return "IN-NATIONAL";
  const s = state.toUpperCase().trim();
  if (s === "UP" || s === "UTTAR PRADESH") return "IN-UP";
  if (s === "DL" || s === "DELHI" || s === "NEW DELHI") return "IN-DL";
  if (s === "HR" || s === "HARYANA") return "IN-HR";
  if (s === "MH" || s === "MAHARASHTRA") return "IN-MH";
  if (s === "KA" || s === "KARNATAKA") return "IN-KA";
  if (s === "TN" || s === "TAMIL NADU") return "IN-TN";
  if (s === "RJ" || s === "RAJASTHAN") return "IN-RJ";
  if (s === "WB" || s === "WEST BENGAL") return "IN-WB";
  return `IN-${s}`;
}
