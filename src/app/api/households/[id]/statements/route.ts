import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { db } from "@/server/db";
import { EngineError } from "@/server/engine";
import { lockMonth, statementStatus } from "@/server/services/statement.service";

type Ctx = { params: Promise<{ id: string }> };
const engineError = (err: unknown) => (err instanceof EngineError ? NextResponse.json({ error: err.message }, { status: err.status }) : null);

/** Lock status of each month (sealed or not), for members. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await requireMembership(req, id, "data:read");
    return NextResponse.json({ statements: await statementStatus(id) });
  } catch (err) {
    return engineError(err) ?? handleAuthError(err);
  }
}

/** Lock a month from this household's own records (owner or admin). */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "household:update");
    const body = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }).safeParse(await req.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: "Pick a month like 2026-03." }, { status: 400 });
    const bundle = await lockMonth(id, body.data.month);
    await db.auditLog.create({ data: { householdId: id, userId: auth.userId, action: "statement.lock", entity: "Statement", details: String(bundle.statement.period) } });
    return NextResponse.json(bundle, { status: 201 });
  } catch (err) {
    return engineError(err) ?? handleAuthError(err);
  }
}
