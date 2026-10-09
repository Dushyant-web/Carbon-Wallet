import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireMembership, handleAuthError } from "@/server/auth/guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  try {
    const { id: householdId, rid: recommendationId } = await params;
    const auth = await requireMembership(req, householdId, "recommendation:apply");

    const recommendation = await db.recommendation.findFirst({
      where: { id: recommendationId, householdId },
    });

    if (!recommendation) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    const updated = await db.recommendation.update({
      where: { id: recommendation.id },
      data: {
        status: "ACCEPTED",
        appliedAt: new Date(),
      },
    });

    // Write audit log
    await db.auditLog.create({
      data: {
        householdId,
        userId: auth.userId,
        action: "recommendation.apply",
        entity: "Recommendation",
        details: `Enrolled in action: ${updated.action} (-${updated.kgSaved} kg/mo)`,
      },
    });

    return NextResponse.json({
      message: `Enrolled in ${updated.action}`,
      recommendation: updated,
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
