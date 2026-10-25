import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { ChallengeError, challengeService } from "@/server/services/challenge.service";

const ActionSchema = z.object({
  template: z.string().min(1).max(40),
  action: z.enum(["join", "checkin", "leave"]),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");
    return NextResponse.json(await challengeService.list(householdId));
  } catch (err) {
    return handleAuthError(err);
  }
}

/** Join a challenge, check in for today (once a day), or leave it. Viewers can't. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "challenge:join");
    const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Send { template, action }" }, { status: 400 });
    const { template, action } = parsed.data;
    try {
      const out =
        action === "join"
          ? await challengeService.join(householdId, template)
          : action === "leave"
            ? await challengeService.leave(householdId, template)
            : await challengeService.checkIn(householdId, template);
      return NextResponse.json(out);
    } catch (err) {
      if (err instanceof ChallengeError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
