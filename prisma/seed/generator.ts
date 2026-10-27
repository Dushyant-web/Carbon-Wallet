import { HouseholdProfile } from "./households.config";
import { Category, ActivitySource } from "@/types";

export interface GeneratedActivity {
  householdId: string;
  category: Category;
  type: string;
  quantity: number;
  unit: string;
  occurredOn: Date;
  source: ActivitySource;
  notes: string;
  powerKw?: number;
}

// Simple deterministic Pseudo-Random Number Generator (Mulberry32)
export function createPRNG(seed: number) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate 12 months of raw activity records for a household profile.
 * Months: 2025-04 through 2026-03 (12 months).
 */
export function generateRawActivities(
  profile: HouseholdProfile,
  randomSeed: number = 42
): GeneratedActivity[] {
  const prng = createPRNG(randomSeed + profile.name.length * 100);
  const activities: GeneratedActivity[] = [];

  // Generate for 12 months ending 2026-03
  for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
    // monthOffset = 0 is 2026-03 (current month)
    // monthOffset = 1 is 2026-02
    // ...
    // monthOffset = 11 is 2025-04
    const date = new Date(Date.UTC(2026, 2 - monthOffset, 15, 12, 0, 0));
    const monthNum = date.getUTCMonth() + 1; // 1 to 12
    const daysInMonth = new Date(date.getUTCFullYear(), monthNum, 0).getDate();

    // Summer seasonality (May, June, July = months 5, 6, 7)
    const isPeakSummer = monthNum === 5 || monthNum === 6;
    const isModerateSummer = monthNum === 4 || monthNum === 7 || monthNum === 8;
    const isWinter = monthNum === 12 || monthNum === 1;

    const seasonalAcMultiplier = isPeakSummer ? 1.75 : isModerateSummer ? 1.35 : isWinter ? 0.35 : 0.85;

    // 1. ELECTRICITY ACTIVITIES
    // AC cooling events
    const acUnits = profile.appliances.filter((a) => a.type === "AC");
    if (acUnits.length > 0) {
      // 4 to 8 AC logging events per month
      const acEventCount = 4 + Math.floor(prng() * 4);
      for (let i = 0; i < acEventCount; i++) {
        const day = 1 + Math.floor(prng() * (daysInMonth - 1));
        const eventDate = new Date(Date.UTC(date.getUTCFullYear(), monthNum - 1, day, 14, 0, 0));
        const hours = (3.5 + prng() * 4.5) * seasonalAcMultiplier;
        const mainAc = acUnits[0];

        activities.push({
          householdId: profile.id,
          category: "Electricity",
          type: "ac_cooling",
          quantity: Number(hours.toFixed(1)),
          unit: "hours",
          powerKw: mainAc.powerKw,
          occurredOn: eventDate,
          source: "SMART_METER",
          notes: `${mainAc.name} cycle run`,
        });
      }
    }

    // Baseload electricity (refrigeration, lighting, fans)
    const baseKwhPerMonth = profile.floorAreaM2 * 0.75 + profile.size * 18;
    activities.push({
      householdId: profile.id,
      category: "Electricity",
      type: "grid_electricity",
      quantity: Number((baseKwhPerMonth * (0.9 + prng() * 0.2)).toFixed(1)),
      unit: "kWh",
      occurredOn: new Date(Date.UTC(date.getUTCFullYear(), monthNum - 1, 28, 22, 0, 0)),
      source: "BILL_IMPORT",
      notes: "Monthly aggregate baseload and non-HVAC appliances",
    });

    // 2. TRANSPORT ACTIVITIES
    for (const veh of profile.vehicles) {
      if (veh.type === "PublicTransit") {
        activities.push({
          householdId: profile.id,
          category: "Transport",
          type: "metro_transit",
          quantity: Number((veh.monthlyKm * (0.85 + prng() * 0.3)).toFixed(0)),
          unit: "km",
          occurredOn: new Date(Date.UTC(date.getUTCFullYear(), monthNum - 1, 20, 18, 0, 0)),
          source: "MANUAL",
          notes: "Monthly metro and suburban transit pass travel",
        });
      } else {
        const carType =
          veh.fuel === "Electric"
            ? "electric_vehicle"
            : veh.fuel === "Diesel"
            ? "diesel_car"
            : veh.fuel === "CNG"
            ? "cng_car"
            : "petrol_car";

        // 3 to 6 travel commute events
        const tripCount = 3 + Math.floor(prng() * 3);
        const kmPerTrip = veh.monthlyKm / tripCount;

        for (let i = 0; i < tripCount; i++) {
          const day = 2 + Math.floor(prng() * (daysInMonth - 2));
          activities.push({
            householdId: profile.id,
            category: "Transport",
            type: carType,
            quantity: Number((kmPerTrip * (0.8 + prng() * 0.4)).toFixed(1)),
            unit: "km",
            occurredOn: new Date(Date.UTC(date.getUTCFullYear(), monthNum - 1, day, 19, 0, 0)),
            source: "MANUAL",
            notes: `${veh.name} commute and errand log`,
          });
        }
      }
    }

    // 3. TRAVEL / AVIATION (Occasional trips)
    // If Roy household or occasional trip month
    const hasFlightThisMonth =
      profile.id === "hh_10_roy"
        ? prng() > 0.15 // Consultant flies almost every month
        : (monthNum === 6 || monthNum === 12) && prng() > 0.4; // Summer / winter holiday

    if (hasFlightThisMonth) {
      const flightKm = profile.id === "hh_10_roy" ? 750 + prng() * 800 : 1200 + prng() * 600;
      activities.push({
        householdId: profile.id,
        category: "Travel",
        type: "flight_domestic_economy",
        quantity: Number(flightKm.toFixed(0)),
        unit: "km",
        occurredOn: new Date(Date.UTC(date.getUTCFullYear(), monthNum - 1, 10, 8, 30, 0)),
        source: "MANUAL",
        notes: "Domestic round-trip flight leg",
      });
    }

    // Food and waste are not part of a home's carbon here (src/server/counted.ts), so none are generated
  }

  return activities;
}
