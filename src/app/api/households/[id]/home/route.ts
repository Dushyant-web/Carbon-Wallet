import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { handleAuthError, requireMembership } from "@/server/auth/guard";

const Body = z.object({ ownsHome: z.boolean().nullable() }).strict();

/** One-time question used by schemes such as rooftop solar: is the house yours? */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "household:update");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Send ownsHome: true, false or null" }, { status: 400 });
    await db.household.update({ where: { id }, data: { ownsHome: parsed.data.ownsHome } });
    await db.auditLog.create({
      data: { householdId: id, userId: auth.userId, action: "household.owns_home", entity: "Household", details: `ownsHome=${parsed.data.ownsHome}` },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
