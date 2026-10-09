import { NextRequest, NextResponse } from "next/server";
import { forecastService } from "@/server/services/forecast.service";
import { requireMembership, handleAuthError } from "@/server/auth/guard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");

    const month = req.nextUrl.searchParams.get("month") || "2026-03";
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
    const month = body.month || "2026-03";

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
