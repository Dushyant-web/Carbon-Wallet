import { NextRequest } from "next/server";
import { requireMembership } from "@/server/auth/guard";
import { billService } from "@/server/services/bill.service";
import { billErrorResponse } from "@/server/services/bill.http";

export const runtime = "nodejs";

/** Streams a decrypted page preview to household members only. Never cached by shared caches. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string; n: string }> }) {
  try {
    const { id: householdId, docId, n } = await params;
    await requireMembership(req, householdId, "data:read");
    const png = await billService.getPreview(householdId, docId, Number.parseInt(n, 10));
    return new Response(new Uint8Array(png), {
      headers: { "content-type": "image/png", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
    });
  } catch (err) {
    return billErrorResponse(err);
  }
}
