import { db } from "@/server/db";

/**
 * Suggestions computed from this household's own data. Every number comes with the arithmetic behind it,
 * and a suggestion is only made when the inputs it needs exist (no AC on record → no AC suggestions).
 */

const GRID_EF = 0.675; // kg CO2/kWh, CEA CO2 Baseline v22.0 FY 2025-26
const SETPOINT_SAVING_PER_C = 0.06; // ~6% less cooling energy per °C higher (BEE guidance)
const SOLAR_KWH_PER_KWP_DAY = 4; // typical Indian rooftop yield
const DEFAULT_TARIFF = 7; // ₹/kWh, used only when no bill shows an amount
// India GHG Program road factors (incl. real-world uplift), kg CO2 per km
const CAR_KG_PER_KM: Record<string, number> = { Petrol: 0.14, Diesel: 0.21, CNG: 0.068, Hybrid: 0.1 };
const METRO_KG_PER_PKM = 0.025; // Delhi Metro, TERI 2019-20 (same factor as the engine)
const FUEL_INR_PER_KM: Record<string, number> = { Petrol: 6.3, Diesel: 5.9, CNG: 3.0, Hybrid: 4.2 }; // ~₹95/L at 15 km/L etc.
const METRO_INR_PER_KM = 2.0;

export type ComputedRecommendation = {
  code: string;
  action: string;
  description: string;
  category: "Electricity" | "Transport" | "Refrigerant";
  kgSaved: number;
  inrSaved: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export async function computeRecommendations(householdId: string): Promise<ComputedRecommendation[]> {
  const household = await db.household.findUnique({
    where: { id: householdId },
    include: { appliances: true, vehicles: true },
  });
  if (!household) return [];
  const [calibration, bills] = await Promise.all([
    db.calibration.findFirst({ where: { householdId, method: { not: "default" } }, orderBy: { createdAt: "desc" } }),
    db.bill.findMany({ where: { householdId }, orderBy: { periodStart: "desc" } }),
  ]);

  const priced = bills.filter((b) => b.amountInr && b.amountInr > 0);
  const pricedKwh = priced.reduce((a, b) => a + b.kwh, 0);
  const tariff = pricedKwh > 0 ? priced.reduce((a, b) => a + (b.amountInr ?? 0), 0) / pricedKwh : null;
  const rate = tariff ?? DEFAULT_TARIFF;
  const rateText = tariff ? `your ₹${tariff.toFixed(2)}/kWh` : `₹${DEFAULT_TARIFF}/kWh (add bill amounts for your rate)`;

  const out: ComputedRecommendation[] = [];

  // --- AC: kW measured from bills beats the rated kW; hours from the latest AC bill beat the appliance setting
  const acAppliance = household.appliances.filter((a) => a.type === "AC").sort((a, b) => b.powerKw - a.powerKw)[0];
  const lastAcBill = bills.find((b) => b.acHoursPerDay > 0);
  const kw = calibration?.acKw ?? acAppliance?.powerKw ?? null;
  const hours = lastAcBill?.acHoursPerDay ?? acAppliance?.avgHoursPerDay ?? null;
  if (kw && hours) {
    const kwSrc = calibration ? `${kw.toFixed(2)} kW (measured from your bills)` : `${kw} kW (rated)`;
    const hSrc = lastAcBill ? `${hours} h/day (your latest AC bill)` : `${hours} h/day`;
    const acKwhMonth = kw * hours * 30;

    const setpointKwh = acKwhMonth * SETPOINT_SAVING_PER_C * 2;
    out.push({
      code: "ac_setpoint_24",
      action: "Set the AC to 24 °C instead of 22 °C",
      description: `Your AC: ${kwSrc} × ${hSrc} × 30 days = ${Math.round(acKwhMonth)} kWh a month. Each degree warmer cuts cooling energy by about 6% (BEE), so 2 °C saves ${Math.round(setpointKwh)} kWh × ${GRID_EF} kg/kWh, at ${rateText}.`,
      category: "Electricity",
      kgSaved: r1(setpointKwh * GRID_EF),
      inrSaved: Math.round(setpointKwh * rate),
      difficulty: "EASY",
    });

    if (hours >= 2) {
      // Never on heatwave days: cooling then is essential. The saving counts only the normal days.
      const billDays = lastAcBill ? Math.max(1, Math.round((lastAcBill.periodEnd.getTime() - lastAcBill.periodStart.getTime()) / 86_400_000)) : 30;
      const heatPerMonth = lastAcBill?.heatDays ? Math.round((lastAcBill.heatDays * 30) / billDays) : 0;
      const normalDays = Math.max(0, 30 - heatPerMonth);
      const hourKwh = kw * 1 * normalDays;
      out.push({
        code: "ac_one_hour_less",
        action: heatPerMonth > 0 ? "Run the AC one hour less on normal days" : "Run the AC one hour less a day",
        description:
          heatPerMonth > 0
            ? `${kwSrc} × 1 h × ${normalDays} normal days = ${Math.round(hourKwh)} kWh a month. Not on heatwave days: your latest AC bill had ${lastAcBill!.heatDays}, and cooling then keeps you safe. A timer that switches off an hour before you wake does it on the other days.`
            : `${kwSrc} × 1 h × 30 days = ${Math.round(hourKwh)} kWh a month. A timer or sleep mode that switches off an hour before you wake does it without thinking.`,
        category: "Electricity",
        kgSaved: r1(hourKwh * GRID_EF),
        inrSaved: Math.round(hourKwh * rate),
        difficulty: "EASY",
      });
    }
  }

  // --- AC gas: a refill means it leaked. A leak test stops the next one (the gas is the CO₂, not the refill bill)
  const yearAgo = new Date(Date.now() - 365 * 86_400_000);
  const refills = await db.emissionEvent.aggregate({
    _sum: { kgCo2e: true },
    _count: true,
    where: { householdId, activity: { category: "Refrigerant", occurredOn: { gte: yearAgo } } },
  });
  const refillKg = refills._sum.kgCo2e ?? 0;
  if (refillKg > 0) {
    out.push({
      code: "ac_leak_test",
      action: "Ask for a leak test before the next AC gas refill",
      description: `Your AC needed gas ${refills._count === 1 ? "once" : `${refills._count} times`} in the last year: ${Math.round(refillKg)} kg CO₂, because that gas leaked out. Fixing the leak (usually a brazed joint or a loose flare nut) avoids the next refill; spread over a year that's ${Math.round(refillKg / 12)} kg a month.`,
      category: "Refrigerant",
      kgSaved: r1(refillKg / 12),
      inrSaved: 0,
      difficulty: "EASY",
    });
  }

  // --- Car → metro for 1 in 5 km
  const car = household.vehicles.find((v) => CAR_KG_PER_KM[v.fuel] !== undefined && v.monthlyKm > 0);
  if (car) {
    const km = car.monthlyKm * 0.2;
    const kg = km * (CAR_KG_PER_KM[car.fuel] - METRO_KG_PER_PKM);
    out.push({
      code: "car_to_metro_20pct",
      action: "Take the metro for 1 in 5 car trips",
      description: `Your ${car.fuel.toLowerCase()} car does ${car.monthlyKm} km a month. Moving 20% (${Math.round(km)} km) to metro saves ${CAR_KG_PER_KM[car.fuel]} − ${METRO_KG_PER_PKM} kg per km (India GHG Program; TERI for metro).`,
      category: "Transport",
      kgSaved: r1(kg),
      inrSaved: Math.round(km * (FUEL_INR_PER_KM[car.fuel] - METRO_INR_PER_KM)),
      difficulty: "MEDIUM",
    });
  }

  // --- Rooftop solar sized to the measured everyday load (or 1 kWp)
  const hasSolar = household.appliances.some((a) => a.type === "SolarPV");
  if (!hasSolar && bills.length > 0) {
    const kwp = calibration ? Math.max(1, Math.min(5, Math.round(calibration.baseloadKwhDay / SOLAR_KWH_PER_KWP_DAY))) : 1;
    const kwh = kwp * SOLAR_KWH_PER_KWP_DAY * 30;
    out.push({
      code: "rooftop_solar",
      action: `Put ${kwp} kWp of solar on the roof`,
      description: `${kwp} kWp × ${SOLAR_KWH_PER_KWP_DAY} kWh/day × 30 = ${kwh} kWh a month from the sun${calibration && calibration.baseloadKwhDay > 0 ? `, sized to your everyday load of ${calibration.baseloadKwhDay} kWh/day` : ""}. PM Surya Ghar subsidy covers part of the cost.`,
      category: "Electricity",
      kgSaved: r1(kwh * GRID_EF),
      inrSaved: Math.round(kwh * rate),
      difficulty: "HARD",
    });
  }

  return out.sort((a, b) => b.kgSaved - a.kgSaved);
}

/** Replaces this household's pending suggestions with freshly computed ones; accepted ones are kept. */
export async function refreshRecommendations(householdId: string) {
  const computed = await computeRecommendations(householdId);
  if (computed.length === 0) return;
  const kept = await db.recommendation.findMany({
    where: { householdId, status: { in: ["ACCEPTED", "COMPLETED"] } },
    select: { action: true },
  });
  const keptActions = new Set(kept.map((k) => k.action));
  await db.$transaction([
    db.recommendation.deleteMany({ where: { householdId, status: "PENDING" } }),
    ...computed
      .filter((c) => !keptActions.has(c.action))
      .map((c) =>
        db.recommendation.create({
          data: {
            householdId,
            action: c.action,
            description: c.description,
            category: c.category,
            kgSaved: c.kgSaved,
            inrSaved: c.inrSaved,
            difficulty: c.difficulty,
          },
        }),
      ),
  ]);
}
