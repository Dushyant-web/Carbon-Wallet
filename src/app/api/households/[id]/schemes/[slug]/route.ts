import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { SchemeError, markApplied } from "@/server/services/scheme.service";

/** The owner says "we applied", so reminders and the scheme list can follow up. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; slug: string }> }) {
  try {
    const { id, slug } = await params;
    await requireMembership(req, id, "household:update");
    const row = await markApplied(id, slug);
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  } catch (err) {
    if (err instanceof SchemeError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleAuthError(err);
  }
}
