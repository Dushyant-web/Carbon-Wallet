import { db } from "@/server/db";
import { EngineError, engineCalibrate, engineCdd, engineDecompose, engineHeatDays, type CddResult, type HeatDay } from "@/server/engine";
import { gridFactor } from "@/server/factors/registry";
import { gridKwh } from "@/server/services/bill.service";
import type { CalibrationResult, DecompositionResult } from "@/lib/engine";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;

export type AcBillRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  days: number;
  kwh: number;
  kwhPerDay: number;
  acHoursPerDay: number;
  cdd: number | null;
  meanTempC: number | null;
  heatDays: number | null;
};

export type HeatwaveBill = { periodStart: string; periodEnd: string; days: HeatDay[]; essentialKwh: number; essentialKg: number };
/** Cooling on IMD heatwave days: shown, but never counted against the household's goal or suggestions. */
export type Heatwave = {
  rule: string;
  source: string;
  zone: string;
  totalDays: number;
  essentialKg: number;
  essentialInr: number | null;
  bills: HeatwaveBill[];
};

export type HeatPeriod = { periodStart: string; periodEnd: string; days: number; cdd: number; meanTempC: number; acHoursPerDay: number };

export type AcInsights = {
  bills: AcBillRow[];
  calibration: CalibrationResult | null;
  weather: { location: CddResult["location"]; source: string; baseC: number } | null;
  heat: { before: HeatPeriod; after: HeatPeriod; kw: number; result: DecompositionResult } | null;
  tariff: { inrPerKwh: number; fromBills: number } | null; // effective ₹/kWh from bills that show an amount
  heatwave: Heatwave | null;
  notes: string[]; // why a section is empty, in plain words
  engineOffline: boolean;
};

/**
 * Everything the "AC & heat" page shows, computed from this household's own bills:
 * AC kW by regression over the bills, real cooling degree days for each bill period, and an LMDI split
 * of the change between the two latest AC bills into weather vs habit.
 */
export async function getAcInsights(householdId: string): Promise<AcInsights> {
  const household = await db.household.findUnique({ where: { id: householdId } });
  if (!household) throw new EngineError("Household not found", 404);
  const bills = await db.bill.findMany({ where: { householdId }, orderBy: { periodStart: "asc" } });
  const out: AcInsights = { bills: [], calibration: null, weather: null, heat: null, tariff: null, heatwave: null, notes: [], engineOffline: false };
  if (bills.length === 0) {
    out.notes.push("Add your electricity bills to see this page with your own numbers.");
    return out;
  }

  const rows: AcBillRow[] = bills.map((b) => {
    const days = Math.round((b.periodEnd.getTime() - b.periodStart.getTime()) / DAY);
    return {
      id: b.id,
      periodStart: iso(b.periodStart),
      periodEnd: iso(b.periodEnd),
      days,
      kwh: gridKwh(b),
      kwhPerDay: Math.round((gridKwh(b) / Math.max(1, days)) * 10) / 10,
      acHoursPerDay: b.acHoursPerDay,
      cdd: null,
      meanTempC: null,
      heatDays: b.heatDays,
    };
  });
  out.bills = rows;
  const priced = bills.filter((b) => b.amountInr != null && b.amountInr > 0);
  const pricedKwh = priced.reduce((a, b) => a + b.kwh, 0);
  if (pricedKwh > 0) {
    out.tariff = {
      inrPerKwh: Math.round((priced.reduce((a, b) => a + (b.amountInr ?? 0), 0) / pricedKwh) * 100) / 100,
      fromBills: priced.length,
    };
  }

  try {
    out.calibration = await engineCalibrate(
      rows.map((r) => ({ period_start: r.periodStart, period_end: r.periodEnd, kwh: r.kwh, ac_hours: r.acHoursPerDay * r.days })),
    );
  } catch (err) {
    if (err instanceof EngineError && err.status === 503) {
      out.engineOffline = true;
      return out;
    }
    throw err;
  }

  // Real weather for the latest 12 bills
  const recent = rows.slice(-12);
  try {
    const cdd = await engineCdd(
      household.city,
      household.state,
      recent.map((r) => ({ start: r.periodStart, end: r.periodEnd })),
    );
    out.weather = { location: cdd.location, source: cdd.source, baseC: cdd.base_c };
    cdd.periods.forEach((p, i) => {
      recent[i].cdd = p.cdd;
      recent[i].meanTempC = p.mean_temp_c;
    });
  } catch (err) {
    out.notes.push(
      err instanceof EngineError && err.status === 404
        ? `We couldn't find "${household.city}" to look up its weather. Check the city in household settings.`
        : "Weather data is unavailable right now, so heat vs habit can't be worked out. Try again later.",
    );
    return out;
  }

  // Heatwave days in each bill (IMD criteria): AC on those days is essential, so it's set apart
  try {
    const heat = await engineHeatDays(
      household.city,
      household.state,
      recent.map((r) => ({ start: r.periodStart, end: r.periodEnd })),
    );
    const kw = out.calibration.ac_kw;
    const ef = gridFactor(household.state);
    const hwBills: HeatwaveBill[] = [];
    for (const [i, p] of heat.periods.entries()) {
      const row = recent[i];
      row.heatDays = p.count;
      const dates = p.days.map((d) => d.date);
      const bill = bills.find((b) => b.id === row.id)!;
      if (bill.heatDays !== p.count || bill.heatDates !== JSON.stringify(dates)) {
        await db.bill.update({ where: { id: row.id }, data: { heatDays: p.count, heatDates: JSON.stringify(dates) } });
      }
      if (p.count > 0) {
        const essentialKwh = kw * row.acHoursPerDay * p.count;
        hwBills.push({ periodStart: row.periodStart, periodEnd: row.periodEnd, days: p.days, essentialKwh: r1(essentialKwh), essentialKg: r1(essentialKwh * ef) });
      }
    }
    const essentialKwh = hwBills.reduce((a, b) => a + b.essentialKwh, 0);
    out.heatwave = {
      rule: heat.rule,
      source: heat.source,
      zone: heat.periods[0]?.zone ?? "plains",
      totalDays: heat.periods.reduce((a, p) => a + p.count, 0),
      essentialKg: r1(essentialKwh * ef),
      essentialInr: out.tariff ? Math.round(essentialKwh * out.tariff.inrPerKwh) : null,
      bills: hwBills,
    };
  } catch {
    out.notes.push("Heatwave days couldn't be checked right now. Try again later.");
  }

  const acBills = recent.filter((r) => r.acHoursPerDay > 0 && r.cdd != null);
  if (out.calibration.method === "default") {
    out.notes.push("None of your bills has AC hours yet. Add the AC hours a day when you add a bill to measure your AC.");
  }
  if (acBills.length < 2) {
    out.notes.push("Heat vs habit compares two bills where the AC ran. Add one more bill with AC hours.");
    return out;
  }
  const [prev, last] = acBills.slice(-2);
  if (!prev.cdd || !last.cdd) {
    out.notes.push("One of the two latest AC bills had no days above 24 °C on average, so there's no weather baseline to compare.");
    return out;
  }
  const kw = out.calibration.ac_kw;
  const result = await engineDecompose(
    { cdd: prev.cdd, ac_hours: prev.acHoursPerDay * prev.days, kw },
    { cdd: last.cdd, ac_hours: last.acHoursPerDay * last.days, kw },
  );
  const toPeriod = (r: AcBillRow): HeatPeriod => ({
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    days: r.days,
    cdd: r.cdd!,
    meanTempC: r.meanTempC!,
    acHoursPerDay: r.acHoursPerDay,
  });
  out.heat = { before: toPeriod(prev), after: toPeriod(last), kw, result };
  return out;
}

/**
 * kg of AC cooling on heatwave days, by month, from the heatwave days stored on each bill (no engine call).
 * Each heatwave day is booked in its own month: AC kW × that bill's AC hours a day × the grid factor.
 */
export async function essentialCoolingByMonth(householdId: string): Promise<Record<string, number>> {
  const household = await db.household.findUnique({ where: { id: householdId }, select: { state: true } });
  const bills = await db.bill.findMany({ where: { householdId, heatDays: { gt: 0 }, acHoursPerDay: { gt: 0 } } });
  if (!household || bills.length === 0) return {};
  const cal = await db.calibration.findFirst({ where: { householdId, method: { not: "default" } }, orderBy: { createdAt: "desc" } });
  const ac = await db.appliance.findFirst({ where: { householdId, type: "AC" }, orderBy: { powerKw: "desc" } });
  const kw = cal?.acKw ?? ac?.powerKw ?? 1.5;
  const ef = gridFactor(household.state);
  const out: Record<string, number> = {};
  for (const b of bills) {
    let dates: string[] = [];
    try {
      dates = JSON.parse(b.heatDates ?? "[]");
    } catch {
      continue;
    }
    for (const d of dates) out[d.slice(0, 7)] = (out[d.slice(0, 7)] ?? 0) + kw * b.acHoursPerDay * ef;
  }
  return Object.fromEntries(Object.entries(out).map(([m, kg]) => [m, r1(kg)]));
}
