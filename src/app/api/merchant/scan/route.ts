import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchant } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { scanCard } from "@/server/services/merchant.service";
import { merchantErrorResponse } from "@/server/services/merchant.http";

const ScanSchema = z.object({ input: z.string().trim().min(4).max(300) });

/** A shop scans a customer's Carbon Card: → a short ticket to register what they bought, and who the card belongs to. */
export async function POST(req: NextRequest) {
  try {
    const { user, merchant } = await requireMerchant(req);
    const limit = await rateLimit(`merchant-scan:${merchant.id}`, 30);
    if (!limit.ok) return NextResponse.json({ error: `Slow down: try again in ${limit.retryAfterSec}s.` }, { status: 429 });

    const parsed = ScanSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Nothing was read from the card." }, { status: 400 });

    return NextResponse.json(await scanCard(merchant, user.id, parsed.data.input));
  } catch (err) {
    return merchantErrorResponse(err);
  }
}
