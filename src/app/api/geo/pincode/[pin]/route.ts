import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { lookupPincode } from "@/server/services/mohalla.service";
import { locationErrorResponse } from "@/server/services/mohalla.http";

/** Pincode → post offices (India Post) and a point for the map (OpenStreetMap). Signed-in users only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ pin: string }> }) {
  try {
    const user = await requireUser(req);
    const limit = await rateLimit(`pincode:${user.id}`, 20, 60_000);
    if (!limit.ok) return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
    const { pin } = await params;
    return NextResponse.json(await lookupPincode(pin));
  } catch (err) {
    return locationErrorResponse(err);
  }
}
