import { db } from "@/server/db";
import { COUNTED_ACTIVITY } from "@/server/counted";
import { stateToRegion, OFFICIAL_EMISSION_FACTORS } from "@/server/factors/registry";
import { benchmarkService } from "@/server/services/benchmark.service";

export class ReportUnavailable extends Error {}

// Readable names for activity types in "top contributors"
const TYPE_NAMES: Record<string, string> = {
  grid_electricity: "Grid electricity",
  ac_cooling: "Air conditioning",
  petrol_car: "Petrol car",
  diesel_car: "Diesel car",
  cng_car: "CNG car",
  two_wheeler: "Two-wheeler",
  flight_economy: "Flights",
  lpg_cooking: "LPG cooking",
};
const typeName = (t: string) => TYPE_NAMES[t] ?? t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
// Public transport and hired rides are someone else's fuel: scope 3 for a household
const SCOPE3_TRANSPORT = /metro|bus|train|rail|taxi|cab|auto|rickshaw|uber|ola/i;
const ELECTRIC_TRANSPORT = /(^|_)ev(_|$)|electric/i;

export interface MonthlyReportPayload {
  reportId: string;
  generatedAt: string;
  month: string;
  monthLabel: string;
  household: {
    id: string;
    name: string;
    city: string;
    state: string;
    country: string;
    size: number;
    homeType: string;
    floorAreaM2: number;
    joinCode: string;
    region: string;
    gridFactorKgKwh: number;
  };
  summary: {
    grossEmissionsKg: number;
    solarOffsetKg: number;
    netEmissionsKg: number;
    perCapitaKg: number;
    carbonDensityKgM2: number;
    carbonScore: number | null;
    priorMonthKg: number | null;
    momChangeKg: number | null;
    momTrendPct: string | null;
    cohortPercentile: number | null;
    cohortCount: number | null;
  };
  provenance: { nBills: number; nLogs: number; billKg: number; billSharePct: number };
  scopes: {
    scope1: {
      title: string;
      description: string;
      totalKg: number;
      percentage: number;
      sources: string[];
    };
    scope2: {
      title: string;
      description: string;
      totalKg: number;
      percentage: number;
      gridFactorUsed: number;
      sources: string[];
    };
    scope3: {
      title: string;
      description: string;
      totalKg: number;
      percentage: number;
      sources: string[];
    };
  };
  categories: Array<{
    category: string;
    kgCo2e: number;
    percentage: number;
    eventCount: number;
  }>;
  topContributors: Array<{
    name: string;
    category: string;
    kgCo2e: number;
    percentage: number;
  }>;
  assets: {
    appliances: Array<{
      name: string;
      type: string;
      rating: string;
      powerKw: number;
    }>;
    vehicles: Array<{
      name: string;
      type: string;
      fuel: string;
      monthlyKm: number;
    }>;
  };
  recommendations: Array<{
    action: string;
    category: string;
    kgSaved: number;
    inrSaved: number;
    status: string;
    commitMonth: string | null;
    realizedKg: number | null;
    verification: string | null; // BILL, FUEL (measured) or DECLARED (half credit, no data yet)
  }>;
  compliance: {
    protocol: string;
    ceaVersion: string;
    regionalFactor: string;
    dataQualityLevel: string;
    verificationStatus: string;
  };
}

export class ReportService {
  async generateMonthlyReport(
    householdId: string,
    month: string
  ): Promise<MonthlyReportPayload> {
    const household = await db.household.findUnique({
      where: { id: householdId },
      include: {
        appliances: true,
        vehicles: true,
        recommendations: true,
        monthlySummaries: {
          orderBy: { month: "desc" },
        },
      },
    });

    if (!household) {
      throw new Error(`Household ${householdId} not found`);
    }

    const currentSummary = household.monthlySummaries.find((s) => s.month === month) ?? null;
    if (!currentSummary || currentSummary.totalKg <= 0) {
      throw new ReportUnavailable(`No emissions recorded for ${month}.`);
    }

    const [yStr, mStr] = month.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const prevMonthStr = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const priorSummary = household.monthlySummaries.find((s) => s.month === prevMonthStr) ?? null;

    const grossEmissionsKg = currentSummary.totalKg;
    const priorMonthKg = priorSummary?.totalKg ?? null;
    const momChangeKg = priorMonthKg !== null ? Number((grossEmissionsKg - priorMonthKg).toFixed(1)) : null;
    const momTrendPct =
      priorMonthKg ? `${(((grossEmissionsKg - priorMonthKg) / priorMonthKg) * 100).toFixed(1)}%` : null;

    const region = stateToRegion(household.state);
    const gridFactorObj = OFFICIAL_EMISSION_FACTORS.find(
      (f) => f.category === "Electricity" && f.type === "grid_electricity" && f.region === region
    ) || OFFICIAL_EMISSION_FACTORS.find(
      (f) => f.category === "Electricity" && f.type === "grid_electricity" && f.region === "IN-NATIONAL"
    );
    const gridFactorKgKwh = gridFactorObj?.kgCo2ePerUnit || 0.675;

    // Every number below comes from this month's recorded emission events (bill-covered logs excluded)
    const events = await db.emissionEvent.findMany({
      where: {
        householdId,
        occurredOn: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) },
        activity: COUNTED_ACTIVITY,
      },
      include: { activity: { include: { bill: true } } },
    });

    // Solar: net-metered bills already subtract exported units, so there is no separate offset to take off
    const solarOffsetKg = 0;
    const netEmissionsKg = grossEmissionsKg;

    const byCat = new Map<string, { kg: number; n: number }>();
    const byType = new Map<string, { category: string; kg: number; name: string }>();
    let scope1Kg = 0;
    let scope2Kg = 0;
    let scope3Kg = 0;
    const scope1Src = new Set<string>();
    const scope2Src = new Set<string>();
    const scope3Src = new Set<string>();
    for (const ev of events) {
      const a = ev.activity;
      const c = byCat.get(a.category) ?? { kg: 0, n: 0 };
      c.kg += ev.kgCo2e;
      c.n += 1;
      byCat.set(a.category, c);
      const key = a.billId ? `bill:${a.billId}` : a.type;
      const name = a.bill ? `Electricity bill${a.bill.discom ? ` (${a.bill.discom})` : ""}` : typeName(a.type);
      const t = byType.get(key) ?? { category: a.category, kg: 0, name };
      t.kg += ev.kgCo2e;
      byType.set(key, t);

      if (a.category === "Electricity" || (a.category === "Transport" && ELECTRIC_TRANSPORT.test(a.type))) {
        scope2Kg += ev.kgCo2e;
        scope2Src.add(name);
      } else if (a.category === "Transport" && !SCOPE3_TRANSPORT.test(a.type)) {
        scope1Kg += ev.kgCo2e;
        scope1Src.add(name);
      } else {
        scope3Kg += ev.kgCo2e;
        scope3Src.add(name);
      }
    }
    const scopeTotal = Math.max(1e-9, scope1Kg + scope2Kg + scope3Kg);

    const categoryEntries = [...byCat.entries()]
      .map(([category, v]) => ({
        category,
        kgCo2e: Number(v.kg.toFixed(1)),
        percentage: Math.round((v.kg / grossEmissionsKg) * 100),
        eventCount: v.n,
      }))
      .sort((a, b) => b.kgCo2e - a.kgCo2e);

    const topContributors = [...byType.values()]
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 3)
      .map((t) => ({
        name: t.name,
        category: t.category,
        kgCo2e: Number(t.kg.toFixed(1)),
        percentage: Math.round((t.kg / grossEmissionsKg) * 100),
      }));

    const billEvents = events.filter((e) => e.activity.billId);
    const billKg = billEvents.reduce((a, e) => a + e.kgCo2e, 0);
    const provenance = {
      nBills: new Set(billEvents.map((e) => e.activity.billId)).size,
      nLogs: events.length - billEvents.length,
      billKg: Number(billKg.toFixed(1)),
      billSharePct: Math.round((billKg / grossEmissionsKg) * 100),
    };

    let cohortPercentile: number | null = null;
    let cohortCount: number | null = null;
    try {
      const b = await benchmarkService.getCohortBenchmark(householdId, month);
      if (b.cohortCount >= 3) {
        cohortPercentile = b.percentile;
        cohortCount = b.cohortCount;
      }
    } catch {
      // no cohort for this month
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthLabel = `${monthNames[m - 1]} ${y}`;



    return {
      reportId: `REP-${household.id.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${month.replace("-", "")}`,
      generatedAt: new Date().toISOString(),
      month,
      monthLabel,
      household: {
        id: household.id,
        name: household.name,
        city: household.city,
        state: household.state,
        country: household.country,
        size: household.size,
        homeType: household.homeType,
        floorAreaM2: household.floorAreaM2,
        joinCode: household.joinCode,
        region,
        gridFactorKgKwh,
      },
      summary: {
        grossEmissionsKg,
        solarOffsetKg,
        netEmissionsKg,
        perCapitaKg: Number((netEmissionsKg / Math.max(1, household.size)).toFixed(1)),
        carbonDensityKgM2: Number((netEmissionsKg / Math.max(1, household.floorAreaM2)).toFixed(2)),
        carbonScore: Math.round(currentSummary.score),
        priorMonthKg,
        momChangeKg,
        momTrendPct,
        cohortPercentile,
        cohortCount,
      },
      provenance,
      scopes: {
        scope1: {
          title: "Scope 1 (Direct Emissions)",
          description: "Combustion transport, on-site fuel consumption",
          totalKg: Number(scope1Kg.toFixed(1)),
          percentage: Math.round((scope1Kg / scopeTotal) * 100),
          sources: [...scope1Src],
        },
        scope2: {
          title: "Scope 2 (Indirect Grid Electricity)",
          description: "Purchased electricity from state transmission grid",
          totalKg: Number(scope2Kg.toFixed(1)),
          percentage: Math.round((scope2Kg / scopeTotal) * 100),
          gridFactorUsed: gridFactorKgKwh,
          sources: [...scope2Src],
        },
        scope3: {
          title: "Scope 3 (Value Chain / Other)",
          description: "Commercial aviation, municipal waste, food supply chain",
          totalKg: Number(scope3Kg.toFixed(1)),
          percentage: Math.round((scope3Kg / scopeTotal) * 100),
          sources: [...scope3Src],
        },
      },
      categories: categoryEntries,
      topContributors,
      assets: {
        appliances: household.appliances.map((a) => ({
          name: a.name || a.type,
          type: a.type,
          rating: a.rating,
          powerKw: a.powerKw,
        })),
        vehicles: household.vehicles.map((v) => ({
          name: v.name || v.type,
          type: v.type,
          fuel: v.fuel,
          monthlyKm: v.monthlyKm,
        })),
      },
      recommendations: household.recommendations.map((r) => ({
        action: r.action,
        category: r.category || "General",
        kgSaved: r.kgSaved,
        inrSaved: r.inrSaved,
        status: r.status,
        commitMonth: r.commitMonth,
        realizedKg: r.realizedKg,
        verification: r.verification,
      })),
      compliance: {
        protocol: "GHG Protocol Corporate / Residential Scope 1, 2, 3 Accounting Standard",
        ceaVersion: "Central Electricity Authority (CEA) CO2 Baseline Database v22.0 (FY 2025-26)",
        regionalFactor: `${region} Grid: ${gridFactorKgKwh} kg CO₂e / kWh`,
        dataQualityLevel:
          provenance.nBills > 0
            ? `${provenance.billSharePct}% from ${provenance.nBills} electricity bill${provenance.nBills > 1 ? "s" : ""}, the rest self-reported`
            : "Self-reported activity logs",
        verificationStatus: provenance.nBills > 0 ? "BILL_BACKED" : "SELF_REPORTED",
      },
    };
  }
}

export const reportService = new ReportService();
