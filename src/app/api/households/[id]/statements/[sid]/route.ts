import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { EngineError } from "@/server/engine";
import { statementFor } from "@/server/services/statement.service";

/** A locked statement with its salt and proof: enough to verify it anywhere. Members of that household only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const { id, sid } = await params;
    await requireMembership(req, id, "data:read");
    return NextResponse.json(await statementFor(id, sid));
  } catch (err) {
    if (err instanceof EngineError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleAuthError(err);
  }
}
