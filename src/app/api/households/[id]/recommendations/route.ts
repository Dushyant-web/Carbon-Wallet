import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { refreshRecommendations } from "@/server/services/recommendation.service";
import { verifyCommitments } from "@/server/services/commitment.service";

/** Suggestions for this home, recomputed from its current bills, assets and vehicles. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");
    await refreshRecommendations(householdId);
    await verifyCommitments(householdId);
    const recommendations = await db.recommendation.findMany({
      where: { householdId, status: { in: ["PENDING", "ACCEPTED", "COMPLETED"] } },
      orderBy: [{ status: "asc" }, { kgSaved: "desc" }],
    });
    return NextResponse.json({ recommendations });
  } catch (err) {
    return handleAuthError(err);
  }
}
