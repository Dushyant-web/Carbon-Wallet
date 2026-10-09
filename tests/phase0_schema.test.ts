import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/server/db";

describe("Phase 0: Prisma Schema & Database Setup", () => {
  beforeAll(async () => {
    // Clean up test data for phase 0 test household
    const testHhId = "hh_test_sharma";
    const testEmail = "arjun.sharma.test@example.com";

    await db.membership.deleteMany({ where: { householdId: testHhId } });
    await db.emissionEvent.deleteMany({ where: { householdId: testHhId } });
    await db.activity.deleteMany({ where: { householdId: testHhId } });
    await db.monthlySummary.deleteMany({ where: { householdId: testHhId } });
    await db.household.deleteMany({ where: { id: testHhId } });
    await db.user.deleteMany({ where: { email: testEmail } });
  });

  afterAll(async () => {
    const testHhId = "hh_test_sharma";
    const testEmail = "arjun.sharma.test@example.com";
    await db.membership.deleteMany({ where: { householdId: testHhId } });
    await db.emissionEvent.deleteMany({ where: { householdId: testHhId } });
    await db.activity.deleteMany({ where: { householdId: testHhId } });
    await db.monthlySummary.deleteMany({ where: { householdId: testHhId } });
    await db.household.deleteMany({ where: { id: testHhId } });
    await db.user.deleteMany({ where: { email: testEmail } });
    await db.$disconnect();
  });

  it("successfully connects to the database", async () => {
    const result = await db.$queryRaw`SELECT 1 as connected`;
    expect(result).toBeDefined();
  });

  it("creates a household, user, and membership with correct foreign keys", async () => {
    const user = await db.user.create({
      data: {
        name: "Arjun Sharma",
        email: "arjun.sharma.test@example.com",
      },
    });
    expect(user.id).toBeDefined();

    const household = await db.household.create({
      data: {
        id: "hh_test_sharma",
        name: "Sharma Residence",
        city: "Noida",
        state: "UP",
        country: "IN",
        size: 4,
        homeType: "Apartment",
        floorAreaM2: 180,
        monthlyBudgetInr: 25000,
        joinCode: "SHARMA123",
        status: "ACTIVE",
      },
    });
    expect(household.id).toBe("hh_test_sharma");

    const membership = await db.membership.create({
      data: {
        householdId: household.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    expect(membership.role).toBe("OWNER");
  });

  it("enforces unique join_code constraint on household", async () => {
    await expect(
      db.household.create({
        data: {
          name: "Duplicate Code Residence",
          city: "Delhi",
          state: "DL",
          size: 2,
          homeType: "Apartment",
          floorAreaM2: 100,
          joinCode: "SHARMA123", // Duplicate
        },
      })
    ).rejects.toThrow();
  });

  it("can insert and query all data model entities", async () => {
    const factor = await db.emissionFactor.upsert({
      where: {
        category_type_region: {
          category: "Electricity",
          type: "test_grid_electricity",
          region: "IN-UP",
        },
      },
      update: {},
      create: {
        category: "Electricity",
        type: "test_grid_electricity",
        unit: "kWh",
        kgCo2ePerUnit: 0.82,
        region: "IN-UP",
        source: "CEA CO2 Baseline Database v19 (2024)",
      },
    });
    expect(factor.id).toBeDefined();

    const activity = await db.activity.create({
      data: {
        householdId: "hh_test_sharma",
        category: "Electricity",
        type: "ac_cooling",
        quantity: 10,
        unit: "kWh",
        occurredOn: new Date(),
        source: "MANUAL",
      },
    });
    expect(activity.id).toBeDefined();

    const event = await db.emissionEvent.create({
      data: {
        householdId: "hh_test_sharma",
        activityId: activity.id,
        factorId: factor.id,
        kgCo2e: 8.2,
        occurredOn: activity.occurredOn,
      },
    });
    expect(event.kgCo2e).toBe(8.2);

    const summary = await db.monthlySummary.create({
      data: {
        householdId: "hh_test_sharma",
        month: "2026-03",
        totalKg: 286.0,
        byCategory: JSON.stringify({ Electricity: 148, Transport: 64 }),
        score: 72,
      },
    });
    expect(summary.totalKg).toBe(286.0);
  });
});
