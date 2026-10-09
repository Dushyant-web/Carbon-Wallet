import { db } from "@/server/db";

export interface ForecastPoint {
  month: string; // "YYYY-MM"
  label: string; // "Apr", "May (Peak)", etc.
  baselineKg: number;
  withActionsKg: number;
  avoidedKg: number;
  avoidedPct: number;
}

export interface SimulationParams {
  acReductionHours?: number;
  swapCarEv?: boolean;
  solarPanelsKw?: number;
}

export interface ForecastResult {
  householdId: string;
  currentEmissions: number;
  appliedActionsCount: number;
  totalCommittedSavingsKg: number;
  projection: ForecastPoint[];
}

export class ForecastService {
  async getForecast(
    householdId: string,
    currentMonth: string = "2026-03",
    simulation?: SimulationParams
  ): Promise<ForecastResult> {
    const household = await db.household.findUnique({
      where: { id: householdId },
      include: {
        recommendations: {
          where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
        },
        monthlySummaries: {
          orderBy: { month: "desc" },
          take: 12,
        },
        appliances: true,
        vehicles: true,
      },
    });

    if (!household) {
      throw new Error(`Household ${householdId} not found`);
    }

    const currentSummary = household.monthlySummaries.find((s) => s.month === currentMonth) ||
      household.monthlySummaries[0];
    const currentKg = currentSummary?.totalKg ?? 250;

    // Committed savings from accepted/completed recommendations
    let committedMonthlySavings = household.recommendations.reduce(
      (sum, r) => sum + r.kgSaved,
      0
    );

    // Add optional simulator interventions
    if (simulation) {
      if (simulation.acReductionHours && simulation.acReductionHours > 0) {
        // hours * 1.5 kW * 30 days * 0.82 kg/kWh
        committedMonthlySavings += simulation.acReductionHours * 1.5 * 30 * 0.82;
      }
      if (simulation.swapCarEv) {
        const hasDiesel = household.vehicles.some((v) => v.fuel === "Diesel");
        committedMonthlySavings += hasDiesel ? 85.0 : 25.0;
      }
      if (simulation.solarPanelsKw && simulation.solarPanelsKw > 0) {
        committedMonthlySavings += simulation.solarPanelsKw * 4 * 30 * 0.82;
      }
    }

    committedMonthlySavings = Number(committedMonthlySavings.toFixed(1));

    // Next 6 months seasonal factors (India northern/central climate)
    // Month 4 (Apr): 1.05x, Month 5 (May peak): 1.35x, Month 6 (Jun peak): 1.32x,
    // Month 7 (Jul): 1.15x, Month 8 (Aug): 1.10x, Month 9 (Sep): 1.02x
    const [currYearStr, currMonthStr] = currentMonth.split("-");
    let year = parseInt(currYearStr, 10);
    let monthNum = parseInt(currMonthStr, 10);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const seasonalWeights: Record<number, number> = {
      1: 0.95,
      2: 0.96,
      3: 1.00,
      4: 1.05,
      5: 1.35, // AC Summer Peak
      6: 1.32, // AC Summer Peak
      7: 1.15,
      8: 1.10,
      9: 1.02,
      10: 0.98,
      11: 0.96,
      12: 0.97,
    };

    const projection: ForecastPoint[] = [];

    for (let i = 1; i <= 6; i++) {
      monthNum++;
      if (monthNum > 12) {
        monthNum = 1;
        year++;
      }

      const mKey = `${year}-${String(monthNum).padStart(2, "0")}`;
      const weight = seasonalWeights[monthNum] || 1.0;
      const monthLabel = monthNames[monthNum - 1] + (monthNum === 5 || monthNum === 6 ? " (Peak)" : "");

      const baselineKg = Number((currentKg * weight).toFixed(1));
      // Action savings are higher during summer months if cooling-related
      const actionWeight = monthNum === 5 || monthNum === 6 ? 1.3 : 1.0;
      const actualSavingsThisMonth = committedMonthlySavings * actionWeight;

      const withActionsKg = Math.max(
        35,
        Number((baselineKg - actualSavingsThisMonth).toFixed(1))
      );
      const avoidedKg = Number((baselineKg - withActionsKg).toFixed(1));
      const avoidedPct = baselineKg > 0 ? Number(((avoidedKg / baselineKg) * 100).toFixed(1)) : 0;

      projection.push({
        month: mKey,
        label: monthLabel,
        baselineKg,
        withActionsKg,
        avoidedKg,
        avoidedPct,
      });
    }

    return {
      householdId: household.id,
      currentEmissions: currentKg,
      appliedActionsCount: household.recommendations.length,
      totalCommittedSavingsKg: committedMonthlySavings,
      projection,
    };
  }
}

export const forecastService = new ForecastService();
