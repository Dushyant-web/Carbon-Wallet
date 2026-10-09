import { NextRequest, NextResponse } from "next/server";
import { benchmarkService } from "@/server/services/benchmark.service";
import { handleAuthError } from "@/server/auth/guard";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const householdId = searchParams.get("householdId") || "hh_01_sharma";
    const state = searchParams.get("state") || undefined;
    const sizeBand = (searchParams.get("sizeBand") as "small" | "medium" | "large") || undefined;
    const homeType = searchParams.get("homeType") || undefined;
    const month = searchParams.get("month") || "2026-03";

    const result = await benchmarkService.getCohortBenchmark(householdId, month, {
      state,
      sizeBand,
      homeType,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleAuthError(err);
  }
}
