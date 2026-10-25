import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";
import { seedEmissionFactors } from "@/server/factors/registry";
import { emissionService } from "@/server/services/emission.service";
import { activityRepository } from "@/server/repositories/activity.repository";
import { summaryRepository } from "@/server/repositories/summary.repository";

describe("Phase 1: Factor Registry & Emission Service", () => {
  const sharmaHouseholdId = "hh_phase1_sharma";
  const khanHouseholdId = "hh_phase1_khan";

  beforeAll(async () => {
    // Clean and seed factors
    await seedEmissionFactors();

    // Clean up test households
    await db.emissionEvent.deleteMany({
      where: { householdId: { in: [sharmaHouseholdId, khanHouseholdId] } },
    });
    await db.activity.deleteMany({
      where: { householdId: { in: [sharmaHouseholdId, khanHouseholdId] } },
    });
    await db.monthlySummary.deleteMany({
      where: { householdId: { in: [sharmaHouseholdId, khanHouseholdId] } },
    });
    await db.membership.deleteMany({
      where: { householdId: { in: [sharmaHouseholdId, khanHouseholdId] } },
    });
    await db.household.deleteMany({
      where: { id: { in: [sharmaHouseholdId, khanHouseholdId] } },
    });

    // Create Sharma Household (Noida, Uttar Pradesh -> CEA v22 all-India grid: 0.675 kg/kWh)
    await db.household.create({
      data: {
        id: sharmaHouseholdId,
        name: "Sharma Residence",
        city: "Noida",
        state: "UP",
        country: "IN",
        size: 4,
        homeType: "Apartment",
        floorAreaM2: 180,
        joinCode: "SHARMA_P1",
      },
    });

    // Create Khan Household (Bengaluru, Karnataka -> IN-KA grid: 0.67 kg/kWh)
    await db.household.create({
      data: {
        id: khanHouseholdId,
        name: "Khan Household",
        city: "Bengaluru",
        state: "KA",
        country: "IN",
        size: 3,
        homeType: "Villa",
        floorAreaM2: 140,
        joinCode: "KHAN_P1",
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("resolves every region to the CEA v22 all-India grid factor", async () => {
    const upGrid = await db.emissionFactor.findUnique({
      where: {
        category_type_region: {
          category: "Electricity",
          type: "grid_electricity",
          region: "IN-UP",
        },
      },
    });
    expect(upGrid).toBeDefined();
    expect(upGrid?.kgCo2ePerUnit).toBe(0.675);
    expect(upGrid?.source).toContain("CEA");

    const kaGrid = await db.emissionFactor.findUnique({
      where: {
        category_type_region: {
          category: "Electricity",
          type: "grid_electricity",
          region: "IN-KA",
        },
      },
    });
    expect(kaGrid?.kgCo2ePerUnit).toBe(0.675);

    const mhGrid = await db.emissionFactor.findUnique({
      where: {
        category_type_region: {
          category: "Electricity",
          type: "grid_electricity",
          region: "IN-MH",
        },
      },
    });
    expect(mhGrid?.kgCo2ePerUnit).toBe(0.675);
  });

  it("Done when criterion: AC 6 h gives the expected kg (6h @ 1.5 kW = 9 kWh * 0.675 = 6.075 kg CO2e)", async () => {
    // Logging AC for 6 hours in Uttar Pradesh (1.5 kW default for standard 1.5-Ton inverter AC)
    const result = await emissionService.calculateAndRecord(sharmaHouseholdId, {
      category: "Electricity",
      type: "ac_cooling",
      quantity: 6,
      unit: "hours",
      powerKw: 1.5,
      occurredOn: new Date("2026-03-15T14:00:00Z"),
      source: "MANUAL",
      notes: "Living room afternoon cooling",
    });

    expect(result.computation.effectiveQuantity).toBe(9.0); // 6 h * 1.5 kW = 9 kWh
    expect(result.computation.effectiveUnit).toBe("kWh");
    expect(result.computation.factorValue).toBe(0.675);
    expect(result.computation.kgCo2e).toBe(6.075); // 9 * 0.675 (CEA v22)
    expect(result.emissionEvent.kgCo2e).toBe(6.075);
    expect(result.monthlySummary.totalKg).toBe(6.08);

    const parsedBreakdown = JSON.parse(result.monthlySummary.byCategory);
    expect(parsedBreakdown.Electricity).toBe(6.08);
  });

  it("gives the same kg for the same activity in every state (single national grid)", async () => {
    // Same 6 hours AC in Karnataka: CEA publishes one all-India factor, so the result matches UP
    const resultKhan = await emissionService.calculateAndRecord(khanHouseholdId, {
      category: "Electricity",
      type: "ac_cooling",
      quantity: 6,
      unit: "hours",
      powerKw: 1.5,
      occurredOn: new Date("2026-03-15T14:00:00Z"),
      source: "MANUAL",
    });

    // 9 kWh * 0.675 = 6.075 kg CO2e
    expect(resultKhan.computation.kgCo2e).toBe(6.075);
    expect(resultKhan.emissionEvent.kgCo2e).toBe(6.075);
  });

  it("enforces category drill-down: AC is part of Electricity and category totals sum to household total", async () => {
    // Add petrol car travel to Sharma (20 km * 0.165 = 3.30 kg)
    await emissionService.calculateAndRecord(sharmaHouseholdId, {
      category: "Transport",
      type: "petrol_car",
      quantity: 20,
      unit: "km",
      occurredOn: new Date("2026-03-16T10:00:00Z"),
      source: "MANUAL",
    });

    // Add another electricity activity (refrigerator & lighting: 5 kWh * 0.675 = 3.375 kg)
    const latest = await emissionService.calculateAndRecord(sharmaHouseholdId, {
      category: "Electricity",
      type: "grid_electricity",
      quantity: 5,
      unit: "kWh",
      occurredOn: new Date("2026-03-17T09:00:00Z"),
      source: "SMART_METER",
    });

    const summary = latest.monthlySummary;
    const breakdown = JSON.parse(summary.byCategory);

    // Electricity total = 6.08 (AC) + 3.38 (General) = 9.46 kg (rounded per event)
    expect(breakdown.Electricity).toBe(9.46);
    expect(breakdown.Transport).toBe(3.30);

    // Sum of categories must exactly equal monthly total
    const sumCategories = Object.values(breakdown as Record<string, number>).reduce(
      (acc, val) => acc + val,
      0
    );
    expect(Number(sumCategories.toFixed(2))).toBe(summary.totalKg);
    expect(summary.totalKg).toBe(12.76);
  });

  it("enforces tenant isolation: activity in Sharma does not affect Khan", async () => {
    const khanSummary = await summaryRepository.getMonthlySummary(khanHouseholdId, "2026-03");
    expect(khanSummary?.totalKg).toBe(6.08);

    const sharmaSummary = await summaryRepository.getMonthlySummary(sharmaHouseholdId, "2026-03");
    expect(sharmaSummary?.totalKg).toBe(12.76);

    const khanActivities = await activityRepository.listActivities(khanHouseholdId);
    expect(khanActivities.length).toBe(1);

    const sharmaActivities = await activityRepository.listActivities(sharmaHouseholdId);
    expect(sharmaActivities.length).toBe(3);
  });

  afterAll(async () => {
    await db.emissionEvent.deleteMany({
      where: { householdId: { in: [sharmaHouseholdId, khanHouseholdId] } },
    });
    await db.activity.deleteMany({
      where: { householdId: { in: [sharmaHouseholdId, khanHouseholdId] } },
    });
    await db.monthlySummary.deleteMany({
      where: { householdId: { in: [sharmaHouseholdId, khanHouseholdId] } },
    });
    await db.membership.deleteMany({
      where: { householdId: { in: [sharmaHouseholdId, khanHouseholdId] } },
    });
    await db.household.deleteMany({
      where: { id: { in: [sharmaHouseholdId, khanHouseholdId] } },
    });
  });
});
