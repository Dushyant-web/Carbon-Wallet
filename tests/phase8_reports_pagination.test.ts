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
      expect(data.households[0].currentEmissions).toBe(286);
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
      expect(data.householdEmissions).toBe(286);
      expect(data.leader.name).toContain("Patel");
      expect(data.leader.emissions).toBe(132);
      expect(data.highest.name).toContain("Kapoor");
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
    let testChallengeId: string;

    it("should return initialized challenges for household", async () => {
      const req = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/challenges");
      const res = await getChallenges(req, { params: Promise.resolve({ id: "hh_01_sharma" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.challenges).toBeDefined();
      expect(data.challenges.length).toBeGreaterThanOrEqual(3);

      const coolingChallenge = data.challenges.find((c: { template: string }) =>
        c.template.includes("summer_cooling")
      );
      expect(coolingChallenge).toBeDefined();
      expect(coolingChallenge.streak).toBeGreaterThanOrEqual(1);
      testChallengeId = coolingChallenge.id;
    });

    it("should update challenge streak and progress when called by MEMBER/OWNER", async () => {
      const req = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-role": "MEMBER",
        },
        body: JSON.stringify({
          challengeId: testChallengeId,
          incrementDays: 1,
        }),
      });

      const res = await postChallenges(req, { params: Promise.resolve({ id: "hh_01_sharma" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.challenge).toBeDefined();
      expect(data.challenge.id).toBe(testChallengeId);
      expect(data.challenge.streak).toBeGreaterThanOrEqual(9);
    });

    it("should reject challenge updates from VIEWER with 403 Forbidden", async () => {
      const req = new NextRequest("http://localhost:3000/api/households/hh_01_sharma/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-role": "VIEWER",
        },
        body: JSON.stringify({
          challengeId: testChallengeId,
          incrementDays: 1,
        }),
      });

      const res = await postChallenges(req, { params: Promise.resolve({ id: "hh_01_sharma" }) });
      expect(res.status).toBe(403);
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
      expect(report.summary.grossEmissionsKg).toBe(286);
      expect(report.summary.priorMonthKg).toBe(312.2);
      expect(report.summary.momTrendPct).toBe("-8.4%");
      expect(report.summary.perCapitaKg).toBe(Number((286 / 4).toFixed(1))); // Sharma family size 4

      // Verify GHG Protocol Scope classifications
      expect(report.scopes.scope1).toBeDefined();
      expect(report.scopes.scope2).toBeDefined();
      expect(report.scopes.scope3).toBeDefined();
      expect(report.scopes.scope2.gridFactorUsed).toBe(0.82); // UP CEA v19 factor

      // Verify category apportionment
      expect(report.categories.length).toBeGreaterThanOrEqual(4);
      const electricityCat = report.categories.find((c: { category: string }) => c.category === "Electricity");
      expect(electricityCat).toBeDefined();
      expect(electricityCat.kgCo2e).toBeGreaterThan(100);

      // Verify assets and compliance statement
      expect(report.assets.appliances.length).toBeGreaterThanOrEqual(1);
      expect(report.compliance.protocol).toContain("GHG Protocol");
      expect(report.compliance.ceaVersion).toContain("CEA");
      expect(report.compliance.verificationStatus).toBe("VERIFIED");
    });
  });
});
