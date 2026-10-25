import { NextRequest, NextResponse } from "next/server";
import { handleAuthError, requireUser } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { publicKey, sendToUser } from "@/server/services/notify.service";

/** Sends a test notification to this person's devices (a few a minute at most). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!publicKey()) return NextResponse.json({ error: "Reminders aren't set up on this server yet." }, { status: 503 });
    if (!rateLimit(`push-test:${user.id}`, 3).ok) return NextResponse.json({ error: "Try again in a minute." }, { status: 429 });
    const sent = await sendToUser(user.id, { title: "Reminders are on", body: "This is how Carbon Wallet will remind you. Nothing else to do.", url: "/settings", tag: "test" });
    return NextResponse.json({ sent });
  } catch (err) {
    return handleAuthError(err);
  }
}
