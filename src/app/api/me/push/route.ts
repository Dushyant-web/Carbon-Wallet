import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { handleAuthError, requireUser } from "@/server/auth/guard";
import { getPrefs, publicKey, removeSubscription, saveSubscription, setPrefs } from "@/server/services/notify.service";

const Subscription = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }) });
const Prefs = z
  .object({
    checkin: z.boolean(),
    bill: z.boolean(),
    goal: z.boolean(),
    quietFrom: z.number().int().min(0).max(23),
    quietTo: z.number().int().min(0).max(23),
  })
  .partial();

/** Whether push is set up, the key to subscribe with, this person's preferences and device count. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const devices = await db.pushSubscription.count({ where: { userId: user.id } });
    return NextResponse.json({ configured: !!publicKey(), publicKey: publicKey(), prefs: await getPrefs(user.id), devices });
  } catch (err) {
    return handleAuthError(err);
  }
}

/** Turn reminders on for this device. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!publicKey()) return NextResponse.json({ error: "Reminders aren't set up on this server yet." }, { status: 503 });
    const sub = Subscription.safeParse(await req.json().catch(() => null));
    if (!sub.success) return NextResponse.json({ error: "That device subscription isn't valid." }, { status: 400 });
    await saveSubscription(user.id, sub.data, req.headers.get("user-agent"));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleAuthError(err);
  }
}

/** Turn reminders off for this device. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = z.object({ endpoint: z.string().max(1000) }).safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    await removeSubscription(user.id, body.data.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}

/** Which reminders, and quiet hours. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = Prefs.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Check the settings." }, { status: 400 });
    return NextResponse.json({ prefs: await setPrefs(user.id, body.data) });
  } catch (err) {
    return handleAuthError(err);
  }
}
