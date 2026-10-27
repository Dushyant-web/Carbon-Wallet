import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { recordSchemeHelp } from "@/server/services/merchant.service";
import { merchantErrorResponse } from "@/server/services/merchant.http";

/** The shop marks a scheme as explained to the customer, or applied for: the household gets the official link. */
export async function POST(req: NextRequest) {
  try {
    const { user, merchant } = await requireMerchant(req);
    const limit = await rateLimit(`merchant-scheme:${merchant.id}`, 60);
    if (!limit.ok) return NextResponse.json({ error: `Slow down: try again in ${limit.retryAfterSec}s.` }, { status: 429 });
    return NextResponse.json(await recordSchemeHelp(merchant, user.id, await req.json().catch(() => null)), { status: 201 });
  } catch (err) {
    return merchantErrorResponse(err);
  }
}
