import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireMembership } from "@/server/auth/guard";
import { canActOn, dueForHousehold } from "@/server/services/reminders.service";

/** What's due for this household now, for the banners on Home (the same list push reminders use). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireMembership(req, id, "data:read");
    const reminders = (await dueForHousehold(id)).filter((r) => canActOn(auth.role, r.kind));
    return NextResponse.json({ reminders });
  } catch (err) {
    return handleAuthError(err);
  }
}
