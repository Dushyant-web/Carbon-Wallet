import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { reissueCardCode } from "@/server/services/identity.service";

/** Lost card: issue a new private code. Every card printed with the old code stops working. Owner/Admin only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    const auth = await requireMembership(req, householdId, "household:update");
    const cardCode = await reissueCardCode(householdId);
    await db.auditLog.create({ data: { householdId, userId: auth.userId, action: "card.reissue", entity: "Household", details: "Card code reissued" } });
    return NextResponse.json({ cardCode });
  } catch (err) {
    return handleAuthError(err);
  }
}
