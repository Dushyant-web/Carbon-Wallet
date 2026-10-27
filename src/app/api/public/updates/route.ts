import { NextResponse } from "next/server";
import { portalUpdates } from "@/server/services/portal.service";

/** Public: the "What's new" ticker and the footer's counts. Cached for 10 minutes at the edge. */
export async function GET() {
  const body = await portalUpdates();
  return NextResponse.json(body, { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
