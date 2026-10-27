import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { refreshRecommendations } from "@/server/services/recommendation.service";
import { ApplianceSchema, OwnerApplianceUsageSchema, REMOVE_BY_REQUEST } from "@/lib/assets";

type Ctx = { params: Promise<{ id: string; applianceId: string }> };

/**
 * Edit a appliance. Suggestions are recomputed because they use these numbers. On one a shop registered, only how
 * it's used can change: the specs the shop entered from the label and invoice stay as they are.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id: householdId, applianceId } = await params;
    await requireMembership(req, householdId, "asset:create");
    const found = await db.appliance.findFirst({ where: { id: applianceId, householdId } });
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json().catch(() => null);
    const parsed = (found.source === "MERCHANT" ? OwnerApplianceUsageSchema.strict() : ApplianceSchema.partial()).safeParse(body);
    if (!parsed.success) {
      const locked = found.source === "MERCHANT" && parsed.error.issues.some((i) => i.code === "unrecognized_keys");
      const error = locked ? "The shop's specs are locked. You can change the name and how much it's used." : parsed.error.issues[0]?.message ?? "Invalid appliance";
      return NextResponse.json({ error }, { status: 400 });
    }
    const appliance = await db.appliance.update({ where: { id: found.id }, data: parsed.data });
    await refreshRecommendations(householdId);
    return NextResponse.json({ appliance });
  } catch (err) {
    return handleAuthError(err);
  }
}

/** Nothing is deleted directly: the owner asks (POST …/removals) and a platform admin decides (removal.service.ts). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id: householdId, applianceId } = await params;
    await requireMembership(req, householdId, "asset:delete");
    const found = await db.appliance.findFirst({ where: { id: applianceId, householdId } });
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: REMOVE_BY_REQUEST, code: "REMOVE_BY_REQUEST" }, { status: 403 });
  } catch (err) {
    return handleAuthError(err);
  }
}
