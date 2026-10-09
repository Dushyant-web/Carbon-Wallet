import { NextRequest, NextResponse } from "next/server";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { challengeService } from "@/server/services/challenge.service";
import { z } from "zod";

const UpdateChallengeSchema = z.object({
  challengeId: z.string(),
  incrementDays: z.number().int().min(1).default(1),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");

    const challenges = await challengeService.listChallenges(householdId);
    return NextResponse.json({ challenges });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    // Guard: Requires recommendation:apply capability (Viewer blocked with 403!)
    await requireMembership(req, householdId, "recommendation:apply");

    const body = await req.json();
    const data = UpdateChallengeSchema.parse(body);

    const updated = await challengeService.updateProgress(householdId, data.challengeId, data.incrementDays);
    return NextResponse.json({ challenge: updated }, { status: 200 });
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
      return NextResponse.json({ error: "Validation Error", details: err }, { status: 400 });
    }
    return handleAuthError(err);
  }
}
