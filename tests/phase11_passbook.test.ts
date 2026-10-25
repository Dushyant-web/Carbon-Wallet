import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { buildCarbonId, checkDigit, isValidCarbonId, stateCode } from "@/lib/carbonId";
import { ensureHouseholdIdentity } from "@/server/services/identity.service";
import { GET as privatePassbook } from "@/app/api/households/[id]/passbook/route";
import { GET as publicPassbook } from "@/app/api/public/passbook/[token]/route";

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${url}`, { headers });
}

describe("Phase 11: Carbon ID and Carbon Passbook", () => {
  it("formats Carbon IDs as CW-ST-YY-NNNN-C with a valid check digit", () => {
    const id = buildCarbonId("Uttar Pradesh", 2026, 1);
    expect(id).toMatch(/^CW-UP-26-0001-\d$/);
    expect(isValidCarbonId(id)).toBe(true);
    expect(stateCode("UP")).toBe("UP");
    expect(stateCode("Maharashtra")).toBe("MH");
  });

  it("catches every single-digit typo in the serial and year", () => {
    const id = buildCarbonId("DL", 2026, 4271);
    const body = id.slice(0, -2);
    const positions = [...body].map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0);
    for (const pos of positions) {
      for (let d = 0; d <= 9; d++) {
        if (body[pos] === String(d)) continue;
        const typo = body.slice(0, pos) + d + body.slice(pos + 1);
        expect(checkDigit(typo)).not.toBe(Number(id.slice(-1)));
      }
    }
  });

  it("assigns each household a unique, permanent identity", async () => {
    const first = await ensureHouseholdIdentity("hh_01_sharma");
    const again = await ensureHouseholdIdentity("hh_01_sharma");
    expect(again).toEqual(first);
    expect(isValidCarbonId(first.carbonId)).toBe(true);

    const all = await db.household.findMany({ where: { carbonId: { not: null } }, select: { carbonId: true } });
    expect(new Set(all.map((h) => h.carbonId)).size).toBe(all.length);
  });

  it("serves the private passbook to members only", async () => {
    const ok = await privatePassbook(req("/api/households/hh_01_sharma/passbook"), {
      params: Promise.resolve({ id: "hh_01_sharma" }),
    });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(isValidCarbonId(body.carbonId)).toBe(true);
    expect(body.months.length).toBeGreaterThan(0);
    expect(body.months[body.months.length - 1].status).toMatch(/OPEN|ANCHORED|RECORDED/);

    const prev = process.env.DEMO_AUTH;
    process.env.DEMO_AUTH = "0";
    try {
      const anon = await privatePassbook(req("/api/households/hh_01_sharma/passbook"), {
        params: Promise.resolve({ id: "hh_01_sharma" }),
      });
      expect(anon.status).toBe(401);
    } finally {
      process.env.DEMO_AUTH = prev;
    }
  });

  it("serves the public record by token with aggregates only", async () => {
    const { publicToken } = await ensureHouseholdIdentity("hh_01_sharma");
    const res = await publicPassbook(req(`/api/public/passbook/${publicToken}`), {
      params: Promise.resolve({ token: publicToken }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.current.totalKg).toBeGreaterThan(0);
    expect(body.publicToken).toBeUndefined();
    const members = await db.membership.findMany({ where: { householdId: "hh_01_sharma" }, include: { user: true } });
    for (const m of members) {
      expect(text).not.toContain(m.user.email);
      expect(text).not.toContain(m.user.name);
    }
    const hh = await db.household.findUnique({ where: { id: "hh_01_sharma" } });
    expect(text).not.toContain(hh!.joinCode);
    expect(text).not.toContain("hh_01_sharma");
  });

  it("treats the current calendar month as in progress, never comparing a part-month", async () => {
    const { buildPassbook } = await import("@/server/services/passbook.service");
    const nowKey = new Date().toISOString().slice(0, 7);
    await db.monthlySummary.upsert({
      where: { householdId_month: { householdId: "hh_07_khan", month: nowKey } },
      update: { totalKg: 4.2 },
      create: { householdId: "hh_07_khan", month: nowKey, totalKg: 4.2, byCategory: "{}", score: 0 },
    });
    try {
      const pb = await buildPassbook("hh_07_khan");
      const open = pb.months.find((m) => m.month === nowKey)!;
      expect(open.status).toBe("OPEN");
      expect(open.deltaPct).toBeNull();
      expect(pb.inProgress?.totalKg).toBe(4.2);
      expect(pb.current.month < nowKey).toBe(true);
      expect(pb.current.totalKg).toBeGreaterThan(100);
      for (const m of pb.months.filter((x) => x.month < nowKey)) expect(m.status).not.toBe("OPEN");
    } finally {
      await db.monthlySummary.deleteMany({ where: { householdId: "hh_07_khan", month: nowKey } });
    }
  });

  it("returns 404 for unknown or malformed tokens", async () => {
    for (const token of ["doesnotexist123", "../etc/passwd", "x"]) {
      const res = await publicPassbook(req(`/api/public/passbook/${encodeURIComponent(token)}`), {
        params: Promise.resolve({ token }),
      });
      expect(res.status).toBe(404);
    }
  });
});
