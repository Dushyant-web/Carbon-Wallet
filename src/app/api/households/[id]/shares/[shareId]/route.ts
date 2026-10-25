import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { ShareError, revokeShare } from "@/server/services/share.service";

/** Revoke a share link: it stops working at once. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; shareId: string }> }) {
  try {
    const { id, shareId } = await params;
    const auth = await requireMembership(req, id, "household:update");
    await revokeShare(id, shareId, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ShareError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleAuthError(err);
  }
}
