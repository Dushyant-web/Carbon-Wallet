import { gasesFromCategories } from "@/lib/ghg";
import { NextRequest, NextResponse } from "next/server";
import { COUNTED_ACTIVITY } from "@/server/counted";
import { db } from "@/server/db";
import { hasPermission } from "@/server/auth/permissions";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { registeredBy } from "@/server/services/merchant.service";
import { monthCoverage, resolveReportingPeriod, shiftMonth } from "@/server/period";
import { benchmarkService, BenchmarkUnavailable } from "@/server/services/benchmark.service";
import { personAllowance } from "@/server/services/allowance.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    const auth = await requireMembership(req, householdId, "data:read");

    const period = await resolveReportingPeriod(householdId, req.nextUrl.searchParams.get("month"));
    const targetMonth = period.month;

    const household = await db.household.findUnique({
      where: { id: householdId },
      include: {
        memberships: {
          include: { user: true },
        },
        appliances: true,
        vehicles: true,
        recommendations: {
          where: { status: "PENDING" },
          orderBy: { kgSaved: "desc" },
        },
        monthlySummaries: {
          where: { month: { lte: period.newerPartial?.month ?? targetMonth } },
          orderBy: { month: "desc" },
          take: 8,
        },
      },
    });

    if (!household) {
      return NextResponse.json({ error: "Household not found" }, { status: 404 });
    }

    // The reporting month and the calendar month before it: never a different month standing in
    const currentSummary = household.monthlySummaries.find((s) => s.month === targetMonth) ?? null;
    const priorMonthKey = shiftMonth(targetMonth, -1);
    const priorSummary = household.monthlySummaries.find((s) => s.month === priorMonthKey) ?? null;

    // Everything else needs only the household and the month, so it is read in one go: on hosting where the
    // database is far away each sequential query costs a round trip
    const [coverage, benchmark, events, billCount, committedCount, challengeCount, shops, average] = await Promise.all([
      monthCoverage(householdId),
      // peers: every home with recorded data for the same month
      currentSummary
        ? benchmarkService.getCohortBenchmark(householdId, targetMonth).catch((err) => {
            if (err instanceof BenchmarkUnavailable) return null;
            throw err;
          })
        : null,
      // where this month's number comes from
      db.emissionEvent.findMany({
        where: {
          householdId,
          occurredOn: {
            gte: new Date(`${targetMonth}-01T00:00:00.000Z`),
            lt: new Date(`${shiftMonth(targetMonth, 1)}-01T00:00:00.000Z`),
          },
          activity: COUNTED_ACTIVITY,
        },
        select: { kgCo2e: true, factor: { select: { source: true } }, activity: { select: { source: true, billId: true } } },
      }),
      // first-run checklist, ticked from real data
      db.bill.count({ where: { householdId } }),
      db.recommendation.count({ where: { householdId, status: { in: ["ACCEPTED", "COMPLETED"] } } }),
      db.challenge.count({ where: { householdId } }),
      registeredBy(householdId), // items a shop registered at the counter
      // the yardstick for the colour: 100 kg per person a month
      personAllowance(),
    ]);
    const currentEmissions = currentSummary?.totalKg ?? 0;
    const priorPartial = coverage.get(priorMonthKey)?.partial ?? false;
    // Only compare two months that are both complete; a partly billed month would make any % meaningless
    const comparable = !!currentSummary && !!priorSummary && !priorPartial && !period.isPartial;
    const priorEmissions = comparable ? priorSummary!.totalKg : null;
    const trendPct = comparable && priorEmissions
      ? Number((((currentEmissions - priorEmissions) / priorEmissions) * 100).toFixed(1))
      : null;

    // Category breakdown
    let breakdown: Record<string, number> = {};
    if (currentSummary?.byCategory) {
      try {
        breakdown = JSON.parse(currentSummary.byCategory);
      } catch {
        breakdown = {};
      }
    }

    // Gas breakdown (kg CO₂e per gas), worked out from the categories for months stored before it existed
    let gasBreakdown: Record<string, number> = {};
    try {
      gasBreakdown = JSON.parse(currentSummary?.byGas || "{}");
    } catch {
      gasBreakdown = {};
    }
    if (!Object.keys(gasBreakdown).length && Object.keys(breakdown).length) gasBreakdown = gasesFromCategories(breakdown);

    // Top contributor
    let topCat = "Electricity";
    let topKg = 0;
    for (const [cat, val] of Object.entries(breakdown)) {
      if (val > topKg) {
        topKg = val;
        topCat = cat;
      }
    }
    const topSharePct = currentEmissions > 0
      ? Number(((topKg / currentEmissions) * 100).toFixed(1))
      : 0;

    // Six calendar months ending at the newest month with data; gaps stay visible as null
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    // End at the newer part-billed month only when it follows straight on; otherwise six empty months would hide the data
    const lastMonth = period.newerPartial && shiftMonth(targetMonth, 1) === period.newerPartial.month ? period.newerPartial.month : targetMonth;
    const byMonth = new Map(household.monthlySummaries.map((s) => [s.month, s.totalKg]));
    const historyMonths = Array.from({ length: 6 }, (_, i) => shiftMonth(lastMonth, i - 5)).map((month) => {
      const cov = coverage.get(month);
      const kg = byMonth.get(month);
      return {
        month,
        label: monthNames[parseInt(month.slice(5), 10) - 1],
        totalKg: kg && kg > 0 ? kg : null,
        partial: cov?.partial ?? false,
        billedDays: cov?.billedDays ?? null,
        daysInMonth: cov?.daysInMonth ?? null,
        isReporting: month === targetMonth,
      };
    });

    // Score: only when the month has data
    const score = currentSummary ? Math.round(currentSummary.score) : null;
    let scoreBand: string | null = null;
    if (score !== null) {
      scoreBand = "Average";
      if (score >= 90) scoreBand = "Excellent";
      else if (score >= 75) scoreBand = "Good";
      else if (score < 40) scoreBand = "Critical";
      else if (score < 60) scoreBand = "Poor";
    }

    // Next best action: the top pending recommendation, or nothing
    const nba = household.recommendations[0] ?? null;

    const peer =
      benchmark && benchmark.cohortCount >= 3
        ? {
            percentile: benchmark.percentile,
            cohortCount: benchmark.cohortCount,
            medianKg: benchmark.cohortMedianTotal,
            differenceFromMedianPct: benchmark.differenceFromMedianPct,
          }
        : null;

    const billEvents = events.filter((e) => e.activity.billId);
    const billKg = billEvents.reduce((a, e) => a + e.kgCo2e, 0);
    const provenance = {
      nBills: new Set(billEvents.map((e) => e.activity.billId)).size,
      nLogs: events.length - billEvents.length,
      billKg: Number(billKg.toFixed(1)),
      loggedKg: Number((events.reduce((a, e) => a + e.kgCo2e, 0) - billKg).toFixed(1)),
      billSharePct: currentEmissions > 0 ? Math.round((billKg / currentEmissions) * 100) : 0,
      factorSources: [...new Set(events.map((e) => e.factor.source.split(" - ")[0]))].slice(0, 4),
    };

    // Solar PV presence
    const solarAppliance = household.appliances.find((a) => a.type === "SolarPV");
    const solarKwh = solarAppliance ? Math.round(solarAppliance.powerKw * solarAppliance.avgHoursPerDay * 30) : 0;

    const setup = {
      bills: billCount,
      assets: household.appliances.length + household.vehicles.length,
      committed: committedCount,
      challenges: challengeCount,
    };

    return NextResponse.json({
      allowance: { ...average, allowanceKg: Math.round(average.perPersonKg * Math.max(1, household.size)) },
      access: { role: auth.role, viewOnly: !hasPermission(auth.role, "activity:create"), canAddBills: hasPermission(auth.role, "bill:create") },
      period,
      provenance,
      setup,
      household: {
        id: household.id,
        name: household.name,
        city: household.city,
        state: household.state,
        country: household.country,
        size: household.size,
        floorAreaM2: household.floorAreaM2,
        monthlyBudgetInr: household.monthlyBudgetInr,
        joinCode: household.joinCode,
        status: household.status,
      },
      kpi: {
        totalEmissions: currentEmissions,
        priorEmissions,
        trendPct,
        score,
        scoreBand,
        topContributor: {
          category: topCat,
          amountKg: topKg,
          sharePct: topSharePct,
        },
        peer,
        actionableSavingsKg: nba?.kgSaved ?? null,
        actionableSavingsInr: nba?.inrSaved ?? null,
      },
      trendHistory: historyMonths,
      categoryBreakdown: breakdown,
      gasBreakdown,
      nextBestAction: nba,
      members: household.memberships.map((m) => ({
        id: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      appliances: household.appliances.map((a) => ({
        id: a.id,
        name: a.name || a.type,
        type: a.type,
        rating: a.rating,
        powerKw: a.powerKw,
        avgHoursPerDay: a.avgHoursPerDay,
        source: a.source,
        brand: a.brand,
        model: a.model,
        capacityTon: a.capacityTon,
        labelYear: a.labelYear,
        registeredBy: shops.get(a.id) ?? null,
      })),
      vehicles: household.vehicles.map((v) => ({
        id: v.id,
        name: v.name || v.type,
        type: v.type,
        fuel: v.fuel,
        monthlyKm: v.monthlyKm,
        kmPerUnit: v.kmPerUnit,
        year: v.year,
        source: v.source,
        registrationNo: v.registrationNo,
        registeredBy: shops.get(v.id) ?? null,
      })),
      solar: {
        hasSolar: !!solarAppliance,
        solarKwh,
      },
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
