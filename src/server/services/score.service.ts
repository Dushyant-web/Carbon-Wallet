import { db } from "@/server/db";

// National urban household reference per capita per month in India ~65-75 kg CO2e/person/month
const NATIONAL_REFERENCE_PER_PERSON_KG = 70.0;

export interface ScoreBreakdown {
  score: number;
  ratingBand: "Critical" | "Poor" | "Average" | "Good" | "Excellent";
  components: {
    perPersonVsReference: number; // weight 35%
    trend: number; // weight 20%
    energyEfficiency: number; // weight 15%
    transportEfficiency: number; // weight 10%
    renewableShare: number; // weight 10%
    completedActions: number; // weight 10%
  };
}

export class ScoreService {
  /**
   * Calculates the CarbonOS Index (prototype metric) using the weighted formula from PLAN.md:
   * 35% per-person emissions vs. national reference
   * 20% trend (last 3 months)
   * 15% energy efficiency (appliance ratings)
   * 10% transport efficiency
   * 10% renewable share
   * 10% completed actions
   */
  /**
   * `totalKg` is the month's fresh total when called while the summary is being rebuilt; without it the
   * stored summary is used. There is no made-up default: a month with no emissions data has no score.
   */
  async calculateScore(householdId: string, month: string, totalKg?: number): Promise<ScoreBreakdown> {
    const household = await db.household.findUnique({
      where: { id: householdId },
      include: {
        appliances: true,
        vehicles: true,
        recommendations: true,
        challenges: true,
      },
    });

    if (!household) {
      throw new Error(`Household ${householdId} not found`);
    }

    // 1. Current Month Total Emissions
    const currentSummary = await db.monthlySummary.findUnique({
      where: {
        householdId_month: {
          householdId,
          month,
        },
      },
    });

    const currentTotalKg = totalKg ?? currentSummary?.totalKg;
    if (currentTotalKg === undefined) {
      throw new Error(`No emissions recorded for ${month}, so there is no score yet`);
    }
    const householdSize = Math.max(1, household.size);
    const perPersonKg = currentTotalKg / householdSize;

    // Component 1: 35% Per-person emissions vs national reference
    // If perPersonKg is half national reference -> 100
    // If perPersonKg equals national reference -> 70
    // If perPersonKg is double -> 30
    let c1 = 100 - (perPersonKg / NATIONAL_REFERENCE_PER_PERSON_KG) * 40;
    c1 = Math.max(0, Math.min(100, c1));

    // Component 2: 20% Trend (last 3 months)
    // Check if emissions are falling or rising
    // Compare with the most recent earlier month that has data (never with a stale copy of this month)
    const previous = await db.monthlySummary.findFirst({
      where: { householdId, month: { lt: month }, totalKg: { gt: 0 } },
      orderBy: { month: "desc" },
    });

    let c2 = 70; // neutral when there is no earlier month to compare with
    if (previous) {
      const latest = currentTotalKg;
      const prior = previous.totalKg;
      if (prior > 0) {
        const changePct = ((latest - prior) / prior) * 100;
        // Falling emissions (negative changePct) increases score
        // -10% change -> +15 points from baseline 70 = 85
        c2 = 70 - changePct * 1.5;
        c2 = Math.max(0, Math.min(100, c2));
      }
    }

    // Component 3: 15% Energy efficiency (appliance ratings)
    let c3 = 65;
    if (household.appliances.length > 0) {
      let ratingSum = 0;
      for (const app of household.appliances) {
        if (app.rating.includes("5_STAR") || app.rating.includes("INVERTER")) ratingSum += 95;
        else if (app.rating.includes("4_STAR")) ratingSum += 80;
        else if (app.rating.includes("3_STAR")) ratingSum += 65;
        else ratingSum += 45;
      }
      c3 = ratingSum / household.appliances.length;
    }

    // Component 4: 10% Transport efficiency
    let c4 = 65;
    if (household.vehicles.length > 0) {
      let vehSum = 0;
      for (const v of household.vehicles) {
        if (v.fuel === "Electric") vehSum += 95;
        else if (v.fuel === "Hybrid" || v.fuel === "CNG") vehSum += 80;
        else if (v.type === "PublicTransit") vehSum += 90;
        else if (v.fuel === "Petrol") vehSum += 60;
        else if (v.fuel === "Diesel") vehSum += 45;
        else vehSum += 60;
      }
      c4 = vehSum / household.vehicles.length;
    }

    // Component 5: 10% Renewable share (e.g. rooftop solar)
    const hasSolar = household.appliances.some(
      (a) => a.type === "SolarPV" || a.name?.toLowerCase().includes("solar")
    );
    const c5 = hasSolar ? 95 : 40;

    // Component 6: 10% Completed actions
    const completed = household.recommendations.filter(
      (r) => r.status === "COMPLETED" || r.status === "ACCEPTED"
    ).length;
    const c6 = Math.min(100, 40 + completed * 20);

    // Weighted Formula
    const totalScore = Math.round(
      c1 * 0.35 +
      c2 * 0.20 +
      c3 * 0.15 +
      c4 * 0.10 +
      c5 * 0.10 +
      c6 * 0.10
    );

    const boundedScore = Math.max(0, Math.min(100, totalScore));

    // Bands: 0–39 Critical, 40–59 Poor, 60–74 Average, 75–89 Good, 90–100 Excellent.
    let ratingBand: "Critical" | "Poor" | "Average" | "Good" | "Excellent" = "Average";
    if (boundedScore < 40) ratingBand = "Critical";
    else if (boundedScore < 60) ratingBand = "Poor";
    else if (boundedScore < 75) ratingBand = "Average";
    else if (boundedScore < 90) ratingBand = "Good";
    else ratingBand = "Excellent";

    return {
      score: boundedScore,
      ratingBand,
      components: {
        perPersonVsReference: Math.round(c1),
        trend: Math.round(c2),
        energyEfficiency: Math.round(c3),
        transportEfficiency: Math.round(c4),
        renewableShare: Math.round(c5),
        completedActions: Math.round(c6),
      },
    };
  }
}

export const scoreService = new ScoreService();
