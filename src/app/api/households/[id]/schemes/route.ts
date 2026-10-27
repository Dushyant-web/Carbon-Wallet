import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { schemesForHousehold } from "@/server/services/scheme.service";

/** Sarkari Yojana for this home: schemes it can use (with why), all schemes in its state, and help already given. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireMembership(req, id, "data:read");
    return NextResponse.json(await schemesForHousehold(id));
  } catch (err) {
    return handleAuthError(err);
  }
}
