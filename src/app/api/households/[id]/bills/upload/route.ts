import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { billService } from "@/server/services/bill.service";
import { billErrorResponse } from "@/server/services/bill.http";

export const runtime = "nodejs";

/** Multipart upload: field `file` (PDF/JPG/PNG/HEIC ≤10 MB), optional `allowAi=1` (user consent). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    const auth = await requireMembership(req, householdId, "bill:create");
    const limit = rateLimit(`bill-upload:${auth.userId}`, 20, 10 * 60_000);
    if (!limit.ok) {
      return NextResponse.json({ error: `Too many uploads. Try again in ${limit.retryAfterSec}s.` }, { status: 429 });
    }
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Attach the bill as `file`." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Bill files must be under 10 MB." }, { status: 413 });
    }
    const document = await billService.upload({
      householdId,
      userId: auth.userId,
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
      allowAi: form?.get("allowAi") === "1",
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    return billErrorResponse(err);
  }
}
