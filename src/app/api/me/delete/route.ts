import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clearSessionCookie } from "@/server/auth/session";
import { handleAuthError, requireUser } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { ERASE_AFTER_DAYS, PrivacyError, deletionPlan, requestAccountDeletion } from "@/server/services/privacy.service";

/** What deleting your account would do to each of your households. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({ eraseAfterDays: ERASE_AFTER_DAYS, households: await deletionPlan(user.id) });
  } catch (err) {
    return handleAuthError(err);
  }
}

/** Delete your account: signed out everywhere now, erased in 30 days. Needs your password. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!rateLimit(`delete:${user.id}`, 5).ok) return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
    const body = z.object({ password: z.string().min(1), deleteHouseholds: z.array(z.string()).max(50).default([]) }).safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Enter your password to confirm." }, { status: 400 });
    const out = await requestAccountDeletion(user.id, body.data.password, body.data.deleteHouseholds);
    const res = NextResponse.json(out);
    clearSessionCookie(res);
    return res;
  } catch (err) {
    if (err instanceof PrivacyError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleAuthError(err);
  }
}
