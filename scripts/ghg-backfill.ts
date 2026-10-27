/**
 * One-off: moves a database from "CO₂ for fuels and electricity" to "all greenhouse gases in CO₂e".
 *   npx tsx --env-file=.env scripts/ghg-backfill.ts
 *
 * 1. Updates every emission factor to its all-gas value (src/server/factors/registry.ts).
 * 2. Rescales each stored emission by its factor's new / old value.
 * 3. Recomputes each month: from its emissions when it has them, otherwise (months added as totals) by scaling
 *    each category and working out the gas split from it.
 * Running it twice changes nothing the second time.
 */
import { db } from "@/server/db";
import { seedEmissionFactors } from "@/server/factors/registry";
import { emissionService } from "@/server/services/emission.service";
import { CATEGORY_TYPE, GAS_PROFILES, co2ePerUnit, gasesFromCategories } from "@/lib/ghg";

async function main() {
  const before = new Map((await db.emissionFactor.findMany()).map((f) => [f.id, f.kgCo2ePerUnit]));
  await seedEmissionFactors();
  const after = await db.emissionFactor.findMany();

  let events = 0;
  for (const f of after) {
    const old = before.get(f.id);
    if (!old || Math.abs(old - f.kgCo2ePerUnit) < 1e-9) continue;
    const ratio = f.kgCo2ePerUnit / old;
    events += await db.$executeRawUnsafe(`UPDATE emission_events SET kg_co2e = ROUND(kg_co2e * ?, 3) WHERE factor_id = ?`, ratio, f.id);
  }

  // months with emissions: recomputed from them (totals, categories, gases, score)
  const withEvents = await db.$queryRawUnsafe<{ household_id: string; month: string }[]>(
    `SELECT DISTINCT household_id, strftime('%Y-%m', occurred_on / 1000, 'unixepoch') AS month FROM emission_events`,
  );
  for (const r of withEvents) await emissionService.recalculateMonthSummary(r.household_id, r.month);
  const done = new Set(withEvents.map((r) => `${r.household_id}|${r.month}`));

  // months added as totals (demo homes): scale each category from CO₂ to CO₂e once, then split by gas
  const ratioFor = (cat: string) => {
    const type = CATEGORY_TYPE[cat];
    const p = type ? GAS_PROFILES[type] : undefined;
    return p && p.co2 > 0 ? co2ePerUnit(type, p.co2) / p.co2 : 1;
  };
  let scaled = 0;
  const rest = await db.monthlySummary.findMany({ select: { id: true, householdId: true, month: true, byCategory: true, byGas: true } });
  for (const s of rest) {
    if (done.has(`${s.householdId}|${s.month}`)) continue;
    if (s.byGas && s.byGas !== "{}") continue; // already converted
    const cats = JSON.parse(s.byCategory || "{}") as Record<string, number>;
    const next = Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, Math.round(v * ratioFor(k) * 10) / 10]));
    const total = Math.round(Object.values(next).reduce((a, v) => a + v, 0) * 10) / 10;
    await db.monthlySummary.update({ where: { id: s.id }, data: { byCategory: JSON.stringify(next), totalKg: total, byGas: JSON.stringify(gasesFromCategories(next)) } });
    scaled++;
  }
  console.log(`factors updated; ${events} emissions rescaled; ${withEvents.length} months recomputed from emissions; ${scaled} total-only months converted`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
