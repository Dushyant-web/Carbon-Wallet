import { describe, it, expect } from "vitest";
import { db } from "@/server/db";
import { currentMonthIST, resolveReportingPeriod, shiftMonth } from "@/server/period";
import { computeRecommendations } from "@/server/services/recommendation.service";
import { forecastService } from "@/server/services/forecast.service";
import { scoreService } from "@/server/services/score.service";

// Every headline number must come from data, with one rule for "which month".
describe("Phase 14: number integrity", () => {
  it("reports the latest complete month with data, never a hard-coded one", async () => {
    expect(currentMonthIST(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11"); // already Nov 1 in India
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");

    const latest = await db.monthlySummary.findFirst({
      where: { householdId: "hh_01_sharma", totalKg: { gt: 0 }, month: { lt: currentMonthIST() } },
      orderBy: { month: "desc" },
    });
    const period = await resolveReportingPeriod("hh_01_sharma");
    expect(period.month).toBe(latest!.month);
    expect(period.hasData).toBe(true);
    expect((await resolveReportingPeriod("hh_01_sharma", "2025-11")).month).toBe("2025-11");
    expect((await resolveReportingPeriod("hh_01_sharma", "2025-13")).month).toBe(latest!.month); // malformed → default
  });

  it("computes AC savings from the home's own AC, with the arithmetic shown", async () => {
    const recs = await computeRecommendations("hh_01_sharma");
    const setpoint = recs.find((r) => r.action.includes("24 °C"))!;
    // No bills in the seed: largest AC is 1.5 kW rated at 5.5 h/day → 247.5 kWh/month; 2 °C × 6% = 29.7 kWh
    expect(setpoint.kgSaved).toBeCloseTo(1.5 * 5.5 * 30 * 0.06 * 2 * 0.675, 1);
    expect(setpoint.description).toContain("1.5 kW (rated)");
    const car = recs.find((r) => r.category === "Transport")!;
    expect(car.kgSaved).toBeCloseTo(380 * 0.2 * (0.14 - 0.025), 1);
    // Sorted by impact
    expect(recs.map((r) => r.kgSaved)).toEqual([...recs.map((r) => r.kgSaved)].sort((a, b) => b - a));
  });

  it("forecasts from the home's own history and says which basis it used", async () => {
    const f = await forecastService.getForecast("hh_01_sharma", "2026-03");
    expect(f.projection).toHaveLength(6);
    const apr = f.projection[0];
    const aprLastYear = await db.monthlySummary.findUnique({
      where: { householdId_month: { householdId: "hh_01_sharma", month: "2025-04" } },
    });
    expect(apr.month).toBe("2026-04");
    expect(apr.basis).toBe("same_month_last_year");
    expect(apr.baselineKg).toBeCloseTo(aprLastYear!.totalKg, 1);

    const none = await forecastService.getForecast("hh_01_sharma", "2030-01");
    expect(none.projection).toEqual([]); // no data → no invented baseline
    expect(none.currentEmissions).toBe(0);
  });

  it("has no score for a month without emissions", async () => {
    await expect(scoreService.calculateScore("hh_01_sharma", "2030-01")).rejects.toThrow(/No emissions/);
  });
});
