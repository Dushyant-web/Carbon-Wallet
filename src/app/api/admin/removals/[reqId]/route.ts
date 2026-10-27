import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/guard";
import { decideRemoval } from "@/server/services/removal.service";
import { removalErrorResponse } from "@/server/services/removal.http";

const Body = z.object({ decision: z.enum(["APPROVE", "REJECT"]), note: z.string().trim().max(240).optional() }).strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reqId: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { reqId } = await params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Approve or reject, with a note when rejecting." }, { status: 400 });
    return NextResponse.json(await decideRemoval(reqId, admin.id, parsed.data.decision === "APPROVE", parsed.data.note || null));
  } catch (err) {
    return removalErrorResponse(err);
  }
}
