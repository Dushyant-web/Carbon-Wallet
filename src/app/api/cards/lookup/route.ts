import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, handleAuthError } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { buildReceipt, resolveReaderInput } from "@/server/services/card.service";

const LookupSchema = z.object({ input: z.string().trim().min(4).max(300) });

/**
 * Reader endpoint, for Carbon Wallet kiosks only (platform admins): the card's private barcode or chip code,
 * a chip serial, or a shared link → printable receipt. A stranger's scanner app only ever sees the bare code.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const limit = rateLimit(`card-lookup:${user.id}`, 30);
    if (!limit.ok) return NextResponse.json({ error: `Slow down: try again in ${limit.retryAfterSec}s.` }, { status: 429 });

    const parsed = LookupSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Nothing was read from the card." }, { status: 400 });

    const hit = await resolveReaderInput(parsed.data.input);
    if (!hit) return NextResponse.json({ error: "Card not recognised. It may have been reissued, or not linked yet." }, { status: 404 });

    return NextResponse.json(await buildReceipt(hit.householdId, hit.via));
  } catch (err) {
    return handleAuthError(err);
  }
}
