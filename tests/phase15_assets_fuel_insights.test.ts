import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";

// The engine isn't running in tests: Shapley values for an additive model are each source's kg minus its average
vi.mock("@/server/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/engine")>();
  return {
    ...real,
    engineShapley: vi.fn(async (months: string[], sources: string[], matrix: number[][]) => {
      const mean = sources.map((_, j) => matrix.reduce((s, r) => s + r[j], 0) / matrix.length);
      const totals = matrix.map((r) => r.reduce((a, b) => a + b, 0));
      return {
        months,
        sources,
        base_kg: Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10,
        values: matrix.map((r) => r.map((v, j) => v - mean[j])),
        totals,
        source_totals: sources.map((_, j) => matrix.reduce((s, r) => s + r[j], 0)),
        method: "test closed form",
      };
    }),
  };
});

const { POST: addVehicle } = await import("@/app/api/households/[id]/vehicles/route");
const { PATCH: editVehicle, DELETE: deleteVehicle } = await import("@/app/api/households/[id]/vehicles/[vehicleId]/route");
const { POST: addAppliance } = await import("@/app/api/households/[id]/appliances/route");
const { POST: addFuel, GET: listFuel } = await import("@/app/api/households/[id]/fuel/route");
const { DELETE: deleteFuel } = await import("@/app/api/households/[id]/fuel/[fuelId]/route");
const { getInsights } = await import("@/server/services/insights.service");

const HH = "hh_01_sharma";
const p = <T extends Record<string, string>>(v: T) => ({ params: Promise.resolve(v) });
const req = (url: string, method = "GET", body?: unknown, role?: string) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json", ...(role ? { "x-demo-role": role } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function monthKg(month: string) {
  const s = await db.monthlySummary.findUnique({ where: { householdId_month: { householdId: HH, month } } });
  return s?.totalKg ?? 0;
}

describe("Phase 15: appliances & vehicles, fuel fill-ups, insights", () => {
  it("adds, edits and deletes a vehicle with plain validation; viewers can't", async () => {
    const bad = await addVehicle(req(`/api/households/${HH}/vehicles`, "POST", { name: "", fuel: "Water" }), p({ id: HH }));
    expect(bad.status).toBe(400);
    expect((await addVehicle(req(`/api/households/${HH}/vehicles`, "POST", { name: "Scooty" }, "VIEWER"), p({ id: HH }))).status).toBe(403);

    const res = await addVehicle(
      req(`/api/households/${HH}/vehicles`, "POST", { name: "Activa", type: "TwoWheeler", fuel: "Petrol", kmPerUnit: 45, monthlyKm: 300, year: 2018 }),
      p({ id: HH }),
    );
    expect(res.status).toBe(201);
    const { vehicle } = await res.json();
    expect(vehicle.year).toBe(2018);

    const edited = await editVehicle(req(`/x`, "PATCH", { monthlyKm: 450 }), p({ id: HH, vehicleId: vehicle.id }));
    expect((await edited.json()).vehicle.monthlyKm).toBe(450);
    expect((await deleteVehicle(req(`/x`, "DELETE"), p({ id: HH, vehicleId: vehicle.id }))).status).toBe(200);
    expect(await db.vehicle.count({ where: { id: vehicle.id } })).toBe(0);
  });

  it("validates appliance types and power", async () => {
    const bad = await addAppliance(req(`/api/households/${HH}/appliances`, "POST", { name: "Heater", type: "Spaceship", powerKw: 2 }), p({ id: HH }));
    expect(bad.status).toBe(400);
  });

  it("a fuel fill-up is litres × 2.31 kg, replaces that car's km estimates for the month, and undoes cleanly", async () => {
    const car = await db.vehicle.findFirst({ where: { householdId: HH, fuel: "Petrol" } });
    expect(car).toBeTruthy();
    const before = await monthKg("2026-03");
    const tripsBefore = await db.activity.count({
      where: { householdId: HH, type: "petrol_car", occurredOn: { gte: new Date("2026-03-01"), lt: new Date("2026-04-01") } },
    });
    expect(tripsBefore).toBeGreaterThan(0);

    const res = await addFuel(
      req(`/api/households/${HH}/fuel`, "POST", { vehicleId: car!.id, quantity: 20, amountInr: 1894.4, pricePerUnit: 94.72, filledOn: "2026-03-15", source: "PHOTO" }),
      p({ id: HH }),
    );
    expect(res.status).toBe(201);
    const out = await res.json();
    expect(out.kgCo2e).toBeCloseTo(20 * 2.31, 2);
    expect(out.coveredTrips).toBe(tripsBefore);

    // The month now counts the fill-up instead of the km trips
    const tripKg = (
      await db.emissionEvent.findMany({
        where: { householdId: HH, activity: { type: "petrol_car" }, occurredOn: { gte: new Date("2026-03-01"), lt: new Date("2026-04-01") } },
      })
    ).reduce((s, e) => s + e.kgCo2e, 0);
    expect(await monthKg("2026-03")).toBeCloseTo(before - tripKg + 20 * 2.31, 1);

    const list = await (await listFuel(req(`/x`), p({ id: HH }))).json();
    expect(list.fillUps[0]).toMatchObject({ quantity: 20, unit: "L", source: "PHOTO", estimatedKm: Math.round(20 * car!.kmPerUnit) });

    expect((await deleteFuel(req(`/x`, "DELETE"), p({ id: HH, fuelId: out.id }))).status).toBe(200);
    expect(await monthKg("2026-03")).toBeCloseTo(before, 1);
    expect(await db.activity.count({ where: { householdId: HH, coveredByFuelLogId: { not: null } } })).toBe(0);
  });

  it("electric vehicles can't log fuel", async () => {
    const ev = await db.vehicle.findFirst({ where: { fuel: "Electric" } });
    const res = await addFuel(req(`/api/households/${ev!.householdId}/fuel`, "POST", { vehicleId: ev!.id, quantity: 10, filledOn: "2026-03-10" }), p({ id: ev!.householdId }));
    expect(res.status).toBe(400);
  });

  it("insights: Shapley values add up to each month, sources are named by vehicle, facts match bullets", async () => {
    const ins = await getInsights(HH);
    expect(ins.available).toBe(true);
    expect(ins.months.length).toBeGreaterThanOrEqual(6);
    for (const m of ins.months) {
      const sum = m.drivers.reduce((s, d) => s + d.kg, 0);
      expect(ins.baseKg + sum).toBeCloseTo(m.totalKg, 0);
    }
    expect(ins.sources.map((s) => s.source)).toContain("Honda City (petrol)");
    expect(ins.appliances.length).toBeGreaterThan(0);
    const total = ins.appliances.reduce((s, a) => s + a.sharePct, 0);
    expect(total).toBeGreaterThanOrEqual(99);
    expect(ins.bullets[0]).toContain(String(ins.months[ins.months.length - 1].totalKg));
    expect(ins.facts.total_kg).toBe(ins.months[ins.months.length - 1].totalKg);
  });
});
