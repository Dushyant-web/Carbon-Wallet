import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { CheckInError, getCheckInState, submitCheckIn } from "@/server/services/checkin.service";

type Ctx = { params: Promise<{ id: string }> };

const Answers = z.object({
  vehicles: z.array(z.object({ vehicleId: z.string().min(1), km: z.number().min(0).max(5000) })).max(10),
  metroKm: z.number().min(0).max(2000).default(0),
  busKm: z.number().min(0).max(2000).default(0),
  acHoursPerDay: z.number().min(0).max(24).nullable(),
});

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireMembership(req, id, "data:read");
    return NextResponse.json(await getCheckInState(id));
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "checkin:create");
    const parsed = Answers.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the answers." }, { status: 400 });
    return NextResponse.json(await submitCheckIn(id, auth.userId, parsed.data), { status: 201 });
  } catch (err) {
    if (err instanceof CheckInError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleAuthError(err);
  }
}
