import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { weekStartOf } from "@/server/services/checkin.service";
import { billService } from "@/server/services/bill.service";

const { GET, POST } = await import("@/app/api/households/[id]/checkins/route");

const at = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};
const call = (hh: string, method: "GET" | "POST", role: string, body?: unknown) =>
  (method === "GET" ? GET : POST)(
    new NextRequest(`http://localhost:3000/api/households/${hh}/checkins`, {
      method,
      headers: { "content-type": "application/json", "x-demo-role": role },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: hh }) }
  );
const weekActs = (hh: string, mondayIso: string) =>
  db.activity.findMany({
    where: { householdId: hh, source: { in: ["CHECKIN", "ROUTINE"] }, occurredOn: { gte: new Date(mondayIso), lt: new Date(new Date(mondayIso).getTime() + 7 * 86_400_000) } },
  });

afterEach(() => vi.useRealTimers());

describe("Phase 20: the weekly check-in", () => {
  it("knows which IST week it is", () => {
    expect(weekStartOf(new Date("2026-04-15T04:30:00Z")).toISOString().slice(0, 10)).toBe("2026-04-13"); // Wednesday
    expect(weekStartOf(new Date("2026-04-19T17:00:00Z")).toISOString().slice(0, 10)).toBe("2026-04-13"); // Sunday 22:30 IST
    expect(weekStartOf(new Date("2026-04-19T19:00:00Z")).toISOString().slice(0, 10)).toBe("2026-04-20"); // Monday 00:30 IST
  });

  // Dates before the seeded year, so no household's reporting month changes for the other suites
  it("prefills from the home's own car and AC, then records the week as activities", async () => {
    at("2023-04-12T06:00:00Z");
    const HH = "hh_01_sharma";
    const state = await (await call(HH, "GET", "OWNER")).json();
    expect(state.weekStart).toBe("2023-04-10");
    expect(state.done).toBe(false);
    expect(state.vehicles.length).toBeGreaterThan(0);
    const car = state.vehicles[0];
    expect(state.prefill.vehicles[0].vehicleId).toBe(car.id);

    const res = await call(HH, "POST", "OWNER", { vehicles: [{ vehicleId: car.id, km: 120 }], metroKm: 30, busKm: 0, acHoursPerDay: 6 });
    expect(res.status).toBe(201);
    const out = await res.json();
    expect(out.state.done).toBe(true);
    expect(out.state.streak).toBe(1);
    const acts = await weekActs(HH, "2023-04-10");
    expect(acts.map((a) => a.type).sort()).toEqual(["ac_cooling", "metro_transit", "petrol_car"]);
    expect(acts.find((a) => a.type === "ac_cooling")?.quantity).toBe(42);

    // answering again replaces the week rather than adding to it
    await call(HH, "POST", "OWNER", { vehicles: [{ vehicleId: car.id, km: 80 }], metroKm: 0, busKm: 0, acHoursPerDay: 6 });
    const again = await weekActs(HH, "2023-04-10");
    expect(again.map((a) => a.type).sort()).toEqual(["ac_cooling", "petrol_car"]);
    expect(again.find((a) => a.type === "petrol_car")?.quantity).toBe(80);
    expect(await db.checkIn.count({ where: { householdId: HH, weekStart: new Date("2023-04-10") } })).toBe(1);

    // next time, "same as last week" starts from these answers
    at("2023-04-19T06:00:00Z");
    const next = await (await call(HH, "GET", "OWNER")).json();
    expect(next.prefill.vehicles[0].km).toBe(80);
    expect(next.hasLast).toBe(true);
  });

  it("fills missed weeks from the routine as estimates, never as zero, and they don't count for the streak", async () => {
    const HH = "hh_01_sharma";
    at("2023-05-03T06:00:00Z"); // two full weeks after 10 April's week were skipped
    const state = await (await call(HH, "GET", "OWNER")).json();
    expect(state.missedWeeks).toBe(2);
    const out = await (await call(HH, "POST", "OWNER", { ...state.prefill })).json();
    expect(out.filled).toBe(2);
    const missed = await db.checkIn.findMany({ where: { householdId: HH, estimated: true } });
    expect(missed.map((c) => c.weekStart.toISOString().slice(0, 10)).sort()).toEqual(["2023-04-17", "2023-04-24"]);
    expect((await weekActs(HH, "2023-04-17")).every((a) => a.source === "ROUTINE")).toBe(true);
    expect(out.state.streak).toBe(1); // estimated weeks don't continue a streak
  });

  it("never counts AC hours twice when a bill already covers that week", async () => {
    const HH = "hh_09_iyer";
    const owner = (await db.membership.findFirstOrThrow({ where: { householdId: HH, role: "OWNER" } })).userId;
    await billService.confirm({ householdId: HH, userId: owner, periodStart: "2023-02-01", periodEnd: "2023-03-01", kwh: 260, acHoursPerDay: 0 });
    at("2023-02-15T06:00:00Z");
    const before = (await db.monthlySummary.findUniqueOrThrow({ where: { householdId_month: { householdId: HH, month: "2023-02" } } })).totalKg;
    await call(HH, "POST", "OWNER", { vehicles: [], metroKm: 0, busKm: 0, acHoursPerDay: 5 });
    const ac = (await weekActs(HH, "2023-02-13")).find((a) => a.type === "ac_cooling");
    expect(ac?.coveredByBillId).toBeTruthy();
    expect((await db.monthlySummary.findUniqueOrThrow({ where: { householdId_month: { householdId: HH, month: "2023-02" } } })).totalKg).toBeCloseTo(before, 2);
  });

  it("checks roles and vehicles", async () => {
    at("2023-04-12T06:00:00Z");
    expect((await call("hh_02_mehta", "POST", "VIEWER", { vehicles: [], metroKm: 1, busKm: 0, acHoursPerDay: null })).status).toBe(403);
    expect((await call("hh_02_mehta", "POST", "MEMBER", { vehicles: [], metroKm: 1, busKm: 0, acHoursPerDay: null })).status).toBe(403); // family only adds bills
    expect((await call("hh_02_mehta", "POST", "OWNER", { vehicles: [{ vehicleId: "not-mine", km: 5 }], metroKm: 0, busKm: 0, acHoursPerDay: null })).status).toBe(404);
    expect((await call("hh_02_mehta", "POST", "OWNER", { vehicles: [], metroKm: -1, busKm: 0, acHoursPerDay: null })).status).toBe(400);
  });
});
