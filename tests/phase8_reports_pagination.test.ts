import { GRID_KG_CO2E_PER_KWH as GRID } from "@/lib/ghg";
import { describe, it, expect } from "vitest";
import { GET as getHouseholds } from "@/app/api/households/route";
import { GET as getBenchmark } from "@/app/api/benchmark/route";
import { GET as getChallenges, POST as postChallenges } from "@/app/api/households/[id]/challenges/route";
import { GET as getReport } from "@/app/api/households/[id]/reports/[month]/route";
import { NextRequest } from "next/server";

describe("Phase 8: Compare, Households Directory, Challenges & Reports", () => {
  describe("1. Household Directory API (Pagination, Sorting, Filtering)", () => {
    it("should paginate households and sort by emissions ascending", async () => {
      const req = new NextRequest("http://localhost:3000/api/households?page=1&limit=4&sort=emissions_asc");
      const res = await getHouseholds(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.households).toBeDefined();
      expect(data.households.length).toBe(4);
      expect(data.total).toBeGreaterThanOrEqual(10);
      expect(data.totalPages).toBeGreaterThanOrEqual(3);
      expect(data.page).toBe(1);

      // First household should be the cleanest (Patel: 132 kg)
      expect(data.households[0].name).toContain("Patel");
      expect(data.households[0].currentEmissions).toBe(132);

      // Verify ascending order
      for (let i = 0; i < data.households.length - 1; i++) {
        expect(data.households[i].currentEmissions).toBeLessThanOrEqual(
          data.households[i + 1].currentEmissions
        );
      }
    });

    it("should filter households by search query", async () => {
      const req = new NextRequest("http://localhost:3000/api/households?search=Sharma");
      const res = await getHouseholds(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.households.length).toBe(1);
      expect(data.households[0].name).toContain("Sharma");
      expect(data.households[0].currentEmissions).toBeCloseTo(286, 1); // the calibrated March total, to the rounding of its events
    });

    it("should filter households by state", async () => {
      const req = new NextRequest("http://localhost:3000/api/households?state=Uttar Pradesh");
      const res = await getHouseholds(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.households.length).toBe(3);
      for (const h of data.households) {
        expect(h.state).toBe("UP");
      }
    });
  });

  describe("2. Cohort Benchmark API", () => {
    it("should calculate benchmark for Sharma against peer cohorts with cohortList", async () => {
      const req = new NextRequest("http://localhost:3000/api/benchmark?householdId=hh_01_sharma");
      const res = await getBenchmark(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.householdId).toBe("hh_01_sharma");
      expect(data.householdEmissions).toBeCloseTo(286, 1); // the calibrated March total, to the rounding of its events
      // Other homes are anonymous in the API: Patel (132 kg) leads, but only by number
    expect(data.leader.name).toBe("Cleanest home");
    expect(JSON.stringify(data.cohortList)).not.toContain("Patel");
      expect(data.leader.emissions).toBe(132);
      expect(data.highest.name).toBe("Highest home");
      expect(data.highest.emissions).toBe(398);
      expect(data.cohortList).toBeDefined();
      expect(data.cohortList.length).toBeGreaterThanOrEqual(10);

      // Check current marker
      const currentInCohort = data.cohortList.find((c: { id: string }) => c.id === "hh_01_sharma");
      expect(currentInCohort).toBeDefined();
      expect(currentInCohort.isCurrent).toBe(true);
    });

    it("should filter benchmark cohort by size band", async () => {
      const req = new NextRequest("http://localhost:3000/api/benchmark?householdId=hh_01_sharma&sizeBand=medium");
      const res = await getBenchmark(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.filtersApplied.sizeBand).toBe("medium");
      expect(data.cohortCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("3. Challenges API & Role Enforcement", () => {
    const post = (body: unknown, role = "OWNER") =>
      postChallenges(
        new NextRequest("http://localhost:3000/api/households/hh_01_sharma/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-demo-role": role },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: "hh_01_sharma" }) },
      );

    it("offers challenges sized to the home, all starting at zero (no made-up streaks)", async () => {
      const res = await getChallenges(new NextRequest("http://localhost:3000/api/households/hh_01_sharma/challenges"), {
        params: Promise.resolve({ id: "hh_01_sharma" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      const templates = data.challenges.map((c: { template: string }) => c.template);
      // Sharma has ACs and a petrol car, so AC and car-free challenges appear
      expect(templates).toEqual(expect.arrayContaining(["ac_24", "ac_hour_less", "standby_off", "car_free_day"]));
      const ac = data.challenges.find((c: { template: string }) => c.template === "ac_hour_less");
      expect(ac.status).toBe("AVAILABLE");
      expect(ac.daysDone).toBe(0);
      // 1.5 kW (largest AC, rated) × 1 h × 0.675 kg/kWh
      expect(ac.kgPerDay).toBeCloseTo(1.5 * GRID, 2);
      expect(data.player.xp).toBe(0);
      expect(data.player.levelName).toBe("Seedling");
    });

    it("joins, checks in once a day, and awards points and the first badge", async () => {
      expect((await post({ template: "ac_hour_less", action: "join" })).status).toBe(200);
      const res = await post({ template: "ac_hour_less", action: "checkin" });
      expect(res.status).toBe(200);
      const data = await res.json();
      const ac = data.challenges.find((c: { template: string }) => c.template === "ac_hour_less");
      expect(ac.daysDone).toBe(1);
      expect(ac.streak).toBe(1);
      expect(ac.checkedInToday).toBe(true);
      expect(ac.kgSaved).toBeCloseTo(1.5 * GRID, 1);
      expect(data.player.xp).toBe(10);
      expect(data.player.badges.find((b: { id: string }) => b.id === "first_step").earned).toBe(true);

      const again = await post({ template: "ac_hour_less", action: "checkin" });
      expect(again.status).toBe(409); // one check-in per day
      expect((await post({ template: "not_a_challenge", action: "join" })).status).toBe(404);
    });

    it("should reject challenge updates from VIEWER with 403 Forbidden", async () => {
      expect((await post({ template: "ac_hour_less", action: "checkin" }, "VIEWER")).status).toBe(403);
    });
  });

  describe("4. Monthly Audit Report API", () => {
    it("should generate a complete GHG Scope 1, 2, 3 carbon audit report for Sharma 2026-03", async () => {
      const req = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/reports/2026-03");
      const res = await getReport(req, {
        params: Promise.resolve({ id: "hh_01_sharma", month: "2026-03" }),
      });
      expect(res.status).toBe(200);

      const report = await res.json();
      expect(report.reportId).toBeDefined();
      expect(report.reportId).toContain("HH01SHARMA");
      expect(report.month).toBe("2026-03");
      expect(report.monthLabel).toContain("March 2026");

      // Verify calibrated targets
      expect(report.summary.grossEmissionsKg).toBeCloseTo(286, 1); // the calibrated March total, to the rounding of its events
      expect(report.summary.priorMonthKg).toBe(312.2);
      expect(report.summary.momTrendPct).toBe("-8.4%");
      expect(report.summary.perCapitaKg).toBe(Number((286 / 4).toFixed(1))); // Sharma family size 4

      // Verify GHG Protocol Scope classifications
      expect(report.scopes.scope1).toBeDefined();
      expect(report.scopes.scope2).toBeDefined();
      expect(report.scopes.scope3).toBeDefined();
      expect(report.scopes.scope2.gridFactorUsed).toBe(GRID); // CEA v22 all-India factor

      // Verify category apportionment
      expect(report.categories.length).toBeGreaterThanOrEqual(4);
      const electricityCat = report.categories.find((c: { category: string }) => c.category === "Electricity");
      expect(electricityCat).toBeDefined();
      expect(electricityCat.kgCo2e).toBeGreaterThan(100);

      // Verify assets and compliance statement
      expect(report.assets.appliances.length).toBeGreaterThanOrEqual(1);
      expect(report.compliance.protocol).toContain("GHG Protocol");
      expect(report.compliance.ceaVersion).toContain("CEA");
      // Seeded March has no bills, so the statement says so instead of claiming verification
      expect(report.compliance.verificationStatus).toBe("SELF_REPORTED");
      expect(report.provenance.nBills).toBe(0);
      expect(report.summary.solarOffsetKg).toBe(0);
    });
  });
});
