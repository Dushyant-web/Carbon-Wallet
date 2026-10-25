import { describe, it, expect, afterEach, vi } from "vitest";
import { db } from "@/server/db";

// Weather for the two bill periods: the "after" bill is either cooler or hotter than the "before" one
const cdd: Record<string, number> = { "2024-04-01": 200 };
vi.mock("@/server/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/engine")>();
  return {
    ...real,
    engineCdd: vi.fn(async (_c: string, _s: string, periods: { start: string; end: string }[]) => ({
      location: { name: "Kolkata", admin1: "West Bengal", lat: 22.6, lon: 88.4 },
      base_c: 24,
      source: "test",
      periods: periods.map((p) => ({ ...p, days: 30, days_with_data: 30, cdd: cdd[p.start] ?? 0, mean_temp_c: 30, max_daily_mean_c: 33 })),
    })),
  };
});

const { commitmentFields, billCheck, fuelCheck, verifyCommitments } = await import("@/server/services/commitment.service");

afterEach(() => vi.useRealTimers());
const ownerOf = async (hh: string) => (await db.membership.findFirstOrThrow({ where: { householdId: hh, role: "OWNER" } })).userId;

describe("Phase 21: commit, then verify against bills and fill-ups", () => {
  it("records the month to check and an expected range", () => {
    const f = commitmentFields(30, new Date("2026-04-10T06:00:00Z"));
    expect(f).toMatchObject({ commitMonth: "2026-05", expectedLow: 21, expectedHigh: 39, verification: null });
  });

  it("measures electricity against a weather-adjusted counterfactual from the bill before", async () => {
    const HH = "hh_10_roy";
    await db.calibration.create({ data: { householdId: HH, acKw: 1.5, acKwLow: 1.2, acKwHigh: 1.8, baseloadKwhDay: 5, method: "regression", nBills: 3 } });
    await db.bill.create({ data: { householdId: HH, periodStart: new Date("2024-04-01"), periodEnd: new Date("2024-05-01"), kwh: 450, source: "MANUAL" } });
    await db.bill.create({ data: { householdId: HH, periodStart: new Date("2024-05-15"), periodEnd: new Date("2024-06-14"), kwh: 380, source: "MANUAL" } });
    const committed = new Date("2024-05-10T10:00:00Z");

    // hotter after (260 vs 200 degree-days): expected 150 + 300/200 × 260 = 540 kWh, actual 380 → 160 kWh saved
    cdd["2024-05-15"] = 260;
    const hot = (await billCheck(HH, committed))!;
    expect(hot.verification).toBe("BILL");
    expect(hot.realizedKg).toBeCloseTo(160 * 0.675, 1);
    expect(hot.note).toMatch(/adjusting for the weather/);

    // cooler after (100): expected 150 + 150 = 300 kWh, actual 380 → no saving, and we say so
    cdd["2024-05-15"] = 100;
    const cool = (await billCheck(HH, committed))!;
    expect(cool.realizedKg).toBeCloseTo(-80 * 0.675, 1);
    expect(cool.note).toMatch(/didn't show a saving/);

    // no bill wholly after the commitment → nothing to measure yet
    expect(await billCheck(HH, new Date("2024-07-01T00:00:00Z"))).toBeNull();
  });

  it("measures a car commitment from fill-ups against the 3 months before", async () => {
    const HH = "hh_04_kapoor";
    const suv = await db.vehicle.findFirstOrThrow({ where: { householdId: HH } });
    const owner = await ownerOf(HH);
    const fill = (filledOn: string, quantity: number) =>
      db.fuelLog.create({ data: { householdId: HH, vehicleId: suv.id, fuel: "Diesel", quantity, filledOn: new Date(filledOn), kgCo2e: quantity * 2.68, source: "MANUAL", createdById: owner } });
    await fill("2022-02-10", 40);
    await fill("2022-03-10", 44);
    await fill("2022-04-10", 36);
    await fill("2022-05-12", 30);
    const out = (await fuelCheck(HH, "2022-05"))!;
    expect(out.verification).toBe("FUEL");
    expect(out.realizedKg).toBeCloseTo((40 - 30) * 2.68, 1);
    expect(await fuelCheck(HH, "2022-07")).toBeNull(); // no fill-ups that month
  });

  it("counts a commitment at half once its month is over without data, and upgrades it when data arrives", async () => {
    const HH = "hh_04_kapoor";
    const rec = await db.recommendation.create({
      data: {
        householdId: HH,
        action: "Take the metro for 1 in 5 car trips",
        category: "Transport",
        kgSaved: 40,
        inrSaved: 500,
        difficulty: "MEDIUM",
        status: "ACCEPTED",
        appliedAt: new Date("2022-08-20T10:00:00Z"),
        ...commitmentFields(40, new Date("2022-08-20T10:00:00Z")),
      },
    });
    expect(rec.commitMonth).toBe("2022-09");

    await verifyCommitments(HH, new Date("2022-09-15T06:00:00Z")); // month not over yet
    expect((await db.recommendation.findUniqueOrThrow({ where: { id: rec.id } })).verification).toBeNull();

    await verifyCommitments(HH, new Date("2022-10-05T06:00:00Z")); // over, nothing measured
    const declared = await db.recommendation.findUniqueOrThrow({ where: { id: rec.id } });
    expect(declared.verification).toBe("DECLARED");
    expect(declared.realizedKg).toBe(20); // half of the expected 40

    const suv = await db.vehicle.findFirstOrThrow({ where: { householdId: HH } });
    const owner = await ownerOf(HH);
    for (const [d, q] of [["2022-06-10", 50], ["2022-07-10", 50], ["2022-08-10", 50], ["2022-09-10", 35]] as const) {
      await db.fuelLog.create({ data: { householdId: HH, vehicleId: suv.id, fuel: "Diesel", quantity: q, filledOn: new Date(d), kgCo2e: q * 2.68, source: "MANUAL", createdById: owner } });
    }
    await verifyCommitments(HH, new Date("2022-10-06T06:00:00Z"));
    const measured = await db.recommendation.findUniqueOrThrow({ where: { id: rec.id } });
    expect(measured.verification).toBe("FUEL");
    expect(measured.realizedKg).toBeCloseTo(15 * 2.68, 1);
  });
});
