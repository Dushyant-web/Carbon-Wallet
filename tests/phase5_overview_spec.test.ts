import { describe, it, expect, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { GET as getOverview } from "@/app/api/households/[id]/overview/route";
import { GET as getBenchmark } from "@/app/api/benchmark/route";
import { HOUSEHOLD_PROFILES } from "../prisma/seed/households.config";

describe("Phase 5: Overview Spec & Cohort Benchmarking", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("Done when criterion: Overview matches the spec for all 10 households", async () => {
    for (const profile of HOUSEHOLD_PROFILES) {
      const req = new NextRequest(`http://localhost:3000/api/households/${profile.id}/overview`);
      const res = await getOverview(req, { params: Promise.resolve({ id: profile.id }) });
      expect(res.status).toBe(200);

      const data = await res.json();

      // 1. Exact total emissions match spec
      expect(data.kpi.totalEmissions).toBe(profile.targetMonthlyKg);

      // 2. Primary category matches spec
      expect(data.kpi.topContributor.category).toBe(profile.primaryCategory);

      // 3. Category drill-down breakdown sums strictly to total
      const categorySum = Object.values(data.categoryBreakdown as Record<string, number>).reduce(
        (a, b) => a + b,
        0
      );
      expect(Math.abs(Number(categorySum.toFixed(1)) - data.kpi.totalEmissions)).toBeLessThanOrEqual(0.1);

      // 4. Trend trajectory array has 6 months of data
      expect(data.trendHistory.length).toBe(6);
      expect(data.trendHistory[data.trendHistory.length - 1].totalKg).toBe(profile.targetMonthlyKg);

      // 5. Next Best Action exists
      expect(data.nextBestAction.action).toBeDefined();
      expect(data.nextBestAction.kgSaved).toBeGreaterThan(0);
    }
  });

  it("verifies Sharma specific spec requirements: Electricity 51.7%, Trend -8.4%", async () => {
    const req = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/overview");
    const res = await getOverview(req, { params: Promise.resolve({ id: "hh_01_sharma" }) });
    const data = await res.json();

    expect(data.kpi.totalEmissions).toBe(286);
    expect(data.kpi.trendPct).toBe(-8.4);
    expect(data.kpi.topContributor.category).toBe("Electricity");
    expect(data.kpi.topContributor.sharePct).toBeCloseTo(51.7, 0);
  });

  it("verifies Gupta has solar offset registered", async () => {
    const req = new NextRequest("http://localhost:3000/api/households/hh_06_gupta/overview");
    const res = await getOverview(req, { params: Promise.resolve({ id: "hh_06_gupta" }) });
    const data = await res.json();

    expect(data.solar.hasSolar).toBe(true);
    expect(data.solar.solarKwh).toBeGreaterThan(0);
  });

  it("verifies Khan has EV registered and low footprint (148 kg)", async () => {
    const req = new NextRequest("http://localhost:3000/api/households/hh_07_khan/overview");
    const res = await getOverview(req, { params: Promise.resolve({ id: "hh_07_khan" }) });
    const data = await res.json();

    expect(data.kpi.totalEmissions).toBe(148);
    expect(data.vehicles.some((v: { fuel: string }) => v.fuel === "Electric")).toBe(true);
  });

  it("verifies Patel is portfolio leader (132 kg)", async () => {
    const req = new NextRequest("http://localhost:3000/api/households/hh_08_patel/overview");
    const res = await getOverview(req, { params: Promise.resolve({ id: "hh_08_patel" }) });
    const data = await res.json();

    expect(data.kpi.totalEmissions).toBe(132);
    expect(data.kpi.topContributor.category).toBe("Food");
  });

  it("verifies Cohort Benchmark endpoint returns median, percentiles and leader metadata", async () => {
    const req = new NextRequest("http://localhost:3000/api/benchmark?householdId=hh_01_sharma");
    const res = await getBenchmark(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.householdId).toBe("hh_01_sharma");
    expect(data.cohortCount).toBeGreaterThanOrEqual(10);
    expect(data.cohortMedianTotal).toBeGreaterThan(150);
    expect(data.leader.name).toContain("Patel");
    expect(data.leader.emissions).toBe(132);
    expect(data.highest.name).toContain("Kapoor");
    expect(data.highest.emissions).toBe(398);
  });
});
