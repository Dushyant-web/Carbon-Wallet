import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { listSales, registerSale } from "@/server/services/merchant.service";
import { merchantErrorResponse } from "@/server/services/merchant.http";

/** The shop's own history of what it registered, and whether each household kept it. */
export async function GET(req: NextRequest) {
  try {
    const { merchant } = await requireMerchant(req);
    return NextResponse.json({ sales: await listSales(merchant.id) });
  } catch (err) {
    return merchantErrorResponse(err);
  }
}

/** Registers one purchased appliance or vehicle to the household whose card was just scanned. */
export async function POST(req: NextRequest) {
  try {
    const { user, merchant } = await requireMerchant(req);
    const limit = await rateLimit(`merchant-sale:${merchant.id}`, 60);
    if (!limit.ok) return NextResponse.json({ error: `Slow down: try again in ${limit.retryAfterSec}s.` }, { status: 429 });
    return NextResponse.json(await registerSale(merchant, user.id, await req.json().catch(() => null)), { status: 201 });
  } catch (err) {
    return merchantErrorResponse(err);
  }
}
