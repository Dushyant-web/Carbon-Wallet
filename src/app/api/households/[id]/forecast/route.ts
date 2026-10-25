import { NextRequest, NextResponse } from "next/server";
import { forecastService } from "@/server/services/forecast.service";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { resolveReportingPeriod } from "@/server/period";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");

    const { month } = await resolveReportingPeriod(householdId, req.nextUrl.searchParams.get("month"));
    const result = await forecastService.getForecast(householdId, month);

    return NextResponse.json(result);
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "forecast:simulate");

    const body = await req.json();
    const { month } = await resolveReportingPeriod(householdId, typeof body.month === "string" ? body.month : null);

    const result = await forecastService.getForecast(householdId, month, {
      acReductionHours: body.acReductionHours,
      swapCarEv: body.swapCarEv,
      solarPanelsKw: body.solarPanelsKw,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleAuthError(err);
  }
}
