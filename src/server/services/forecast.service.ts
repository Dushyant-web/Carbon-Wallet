import { db } from "@/server/db";

export interface ForecastPoint {
  month: string; // "YYYY-MM"
  label: string; // "Apr 2026"
  basis: "same_month_last_year" | "recent_average"; // where the baseline came from
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

export interface SimulationBreakdown {
  acKg: number;
  evKg: number;
  solarKg: number;
  acKw: number;
  acKwSource: "bills" | "appliance" | "none"; // measured from bills > rated on the appliance > no AC on record
  carMonthlyKm: number;
}

export interface ForecastResult {
  householdId: string;
  month: string; // the reporting month the projection starts after
  currentEmissions: number;
  appliedActionsCount: number;
  totalCommittedSavingsKg: number;
  simulation: SimulationBreakdown | null;
  projection: ForecastPoint[];
}

// CEA CO2 Baseline Database v22.0, FY 2025-26 all-India weighted average.
const GRID_EF = 0.675;
// India GHG Program 2015 road factors (incl. 10% real-world uplift), kg CO2 per vehicle-km.
const CAR_KG_PER_KM: Record<string, number> = { Petrol: 0.14, Diesel: 0.21, CNG: 0.068, Hybrid: 0.1 };
const EV_KWH_PER_KM = 0.15; // assumption: small Indian EV, plug-to-wheel
const SOLAR_KWH_PER_KWP_DAY = 4; // assumption: typical north-India yield

export class ForecastService {
  async getForecast(
    householdId: string,
    currentMonth: string,
    simulation?: SimulationParams
  ): Promise<ForecastResult> {
    const household = await db.household.findUnique({
      where: { id: householdId },
      include: {
        recommendations: {
          where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
        },
        monthlySummaries: {
          where: { totalKg: { gt: 0 } },
          orderBy: { month: "desc" },
          take: 36,
        },
        appliances: true,
        vehicles: true,
      },
    });

    if (!household) {
      throw new Error(`Household ${householdId} not found`);
    }

    const currentSummary = household.monthlySummaries.find((s) => s.month === currentMonth) ?? null;
    const currentKg = currentSummary?.totalKg ?? 0;

    // Committed savings from accepted/completed recommendations
    let committedMonthlySavings = household.recommendations.reduce(
      (sum, r) => sum + r.kgSaved,
      0
    );

    // Optional what-if levers, computed from this household's own assets.
    let simulationBreakdown: SimulationBreakdown | null = null;
    if (simulation) {
      // Prefer the AC draw measured from this home's bills; fall back to the appliance's rated power.
      const calibration = await db.calibration.findFirst({
        where: { householdId, method: { not: "default" } },
        orderBy: { createdAt: "desc" },
      });
      const ac = household.appliances
        .filter((a) => a.type === "AC")
        .sort((a, b) => b.powerKw - a.powerKw)[0];
      const acKwSource: SimulationBreakdown["acKwSource"] = calibration ? "bills" : ac ? "appliance" : "none";
      const acKw = calibration?.acKw ?? ac?.powerKw ?? 0;
      const car = household.vehicles.find((v) => v.fuel !== "Electric" && CAR_KG_PER_KM[v.fuel] !== undefined);
      const carKm = car?.monthlyKm ?? 0;

      const acKg = (simulation.acReductionHours ?? 0) * acKw * 30 * GRID_EF;
      const evKg = simulation.swapCarEv && car
        ? Math.max(0, carKm * (CAR_KG_PER_KM[car.fuel] - EV_KWH_PER_KM * GRID_EF))
        : 0;
      const solarKg = (simulation.solarPanelsKw ?? 0) * SOLAR_KWH_PER_KWP_DAY * 30 * GRID_EF;

      simulationBreakdown = {
        acKg: Number(acKg.toFixed(1)),
        evKg: Number(evKg.toFixed(1)),
        solarKg: Number(solarKg.toFixed(1)),
        acKw: Number(acKw.toFixed(2)),
        acKwSource,
        carMonthlyKm: carKm,
      };
      committedMonthlySavings += acKg + evKg + solarKg;
    }

    committedMonthlySavings = Number(committedMonthlySavings.toFixed(1));

    // Baseline for each coming month from this home's own history: the same month a year earlier
    // (captures its real summer/winter swing), else the average of its last three months with data.
    const byMonth = new Map(household.monthlySummaries.map((m) => [m.month, m.totalKg]));
    const recent = household.monthlySummaries.filter((m) => m.month <= currentMonth).slice(0, 3);
    const recentAvg = recent.length ? recent.reduce((a, m) => a + m.totalKg, 0) / recent.length : 0;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const projection: ForecastPoint[] = [];

    if (currentSummary) {
      const [y0, m0] = currentMonth.split("-").map(Number);
      for (let i = 1; i <= 6; i++) {
        const d = new Date(Date.UTC(y0, m0 - 1 + i, 1));
        const mKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        const lastYearKey = `${d.getUTCFullYear() - 1}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        const lastYear = byMonth.get(lastYearKey);
        const baselineKg = Number((lastYear ?? recentAvg).toFixed(1));
        const withActionsKg = Math.max(0, Number((baselineKg - committedMonthlySavings).toFixed(1)));
        const avoidedKg = Number((baselineKg - withActionsKg).toFixed(1));
        projection.push({
          month: mKey,
          label: `${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
          basis: lastYear !== undefined ? "same_month_last_year" : "recent_average",
          baselineKg,
          withActionsKg,
          avoidedKg,
          avoidedPct: baselineKg > 0 ? Number(((avoidedKg / baselineKg) * 100).toFixed(1)) : 0,
        });
      }
    }

    return {
      householdId: household.id,
      month: currentMonth,
      currentEmissions: currentKg,
      appliedActionsCount: household.recommendations.length,
      totalCommittedSavingsKg: committedMonthlySavings,
      simulation: simulationBreakdown,
      projection,
    };
  }
}

export const forecastService = new ForecastService();
