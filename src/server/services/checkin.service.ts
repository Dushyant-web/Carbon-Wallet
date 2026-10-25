import { db } from "@/server/db";
import { emissionService } from "@/server/services/emission.service";
import { vehicleTripType } from "@/lib/quickLog";
import type { CreateActivityInput } from "@/types";

/*
 * The weekly 60-second check-in (system_design.md §11): this week's car km, metro and bus km, and AC hours a
 * day. Each answer becomes an activity like any other, so anything a bill or a fuel fill-up already covers is
 * kept as a note and never counted twice. A missed week is filled from the latest answers and marked
 * Estimated, never zero (a gap is not a saving). The latest check-in is the household's routine.
 */

export type CheckInAnswers = {
  vehicles: { vehicleId: string; km: number }[];
  metroKm: number;
  busKm: number;
  acHoursPerDay: number | null; // null when the home has no AC
};

export type CheckInState = {
  weekStart: string; // Monday of this week, "YYYY-MM-DD" (IST)
  done: boolean;
  streak: number; // weeks in a row, answered (not estimated)
  missedWeeks: number; // weeks since the last check-in that will be filled from the routine (max 4)
  prefill: CheckInAnswers;
  hasLast: boolean;
  vehicles: { id: string; name: string; type: string; fuel: string }[];
  hasAc: boolean;
};

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const MAX_FILL = 4;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Monday 00:00 of the IST week containing `now`, as a UTC-midnight date (the calendar day is what matters). */
export function weekStartOf(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const day = (ist.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - day));
}

async function eligibleVehicles(householdId: string) {
  const vs = await db.vehicle.findMany({ where: { householdId }, orderBy: { createdAt: "asc" } });
  return vs.filter((v) => vehicleTripType(v) !== null).map((v) => ({ id: v.id, name: v.name || v.type, type: v.type, fuel: v.fuel, monthlyKm: v.monthlyKm }));
}

async function acDefault(householdId: string): Promise<number | null> {
  const bill = await db.bill.findFirst({ where: { householdId, acHoursPerDay: { gt: 0 } }, orderBy: { periodStart: "desc" } });
  if (bill) return bill.acHoursPerDay;
  const ac = await db.appliance.findFirst({ where: { householdId, type: "AC" }, orderBy: { powerKw: "desc" } });
  return ac ? ac.avgHoursPerDay : null;
}

function parse(answers: string): CheckInAnswers | null {
  try {
    return JSON.parse(answers) as CheckInAnswers;
  } catch {
    return null;
  }
}

export async function getCheckInState(householdId: string, now: Date = new Date()): Promise<CheckInState> {
  const week = weekStartOf(now);
  const [vehicles, ac, checkIns] = await Promise.all([
    eligibleVehicles(householdId),
    acDefault(householdId),
    db.checkIn.findMany({ where: { householdId }, orderBy: { weekStart: "desc" }, take: 60 }),
  ]);
  const answered = checkIns.filter((c) => !c.estimated);
  const last = answered[0] ? parse(answered[0].answers) : null;
  const done = answered.some((c) => c.weekStart.getTime() === week.getTime());

  // streak: answered weeks in a row, counting back from this week (or last week, if this one isn't done yet)
  const weeks = new Set(answered.map((c) => c.weekStart.getTime()));
  let streak = 0;
  for (let t = done ? week.getTime() : week.getTime() - WEEK; weeks.has(t); t -= WEEK) streak++;

  const lastWeek = checkIns[0]?.weekStart.getTime();
  const missedWeeks = lastWeek === undefined || done ? 0 : Math.min(MAX_FILL, Math.max(0, Math.round((week.getTime() - lastWeek) / WEEK) - 1));

  const known = new Set(vehicles.map((v) => v.id));
  const prefill: CheckInAnswers = last
    ? {
        ...last,
        vehicles: vehicles.map((v) => ({ vehicleId: v.id, km: last.vehicles.find((x) => x.vehicleId === v.id)?.km ?? Math.round(v.monthlyKm / 4.35) })),
        acHoursPerDay: ac === null && last.acHoursPerDay === null ? null : last.acHoursPerDay ?? ac,
      }
    : {
        vehicles: vehicles.map((v) => ({ vehicleId: v.id, km: Math.round(v.monthlyKm / 4.35) })),
        metroKm: 0,
        busKm: 0,
        acHoursPerDay: ac,
      };
  prefill.vehicles = prefill.vehicles.filter((v) => known.has(v.vehicleId));

  return {
    weekStart: iso(week),
    done,
    streak,
    missedWeeks,
    prefill,
    hasLast: !!last,
    vehicles: vehicles.map((v) => ({ id: v.id, name: v.name, type: v.type, fuel: v.fuel })),
    hasAc: ac !== null || (last?.acHoursPerDay ?? null) !== null,
  };
}

/** The activities one week's answers stand for (dated on the Thursday, or today if that's still ahead). */
async function activitiesFor(householdId: string, answers: CheckInAnswers, week: Date, now: Date, estimated: boolean) {
  const vehicles = await db.vehicle.findMany({ where: { householdId } });
  const thursday = new Date(week.getTime() + 3 * DAY + 12 * 3600_000);
  const occurredOn = thursday.getTime() > now.getTime() ? now : thursday;
  const source = estimated ? "ROUTINE" : "CHECKIN";
  const tag = estimated ? "Estimated from your weekly routine" : "Weekly check-in";
  const out: CreateActivityInput[] = [];
  for (const a of answers.vehicles) {
    const v = vehicles.find((x) => x.id === a.vehicleId);
    const type = v ? vehicleTripType(v) : null;
    if (!v || !type || !(a.km > 0)) continue;
    out.push({ category: "Transport", type, quantity: a.km, unit: "km", occurredOn, source, notes: `${tag}: ${v.name || v.type}, ${a.km} km` });
  }
  if (answers.metroKm > 0) out.push({ category: "Travel", type: "metro_transit", quantity: answers.metroKm, unit: "km", occurredOn, source, notes: `${tag}: metro, ${answers.metroKm} km` });
  if (answers.busKm > 0) out.push({ category: "Travel", type: "city_bus", quantity: answers.busKm, unit: "km", occurredOn, source, notes: `${tag}: bus, ${answers.busKm} km` });
  if (answers.acHoursPerDay && answers.acHoursPerDay > 0) {
    out.push({
      category: "Electricity",
      type: "ac_cooling",
      quantity: Number((answers.acHoursPerDay * 7).toFixed(2)),
      unit: "hours",
      occurredOn,
      source,
      notes: `${tag}: AC ${answers.acHoursPerDay} h a day × 7 days`,
    });
  }
  return out;
}

/** Removes a week's check-in and the activities it created, and refreshes those months. */
async function clearWeek(householdId: string, week: Date) {
  const acts = await db.activity.findMany({
    where: { householdId, source: { in: ["CHECKIN", "ROUTINE"] }, occurredOn: { gte: week, lt: new Date(week.getTime() + WEEK) } },
    select: { id: true, occurredOn: true },
  });
  if (acts.length) await db.activity.deleteMany({ where: { id: { in: acts.map((a) => a.id) } } });
  await db.checkIn.deleteMany({ where: { householdId, weekStart: week } });
  return new Set(acts.map((a) => `${a.occurredOn.getFullYear()}-${String(a.occurredOn.getMonth() + 1).padStart(2, "0")}`));
}

async function recordWeek(householdId: string, userId: string, answers: CheckInAnswers, week: Date, now: Date, estimated: boolean) {
  const touched = await clearWeek(householdId, week);
  for (const a of await activitiesFor(householdId, answers, week, now, estimated)) {
    await emissionService.calculateAndRecord(householdId, { ...a, memberId: userId });
  }
  await db.checkIn.create({ data: { householdId, weekStart: week, answers: JSON.stringify(answers), estimated, createdById: userId } });
  // months that lost activities and gained none still need their totals refreshed
  for (const month of touched) await emissionService.recalculateMonthSummary(householdId, month);
}

export class CheckInError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function submitCheckIn(householdId: string, userId: string, answers: CheckInAnswers, now: Date = new Date()) {
  const week = weekStartOf(now);
  const known = new Set((await db.vehicle.findMany({ where: { householdId }, select: { id: true } })).map((v) => v.id));
  if (answers.vehicles.some((v) => !known.has(v.vehicleId))) throw new CheckInError("That vehicle isn't in this household.", 404);

  // Missed weeks since the last check-in: filled from the routine (the latest answers), marked Estimated
  const previous = await db.checkIn.findFirst({ where: { householdId, weekStart: { lt: week } }, orderBy: { weekStart: "desc" } });
  let filled = 0;
  if (previous) {
    const routine = parse(previous.answers);
    const gap = Math.round((week.getTime() - previous.weekStart.getTime()) / WEEK) - 1;
    for (let k = Math.min(gap, MAX_FILL); k >= 1 && routine; k--) {
      const missed = new Date(week.getTime() - k * WEEK);
      await recordWeek(householdId, userId, routine, missed, now, true);
      filled++;
    }
  }

  await recordWeek(householdId, userId, answers, week, now, false);
  await db.auditLog.create({
    data: { householdId, userId, action: "checkin.submit", entity: "CheckIn", details: `${iso(week)}${filled ? `, ${filled} missed week(s) estimated` : ""}` },
  });
  return { filled, state: await getCheckInState(householdId, now) };
}
