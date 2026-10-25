import { NextRequest, NextResponse } from "next/server";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { getInsights } from "@/server/services/insights.service";

/** What caused this home's CO2, month by month (Shapley values), plus appliance and vehicle splits. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");
    return NextResponse.json(await getInsights(householdId, req.nextUrl.searchParams.get("month")));
  } catch (err) {
    return handleAuthError(err);
  }
}
