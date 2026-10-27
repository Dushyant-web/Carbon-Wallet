import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { EngineError } from "@/server/engine";
import { forecastFor } from "@/server/services/mlForecast.service";

/** Next month's CO₂ from the machine-learned model, with a likely range and the reasons in kg. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireMembership(req, id, "data:read");
    try {
      return NextResponse.json({ forecast: await forecastFor(id) }, { headers: { "cache-control": "private, max-age=300" } });
    } catch (err) {
      if (err instanceof EngineError) return NextResponse.json({ forecast: null, unavailable: err.message }, { status: 200 });
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
