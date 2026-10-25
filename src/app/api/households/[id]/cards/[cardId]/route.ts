import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";

/** Revokes a lost or replaced card. The chip stops resolving immediately; the row is kept for the audit trail. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  try {
    const { id: householdId, cardId } = await params;
    const auth = await requireMembership(req, householdId, "household:update");
    const card = await db.card.findFirst({ where: { id: cardId, householdId } });
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    await db.card.update({ where: { id: card.id }, data: { status: "REVOKED" } });
    await db.auditLog.create({
      data: { householdId, userId: auth.userId, action: "card.revoke", entity: "Card", details: `Revoked card ••••${card.uid.slice(-4)}` },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
