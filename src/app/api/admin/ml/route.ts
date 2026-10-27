import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireAdmin } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { EngineError } from "@/server/engine";
import { forecastStatus, startForecastTraining } from "@/server/services/mlForecast.service";

/** The forecast model: how it was trained, how well it does on months it never saw, and the data behind it. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    return NextResponse.json(await forecastStatus(), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return handleAuthError(err);
  }
}

/** Retrain now, in the background (it also retrains every night). */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!(await rateLimit(`ml-train:${admin.id}`, 3, 10 * 60_000)).ok) return NextResponse.json({ error: "Retrained a moment ago. Try again in a few minutes." }, { status: 429 });
    try {
      return NextResponse.json(await startForecastTraining());
    } catch (err) {
      if (err instanceof EngineError) return NextResponse.json({ error: err.message }, { status: err.status === 422 ? 422 : 503 });
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
