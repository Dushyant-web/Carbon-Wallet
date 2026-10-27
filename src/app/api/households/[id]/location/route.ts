import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { setLocation } from "@/server/services/mohalla.service";
import { locationErrorResponse } from "@/server/services/mohalla.http";

/** The owner sets where the home is (GPS or a pin dropped by hand). Only H3 hexagons are stored. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "household:update");
    const limit = await rateLimit(`location:${id}`, 10, 60 * 60_000);
    if (!limit.ok) return NextResponse.json({ error: "Too many changes. Try again later." }, { status: 429 });
    return NextResponse.json(await setLocation(id, auth.userId, await req.json().catch(() => null)));
  } catch (err) {
    return locationErrorResponse(err);
  }
}
