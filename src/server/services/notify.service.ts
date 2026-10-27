import webpush from "web-push";
import { db } from "@/server/db";

/*
 * Web Push: reminders on a phone or laptop, even when Carbon Wallet isn't open. Keys come from .env
 * (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT); `npm run vapid` makes a pair. Without them, push is
 * simply off and reminders still show inside the app.
 */

export type NotifyPrefs = { checkin: boolean; bill: boolean; goal: boolean; quietFrom: number; quietTo: number };
export const DEFAULT_PREFS: NotifyPrefs = { checkin: true, bill: true, goal: true, quietFrom: 22, quietTo: 8 }; // hours, IST

export type NotificationKind = "SHOP" | "REMOVAL" | "SCHEME" | "HELP" | "REMINDER" | "MOHALLA" | "HEAT" | "SYSTEM";
export type PushPayload = { title: string; body: string; url: string; tag: string; kind?: NotificationKind };

/** What kind of notice a push is, from its tag ("merchant:…", "removal:…"), for the bell's icons and filters. */
function kindOf(p: PushPayload): NotificationKind {
  if (p.kind) return p.kind;
  const prefix = p.tag.split(":")[0];
  return (
    ({ merchant: "SHOP", removal: "REMOVAL", scheme: "SCHEME", grievance: "HELP", BILL: "REMINDER", CHECKIN: "REMINDER", GOAL: "REMINDER", heat: "HEAT", mohalla: "MOHALLA" } as Record<string, NotificationKind>)[prefix] ?? "SYSTEM"
  );
}

let configuredFor = "";
export function pushConfigured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (configuredFor !== pub) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@carbonwallet.in", pub, priv);
    configuredFor = pub;
  }
  return true;
}

export const publicKey = () => (pushConfigured() ? process.env.VAPID_PUBLIC_KEY! : null);

export async function getPrefs(userId: string): Promise<NotifyPrefs> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { notifyPrefs: true } });
  try {
    return { ...DEFAULT_PREFS, ...(u?.notifyPrefs ? JSON.parse(u.notifyPrefs) : {}) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function setPrefs(userId: string, patch: Partial<NotifyPrefs>): Promise<NotifyPrefs> {
  const next = { ...(await getPrefs(userId)), ...patch };
  await db.user.update({ where: { id: userId }, data: { notifyPrefs: JSON.stringify(next) } });
  return next;
}

export async function saveSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string | null) {
  // one row per device; a device that changes hands moves to the new account
  return db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 200) ?? null },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 200) ?? null },
  });
}

export async function removeSubscription(userId: string, endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

/**
 * Notifies one person: always into the website's notification centre (the bell), and as a phone / desktop push
 * on every device they enabled. Devices the push service says are gone are removed. Returns pushes sent.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  if (payload.tag !== "test") {
    await db.notification
      .create({ data: { userId, kind: kindOf(payload), title: payload.title.slice(0, 140), body: payload.body.slice(0, 500), url: payload.url.startsWith("/") ? payload.url : "/" } })
      .catch(() => null); // the notice must never break the action that caused it
  }
  if (!pushConfigured()) return 0;
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "normal" });
      await db.pushSubscription.update({ where: { id: s.id }, data: { lastSentAt: new Date() } });
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
    }
  }
  return sent;
}

/** Push to the people of a home (owners only, or everyone). A failed push never fails the action that caused it. */
export async function notifyHousehold(householdId: string, payload: PushPayload, roles: string[] = ["OWNER", "MEMBER", "VIEWER"]): Promise<number> {
  const members = await db.membership.findMany({ where: { householdId, status: "ACTIVE", role: { in: roles } }, select: { userId: true } });
  let sent = 0;
  for (const m of members) sent += await sendToUser(m.userId, payload).catch(() => 0);
  return sent;
}
