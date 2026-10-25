import { db } from "@/server/db";
import { COUNTED_ACTIVITY } from "@/server/counted";
import { currentMonthIST, daysInMonth, monthLabel, shiftMonth } from "@/server/period";
import { essentialCoolingByMonth } from "@/server/services/acInsights.service";
import { gridFactor } from "@/server/factors/registry";

/*
 * A household goal is a trajectory, not a budget (system_design.md §6; flaws.md C3):
 *   baseline(month) = the same month last year, else the average of the 3 months before the goal began
 *   target(month)   = baseline × (1 − r × min(1, k / glide)),  k = 1 for the first month of the goal
 * Cooling on heatwave days is essential and is taken out of both sides, so a heatwave never counts against
 * anyone. We never show "kg left to spend": only where the month is heading against its target.
 */

export const GOAL_LIMITS = { minPct: 5, maxPct: 30, minGlide: 3, maxGlide: 12 };
const DEFAULT_TARIFF = 7; // ₹/kWh, only when no bill shows an amount (same as the suggestions)

export type GoalState = "on_track" | "watch" | "likely_over" | "no_data";
export type GoalMonth = { month: string; label: string; target: number; actual: number | null; met: boolean | null; complete: boolean };
export type GoalView = {
  id: string;
  targetPct: number;
  glideMonths: number;
  startMonth: string;
  endMonth: string;
  baselineBasis: "same month last year" | "your average before the goal";
  current: {
    month: string;
    label: string;
    target: number;
    forecast: number;
    soFar: number;
    state: GoalState;
    // ₹ first: the electricity part of the gap between the forecast and the target, at the household's tariff
    inrVsTarget: number | null;
    essentialKg: number;
  };
  months: GoalMonth[];
  lever: { action: string; kgSaved: number; inrSaved: number } | null;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const monthsBetween = (a: string, b: string) => {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

type Summary = { total: number; byCategory: Record<string, number> };

async function summaries(householdId: string): Promise<Map<string, Summary>> {
  const rows = await db.monthlySummary.findMany({ where: { householdId }, select: { month: true, totalKg: true, byCategory: true } });
  const out = new Map<string, Summary>();
  for (const r of rows) {
    let byCategory: Record<string, number> = {};
    try {
      byCategory = JSON.parse(r.byCategory);
    } catch {
      /* old rows */
    }
    out.set(r.month, { total: r.totalKg, byCategory });
  }
  return out;
}

/** A month's kg without heatwave cooling (and the category split, likewise). */
function adjusted(s: Summary | undefined, essential: number): Summary | null {
  if (!s || s.total <= 0) return null;
  const byCategory = { ...s.byCategory };
  if (essential > 0 && byCategory.Electricity != null) byCategory.Electricity = Math.max(0, byCategory.Electricity - essential);
  return { total: Math.max(0, s.total - essential), byCategory };
}

export function baselineFor(
  month: string,
  startMonth: string,
  history: Map<string, Summary>,
  essential: Record<string, number>,
): { summary: Summary; basis: GoalView["baselineBasis"] } | null {
  const lastYear = shiftMonth(month, -12);
  const ly = adjusted(history.get(lastYear), essential[lastYear] ?? 0);
  if (ly) return { summary: ly, basis: "same month last year" };
  const before = [1, 2, 3].map((k) => shiftMonth(startMonth, -k)).map((m) => adjusted(history.get(m), essential[m] ?? 0)).filter((x): x is Summary => !!x);
  if (before.length === 0) return null;
  const byCategory: Record<string, number> = {};
  for (const s of before) for (const [c, kg] of Object.entries(s.byCategory)) byCategory[c] = (byCategory[c] ?? 0) + kg / before.length;
  return { summary: { total: before.reduce((a, s) => a + s.total, 0) / before.length, byCategory }, basis: "your average before the goal" };
}

export function targetFor(baseline: number, pct: number, glide: number, k: number): number {
  return baseline * (1 - (pct / 100) * Math.min(1, k / glide));
}

/**
 * Where this month is heading, category by category: what's counted so far, plus the rest of the month at a
 * blend of this month's own pace and the baseline pace. A category with nothing logged yet this month (often
 * electricity, whose bill arrives later) runs at its baseline for the whole month, so missing data never
 * looks like a saving.
 */
// One-offs (a flight, an AC gas refill) mustn't be read as a daily pace: what happened stays, and the rest
// of the month runs at the usual level for that category
const LUMPY = new Set(["Travel", "Refrigerant"]);

export function forecastMonth(opts: {
  soFar: Record<string, number>;
  daysLogged: Record<string, number>;
  baseline: Record<string, number>;
  dayOfMonth: number;
  days: number;
}): number {
  const { soFar, daysLogged, baseline, dayOfMonth, days } = opts;
  const remaining = Math.max(0, days - dayOfMonth);
  let total = 0;
  for (const c of new Set([...Object.keys(soFar), ...Object.keys(baseline)])) {
    const mtd = soFar[c] ?? 0;
    const logged = daysLogged[c] ?? 0;
    if (LUMPY.has(c)) {
      total += mtd + remaining * ((baseline[c] ?? 0) / days);
      continue;
    }
    if (logged === 0 && mtd === 0) {
      total += baseline[c] ?? 0;
      continue;
    }
    const w = logged / (logged + 7);
    const recentDaily = dayOfMonth > 0 ? mtd / dayOfMonth : 0;
    const baseDaily = (baseline[c] ?? 0) / days;
    total += mtd + remaining * (w * recentDaily + (1 - w) * baseDaily);
  }
  return total;
}

export function stateOf(forecast: number, target: number): GoalState {
  if (!(target > 0)) return "no_data";
  const ratio = forecast / target;
  return ratio <= 0.9 ? "on_track" : ratio <= 1.1 ? "watch" : "likely_over";
}

export async function getGoalView(householdId: string, now: Date = new Date()): Promise<GoalView | null> {
  const goal = await db.goal.findFirst({ where: { householdId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  if (!goal || !goal.startMonth) return null;
  const household = await db.household.findUnique({ where: { id: householdId }, select: { state: true } });
  const [history, essential, bills, lever] = await Promise.all([
    summaries(householdId),
    essentialCoolingByMonth(householdId),
    db.bill.findMany({ where: { householdId, amountInr: { gt: 0 } }, select: { kwh: true, amountInr: true } }),
    db.recommendation.findFirst({ where: { householdId, status: "PENDING" }, orderBy: { kgSaved: "desc" } }),
  ]);

  const current = currentMonthIST(now);
  const endMonth = shiftMonth(goal.startMonth, goal.glideMonths - 1);
  const months: GoalMonth[] = [];
  let basis: GoalView["baselineBasis"] = "same month last year";
  for (let k = 1; k <= goal.glideMonths; k++) {
    const month = shiftMonth(goal.startMonth, k - 1);
    const base = baselineFor(month, goal.startMonth, history, essential);
    if (!base) continue;
    if (k === 1) basis = base.basis;
    const target = targetFor(base.summary.total, goal.targetPct, goal.glideMonths, k);
    const complete = month < current;
    const actual = complete ? adjusted(history.get(month), essential[month] ?? 0)?.total ?? null : null;
    months.push({ month, label: monthLabel(month, true), target: r1(target), actual: actual == null ? null : r1(actual), met: actual == null ? null : actual <= target, complete });
  }

  // This month: forecast from what's counted so far
  const curBase = baselineFor(current, goal.startMonth, history, essential);
  const k = monthsBetween(goal.startMonth, current) + 1;
  const curTarget = curBase && k >= 1 ? targetFor(curBase.summary.total, goal.targetPct, goal.glideMonths, k) : 0;
  const soFar = adjusted(history.get(current), essential[current] ?? 0)?.byCategory ?? {};
  const [y, m] = current.split("-").map(Number);
  const acts = await db.activity.findMany({
    where: { householdId, ...COUNTED_ACTIVITY, occurredOn: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } },
    select: { category: true, occurredOn: true },
  });
  const loggedDays: Record<string, Set<string>> = {};
  for (const a of acts) (loggedDays[a.category] ??= new Set()).add(a.occurredOn.toISOString().slice(0, 10));
  const days = daysInMonth(current);
  const dayOfMonth = Math.min(days, Number(new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(8, 10)));
  const forecast = curBase
    ? forecastMonth({
        soFar,
        daysLogged: Object.fromEntries(Object.entries(loggedDays).map(([c, s]) => [c, s.size])),
        baseline: curBase.summary.byCategory,
        dayOfMonth,
        days,
      })
    : 0;

  // ₹: only the electricity part of the gap, priced at this home's tariff
  const pricedKwh = bills.reduce((a, b) => a + b.kwh, 0);
  const tariff = pricedKwh > 0 ? bills.reduce((a, b) => a + (b.amountInr ?? 0), 0) / pricedKwh : DEFAULT_TARIFF;
  const elecShare = curBase && curBase.summary.total > 0 ? (curBase.summary.byCategory.Electricity ?? 0) / curBase.summary.total : 0;
  const gapKg = forecast - curTarget;
  const inrVsTarget = curBase ? Math.round(((gapKg * elecShare) / gridFactor(household?.state)) * tariff) : null;

  return {
    id: goal.id,
    targetPct: goal.targetPct,
    glideMonths: goal.glideMonths,
    startMonth: goal.startMonth,
    endMonth,
    baselineBasis: basis,
    current: {
      month: current,
      label: monthLabel(current),
      target: r1(curTarget),
      forecast: r1(forecast),
      soFar: r1(Object.values(soFar).reduce((a, b) => a + b, 0)),
      state: curBase ? stateOf(forecast, curTarget) : "no_data",
      inrVsTarget,
      essentialKg: essential[current] ?? 0,
    },
    months,
    lever: lever ? { action: lever.action, kgSaved: lever.kgSaved, inrSaved: lever.inrSaved } : null,
  };
}

export class GoalError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Starts a goal this month (any active goal is replaced). Needs some history to have a baseline. */
export async function setGoal(householdId: string, userId: string, targetPct: number, glideMonths: number, now: Date = new Date()) {
  const pct = Math.round(targetPct);
  const glide = Math.round(glideMonths);
  if (pct < GOAL_LIMITS.minPct || pct > GOAL_LIMITS.maxPct) throw new GoalError(`Pick a cut between ${GOAL_LIMITS.minPct}% and ${GOAL_LIMITS.maxPct}%.`);
  if (glide < GOAL_LIMITS.minGlide || glide > GOAL_LIMITS.maxGlide) throw new GoalError(`Pick ${GOAL_LIMITS.minGlide} to ${GOAL_LIMITS.maxGlide} months.`);
  const startMonth = currentMonthIST(now);
  const [history, essential] = await Promise.all([summaries(householdId), essentialCoolingByMonth(householdId)]);
  const base = baselineFor(startMonth, startMonth, history, essential);
  if (!base) throw new GoalError("Add a bill or a few weeks of entries first, so there's a baseline to measure against.", 409);
  const [y, m] = shiftMonth(startMonth, glide).split("-").map(Number);
  return db.$transaction(async (tx) => {
    await tx.goal.updateMany({ where: { householdId, status: "ACTIVE" }, data: { status: "REPLACED" } });
    const goal = await tx.goal.create({
      data: { householdId, targetPct: pct, glideMonths: glide, startMonth, baselineKg: r1(base.summary.total), deadline: new Date(Date.UTC(y, m - 1, 1)), createdById: userId },
    });
    await tx.auditLog.create({ data: { householdId, userId, action: "goal.set", entity: "Goal", details: `${pct}% over ${glide} months from ${startMonth}` } });
    return goal;
  });
}

export async function stopGoal(householdId: string, userId: string) {
  const out = await db.goal.updateMany({ where: { householdId, status: "ACTIVE" }, data: { status: "STOPPED" } });
  if (out.count > 0) await db.auditLog.create({ data: { householdId, userId, action: "goal.stop", entity: "Goal", details: "stopped" } });
  return out.count;
}
