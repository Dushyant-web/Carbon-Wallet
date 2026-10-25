import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/server/auth/guard";
import { hasPermission } from "@/server/auth/permissions";
import { billService } from "@/server/services/bill.service";
import { billErrorResponse } from "@/server/services/bill.http";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    const { id: householdId, docId } = await params;
    await requireMembership(req, householdId, "data:read");
    return NextResponse.json({ document: await billService.getDocument(householdId, docId) });
  } catch (err) {
    return billErrorResponse(err);
  }
}

/** Discards an upload that was never confirmed (file, previews and extraction). Family can discard only their own uploads. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    const { id: householdId, docId } = await params;
    const auth = await requireMembership(req, householdId, "bill:create");
    const ownOnly = !hasPermission(auth.role, "activity:delete");
    await billService.removeDocument(householdId, docId, auth.userId, ownOnly);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return billErrorResponse(err);
  }
}
