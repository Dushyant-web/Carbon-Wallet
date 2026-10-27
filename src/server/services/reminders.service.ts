import { db } from "@/server/db";
import { getCheckInState, weekStartOf } from "@/server/services/checkin.service";
import { getGoalView } from "@/server/services/goal.service";
import { getPrefs, sendToUser } from "@/server/services/notify.service";
import { hasPermission, type Capability } from "@/server/auth/permissions";
import type { Role } from "@/types";

/*
 * Reminders keep the weekly rhythm going (system_design.md §11; flaws.md C1, C4). The same list feeds the
 * banners inside the app and the push notifications sent by `npm run reminders`:
 *   CHECKIN  this week's check-in isn't done            (push: Sunday 17:00–21:00 IST only)
 *   BILL     the next electricity bill should be out by now (3 days after the expected end of its period)
 *   GOAL     this month is heading over the goal          (at most once a week)
 * Each is sent at most once per household, person and period, never in quiet hours, and only if wanted.
 */

export type ReminderKind = "CHECKIN" | "BILL" | "GOAL";
export type DueReminder = { householdId: string; kind: ReminderKind; periodKey: string; title: string; body: string; url: string };

// Only remind people about something their role lets them do: family add bills, only the owner checks in or sets goals
const ACTS_WITH: Record<ReminderKind, Capability> = { CHECKIN: "checkin:create", BILL: "bill:create", GOAL: "goal:manage" };
export const canActOn = (role: Role, kind: ReminderKind) => hasPermission(role, ACTS_WITH[kind]);

const DAY = 86_400_000;
const istHour = (now: Date) => new Date(now.getTime() + 5.5 * 3600_000).getUTCHours();
const istWeekday = (now: Date) => new Date(now.getTime() + 5.5 * 3600_000).getUTCDay(); // 0 = Sunday
const iso = (d: Date) => d.toISOString().slice(0, 10);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** What's due for a household right now (no time-of-day rules: those apply to push only). */
export async function dueForHousehold(householdId: string, now: Date = new Date()): Promise<DueReminder[]> {
  const out: DueReminder[] = [];
  const household = await db.household.findUnique({ where: { id: householdId }, select: { name: true } });
  if (!household) return out;

  const checkin = await getCheckInState(householdId, now);
  if (!checkin.done) {
    out.push({
      householdId,
      kind: "CHECKIN",
      periodKey: iso(weekStartOf(now)),
      title: "This week's check-in",
      body: checkin.hasLast ? "About a minute. Was the week like the last one? One tap." : "About a minute: car km, metro and bus, AC hours.",
      url: "/check-in",
    });
  }

  // Next bill: the latest bill's period length after its end, plus 3 days for it to arrive
  const latest = await db.bill.findFirst({ where: { householdId }, orderBy: { periodEnd: "desc" } });
  if (latest) {
    const cycle = Math.max(25, Math.round((latest.periodEnd.getTime() - latest.periodStart.getTime()) / DAY));
    const expectedEnd = new Date(latest.periodEnd.getTime() + cycle * DAY);
    if (now.getTime() >= expectedEnd.getTime() + 3 * DAY) {
      out.push({
        householdId,
        kind: "BILL",
        periodKey: iso(expectedEnd),
        title: "Your electricity bill should be out",
        body: `The bill after the one ending ${latest.periodEnd.getUTCDate()} ${MONTHS[latest.periodEnd.getUTCMonth()]} should be here. Upload it so your record counts what you really used.`,
        url: "/bills/new",
      });
    }
  }

  const goal = await getGoalView(householdId, now);
  if (goal?.current.state === "likely_over") {
    out.push({
      householdId,
      kind: "GOAL",
      periodKey: iso(weekStartOf(now)),
      title: "This month is heading over your goal",
      body: `About ${Math.round(goal.current.forecast)} kg against a ${Math.round(goal.current.target)} kg target.${goal.lever ? ` Biggest lever: ${goal.lever.action.toLowerCase()}.` : ""}`,
      url: "/dashboard",
    });
  }
  return out;
}

const inQuietHours = (hour: number, from: number, to: number) => (from === to ? false : from < to ? hour >= from && hour < to : hour >= from || hour < to);

/** One pass of the push scheduler: safe to run as often as you like. */
export async function runReminders(now: Date = new Date()): Promise<{ sent: number; considered: number }> {
  const users = await db.user.findMany({
    where: { status: "ACTIVE", memberships: { some: { status: "ACTIVE" } } }, // the bell works without push
    select: { id: true, memberships: { where: { status: "ACTIVE" }, select: { householdId: true, role: true } } },
  });
  let sent = 0;
  let considered = 0;
  for (const u of users) {
    const prefs = await getPrefs(u.id);
    if (inQuietHours(istHour(now), prefs.quietFrom, prefs.quietTo)) continue;
    for (const m of u.memberships) {
      for (const r of await dueForHousehold(m.householdId, now)) {
        if (!canActOn(m.role as Role, r.kind)) continue;
        considered++;
        if (r.kind === "CHECKIN" && (!prefs.checkin || istWeekday(now) !== 0 || istHour(now) < 17 || istHour(now) >= 21)) continue;
        if (r.kind === "BILL" && !prefs.bill) continue;
        if (r.kind === "GOAL" && !prefs.goal) continue;
        const key = { userId: u.id, householdId: m.householdId, kind: r.kind, periodKey: r.periodKey };
        if (await db.sentReminder.findUnique({ where: { userId_householdId_kind_periodKey: key } })) continue; // already sent
        try {
          await db.sentReminder.create({ data: key });
        } catch {
          continue; // another run got there first
        }
        sent += await sendToUser(u.id, { title: r.title, body: r.body, url: r.url, tag: `${r.kind}:${m.householdId}` });
      }
    }
  }
  return { sent, considered };
}
