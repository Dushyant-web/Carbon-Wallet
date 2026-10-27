/**
 * One-off: takes food and waste out of every stored month, now that they are not part of a home's carbon
 * (src/server/counted.ts). Each month's total drops by what those two categories held, the categories go, and the
 * gas split is cleared (it is worked out again from the categories when read). Then the mohalla, city, state and
 * India totals are recomputed from the new monthly totals.
 *
 *   this laptop (SQLite):  npm run db:drop-food-waste
 *   Supabase (Postgres):   see DEPLOY.md, "Food and waste removed"
 *
 * Two set-based UPDATEs, so it takes seconds even over a slow link. Running it again changes nothing.
 */
import { db } from "@/server/db";
import { runAreaJob } from "@/server/services/mohalla.service";

const postgres = /^postgres(ql)?:/.test(process.env.DATABASE_URL ?? "");

// Pre-filtered with LIKE so only rows that really hold the keys (valid JSON) are parsed
const UPDATE = postgres
  ? `UPDATE monthly_summaries SET
       total_kg = ROUND((total_kg - COALESCE((by_category::jsonb->>'Food')::numeric, 0)
                                  - COALESCE((by_category::jsonb->>'Waste')::numeric, 0))::numeric, 2),
       by_category = ((by_category::jsonb - 'Food') - 'Waste')::text,
       by_gas = '{}'
     WHERE by_category LIKE '%"Food"%' OR by_category LIKE '%"Waste"%'`
  : `UPDATE monthly_summaries SET
       total_kg = ROUND(total_kg - COALESCE(json_extract(by_category, '$.Food'), 0)
                                 - COALESCE(json_extract(by_category, '$.Waste'), 0), 2),
       by_category = json_remove(by_category, '$.Food', '$.Waste'),
       by_gas = '{}'
     WHERE by_category LIKE '%"Food"%' OR by_category LIKE '%"Waste"%'`;

async function main() {
  const months = await db.$executeRawUnsafe(UPDATE);
  console.log(`${months} monthly totals no longer include food or waste`);
  const areas = await runAreaJob();
  console.log(`area totals recomputed for ${areas.months.length} months (${areas.areas} areas)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
