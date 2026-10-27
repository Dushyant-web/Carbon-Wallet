import { NextRequest, NextResponse } from "next/server";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { getInsights } from "@/server/services/insights.service";
import { EngineError, engineNarrate } from "@/server/engine";

/** The same facts, reworded by an AI model in plain English. Numbers it didn't get from us are dropped. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    const auth = await requireMembership(req, householdId, "data:read");
    if (!(await rateLimit(`narrate:${auth.userId}`, 30, 10 * 60_000)).ok) {
      return NextResponse.json({ bullets: [], model: null, reason: "Too many requests, try again soon." }, { status: 429 });
    }
    const insights = await getInsights(householdId, req.nextUrl.searchParams.get("month"));
    if (!insights.available) return NextResponse.json({ bullets: [], model: null, reason: insights.reason });
    try {
      return NextResponse.json(await engineNarrate(insights.facts, 4));
    } catch (err) {
      if (err instanceof EngineError) return NextResponse.json({ bullets: [], model: null, reason: "AI writing is unavailable right now." });
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
