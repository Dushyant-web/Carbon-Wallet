import { db } from "@/server/db";
import { engineCdd } from "@/server/engine";
import { gridFactor } from "@/server/factors/registry";
import { currentMonthIST, shiftMonth } from "@/server/period";
import { gridKwh } from "@/server/services/bill.service";

/*
 * Commit → verify (system_design.md §9.4). A suggestion you commit to is checked against what actually
 * happened, using measurements, not promises:
 *   BILL     electricity: the first bill wholly after the commitment vs a weather-adjusted counterfactual.
 *            From the last bill before it: everyday load (calibration) + cooling per degree-day; the
 *            counterfactual is that same home under the new bill's real weather. Saving = counterfactual − actual.
 *   FUEL     car: litres bought in the month after committing vs the average of the 3 months before.
 *   DECLARED no measurement yet once the month is over: half the expected saving, labelled as a promise. It is
 *            upgraded as soon as a bill or fill-ups arrive.
 */

const DAY = 86_400_000;
const r1 = (n: number) => Math.round(n * 10) / 10;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const FUEL_KG: Record<string, number> = { Petrol: 2.31, Hybrid: 2.31, Diesel: 2.68, CNG: 2.75 }; // per L (kg for CNG), as the registry
export const RANGE = { low: 0.7, high: 1.3 }; // the expected saving is shown as a range around the estimate

/** Fields to set when someone commits to a suggestion now. */
export function commitmentFields(kgSaved: number, now: Date = new Date()) {
  return {
    commitMonth: shiftMonth(currentMonthIST(now), 1), // the first whole month after committing
    expectedLow: r1(kgSaved * RANGE.low),
    expectedHigh: r1(kgSaved * RANGE.high),
    realizedKg: null,
    verification: null,
    verifiedAt: null,
    verifyNote: null,
  };
}

type Result = { realizedKg: number; verification: "BILL" | "FUEL" | "DECLARED"; note: string };

/** Measured saving from bills, or null when there's no bill wholly after the commitment yet. */
export async function billCheck(householdId: string, committedAt: Date): Promise<Result | null> {
  const household = await db.household.findUnique({ where: { id: householdId }, select: { city: true, state: true } });
  const bills = await db.bill.findMany({ where: { householdId }, orderBy: { periodStart: "asc" } });
  const before = [...bills].reverse().find((b) => b.periodEnd.getTime() <= committedAt.getTime());
  const after = bills.find((b) => b.periodStart.getTime() >= committedAt.getTime() - DAY);
  if (!household || !before || !after) return null;
  const cal = await db.calibration.findFirst({ where: { householdId, method: { not: "default" } }, orderBy: { createdAt: "desc" } });
  const days = (b: { periodStart: Date; periodEnd: Date }) => Math.max(1, Math.round((b.periodEnd.getTime() - b.periodStart.getTime()) / DAY));
  const dBefore = days(before);
  const dAfter = days(after);
  const kBefore = gridKwh(before);
  const kAfter = gridKwh(after);

  let expectedKwh = (kBefore / dBefore) * dAfter; // no weather: same daily use as before
  let weather = "";
  if (cal) {
    try {
      const cdd = await engineCdd(household.city, household.state, [
        { start: iso(before.periodStart), end: iso(before.periodEnd) },
        { start: iso(after.periodStart), end: iso(after.periodEnd) },
      ]);
      const [cBefore, cAfter] = cdd.periods.map((p) => p.cdd);
      const coolingBefore = Math.max(0, kBefore - cal.baseloadKwhDay * dBefore);
      if (cBefore > 0) {
        expectedKwh = cal.baseloadKwhDay * dAfter + (coolingBefore / cBefore) * cAfter;
        weather = `, after adjusting for the weather (${Math.round(cBefore)} → ${Math.round(cAfter)} degree-days)`;
      }
    } catch {
      return null; // weather unavailable right now: try again later rather than guess
    }
  }
  const savedKwhMonth = ((expectedKwh - kAfter) * 30) / dAfter;
  const realizedKg = r1(savedKwhMonth * gridFactor(household.state));
  return {
    realizedKg,
    verification: "BILL",
    note:
      realizedKg > 0
        ? `Your bill from ${iso(after.periodStart)} used ${Math.round(kAfter)} kWh where ${Math.round(expectedKwh)} kWh was expected${weather}.`
        : `Your bill from ${iso(after.periodStart)} didn't show a saving yet: ${Math.round(kAfter)} kWh where ${Math.round(expectedKwh)} kWh was expected${weather}.`,
  };
}

/** Measured saving from fuel fill-ups for the household's only car on that fuel, or null without data. */
export async function fuelCheck(householdId: string, commitMonth: string): Promise<Result | null> {
  const cars = await db.vehicle.findMany({ where: { householdId, type: { in: ["Car", "SUV"] }, fuel: { in: Object.keys(FUEL_KG) } } });
  if (cars.length !== 1) return null;
  const car = cars[0];
  const range = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) };
  };
  const litres = async (m: string) =>
    (await db.fuelLog.aggregate({ _sum: { quantity: true }, _count: true, where: { householdId, vehicleId: car.id, filledOn: range(m) } }));
  const after = await litres(commitMonth);
  const prior = await Promise.all([1, 2, 3].map((k) => litres(shiftMonth(commitMonth, -k))));
  const withData = prior.filter((p) => p._count > 0);
  if (after._count === 0 || withData.length === 0) return null;
  const avgBefore = withData.reduce((a, p) => a + (p._sum.quantity ?? 0), 0) / withData.length;
  const realizedKg = r1((avgBefore - (after._sum.quantity ?? 0)) * FUEL_KG[car.fuel]);
  const unit = car.fuel === "CNG" ? "kg" : "L";
  return {
    realizedKg,
    verification: "FUEL",
    note: `${car.name || "Your car"} took ${r1(after._sum.quantity ?? 0)} ${unit} that month, against ${r1(avgBefore)} ${unit} a month before you committed.`,
  };
}

/** Checks every commitment that can be checked now; measured results replace declared ones. */
export async function verifyCommitments(householdId: string, now: Date = new Date()) {
  const open = await db.recommendation.findMany({
    where: { householdId, status: { in: ["ACCEPTED", "COMPLETED"] }, commitMonth: { not: null }, OR: [{ verification: null }, { verification: "DECLARED" }] },
  });
  const current = currentMonthIST(now);
  for (const r of open) {
    let result: Result | null = null;
    if (r.category === "Electricity" && r.appliedAt) result = await billCheck(householdId, r.appliedAt);
    if (r.category === "Transport" && r.commitMonth! < current) result = await fuelCheck(householdId, r.commitMonth!);
    if (!result && r.verification === null && r.commitMonth! < current) {
      const expected = ((r.expectedLow ?? r.kgSaved) + (r.expectedHigh ?? r.kgSaved)) / 2;
      result = {
        realizedKg: r1(expected * 0.5),
        verification: "DECLARED",
        note: "No bill or fill-up covers it yet, so it counts at half: a promise, not a measurement. It updates when one arrives.",
      };
    }
    if (result) {
      await db.recommendation.update({
        where: { id: r.id },
        data: { realizedKg: result.realizedKg, verification: result.verification, verifyNote: result.note, verifiedAt: now },
      });
    }
  }
}
