import { db } from "@/server/db";
import { EngineError, engineAnchor, engineGetStatement, engineIssueStatement, engineStatementStatus } from "@/server/engine";
import { resolveReportingPeriod } from "@/server/period";

/*
 * Locking and sealing a month. The numbers always come from this household's records in our database, never
 * from a browser, and only this server holds the engine key, so nobody can seal made-up figures or spend
 * the anchoring wallet's gas.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Locks a month (the reporting month by default) as a salted statement, ready to be sealed. */
export async function lockMonth(householdId: string, month?: string) {
  const period = month ?? (await resolveReportingPeriod(householdId)).month;
  const summary = await db.monthlySummary.findUnique({ where: { householdId_month: { householdId, month: period } } });
  if (!summary || summary.totalKg <= 0) throw new EngineError("There's nothing recorded for that month to lock.", 409);
  let byCategory: Record<string, number> = {};
  try {
    byCategory = JSON.parse(summary.byCategory);
  } catch {
    /* old rows */
  }
  // savings measured from bills or fill-ups for commitments checked against this month
  const verified = await db.recommendation.aggregate({
    _sum: { realizedKg: true },
    where: { householdId, commitMonth: period, verification: { in: ["BILL", "FUEL"] }, realizedKg: { gt: 0 } },
  });
  return engineIssueStatement({
    household_ref: householdId,
    period,
    total_kg: r1(summary.totalKg),
    by_category: Object.fromEntries(Object.entries(byCategory).filter(([, kg]) => kg > 0).map(([c, kg]) => [c, r1(kg)])),
    verified_reductions_kg: r1(verified._sum.realizedKg ?? 0),
  });
}

/** Seals every locked statement (all households) in one batch: one transaction for many statements. */
export function sealPending() {
  return engineAnchor();
}

export function statementStatus(householdId: string) {
  return engineStatementStatus(householdId);
}

/** A statement bundle (with its salt), only for the household it belongs to. */
export async function statementFor(householdId: string, statementId: string) {
  const bundle = await engineGetStatement(statementId);
  if (bundle.statement?.household_ref !== householdId) throw new EngineError("Statement not found", 404);
  return bundle;
}
