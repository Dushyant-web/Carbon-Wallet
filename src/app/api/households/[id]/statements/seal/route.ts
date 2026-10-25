import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { db } from "@/server/db";
import { EngineError } from "@/server/engine";
import { sealPending } from "@/server/services/statement.service";

/** Seal locked months on the chain (owner or admin). One transaction covers every locked statement. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "household:update");
    const anchor = await sealPending();
    await db.auditLog.create({ data: { householdId: id, userId: auth.userId, action: "statement.seal", entity: "AnchorBatch", details: `${anchor.chain} ${anchor.tx_hash}` } });
    return NextResponse.json(anchor, { status: 201 });
  } catch (err) {
    if (err instanceof EngineError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleAuthError(err);
  }
}
