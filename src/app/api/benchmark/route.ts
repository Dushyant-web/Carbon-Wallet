import { NextRequest, NextResponse } from "next/server";
import { benchmarkService, BenchmarkUnavailable } from "@/server/services/benchmark.service";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { resolveReportingPeriod } from "@/server/period";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const householdId = searchParams.get("householdId");
    if (!householdId) return NextResponse.json({ error: "householdId is required" }, { status: 400 });
    await requireMembership(req, householdId, "data:read");
    const state = searchParams.get("state") || undefined;
    const sizeBand = (searchParams.get("sizeBand") as "small" | "medium" | "large") || undefined;
    const homeType = searchParams.get("homeType") || undefined;
    const period = await resolveReportingPeriod(householdId, searchParams.get("month"));

    try {
      const result = await benchmarkService.getCohortBenchmark(householdId, period.month, { state, sizeBand, homeType });
      return NextResponse.json({ ...result, period });
    } catch (err) {
      if (err instanceof BenchmarkUnavailable) return NextResponse.json({ error: err.message, period }, { status: 404 });
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
