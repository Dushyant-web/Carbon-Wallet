import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { EngineError, SHARE_LIMITS, ShareError, createShare, listShares } from "@/server/services/share.service";

type Ctx = { params: Promise<{ id: string }> };
const known = (err: unknown) =>
  err instanceof ShareError || err instanceof EngineError ? NextResponse.json({ error: err.message }, { status: err.status }) : null;

/** The household's share links (owner or admin). */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireMembership(req, id, "household:update");
    return NextResponse.json({ shares: await listShares(id) });
  } catch (err) {
    return known(err) ?? handleAuthError(err);
  }
}

/** Share sealed months with a bank or employer (owner or admin). */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "household:update");
    const body = z
      .object({
        months: z.array(z.string()).min(1).max(SHARE_LIMITS.maxMonths),
        days: z.number().int().min(SHARE_LIMITS.minDays).max(SHARE_LIMITS.maxDays).default(SHARE_LIMITS.defaultDays),
        label: z.string().max(80).optional(),
      })
      .safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Check the link details." }, { status: 400 });
    return NextResponse.json(await createShare(id, auth.userId, body.data.months, body.data.days, body.data.label), { status: 201 });
  } catch (err) {
    return known(err) ?? handleAuthError(err);
  }
}
