import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";

// The engine isn't running in tests: capture what the server would send it
const issued: Record<string, unknown>[] = [];
vi.mock("@/server/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/engine")>();
  return {
    ...real,
    engineIssueStatement: vi.fn(async (body: Record<string, unknown>) => {
      issued.push(body);
      return { id: `st_${issued.length}`, statement: { ...body, type: "CarbonStatement/v1" }, salt: "0x01", leaf: "0x02", proof: [], batch_id: null, anchor: null };
    }),
    engineAnchor: vi.fn(async () => ({ batch_id: 7, merkle_root: "0xroot", n_statements: 1, chain: "polygon-amoy", tx_hash: "0xtx", factor_set: "IN-2026.1", factor_set_hash: "0xfs" })),
    engineGetStatement: vi.fn(async (id: string) => ({ id, statement: { household_ref: id === "st_other" ? "hh_09_iyer" : "hh_02_mehta", period: "2026-03" }, salt: "0x01", leaf: "0x02", proof: [], batch_id: 7, anchor: null })),
    engineStatementStatus: vi.fn(async () => [{ period: "2026-03", anchored: true, statement_id: "st_1" }]),
  };
});

const { GET: list, POST: lock } = await import("@/app/api/households/[id]/statements/route");
const { POST: seal } = await import("@/app/api/households/[id]/statements/seal/route");
const { GET: one } = await import("@/app/api/households/[id]/statements/[sid]/route");

const HH = "hh_02_mehta";
const req = (method: string, role: string, body?: unknown) =>
  new NextRequest(`http://localhost:3000/api/households/${HH}/statements`, {
    method,
    headers: { "content-type": "application/json", "x-demo-role": role },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("Phase 22: locking and sealing months from the server", () => {
  it("seals the household's own recorded numbers, whatever the request says", async () => {
    const res = await lock(req("POST", "OWNER", { month: "2026-03", total_kg: 1, by_category: { Electricity: 1 } }), { params: Promise.resolve({ id: HH }) });
    expect(res.status).toBe(201);
    const march = await db.monthlySummary.findUniqueOrThrow({ where: { householdId_month: { householdId: HH, month: "2026-03" } } });
    const sent = issued.at(-1)!;
    expect(sent.household_ref).toBe(HH);
    expect(sent.period).toBe("2026-03");
    expect(sent.total_kg).toBeCloseTo(march.totalKg, 1); // from the database, not the 1 kg in the request
    expect(await db.auditLog.count({ where: { householdId: HH, action: "statement.lock" } })).toBeGreaterThan(0);
  });

  it("lets the owner lock and seal; family and viewers only look", async () => {
    expect((await lock(req("POST", "MEMBER", { month: "2026-03" }), { params: Promise.resolve({ id: HH }) })).status).toBe(403);
    expect((await seal(req("POST", "VIEWER"), { params: Promise.resolve({ id: HH }) })).status).toBe(403);
    const sealed = await seal(req("POST", "OWNER"), { params: Promise.resolve({ id: HH }) });
    expect(sealed.status).toBe(201);
    expect((await sealed.json()).chain).toBe("polygon-amoy");
    const status = await list(req("GET", "VIEWER"), { params: Promise.resolve({ id: HH }) });
    expect((await status.json()).statements[0].anchored).toBe(true);
  });

  it("never hands one household another household's statement", async () => {
    expect((await one(req("GET", "OWNER"), { params: Promise.resolve({ id: HH, sid: "st_1" }) })).status).toBe(200);
    expect((await one(req("GET", "OWNER"), { params: Promise.resolve({ id: HH, sid: "st_other" }) })).status).toBe(404);
  });

  it("refuses to lock a month with nothing recorded", async () => {
    expect((await lock(req("POST", "OWNER", { month: "2019-01" }), { params: Promise.resolve({ id: HH }) })).status).toBe(409);
  });
});
