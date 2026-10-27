import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { billService } from "@/server/services/bill.service";
import { billErrorResponse } from "@/server/services/bill.http";

/** The user consented: send this stored bill to the AI reader and return the merged extraction. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    const { id: householdId, docId } = await params;
    const auth = await requireMembership(req, householdId, "bill:create");
    const limit = await rateLimit(`bill-ai:${auth.userId}`, 10, 10 * 60_000);
    if (!limit.ok) {
      return NextResponse.json({ error: `Too many AI reads. Try again in ${limit.retryAfterSec}s.` }, { status: 429 });
    }
    return NextResponse.json({ document: await billService.rereadWithAi(householdId, docId, auth.userId) });
  } catch (err) {
    return billErrorResponse(err);
  }
}
