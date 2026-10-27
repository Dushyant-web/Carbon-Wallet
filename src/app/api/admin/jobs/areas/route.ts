import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireAdmin } from "@/server/auth/guard";
import { runAreaJob } from "@/server/services/mohalla.service";

/** Runs the nightly mohalla job now: regroup homes, recompute area totals. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    return NextResponse.json(await runAreaJob());
  } catch (err) {
    return handleAuthError(err);
  }
}
