import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { PrivacyError, requestHouseholdDeletion } from "@/server/services/privacy.service";

/** The owner deletes this household: hidden from everyone now, erased in 30 days. Needs the owner's password. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "household:archive");
    const body = z.object({ password: z.string().min(1) }).safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Enter your password to confirm." }, { status: 400 });
    const out = await requestHouseholdDeletion(id, auth.userId, body.data.password);
    await db.auditLog.create({ data: { householdId: id, userId: auth.userId, action: "household.delete_requested", entity: "Household", details: `erase on ${out.eraseOn.slice(0, 10)}` } });
    return NextResponse.json(out);
  } catch (err) {
    if (err instanceof PrivacyError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleAuthError(err);
  }
}
