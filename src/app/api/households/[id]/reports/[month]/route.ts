import { NextRequest, NextResponse } from "next/server";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { reportService, ReportUnavailable } from "@/server/services/report.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; month: string }> }
) {
  try {
    const { id: householdId, month } = await params;
    await requireMembership(req, householdId, "data:read");

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: "Month must look like 2026-03" }, { status: 400 });
    }
    try {
      return NextResponse.json(await reportService.generateMonthlyReport(householdId, month));
    } catch (err) {
      if (err instanceof ReportUnavailable) return NextResponse.json({ error: err.message }, { status: 404 });
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
