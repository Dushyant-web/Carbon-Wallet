import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import webpush from "web-push";
import { db } from "@/server/db";

// Count pushes instead of sending them; the goal view is faked (it has its own tests)
const pushed: { userId: string; title: string }[] = [];
vi.mock("@/server/services/notify.service", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/services/notify.service")>();
  return { ...real, sendToUser: vi.fn(async (userId: string, p: { title: string }) => (pushed.push({ userId, title: p.title }), 1)) };
});
const likelyOver = new Set<string>();
vi.mock("@/server/services/goal.service", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/services/goal.service")>();
  return {
    ...real,
    getGoalView: vi.fn(async (hh: string) =>
      likelyOver.has(hh) ? { current: { state: "likely_over", forecast: 340, target: 300 }, lever: { action: "Set the AC to 24 °C instead of 22 °C" } } : null,
    ),
  };
});

const { dueForHousehold, runReminders } = await import("@/server/services/reminders.service");
const { submitCheckIn } = await import("@/server/services/checkin.service");
const { billService } = await import("@/server/services/bill.service");
const { setPrefs } = await import("@/server/services/notify.service");
const { POST: subscribe, GET: pushStatus, DELETE: unsubscribe } = await import("@/app/api/me/push/route");
const { POST: login } = await import("@/app/api/auth/login/route");

const HH = "hh_10_roy";
const ownerOf = async (hh: string) => (await db.membership.findFirstOrThrow({ where: { householdId: hh, role: "OWNER" } })).userId;
const kinds = async (now: string) => (await dueForHousehold(HH, new Date(now))).map((r) => r.kind).sort();

describe("Phase 24: reminders and push", () => {
  beforeAll(async () => {
    const owner = await ownerOf(HH);
    // a bill for 1 Jan – 31 Jan 2022: the next one is due around 2 March, nudged from 5 March
    await billService.confirm({ householdId: HH, userId: owner, periodStart: "2022-01-01", periodEnd: "2022-01-31", kwh: 200 });
  });

  it("knows when the next bill should be out, and when the check-in is due", async () => {
    expect(await kinds("2022-03-03T06:00:00Z")).toEqual(["CHECKIN"]); // bill not late yet
    const due = await dueForHousehold(HH, new Date("2022-03-06T06:00:00Z"));
    expect(due.map((r) => r.kind).sort()).toEqual(["BILL", "CHECKIN"]);
    expect(due.find((r) => r.kind === "BILL")?.url).toBe("/bills/new");

    await submitCheckIn(HH, await ownerOf(HH), { vehicles: [], metroKm: 10, busKm: 0, acHoursPerDay: null }, new Date("2022-03-06T06:00:00Z"));
    expect(await kinds("2022-03-06T08:00:00Z")).toEqual(["BILL"]); // checked in this week
    likelyOver.add(HH);
    expect(await kinds("2022-03-06T08:00:00Z")).toEqual(["BILL", "GOAL"]);
    likelyOver.delete(HH);
  });

  it("pushes once per period, on Sunday evening for the check-in, never in quiet hours, only if wanted", async () => {
    const owner = await ownerOf(HH);
    await db.pushSubscription.create({ data: { userId: owner, endpoint: "https://push.example/roy-owner", p256dh: "k".repeat(40), auth: "a".repeat(16) } });
    const mine = () => pushed.filter((p) => p.userId === owner).map((p) => p.title);

    // Sunday 13 March 2022, 23:30 IST: quiet hours
    await runReminders(new Date("2022-03-13T18:00:00Z"));
    expect(mine()).toEqual([]);
    // Sunday 13 March, 18:30 IST: the check-in and the late bill
    await runReminders(new Date("2022-03-13T13:00:00Z"));
    expect(mine().sort()).toEqual(["This week's check-in", "Your electricity bill should be out"]);
    // again an hour later: nothing new
    await runReminders(new Date("2022-03-13T14:00:00Z"));
    expect(mine()).toHaveLength(2);
    // Monday 10:00 IST next week: not a check-in evening; the bill was already sent
    await runReminders(new Date("2022-03-14T04:30:00Z"));
    expect(mine()).toHaveLength(2);
    // turned off: next Sunday evening sends nothing
    await setPrefs(owner, { checkin: false });
    await runReminders(new Date("2022-03-20T13:00:00Z"));
    expect(mine()).toHaveLength(2);
  });

  it("lets a signed-in person turn reminders on and off for a device", async () => {
    const keys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    const res = await login(new NextRequest("http://localhost:3000/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "arjun.sharma@example.com", password: "CarbonDemo#2026" }) }));
    const cookie = `cw_session=${/cw_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")![1]}`;
    const call = (method: string, body?: unknown) =>
      new NextRequest("http://localhost:3000/api/me/push", { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", keys: { p256dh: "B".repeat(87), auth: "x".repeat(22) } };

    expect((await subscribe(new NextRequest("http://localhost:3000/api/me/push", { method: "POST", body: JSON.stringify(sub) }))).status).toBe(401);
    expect((await subscribe(call("POST", sub))).status).toBe(201);
    const status = await (await pushStatus(call("GET"))).json();
    expect(status).toMatchObject({ configured: true, publicKey: keys.publicKey, devices: 1 });
    expect(status.prefs).toMatchObject({ checkin: true, quietFrom: 22, quietTo: 8 });
    expect((await unsubscribe(call("DELETE", { endpoint: sub.endpoint }))).status).toBe(200);
    expect((await (await pushStatus(call("GET"))).json()).devices).toBe(0);
  });
});
