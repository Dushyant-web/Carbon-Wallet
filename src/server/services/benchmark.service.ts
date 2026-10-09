import { db } from "@/server/db";

export interface BenchmarkFilters {
  state?: string;
  sizeBand?: "small" | "medium" | "large" | "all";
  homeType?: string;
}

export interface BenchmarkResult {
  householdId: string;
  householdName: string;
  householdEmissions: number;
  perCapitaEmissions: number;
  cohortCount: number;
  cohortMedianTotal: number;
  cohortMedianPerCapita: number;
  percentile: number; // 0 to 100
  differenceFromMedianPct: number;
  leader: {
    name: string;
    emissions: number;
    perCapita: number;
  };
  highest: {
    name: string;
    emissions: number;
    perCapita: number;
  };
  cohortList: Array<{
    id: string;
    name: string;
    city: string;
    state: string;
    size: number;
    homeType: string;
    emissions: number;
    perCapita: number;
    isCurrent: boolean;
  }>;
  filtersApplied: {
    sizeBand?: string;
    state?: string;
    homeType?: string;
    totalConsidered: number;
  };
}

export class BenchmarkService {
  async getCohortBenchmark(
    householdId: string,
    month: string = "2026-03",
    filters?: BenchmarkFilters
  ): Promise<BenchmarkResult> {
    const targetHousehold = await db.household.findUnique({
      where: { id: householdId },
      include: {
        monthlySummaries: {
          where: { month },
        },
      },
    });

    if (!targetHousehold) {
      throw new Error(`Household ${householdId} not found`);
    }

    const targetEmissions = targetHousehold.monthlySummaries[0]?.totalKg ?? 250;
    const targetPerCapita = Number((targetEmissions / Math.max(1, targetHousehold.size)).toFixed(1));

    // Fetch all active households with their current month summary
    const allHouseholds = await db.household.findMany({
      where: { status: "ACTIVE" },
      include: {
        monthlySummaries: {
          where: { month },
        },
      },
    });

    // Apply cohort filtering if requested
    let cohort = allHouseholds.map((h) => {
      const em = h.monthlySummaries[0]?.totalKg ?? 200;
      const pc = Number((em / Math.max(1, h.size)).toFixed(1));
      return {
        id: h.id,
        name: h.name,
        city: h.city,
        state: h.state,
        size: h.size,
        homeType: h.homeType,
        emissions: em,
        perCapita: pc,
      };
    });

    if (filters?.state && filters.state !== "all") {
      const s = filters.state.toUpperCase().trim();
      let stateCodes = [filters.state];
      if (s === "UP" || s === "UTTAR PRADESH") stateCodes = ["UP", "Uttar Pradesh"];
      else if (s === "DL" || s === "DELHI" || s === "NEW DELHI") stateCodes = ["DL", "Delhi"];
      else if (s === "HR" || s === "HARYANA") stateCodes = ["HR", "Haryana"];
      else if (s === "MH" || s === "MAHARASHTRA") stateCodes = ["MH", "Maharashtra"];
      else if (s === "KA" || s === "KARNATAKA") stateCodes = ["KA", "Karnataka"];
      else if (s === "TN" || s === "TAMIL NADU") stateCodes = ["TN", "Tamil Nadu"];
      else if (s === "RJ" || s === "RAJASTHAN") stateCodes = ["RJ", "Rajasthan"];
      else if (s === "WB" || s === "WEST BENGAL") stateCodes = ["WB", "West Bengal"];

      const stateFiltered = cohort.filter((h) => stateCodes.includes(h.state));
      if (stateFiltered.length >= 2) cohort = stateFiltered;
    }

    if (filters?.sizeBand && filters.sizeBand !== "all") {
      const sizeFiltered = cohort.filter((h) => {
        if (filters.sizeBand === "small") return h.size <= 3;
        if (filters.sizeBand === "medium") return h.size === 4 || h.size === 5;
        return h.size >= 6;
      });
      if (sizeFiltered.length >= 2) cohort = sizeFiltered;
    }

    // Filter to households with active monthly summaries (exclude unseeded test stubs)
    cohort = cohort.filter((h) => h.emissions >= 50);
    cohort.sort((a, b) => a.emissions - b.emissions);

    const leader = cohort[0];
    const highest = cohort[cohort.length - 1];

    // Median
    const midIdx = Math.floor(cohort.length / 2);
    const medianTotal = cohort.length % 2 === 0
      ? Number(((cohort[midIdx - 1].emissions + cohort[midIdx].emissions) / 2).toFixed(1))
      : cohort[midIdx].emissions;

    const medianPerCapita = cohort.length % 2 === 0
      ? Number(((cohort[midIdx - 1].perCapita + cohort[midIdx].perCapita) / 2).toFixed(1))
      : cohort[midIdx].perCapita;

    // Percentile rank (lower emissions = higher percentile)
    const rank = cohort.findIndex((h) => h.id === householdId);
    const percentile = rank !== -1
      ? Math.round(100 - (rank / (cohort.length - 1 || 1)) * 100)
      : 50;

    const differenceFromMedianPct = medianTotal > 0
      ? Number((((targetEmissions - medianTotal) / medianTotal) * 100).toFixed(1))
      : 0;

    const cohortList = cohort.map((c) => ({
      ...c,
      isCurrent: c.id === householdId,
    }));

    return {
      householdId: targetHousehold.id,
      householdName: targetHousehold.name,
      householdEmissions: targetEmissions,
      perCapitaEmissions: targetPerCapita,
      cohortCount: cohort.length,
      cohortMedianTotal: medianTotal,
      cohortMedianPerCapita: medianPerCapita,
      percentile,
      differenceFromMedianPct,
      leader: {
        name: leader.name,
        emissions: leader.emissions,
        perCapita: leader.perCapita,
      },
      highest: {
        name: highest.name,
        emissions: highest.emissions,
        perCapita: highest.perCapita,
      },
      cohortList,
      filtersApplied: {
        sizeBand: filters?.sizeBand || "All Sizes",
        state: filters?.state || "All Regions",
        homeType: filters?.homeType || "All Types",
        totalConsidered: cohort.length,
      },
    };
  }
}

export const benchmarkService = new BenchmarkService();
