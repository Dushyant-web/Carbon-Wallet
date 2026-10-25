import { db } from "@/server/db";

/**
 * One rule for "which month are we talking about", used by every page and API:
 *   reporting month = the latest month with data that has ended and that bills cover fully (or that has no
 *   bills at all); partly billed and current months are shown separately and never compared as if complete.
 * An explicit, well-formed ?month= always wins.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Calendar month in India (IST), e.g. "2026-10". */
export function currentMonthIST(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split("-").map(Number);
  const name = NAMES[m - 1] ?? month;
  return `${short ? name.slice(0, 3) : name} ${y}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export type MonthCoverage = { billedDays: number; daysInMonth: number; partial: boolean };

/**
 * How much of each month the household's bills cover. A month is *partial* when bills cover only some of
 * its days and nothing else (no logged electricity) fills the rest, e.g. the latest bill ends on the 26th.
 * Partial months are real numbers, but comparing them with full months would mislead, so they're flagged.
 */
export async function monthCoverage(householdId: string): Promise<Map<string, MonthCoverage>> {
  const bills = await db.bill.findMany({ where: { householdId }, select: { periodStart: true, periodEnd: true } });
  const billed = new Map<string, number>();
  for (const b of bills) {
    for (let t = b.periodStart.getTime(); t < b.periodEnd.getTime(); t += 86_400_000) {
      const d = new Date(t);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      billed.set(key, (billed.get(key) ?? 0) + 1);
    }
  }
  const out = new Map<string, MonthCoverage>();
  if (billed.size === 0) return out;
  const months = [...billed.keys()].sort();
  const logged = await db.activity.findMany({
    where: {
      householdId,
      category: "Electricity",
      billId: null,
      coveredByBillId: null,
      occurredOn: { gte: new Date(`${months[0]}-01T00:00:00Z`), lt: new Date(`${shiftMonth(months[months.length - 1], 1)}-01T00:00:00Z`) },
    },
    select: { occurredOn: true },
  });
  const hasLogs = new Set(logged.map((a) => a.occurredOn.toISOString().slice(0, 7)));
  for (const [month, days] of billed) {
    const dim = daysInMonth(month);
    const billedDays = Math.min(days, dim);
    out.set(month, { billedDays, daysInMonth: dim, partial: billedDays < dim && !hasLogs.has(month) });
  }
  return out;
}

export type ReportingPeriod = {
  month: string; // the month every headline number refers to
  label: string; // "March 2026"
  isPartial: boolean; // the month isn't fully covered (current month, or bills cover only some days)
  coverage: MonthCoverage | null; // bill coverage of this month, if any bill touches it
  currentMonth: string; // today's month in IST
  soFar: { month: string; totalKg: number } | null; // current month's running total, if any
  newerPartial: { month: string; label: string; totalKg: number; billedDays: number; daysInMonth: number } | null;
  hasData: boolean;
};

export async function resolveReportingPeriod(householdId: string, requested?: string | null): Promise<ReportingPeriod> {
  const currentMonth = currentMonthIST();
  const [summaries, coverage] = await Promise.all([
    db.monthlySummary.findMany({
      where: { householdId, totalKg: { gt: 0 }, month: { lte: currentMonth } },
      orderBy: { month: "desc" },
      select: { month: true, totalKg: true },
    }),
    monthCoverage(householdId),
  ]);
  const current = summaries.find((s) => s.month === currentMonth) ?? null;
  const soFar = current ? { month: current.month, totalKg: current.totalKg } : null;

  if (requested && MONTH_RE.test(requested)) {
    const cov = coverage.get(requested) ?? null;
    return {
      month: requested,
      label: monthLabel(requested),
      isPartial: requested === currentMonth || !!cov?.partial,
      coverage: cov,
      currentMonth,
      soFar,
      newerPartial: null,
      hasData: summaries.some((s) => s.month === requested),
    };
  }

  const ended = summaries.filter((s) => s.month < currentMonth);
  const complete = ended.find((s) => !coverage.get(s.month)?.partial);
  const chosen = complete ?? ended[0];
  const month = chosen?.month ?? currentMonth;
  // A newer month that only part of a bill reaches (e.g. the latest bill ended on the 26th)
  const newer = ended.find((s) => s.month > month && coverage.get(s.month)?.partial);
  const newerCov = newer ? coverage.get(newer.month)! : null;
  return {
    month,
    label: monthLabel(month),
    isPartial: !chosen || !!coverage.get(month)?.partial,
    coverage: coverage.get(month) ?? null,
    currentMonth,
    soFar,
    newerPartial:
      newer && newerCov
        ? { month: newer.month, label: monthLabel(newer.month), totalKg: newer.totalKg, billedDays: newerCov.billedDays, daysInMonth: newerCov.daysInMonth }
        : null,
    hasData: !!chosen || !!current,
  };
}
