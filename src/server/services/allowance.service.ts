import { db } from "@/server/db";
import { stateCode } from "@/lib/carbonId";
import { stateAveragePerPerson, statusFor, type CarbonStatus } from "@/lib/allowance";
import { minHomes } from "./mohalla.service";

/*
 * "The state average for a home like yours". Once a state has enough Carbon Wallet homes (the same 20-home
 * privacy minimum as area totals), it is their measured average per person for that month: real bills, same
 * season. Before that, the published starting estimate in src/lib/allowance.ts is used, and labelled as such.
 */
export type StateAverage = { perPersonKg: number; source: "HOMES" | "ESTIMATE"; homes: number; month: string | null };

export async function stateAverage(state: string, month?: string | null): Promise<StateAverage> {
  const key = stateCode(state);
  const row = await db.areaStat.findFirst({
    where: { level: "STATE", key, homes: { gte: minHomes() }, ...(month ? { month: { lte: month } } : {}) },
    orderBy: { month: "desc" },
  });
  if (row) return { perPersonKg: row.kgPerPerson, source: "HOMES", homes: row.homes, month: row.month };
  return { perPersonKg: stateAveragePerPerson(state).total, source: "ESTIMATE", homes: 0, month: null };
}

export async function homeStatus(state: string, people: number, usedKg: number, month?: string | null) {
  const avg = await stateAverage(state, month);
  const allowanceKg = Math.round(avg.perPersonKg * Math.max(1, people));
  const ratio = allowanceKg > 0 ? usedKg / allowanceKg : 0;
  return { allowanceKg, ratio: Math.round(ratio * 100) / 100, status: statusFor(usedKg, allowanceKg) as CarbonStatus, average: avg };
}
