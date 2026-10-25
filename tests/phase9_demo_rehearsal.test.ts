import { describe, it, expect } from "vitest";
import { GET as getOverview } from "@/app/api/households/[id]/overview/route";
import { POST as postActivity } from "@/app/api/households/[id]/activities/route";
import { POST as postChallenge } from "@/app/api/households/[id]/challenges/route";
import { POST as applyRecommendation } from "@/app/api/households/[id]/recommendations/[rid]/apply/route";
import { db } from "@/server/db";
import { NextRequest } from "next/server";

describe("Phase 9: Demo Script Rehearsal & End-to-End Proof of Concept", () => {
  let createdActivityId: string = "";
let summaryBefore: { totalKg: number; byCategory: string; score: number } | null = null;

  describe("Step 1: Open Sharma Residence (Baseline 286 kg, Electricity-heavy, AC Recommendation)", () => {
    it("retrieves Sharma telemetry matching all calibrated spec targets", async () => {
      const req = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/overview");
      const res = await getOverview(req, { params: Promise.resolve({ id: "hh_01_sharma" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.household.id).toBe("hh_01_sharma");
      expect(data.household.name).toBe("Sharma Residence");
      expect(data.household.size).toBe(4);
      expect(data.household.state).toBe("UP");

      // Baseline monthly emissions
      expect(data.kpi.totalEmissions).toBe(286);
      expect(data.kpi.trendPct).toBe(-8.4);

      // Top contributor is Electricity / AC cooling
      expect(data.kpi.topContributor.category).toBe("Electricity");
      expect(data.kpi.topContributor.sharePct).toBeGreaterThanOrEqual(40);

      // Top recommendation addresses AC / cooling thermal load
      expect(data.nextBestAction.category).toBe("Electricity");
      expect(data.nextBestAction.action).toMatch(/AC|Cooling|Thermostat|Compressor/i);
      expect(data.nextBestAction.kgSaved).toBeGreaterThan(0);
      expect(data.nextBestAction.inrSaved).toBeGreaterThan(0);
    });
  });

  describe("Step 2: Switch to Khan Household (148 kg, EV Transport, High Efficiency)", () => {
    it("dynamically loads Khan Household with distinctly different telemetry and EV fleet", async () => {
      const req = new NextRequest("http://localhost:3000/api/households/hh_07_khan/overview");
      const res = await getOverview(req, { params: Promise.resolve({ id: "hh_07_khan" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.household.id).toBe("hh_07_khan");
      expect(data.household.name).toBe("Khan Household");
      expect(data.kpi.totalEmissions).toBe(148);

      // Low per-capita emissions (148 / 3 members = ~49.3 kg)
      const perCapita = data.kpi.totalEmissions / data.household.size;
      expect(perCapita).toBeLessThan(60);

      // Verified EV fleet
      expect(data.vehicles.some((v: { fuel: string }) => v.fuel === "Electric")).toBe(true);

      // Telemetry visibly distinct from Sharma
      expect(data.kpi.totalEmissions).not.toBe(286);
      expect(data.household.city).toBe("Bengaluru");
    });
  });

  describe("Step 3: Switch to Kapoor Residence (398 kg, Transport-heavy, Mobility Target)", () => {
    it("loads Kapoor Residence as the highest portfolio emitter driven by transport", async () => {
      const req = new NextRequest("http://localhost:3000/api/households/hh_04_kapoor/overview");
      const res = await getOverview(req, { params: Promise.resolve({ id: "hh_04_kapoor" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.household.id).toBe("hh_04_kapoor");
      expect(data.household.name).toBe("Kapoor Residence");
      expect(data.kpi.totalEmissions).toBe(398);

      // Transport is top contributor
      expect(data.kpi.topContributor.category).toBe("Transport");
      expect(data.kpi.topContributor.sharePct).toBeGreaterThanOrEqual(45);

      // The top suggestion is the largest computed saving. For Kapoor that's the 3.5 kW VRF AC (1 h less a day
      // = 105 kWh ≈ 70.9 kg), ahead of moving 1 in 5 diesel-car km to metro (≈ 36.3 kg), even though transport is
      // the biggest source.
      const pending = await db.recommendation.findMany({ where: { householdId: "hh_04_kapoor", status: "PENDING" } });
      expect(data.nextBestAction.kgSaved).toBe(Math.max(...pending.map((r) => r.kgSaved)));
      expect(pending.some((r) => r.category === "Transport")).toBe(true);
    });
  });

  describe("Step 4: Add Activity Event in Sharma & Observe Live Pipeline Recalculation", () => {
    it("records a 6-hour AC activity in UP grid (+6.075 kg CO₂e) and updates totals live", async () => {
      summaryBefore = await db.monthlySummary.findUnique({
        where: { householdId_month: { householdId: "hh_01_sharma", month: "2026-03" } },
        select: { totalKg: true, byCategory: true, score: true },
      });
      // 1. Post new AC cooling activity
      const postReq = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-role": "OWNER",
        },
        body: JSON.stringify({
          category: "Electricity",
          type: "ac_cooling",
          quantity: 6,
          unit: "hours",
          occurredOn: "2026-03-25T14:00:00.000Z",
          source: "MANUAL",
          notes: "Live demo afternoon AC run",
        }),
      });

      const postRes = await postActivity(postReq, { params: Promise.resolve({ id: "hh_01_sharma" }) });
      expect(postRes.status).toBe(201);

      const postData = await postRes.json();
      expect(postData.activity).toBeDefined();
      expect(postData.emissionEvent).toBeDefined();
      expect(postData.monthlySummary).toBeDefined();

      createdActivityId = postData.activity.id;

      // 6 h * 1.5 kW = 9.0 kWh * 0.675 kg/kWh (CEA v22) = 6.075 kg
      expect(postData.emissionEvent.kgCo2e).toBe(6.075);

      // Monthly rollup updated: 286 + 6.075 = 292.1 kg
      expect(Math.round(postData.monthlySummary.totalKg * 10) / 10).toBe(292.1);

      // 2. Overview query immediately reflects updated total
      const overviewReq = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/overview");
      const overviewRes = await getOverview(overviewReq, { params: Promise.resolve({ id: "hh_01_sharma" }) });
      const overviewData = await overviewRes.json();

      expect(Math.round(overviewData.kpi.totalEmissions * 10) / 10).toBe(292.1);
    });

    it("resets the demo activity to restore calibrated baseline", async () => {
      if (createdActivityId) {
        await db.emissionEvent.deleteMany({ where: { activityId: createdActivityId } });
        await db.activity.deleteMany({ where: { id: createdActivityId } });

        // Restore the whole summary (total, category split and score), not just the total, so later suites
        // see consistent data regardless of test order.
        await db.monthlySummary.update({
          where: { householdId_month: { householdId: "hh_01_sharma", month: "2026-03" } },
          data: summaryBefore ?? { totalKg: 286.0 },
        });
      }

      const checkReq = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/overview");
      const checkRes = await getOverview(checkReq, { params: Promise.resolve({ id: "hh_01_sharma" }) });
      const checkData = await checkRes.json();
      expect(checkData.kpi.totalEmissions).toBe(286);
    });
  });

  describe("Step 5: Role-Based Access Control Rejection with VIEWER Role", () => {
    it("blocks activity creation from VIEWER with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-role": "VIEWER",
        },
        body: JSON.stringify({
          category: "Electricity",
          type: "ac_cooling",
          quantity: 2,
          unit: "hours",
          occurredOn: new Date().toISOString(),
          source: "MANUAL",
        }),
      });

      const res = await postActivity(req, { params: Promise.resolve({ id: "hh_01_sharma" }) });
      expect(res.status).toBe(403);

      const err = await res.json();
      expect(err.error).toContain("Forbidden");
    });

    it("blocks challenge check-ins from VIEWER with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-role": "VIEWER",
        },
        body: JSON.stringify({
          challengeId: "any_challenge_id",
          incrementDays: 1,
        }),
      });

      const res = await postChallenge(req, { params: Promise.resolve({ id: "hh_01_sharma" }) });
      expect(res.status).toBe(403);
    });

    it("blocks recommendation application from VIEWER with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/recommendations/rec_01/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-role": "VIEWER",
        },
      });

      const res = await applyRecommendation(req, {
        params: Promise.resolve({ id: "hh_01_sharma", rid: "rec_01" }),
      });
      expect(res.status).toBe(403);
    });
  });
});
