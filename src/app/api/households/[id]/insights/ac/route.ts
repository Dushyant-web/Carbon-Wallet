import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/server/auth/guard";
import { getAcInsights } from "@/server/services/acInsights.service";
import { billErrorResponse } from "@/server/services/bill.http";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");
    return NextResponse.json(await getAcInsights(householdId));
  } catch (err) {
    return billErrorResponse(err);
  }
}
