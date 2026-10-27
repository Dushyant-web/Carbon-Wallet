import { ALLOWANCE_PER_PERSON_KG, statusFor, type CarbonStatus } from "@/lib/allowance";

/*
 * What a home's colour is measured against: 100 kg CO₂e per person a month (src/lib/allowance.ts), the same in
 * every state and month. The shape keeps "source / homes / month" so the website and the apps read it unchanged.
 */
export type Allowance = { perPersonKg: number; source: "FIXED"; homes: number; month: string | null };

export function personAllowance(): Allowance {
  return { perPersonKg: ALLOWANCE_PER_PERSON_KG, source: "FIXED", homes: 0, month: null };
}

export async function homeStatus(people: number, usedKg: number) {
  const avg = personAllowance();
  const allowanceKg = Math.round(avg.perPersonKg * Math.max(1, people));
  const ratio = allowanceKg > 0 ? usedKg / allowanceKg : 0;
  return { allowanceKg, ratio: Math.round(ratio * 100) / 100, status: statusFor(usedKg, allowanceKg) as CarbonStatus, average: avg };
}
