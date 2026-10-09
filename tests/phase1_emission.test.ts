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

    // Create Sharma Household (Noida, Uttar Pradesh -> IN-UP grid: 0.82 kg/kWh)
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

  it("verifies versioned Indian state-level emission factors in registry", async () => {
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
    expect(upGrid?.kgCo2ePerUnit).toBe(0.82);
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
    expect(kaGrid?.kgCo2ePerUnit).toBe(0.67);

    const mhGrid = await db.emissionFactor.findUnique({
      where: {
        category_type_region: {
          category: "Electricity",
          type: "grid_electricity",
          region: "IN-MH",
        },
      },
    });
    expect(mhGrid?.kgCo2ePerUnit).toBe(0.79);
  });

  it("Done when criterion: AC 6 h gives the expected kg (6h @ 1.5 kW in UP = 9 kWh * 0.82 = 7.38 kg CO2e)", async () => {
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
    expect(result.computation.factorValue).toBe(0.82);
    expect(result.computation.kgCo2e).toBe(7.38); // 9 * 0.82 = 7.38 kg CO2e
    expect(result.emissionEvent.kgCo2e).toBe(7.38);
    expect(result.monthlySummary.totalKg).toBe(7.38);

    const parsedBreakdown = JSON.parse(result.monthlySummary.byCategory);
    expect(parsedBreakdown.Electricity).toBe(7.38);
  });

  it("computes different emissions for same activity in different states due to grid mix", async () => {
    // Same 6 hours AC in Karnataka (greener grid: 0.67 kg/kWh vs UP: 0.82 kg/kWh)
    const resultKhan = await emissionService.calculateAndRecord(khanHouseholdId, {
      category: "Electricity",
      type: "ac_cooling",
      quantity: 6,
      unit: "hours",
      powerKw: 1.5,
      occurredOn: new Date("2026-03-15T14:00:00Z"),
      source: "MANUAL",
    });

    // 9 kWh * 0.67 = 6.03 kg CO2e
    expect(resultKhan.computation.kgCo2e).toBe(6.03);
    expect(resultKhan.emissionEvent.kgCo2e).toBe(6.03);
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

    // Add another electricity activity (refrigerator & lighting: 5 kWh * 0.82 = 4.10 kg)
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

    // Electricity total = 7.38 (AC) + 4.10 (General) = 11.48 kg
    expect(breakdown.Electricity).toBe(11.48);
    expect(breakdown.Transport).toBe(3.30);

    // Sum of categories must exactly equal monthly total
    const sumCategories = Object.values(breakdown as Record<string, number>).reduce(
      (acc, val) => acc + val,
      0
    );
    expect(Number(sumCategories.toFixed(2))).toBe(summary.totalKg);
    expect(summary.totalKg).toBe(14.78);
  });

  it("enforces tenant isolation: activity in Sharma does not affect Khan", async () => {
    const khanSummary = await summaryRepository.getMonthlySummary(khanHouseholdId, "2026-03");
    expect(khanSummary?.totalKg).toBe(6.03);

    const sharmaSummary = await summaryRepository.getMonthlySummary(sharmaHouseholdId, "2026-03");
    expect(sharmaSummary?.totalKg).toBe(14.78);

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
