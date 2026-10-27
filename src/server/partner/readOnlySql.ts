import { db } from "@/server/db";

/*
 * Partner's database access for admins: read only, on purpose. Partner also reads text that users wrote
 * (complaints, removal notes, shop names), and such text could try to talk it into changing data; with no way to
 * write, it can't. Three layers: the statement must be a single SELECT/WITH, it runs inside a read-only
 * transaction (SQLite query_only / Postgres READ ONLY), and secrets are blanked out of the result.
 */

export const MAX_ROWS = 200;
const BLOCKED =
  /\b(insert|update|delete|drop|alter|create|replace|upsert|merge|attach|detach|pragma|vacuum|reindex|truncate|grant|revoke|copy|into|lock|call|execute|exec|begin|commit|rollback|savepoint|release|analyze|load_extension|readfile|writefile|pg_read_file|pg_sleep|dblink|set)\b/i;
/** Columns nobody reads through Partner: secrets, sign-in material, private codes, raw photo bytes. */
const SECRET_NAMES = new Set([
  "password_hash", "token_hash", "token", "consumer_hash", "endpoint", "p256dh", "auth", "subject",
  "join_code", "public_token", "card_code", "storage_path", "data",
]);
const SECRET_COLUMN = /pass|secret|token|card_?code|join_?code|api_?key|otp|nonce|p256dh|^auth$|endpoint|consumer_hash|^subject$|storage_path|^data$/i;

export class SqlRejected extends Error {}

export function checkSql(sql: string): string {
  const q = sql.trim().replace(/;\s*$/, "");
  if (!q) throw new SqlRejected("Empty query.");
  if (q.length > 4000) throw new SqlRejected("Query too long.");
  if (/--|\/\*/.test(q)) throw new SqlRejected("No comments in queries.");
  if (q.includes(";")) throw new SqlRejected("One statement only.");
  if (!/^(select|with)\b/i.test(q)) throw new SqlRejected("Only SELECT (or WITH … SELECT) queries are allowed.");
  const code = q.replace(/'(?:[^']|'')*'/g, "''"); // words inside string literals are fine
  const bad = BLOCKED.exec(code);
  if (bad) throw new SqlRejected(`"${bad[1]}" isn't allowed: Partner can only read.`);
  // naming a secret column at all is refused, so it can't be renamed (AS x) or wrapped in a function to slip out
  const secret = (code.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []).find((w) => SECRET_NAMES.has(w.toLowerCase().replace(/^.*\./, "")));
  if (secret) throw new SqlRejected(`The "${secret}" column is private and can't be read through Partner.`);
  return q;
}

const isPostgres = () => /^postgres(ql)?:/.test(process.env.DATABASE_URL ?? "");

function clean(value: unknown, column: string): unknown {
  if (SECRET_COLUMN.test(column)) return value === null ? null : "[hidden]";
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Uint8Array) return `[binary, ${value.length} bytes]`;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 300) return `${value.slice(0, 300)}…`;
  return value;
}

export async function readOnlyQuery(sql: string): Promise<{ columns: string[]; rows: Record<string, unknown>[]; truncated: boolean }> {
  const q = checkSql(sql);
  const wrapped = `SELECT * FROM (${q}) AS partner_query LIMIT ${MAX_ROWS + 1}`;
  const raw = await db.$transaction(async (tx) => {
    if (isPostgres()) {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5s'");
      return tx.$queryRawUnsafe<Record<string, unknown>[]>(wrapped);
    }
    await tx.$executeRawUnsafe("PRAGMA query_only = 1");
    try {
      return await tx.$queryRawUnsafe<Record<string, unknown>[]>(wrapped);
    } finally {
      await tx.$executeRawUnsafe("PRAGMA query_only = 0");
    }
  });
  const rows = raw.slice(0, MAX_ROWS).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, clean(v, k)])));
  return { columns: rows[0] ? Object.keys(rows[0]) : [], rows, truncated: raw.length > MAX_ROWS };
}

/** Tables and their columns, so Partner can write correct queries. */
export async function describeTables(): Promise<Record<string, string[]>> {
  if (isPostgres()) {
    const cols = await db.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position",
    );
    const out: Record<string, string[]> = {};
    for (const c of cols) (out[c.table_name] ??= []).push(c.column_name);
    return out;
  }
  const tables = await db.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name",
  );
  const out: Record<string, string[]> = {};
  for (const t of tables) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(t.name)) continue;
    const cols = await db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${t.name}")`);
    out[t.name] = cols.map((c) => c.name);
  }
  return out;
}
