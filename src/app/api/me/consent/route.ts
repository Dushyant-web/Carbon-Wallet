import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { handleAuthError, requireUser } from "@/server/auth/guard";
import { CONSENT_VERSION, recordConsent } from "@/server/services/privacy.service";

/** Whether you've agreed to the current privacy notice. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { consentVersion: true, consentAt: true } });
    return NextResponse.json({ current: CONSENT_VERSION, agreed: row.consentVersion === CONSENT_VERSION, agreedAt: row.consentAt });
  } catch (err) {
    return handleAuthError(err);
  }
}

/** Agree to the current privacy notice. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await recordConsent(user.id);
    return NextResponse.json({ current: CONSENT_VERSION, agreed: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
