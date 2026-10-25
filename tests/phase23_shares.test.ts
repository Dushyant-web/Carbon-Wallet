import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";

const HH = "hh_09_iyer";
// The engine isn't running: March 2026 is sealed, February only locked
vi.mock("@/server/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/engine")>();
  return {
    ...real,
    engineStatementStatus: vi.fn(async () => [
      { period: "2026-02", anchored: false, statement_id: "st_feb", batch_id: null },
      { period: "2026-03", anchored: true, statement_id: "st_mar", batch_id: 3 },
    ]),
    engineGetStatement: vi.fn(async (id: string) => ({
      id,
      statement: { household_ref: HH, period: "2026-03", total_kg: 212.4, by_category: { Electricity: 150.1, Transport: 62.3 }, verified_reductions_kg: 12.5, factor_set: "IN-2026.1", issued_at: "2026-04-02T10:00:00" },
      salt: "0xsalt",
      leaf: "0xleaf",
      proof: ["0xp1"],
      batch_id: 3,
      anchor: { merkle_root: "0xroot", chain: "polygon-amoy", tx_hash: "0xtx", factor_set: "IN-2026.1", anchored_at: "2026-04-02T10:05:00", explorer_url: "https://amoy.polygonscan.com/tx/0xtx", block_number: 123 },
    })),
  };
});

const { GET: listShares, POST: createShare } = await import("@/app/api/households/[id]/shares/route");
const { DELETE: revoke } = await import("@/app/api/households/[id]/shares/[shareId]/route");
const { GET: publicView } = await import("@/app/api/public/verify/[token]/route");

const req = (method: string, role: string, body?: unknown) =>
  new NextRequest(`http://localhost:3000/api/households/${HH}/shares`, {
    method,
    headers: { "content-type": "application/json", "x-demo-role": role },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const view = (token: string) => publicView(new NextRequest(`http://localhost:3000/api/public/verify/${token}`), { params: Promise.resolve({ token }) });
const p = { params: Promise.resolve({ id: HH }) };

describe("Phase 23: sharing sealed months with a bank or employer", () => {
  let token = "";
  let shareId = "";

  it("shares only sealed months, and only owners and admins can", async () => {
    expect((await createShare(req("POST", "OWNER", { months: ["2026-02"] }), p)).status).toBe(409); // locked, not sealed
    expect((await createShare(req("POST", "MEMBER", { months: ["2026-03"] }), p)).status).toBe(403);
    const res = await createShare(req("POST", "OWNER", { months: ["2026-03"], days: 30, label: "Home loan" }), p);
    expect(res.status).toBe(201);
    const out = await res.json();
    token = out.token;
    shareId = out.id;
    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it("shows the verifier sealed totals and the proof, never names, emails or the card code", async () => {
    const res = await view(token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe("ok");
    expect(body.carbonId).toMatch(/^CW-/);
    expect(body.months).toHaveLength(1);
    expect(body.months[0]).toMatchObject({ period: "2026-03", totalKg: 212.4, verifiedReductionsKg: 12.5 });
    expect(body.months[0].anchor.explorerUrl).toContain("polygonscan");
    expect(body.months[0].proof).toMatchObject({ salt: "0xsalt", batch_id: 3 });

    const household = await db.household.findUniqueOrThrow({ where: { id: HH }, include: { memberships: { include: { user: true } } } });
    const text = JSON.stringify(body);
    for (const m of household.memberships) {
      expect(text).not.toContain(m.user.email);
      expect(text).not.toContain(m.user.name);
    }
    if (household.cardCode) expect(text).not.toContain(household.cardCode);
    expect(text).not.toContain(household.name);

    const listed = (await (await listShares(req("GET", "OWNER"), p)).json()).shares.find((s: { id: string }) => s.id === shareId);
    expect(listed.views).toBe(1);
  });

  it("stops working when turned off or expired, and unknown links say so", async () => {
    expect((await revoke(req("DELETE", "OWNER"), { params: Promise.resolve({ id: HH, shareId }) })).status).toBe(200);
    expect((await (await view(token)).json()).state).toBe("revoked");

    const owner = (await db.membership.findFirstOrThrow({ where: { householdId: HH, role: "OWNER" } })).userId;
    const old = await db.shareLink.create({ data: { token: "expiredtoken123456789012", householdId: HH, months: '["2026-03"]', expiresAt: new Date(Date.now() - 1000), createdById: owner } });
    const expired = await view(old.token);
    expect(expired.status).toBe(410);
    expect((await expired.json()).state).toBe("expired");
    expect((await view("nosuchtoken000000000000x")).status).toBe(404);
  });
});
