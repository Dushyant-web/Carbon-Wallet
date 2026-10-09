import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { HOUSEHOLD_PROFILES } from "../prisma/seed/households.config";

import { seedDatabase } from "../prisma/seed";

describe("Phase 2: Seed Generator & Calibration Engine", () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("Done when criterion: All 10 households hit target totals in current month (2026-03)", async () => {
    for (const profile of HOUSEHOLD_PROFILES) {
      const summary = await db.monthlySummary.findUnique({
        where: {
          householdId_month: {
            householdId: profile.id,
            month: "2026-03",
          },
        },
      });

      expect(summary).toBeDefined();
      expect(summary?.totalKg).toBe(profile.targetMonthlyKg);
    }
  });

  it("verifies Sharma Residence hits 286 kg and has intended trend of -8.4% vs last month", async () => {
    const sharmaCurrent = await db.monthlySummary.findUnique({
      where: {
        householdId_month: {
          householdId: "hh_01_sharma",
          month: "2026-03",
        },
      },
    });
    const sharmaPrior = await db.monthlySummary.findUnique({
      where: {
        householdId_month: {
          householdId: "hh_01_sharma",
          month: "2026-02",
        },
      },
    });

    expect(sharmaCurrent?.totalKg).toBe(286.0);
    expect(sharmaPrior?.totalKg).toBe(312.2);

    const changePct = Number(
      (((sharmaCurrent!.totalKg - sharmaPrior!.totalKg) / sharmaPrior!.totalKg) * 100).toFixed(1)
    );
    expect(changePct).toBe(-8.4);
  });

  it("verifies category breakdown strictly sums to monthly total across all 10 households", async () => {
    const summaries = await db.monthlySummary.findMany({
      where: {
        month: "2026-03",
        householdId: { in: HOUSEHOLD_PROFILES.map((p) => p.id) },
      },
    });

    expect(summaries.length).toBe(10);

    for (const summary of summaries) {
      const breakdown = JSON.parse(summary.byCategory) as Record<string, number>;
      const categorySum = Object.values(breakdown).reduce((a, b) => a + b, 0);

      // Verify category totals sum to totalKg within 0.1 kg
      expect(Math.abs(Number(categorySum.toFixed(1)) - summary.totalKg)).toBeLessThanOrEqual(0.1);
    }
  });

  it("verifies all 12 historical months exist with seasonal summer variation", async () => {
    for (const profile of HOUSEHOLD_PROFILES) {
      const summaries = await db.monthlySummary.findMany({
        where: { householdId: profile.id },
        orderBy: { month: "asc" },
      });

      expect(summaries.length).toBe(12);

      // May and June 2025 summer peak should be higher than March 2026
      const maySummary = summaries.find((s) => s.month === "2025-05");
      const juneSummary = summaries.find((s) => s.month === "2025-06");
      const marchSummary = summaries.find((s) => s.month === "2026-03");

      expect(maySummary).toBeDefined();
      expect(juneSummary).toBeDefined();
      expect(marchSummary).toBeDefined();

      if (profile.appliances.some((a) => a.type === "AC")) {
        expect(maySummary!.totalKg).toBeGreaterThan(marchSummary!.totalKg);
        expect(juneSummary!.totalKg).toBeGreaterThan(marchSummary!.totalKg);
      }
    }
  });

  it("verifies that all underlying activities and emission events exist and are properly scoped", async () => {
    const totalActivities = await db.activity.count();
    const totalEvents = await db.emissionEvent.count();

    expect(totalActivities).toBeGreaterThan(500);
    expect(totalEvents).toBe(totalActivities);

    // Verify Sharma's activities are all scoped to Sharma
    const sharmaActs = await db.activity.findMany({
      where: { householdId: "hh_01_sharma" },
      include: { emissionEvents: true },
    });

    expect(sharmaActs.length).toBeGreaterThan(30);
    for (const act of sharmaActs) {
      expect(act.householdId).toBe("hh_01_sharma");
      expect(act.emissionEvents.length).toBe(1);
      expect(act.emissionEvents[0].householdId).toBe("hh_01_sharma");
    }
  });
});
