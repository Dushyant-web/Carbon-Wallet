import { NextRequest, NextResponse } from "next/server";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { reportService } from "@/server/services/report.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; month: string }> }
) {
  try {
    const { id: householdId, month } = await params;
    await requireMembership(req, householdId, "data:read");

    const report = await reportService.generateMonthlyReport(householdId, month);
    return NextResponse.json(report);
  } catch (err) {
    return handleAuthError(err);
  }
}
