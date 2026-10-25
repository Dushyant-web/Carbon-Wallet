import { NextRequest, NextResponse } from "next/server";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { buildPassbook } from "@/server/services/passbook.service";
import { ensureHouseholdIdentity } from "@/server/services/identity.service";

/** The household's own passbook. Members also get the private card code (never part of the public passbook). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");
    const [passbook, identity] = await Promise.all([buildPassbook(householdId), ensureHouseholdIdentity(householdId)]);
    return NextResponse.json({ ...passbook, cardCode: identity.cardCode });
  } catch (err) {
    return handleAuthError(err);
  }
}
