import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { refreshRecommendations } from "@/server/services/recommendation.service";
import { ApplianceSchema } from "@/lib/assets";

type Ctx = { params: Promise<{ id: string; applianceId: string }> };

/** Edit a appliance. Suggestions are recomputed because they use these numbers. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id: householdId, applianceId } = await params;
    await requireMembership(req, householdId, "asset:create");
    const parsed = ApplianceSchema.partial().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid appliance" }, { status: 400 });
    const found = await db.appliance.findFirst({ where: { id: applianceId, householdId } });
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const appliance = await db.appliance.update({ where: { id: found.id }, data: parsed.data });
    await refreshRecommendations(householdId);
    return NextResponse.json({ appliance });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id: householdId, applianceId } = await params;
    await requireMembership(req, householdId, "asset:delete");
    const found = await db.appliance.findFirst({ where: { id: applianceId, householdId } });
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.appliance.delete({ where: { id: found.id } });
    await refreshRecommendations(householdId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
