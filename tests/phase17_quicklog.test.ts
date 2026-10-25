import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { flightKm, greatCircleKm, toActivity, vehicleTripType, FLIGHT_UPLIFT } from "@/lib/quickLog";
import { airport } from "@/lib/airports";
import { billService } from "@/server/services/bill.service";
import { fuelService } from "@/server/services/fuel.service";

const { POST: logActivity } = await import("@/app/api/households/[id]/activities/route");

const p = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (hh: string, body: unknown, preview = false) =>
  logActivity(
    new NextRequest(`http://localhost:3000/api/households/${hh}/activities${preview ? "?preview=1" : ""}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-role": "OWNER" },
      body: JSON.stringify(body),
    }),
    p(hh)
  );
const ownerOf = async (hh: string) => (await db.membership.findFirstOrThrow({ where: { householdId: hh, role: "OWNER" } })).userId;
const summary = (hh: string, month: string) => db.monthlySummary.findUnique({ where: { householdId_month: { householdId: hh, month } } });

describe("Phase 17: quick log", () => {
  it("works out flight distances like DEFRA (great circle + 8%)", () => {
    const gc = greatCircleKm(airport("DEL")!, airport("BOM")!);
    expect(gc).toBeGreaterThan(1120); // Delhi–Mumbai is ~1,140 km as the crow flies
    expect(gc).toBeLessThan(1160);
    expect(flightKm("DEL", "BOM", false)).toBe(Math.round(gc * FLIGHT_UPLIFT));
    expect(flightKm("DEL", "BOM", true)).toBe(Math.round(gc * FLIGHT_UPLIFT * 2));
    expect(flightKm("DEL", "DEL", false)).toBeNull();
    expect(flightKm("DEL", "XXX", false)).toBeNull();
  });

  it("turns everyday answers into activities", () => {
    expect(toActivity({ kind: "lpg", cylinders: 2, cylinderKg: 14.2 })).toMatchObject({ category: "Food", type: "lpg_cooking", quantity: 28.4, unit: "kg" });
    expect(toActivity({ kind: "ac_gas", gas: "R32", kg: 0.8 })).toMatchObject({ category: "Refrigerant", type: "refrigerant_r32", quantity: 0.8 });
    expect(toActivity({ kind: "ac_gas", gas: "R32", kg: 12 })).toBeNull(); // no home AC holds that much
    expect(toActivity({ kind: "transit", mode: "bus", km: 12 })).toMatchObject({ category: "Travel", type: "city_bus", quantity: 12 });
    expect(vehicleTripType({ type: "Car", fuel: "CNG" })).toBe("cng_car");
    expect(vehicleTripType({ type: "TwoWheeler", fuel: "Electric" })).toBeNull(); // no sourced factor yet
    expect(vehicleTripType({ type: "ThreeWheeler", fuel: "CNG" })).toBeNull();
  });

  it("previews with the real factor and saves nothing; a missing factor is synced from the registry", async () => {
    await db.emissionFactor.deleteMany({ where: { type: "city_bus" } }); // as on a database seeded before buses existed
    const before = await db.activity.count({ where: { householdId: "hh_03_verma" } });
    const lpg = await post("hh_03_verma", { ...toActivity({ kind: "lpg", cylinders: 1, cylinderKg: 14.2 }), occurredOn: "2023-05-10T12:00:00Z" }, true);
    expect(lpg.status).toBe(200);
    expect((await lpg.json()).kgCo2e).toBeCloseTo(14.2 * 2.98, 3);
    const bus = await post("hh_03_verma", { ...toActivity({ kind: "transit", mode: "bus", km: 10 }), occurredOn: "2023-05-10T12:00:00Z" }, true);
    expect(bus.status).toBe(200);
    expect((await bus.json()).kgCo2e).toBeCloseTo(0.152, 3);
    expect(await db.activity.count({ where: { householdId: "hh_03_verma" } })).toBe(before);
  });

  it("books an AC gas refill as its own line in that month", async () => {
    const res = await post("hh_03_verma", { ...toActivity({ kind: "ac_gas", gas: "R32", kg: 0.8 }), occurredOn: "2023-05-12T12:00:00Z" });
    expect(res.status).toBe(201);
    const s = await summary("hh_03_verma", "2023-05");
    expect(JSON.parse(s!.byCategory).Refrigerant).toBeCloseTo(616.8, 1); // 0.8 kg × GWP 771
  });

  it("never counts electricity twice: AC hours inside a billed period are kept as a note", async () => {
    await billService.confirm({ householdId: "hh_04_kapoor", userId: await ownerOf("hh_04_kapoor"), periodStart: "2023-06-01", periodEnd: "2023-07-01", kwh: 300, acHoursPerDay: 0 });
    const kgBefore = (await summary("hh_04_kapoor", "2023-06"))!.totalKg;
    const ac = { category: "Electricity", type: "ac_cooling", quantity: 6, unit: "hours", occurredOn: "2023-06-15T12:00:00Z" };
    const pv = await (await post("hh_04_kapoor", ac, true)).json();
    expect(pv.counted).toBe(false);
    expect(pv.coveredBy).toBe("bill");
    const res = await (await post("hh_04_kapoor", ac)).json();
    const saved = await db.activity.findUnique({ where: { id: res.activity.id } });
    expect(saved?.coveredByBillId).toBeTruthy();
    expect((await summary("hh_04_kapoor", "2023-06"))!.totalKg).toBeCloseTo(kgBefore, 2);
  });

  it("never counts a car twice: km logged after that month's fill-ups are kept as a note", async () => {
    const cng = await db.vehicle.findFirstOrThrow({ where: { householdId: "hh_06_gupta", fuel: "CNG" } });
    await fuelService.confirm({ householdId: "hh_06_gupta", userId: await ownerOf("hh_06_gupta"), vehicleId: cng.id, quantity: 8, filledOn: "2023-07-05", source: "MANUAL" });
    const kgBefore = (await summary("hh_06_gupta", "2023-07"))!.totalKg;
    const trip = { ...toActivity({ kind: "drive", vehicle: cng, km: 40 }), occurredOn: "2023-07-20T12:00:00Z" };
    const res = await (await post("hh_06_gupta", trip)).json();
    const saved = await db.activity.findUnique({ where: { id: res.activity.id } });
    expect(saved?.coveredByFuelLogId).toBeTruthy();
    expect((await summary("hh_06_gupta", "2023-07"))!.totalKg).toBeCloseTo(kgBefore, 2);
    // a different month has no fill-up, so the trip counts there
    const other = await (await post("hh_06_gupta", { ...trip, occurredOn: "2023-08-20T12:00:00Z" })).json();
    expect((await db.activity.findUnique({ where: { id: other.activity.id } }))?.coveredByFuelLogId).toBeNull();
  });

  it("counts a solar bill by what the home drew from the grid, never subtracting exported solar", async () => {
    const owner = await ownerOf("hh_05_singh");
    // net metering: 350 kWh imported, 150 kWh of rooftop solar exported, 200 kWh billed
    await billService.confirm({ householdId: "hh_05_singh", userId: owner, periodStart: "2023-09-01", periodEnd: "2023-10-01", kwh: 200, importKwh: 350, exportKwh: 150 });
    const s = await summary("hh_05_singh", "2023-09");
    expect(JSON.parse(s!.byCategory).Electricity).toBeCloseTo(350 * 0.675, 1);
    // an import smaller than the billed units can't be right, so the billed units are used
    await billService.confirm({ householdId: "hh_05_singh", userId: owner, periodStart: "2023-11-01", periodEnd: "2023-12-01", kwh: 200, importKwh: 120 });
    expect(JSON.parse((await summary("hh_05_singh", "2023-11"))!.byCategory).Electricity).toBeCloseTo(200 * 0.675, 1);
  });
});
