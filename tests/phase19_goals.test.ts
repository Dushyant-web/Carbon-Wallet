import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { baselineFor, forecastMonth, stateOf, targetFor } from "@/server/services/goal.service";

const { GET, POST, DELETE } = await import("@/app/api/households/[id]/goals/route");

const HH = "hh_08_patel";
const p = { params: Promise.resolve({ id: HH }) };
const req = (method: string, role: string, body?: unknown) =>
  new NextRequest(`http://localhost:3000/api/households/${HH}/goals`, {
    method,
    headers: { "content-type": "application/json", "x-demo-role": role },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("Phase 19: goals are a trajectory, not a budget", () => {
  it("glides the target down to the full cut, then holds it", () => {
    expect(targetFor(300, 10, 6, 1)).toBeCloseTo(295, 6);
    expect(targetFor(300, 10, 6, 6)).toBeCloseTo(270, 6);
    expect(targetFor(300, 10, 6, 9)).toBeCloseTo(270, 6);
  });

  it("calls the month on track, watch or likely over against its target", () => {
    expect(stateOf(260, 300)).toBe("on_track");
    expect(stateOf(300, 300)).toBe("watch");
    expect(stateOf(340, 300)).toBe("likely_over");
    expect(stateOf(100, 0)).toBe("no_data");
  });

  it("forecasts per category, so a bill that hasn't arrived never looks like a saving", () => {
    // day 10 of 30; only transport logged (3 days, 20 kg); electricity has nothing yet → runs at baseline
    const f = forecastMonth({ soFar: { Transport: 20 }, daysLogged: { Transport: 3 }, baseline: { Electricity: 150, Transport: 90 }, dayOfMonth: 10, days: 30 });
    // electricity: nothing yet, so its whole baseline (150) · transport: 20 + 20 × (0.3 × 2 + 0.7 × 3) = 74
    expect(f).toBeCloseTo(224, 6);
  });

  it("never reads a one-off (an AC gas refill, a flight) as a daily pace", () => {
    // a 617 kg refill on day 3: it stays, and the rest of the month runs at the usual 0 kg; a flight likewise
    const f = forecastMonth({ soFar: { Refrigerant: 617, Travel: 300 }, daysLogged: { Refrigerant: 1, Travel: 1 }, baseline: { Travel: 60 }, dayOfMonth: 3, days: 30 });
    expect(f).toBeCloseTo(617 + 300 + 27 * 2, 6);
  });

  it("uses the same month last year, without heatwave cooling; else the 3 months before the goal", () => {
    const history = new Map([
      ["2025-05", { total: 400, byCategory: { Electricity: 300, Transport: 100 } }],
      ["2026-02", { total: 210, byCategory: { Electricity: 150, Transport: 60 } }],
      ["2026-03", { total: 240, byCategory: { Electricity: 170, Transport: 70 } }],
      ["2026-04", { total: 270, byCategory: { Electricity: 200, Transport: 70 } }],
    ]);
    const ly = baselineFor("2026-05", "2026-05", history, { "2025-05": 40 })!;
    expect(ly.basis).toBe("same month last year");
    expect(ly.summary.total).toBe(360);
    expect(ly.summary.byCategory.Electricity).toBe(260);
    const avg = baselineFor("2026-06", "2026-05", history, {})!;
    expect(avg.basis).toBe("your average before the goal");
    expect(avg.summary.total).toBeCloseTo(240, 6);
    expect(baselineFor("2030-01", "2030-01", history, {})).toBeNull();
  });

  describe("the goals API (clock pinned to 10 April 2026, inside the seeded year)", () => {
    beforeAll(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-04-10T06:00:00Z"));
    });
    afterAll(() => vi.useRealTimers());

    it("sets a goal from this month with the same month last year as its baseline", async () => {
      const res = await POST(req("POST", "OWNER", { targetPct: 10, glideMonths: 6 }), p);
      expect(res.status).toBe(201);
      const { goal } = await res.json();
      const apr25 = await db.monthlySummary.findUniqueOrThrow({ where: { householdId_month: { householdId: HH, month: "2025-04" } } });
      expect(goal.startMonth).toBe("2026-04");
      expect(goal.endMonth).toBe("2026-09");
      expect(goal.baselineBasis).toBe("same month last year");
      expect(goal.months).toHaveLength(6);
      expect(goal.months[0].target).toBeCloseTo(apr25.totalKg * (1 - 0.1 / 6), 0);
      // nothing logged in April 2026 yet: the forecast is the baseline, a hair above the first target
      expect(goal.current.forecast).toBeCloseTo(apr25.totalKg, 0);
      expect(goal.current.state).toBe("watch");
      expect(JSON.stringify(goal)).not.toMatch(/left|remaining/i); // never "kg left to spend"
    });

    it("lets members and viewers see the goal, but only owners and admins set it", async () => {
      expect((await POST(req("POST", "MEMBER", { targetPct: 10 }), p)).status).toBe(403);
      const seen = await (await GET(req("GET", "VIEWER"), p)).json();
      expect(seen.goal.targetPct).toBe(10);
    });

    it("replaces the active goal, rejects silly targets, and can be stopped", async () => {
      expect((await POST(req("POST", "OWNER", { targetPct: 15, glideMonths: 4 }), p)).status).toBe(201);
      const goals = await db.goal.findMany({ where: { householdId: HH } });
      expect(goals.filter((g) => g.status === "ACTIVE")).toHaveLength(1);
      expect(goals.some((g) => g.status === "REPLACED")).toBe(true);
      expect((await POST(req("POST", "OWNER", { targetPct: 50 }), p)).status).toBe(400);
      expect((await DELETE(req("DELETE", "OWNER"), p)).status).toBe(200);
      expect((await (await GET(req("GET", "OWNER"), p)).json()).goal).toBeNull();
    });
  });
});
