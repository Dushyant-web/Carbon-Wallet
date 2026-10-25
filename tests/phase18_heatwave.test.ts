import { describe, it, expect, vi } from "vitest";
import { db } from "@/server/db";

// The engine isn't running in tests: fixed calibration, weather and heatwave answers
vi.mock("@/server/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/engine")>();
  const heat: Record<string, { date: string; tmax_c: number }[]> = {
    "2024-05-01": [
      { date: "2024-05-20", tmax_c: 46.1 },
      { date: "2024-05-21", tmax_c: 45.4 },
    ],
    "2024-06-01": [{ date: "2024-06-02", tmax_c: 44.8 }],
  };
  return {
    ...real,
    engineCalibrate: vi.fn(async () => ({
      method: "regression",
      n_bills: 2,
      baseload_kwh_per_day: 5,
      ac_kw: 1.2,
      ac_kw_range: [1.0, 1.4],
      latest_bill: { electricity_kwh: 500, electricity_kg: 337.5, ac_kwh: 252, ac_kg: 170, ac_kg_low: 150, ac_kg_high: 190, ac_share_pct: 50 },
    })),
    engineCdd: vi.fn(async (_c: string, _s: string, periods: { start: string; end: string }[]) => ({
      location: { name: "Delhi", admin1: "Delhi", lat: 28.6, lon: 77.2 },
      base_c: 24,
      source: "test",
      periods: periods.map((p) => ({ ...p, days: 31, days_with_data: 31, cdd: 300, mean_temp_c: 34, max_daily_mean_c: 37 })),
    })),
    engineHeatDays: vi.fn(async (_c: string, _s: string, periods: { start: string; end: string }[]) => ({
      location: { name: "Delhi", admin1: "Delhi", lat: 28.6, lon: 77.2 },
      rule: "IMD heat-wave criteria (test)",
      source: "test",
      periods: periods.map((p) => {
        const days = (heat[p.start] ?? []).map((d) => ({ ...d, normal_c: 40.5, departure_c: d.tmax_c - 40.5, why: "test" }));
        return { start: p.start, end: p.end, zone: "plains", days_checked: 30, count: days.length, days };
      }),
    })),
    engineDecompose: vi.fn(async () => ({ before_kg: 100, after_kg: 120, total_change_kg: 20, effects_kg: { weather: 8, behaviour: 12 } })),
  };
});

const { billService } = await import("@/server/services/bill.service");
const { getAcInsights, essentialCoolingByMonth } = await import("@/server/services/acInsights.service");
const { computeRecommendations } = await import("@/server/services/recommendation.service");
const { emissionService } = await import("@/server/services/emission.service");

const HH = "hh_07_khan";

describe("Phase 18: heatwave days are essential cooling", () => {
  it("finds heatwave days per bill, stores them, and sets their cooling apart", async () => {
    const owner = (await db.membership.findFirstOrThrow({ where: { householdId: HH, role: "OWNER" } })).userId;
    await billService.confirm({ householdId: HH, userId: owner, periodStart: "2024-05-01", periodEnd: "2024-06-01", kwh: 450, acHoursPerDay: 6 });
    await billService.confirm({ householdId: HH, userId: owner, periodStart: "2024-06-01", periodEnd: "2024-07-01", kwh: 500, acHoursPerDay: 7 });

    const ac = await getAcInsights(HH);
    expect(ac.heatwave?.totalDays).toBe(3);
    // 1.2 kW × 6 h × 2 days + 1.2 kW × 7 h × 1 day = 22.8 kWh × 0.675
    expect(ac.heatwave?.essentialKg).toBeCloseTo(15.4, 1);
    expect(ac.heatwave?.bills.map((b) => b.essentialKg)).toEqual([9.7, 5.7]);

    const may = await db.bill.findFirstOrThrow({ where: { householdId: HH, periodStart: new Date("2024-05-01") } });
    expect(may.heatDays).toBe(2);
    expect(JSON.parse(may.heatDates!)).toEqual(["2024-05-20", "2024-05-21"]);

    // booked in the month of each heatwave day, from the stored days (no engine call)
    expect(await essentialCoolingByMonth(HH)).toEqual({ "2024-05": 9.7, "2024-06": 5.7 });
  });

  it("never suggests cutting AC on heatwave days", async () => {
    const recs = await computeRecommendations(HH);
    const hour = recs.find((r) => r.code === "ac_one_hour_less")!;
    expect(hour.action).toMatch(/normal days/);
    expect(hour.description).toMatch(/Not on heatwave days/);
    // latest AC bill: 1 heatwave day in 30 → the saving counts 29 normal days at 1.2 kW
    expect(hour.kgSaved).toBeCloseTo(1.2 * 29 * 0.675, 1);
  });

  it("suggests a leak test once an AC gas refill is on record", async () => {
    expect((await computeRecommendations(HH)).some((r) => r.code === "ac_leak_test")).toBe(false);
    await emissionService.calculateAndRecord(HH, {
      category: "Refrigerant",
      type: "refrigerant_r32",
      quantity: 0.8,
      unit: "kg",
      occurredOn: new Date(),
      source: "MANUAL",
    });
    const leak = (await computeRecommendations(HH)).find((r) => r.code === "ac_leak_test");
    expect(leak?.kgSaved).toBeCloseTo((0.8 * 771) / 12, 1);
    expect(leak?.inrSaved).toBe(0); // no made-up refill price
  });
});
