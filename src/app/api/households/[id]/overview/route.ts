import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");

    const searchParams = req.nextUrl.searchParams;
    const targetMonth = searchParams.get("month") || "2026-03";

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
          where: { month: { lte: targetMonth } },
          orderBy: { month: "desc" },
          take: 6,
        },
      },
    });

    if (!household) {
      return NextResponse.json({ error: "Household not found" }, { status: 404 });
    }

    // Current target month and prior month
    const currentSummary = household.monthlySummaries.find((s) => s.month === targetMonth) ||
      household.monthlySummaries[0];
    const priorMonthKey = (() => {
      const [y, m] = targetMonth.split("-").map(Number);
      const prevD = new Date(Date.UTC(y, m - 2, 1));
      return `${prevD.getUTCFullYear()}-${String(prevD.getUTCMonth() + 1).padStart(2, "0")}`;
    })();
    const priorSummary = household.monthlySummaries.find((s) => s.month === priorMonthKey) ||
      household.monthlySummaries[1];

    const currentEmissions = currentSummary?.totalKg ?? 0;
    const priorEmissions = priorSummary?.totalKg ?? 0;
    const trendPct = priorEmissions > 0
      ? Number((((currentEmissions - priorEmissions) / priorEmissions) * 100).toFixed(1))
      : 0;

    // Category breakdown
    let breakdown: Record<string, number> = {};
    if (currentSummary?.byCategory) {
      try {
        breakdown = JSON.parse(currentSummary.byCategory);
      } catch {
        breakdown = {};
      }
    }

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

    // 6-Month trajectory (chronological)
    const historyMonths = [...household.monthlySummaries].reverse().map((s) => {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const [, mStr] = s.month.split("-");
      const mIdx = parseInt(mStr, 10) - 1;
      return {
        month: s.month,
        label: monthNames[mIdx] || s.month,
        totalKg: s.totalKg,
      };
    });

    // Score details
    const score = Math.round(currentSummary?.score ?? 70);
    let scoreBand = "Average";
    if (score >= 90) scoreBand = "Excellent (Net Zero Leader)";
    else if (score >= 75) scoreBand = "Good Standing";
    else if (score < 40) scoreBand = "Critical";
    else if (score < 60) scoreBand = "Poor";

    // Next best action
    const nba = household.recommendations[0] || {
      action: "Maintain Smart Baseline Monitoring",
      description: "Continue automated metering to maintain optimal energy efficiency.",
      kgSaved: 15.0,
      inrSaved: 500,
      difficulty: "EASY",
    };

    // Solar PV presence
    const solarAppliance = household.appliances.find((a) => a.type === "SolarPV");
    const solarKwh = solarAppliance ? Math.round(solarAppliance.powerKw * solarAppliance.avgHoursPerDay * 30) : 0;

    return NextResponse.json({
      household: {
        id: household.id,
        name: household.name,
        city: household.city,
        state: household.state,
        country: household.country,
        size: household.size,
        floorAreaM2: household.floorAreaM2,
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
        peerPercentile: Math.min(98, Math.max(15, Math.round(100 - (currentEmissions / 450) * 100))),
        actionableSavingsKg: nba.kgSaved,
        actionableSavingsInr: nba.inrSaved,
      },
      trendHistory: historyMonths,
      categoryBreakdown: breakdown,
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
      })),
      vehicles: household.vehicles.map((v) => ({
        id: v.id,
        name: v.name || v.type,
        type: v.type,
        fuel: v.fuel,
        monthlyKm: v.monthlyKm,
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
