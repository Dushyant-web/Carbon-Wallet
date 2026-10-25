import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { GOAL_LIMITS, GoalError, getGoalView, setGoal, stopGoal } from "@/server/services/goal.service";

type Ctx = { params: Promise<{ id: string }> };

const SetGoal = z.object({
  targetPct: z.number().min(GOAL_LIMITS.minPct).max(GOAL_LIMITS.maxPct),
  glideMonths: z.number().int().min(GOAL_LIMITS.minGlide).max(GOAL_LIMITS.maxGlide).default(6),
});

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireMembership(req, id, "data:read");
    return NextResponse.json({ goal: await getGoalView(id) });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "goal:manage");
    const parsed = SetGoal.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the goal." }, { status: 400 });
    await setGoal(id, auth.userId, parsed.data.targetPct, parsed.data.glideMonths);
    return NextResponse.json({ goal: await getGoalView(id) }, { status: 201 });
  } catch (err) {
    if (err instanceof GoalError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "goal:manage");
    await stopGoal(id, auth.userId);
    return NextResponse.json({ goal: null });
  } catch (err) {
    return handleAuthError(err);
  }
}
