/**
 * One-off copy of every row from the local SQLite database into Supabase (Postgres), keeping ids.
 *   1. node scripts/postgres-schema.mjs && npx prisma generate --schema prisma/postgres/schema.prisma --generator pgcopy
 *   2. DIRECT_URL=postgres://… npx prisma migrate deploy --schema prisma/postgres/schema.prisma
 *   3. PG_URL=postgres://… (direct, not pooled) npx tsx scripts/sqlite-to-postgres.ts
 * Foreign keys are switched off for the copy's own connection only (circular links such as fuel log ↔ activity),
 * so tables can be filled in any order. Run it on an empty database, or add --replace to empty the copied tables
 * first (in the same transaction, so a failed copy leaves the old data in place).
 */
import { PrismaClient as SqliteClient } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient: PgClient } = require("../prisma/postgres/client");

// Not copied: sign-in sessions, 15-minute counter tickets and this machine's push subscriptions. They belong to
// the local copy; on the new database people simply sign in again.
const MODELS = [
  "user", "household", "membership", "emissionFactor", "recurringRule", "appliance", "vehicle", "document", "bill",
  "activity", "fuelLog", "emissionEvent", "monthlySummary", "recommendation", "challenge", "goal", "budget",
  "auditLog", "card", "calibration", "checkIn", "shareLink", "sentReminder",
  "erasureLog", "merchant", "merchantSale", "oAuthIdentity", "scheme", "schemeHelp",
  "removalRequest", "removalPhoto", "mohalla", "householdLocation", "areaStat", "weatherCell", "anchorBatch", "anchorLeaf",
  "catalogueItem", "catalogueImage", "grievance", "notification", "translation",
] as const;

async function main() {
  if (!process.env.PG_URL) throw new Error("Set PG_URL to the Supabase direct connection string.");
  const from = new SqliteClient();
  const to = new PgClient({ datasources: { db: { url: process.env.PG_URL } } });
  await to.$transaction(
    async (tx: { $executeRawUnsafe: (q: string) => Promise<unknown> } & Record<string, { createMany: (a: unknown) => Promise<{ count: number }> }>) => {
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
      if (process.argv.includes("--replace")) {
        const tables = await (tx as unknown as { $queryRawUnsafe: (q: string) => Promise<{ tablename: string }[]> }).$queryRawUnsafe(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
        );
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
        console.log(`emptied ${tables.length} tables`);
      }
      for (const m of MODELS) {
        const rows = await (from as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[m].findMany();
        let n = 0;
        for (let i = 0; i < rows.length; i += 500) n += (await tx[m].createMany({ data: rows.slice(i, i + 500) })).count;
        console.log(`${m.padEnd(18)} ${n}`);
      }
    },
    { timeout: 30 * 60_000, maxWait: 60_000 },
  );
  await from.$disconnect();
  await to.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
