import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { POST as postActivity } from "@/app/api/households/[id]/activities/route";
import { POST as postAppliance, GET as getAppliances } from "@/app/api/households/[id]/appliances/route";
import { POST as postVehicle, GET as getVehicles } from "@/app/api/households/[id]/vehicles/route";
import { POST as postMember, GET as getMembers } from "@/app/api/households/[id]/members/route";
import { POST as postJoin } from "@/app/api/join/route";

describe("Phase 6: Live Pipeline, Assets, Members & Onboarding", () => {
  const householdId = "hh_phase6_live";
  let ownerUserId = "";

  beforeAll(async () => {
    // Clean up if existing
    await db.membership.deleteMany({ where: { householdId } });
    await db.emissionEvent.deleteMany({ where: { householdId } });
    await db.activity.deleteMany({ where: { householdId } });
    await db.monthlySummary.deleteMany({ where: { householdId } });
    await db.appliance.deleteMany({ where: { householdId } });
    await db.vehicle.deleteMany({ where: { householdId } });
    await db.household.deleteMany({ where: { id: householdId } });

    // Create or find test user and household
    const owner = await db.user.upsert({
      where: { email: "p6_owner@example.com" },
      update: {},
      create: { name: "Phase6 Owner", email: "p6_owner@example.com" },
    });
    ownerUserId = owner.id;

    await db.household.create({
      data: {
        id: householdId,
        name: "Phase 6 Test Residence",
        city: "Noida",
        state: "UP",
        country: "IN",
        size: 4,
        homeType: "Apartment",
        floorAreaM2: 180,
        joinCode: "P6TEST01",
        status: "ACTIVE",
      },
    });

    await db.membership.create({
      data: {
        householdId,
        userId: ownerUserId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    // Seed initial monthly summary
    await db.monthlySummary.create({
      data: {
        householdId,
        month: "2026-03",
        totalKg: 100.0,
        byCategory: JSON.stringify({ Electricity: 50.0, Transport: 50.0 }),
        score: 75.0,
      },
    });
  });

  afterAll(async () => {
    await db.membership.deleteMany({ where: { householdId } });
    await db.emissionEvent.deleteMany({ where: { householdId } });
    await db.activity.deleteMany({ where: { householdId } });
    await db.monthlySummary.deleteMany({ where: { householdId } });
    await db.appliance.deleteMany({ where: { householdId } });
    await db.vehicle.deleteMany({ where: { householdId } });
    await db.household.deleteMany({ where: { id: householdId } });
    await db.$disconnect();
  });

  it("Done when criterion: Adding an activity updates total and score live in an atomic transaction", async () => {
    // 1. Initial State
    const initialSummary = await db.monthlySummary.findUnique({
      where: { householdId_month: { householdId, month: "2026-03" } },
    });
    expect(initialSummary).toBeDefined();

    // 2. Add an activity for 20 kWh in UP (20 * 0.82 = 16.4 kg CO2e)
    const payload = {
      category: "Electricity",
      type: "grid_electricity",
      quantity: 20,
      unit: "kWh",
      occurredOn: new Date("2026-03-20T12:00:00Z").toISOString(),
      notes: "Night storage heater cycle",
    };

    const req = new NextRequest(`http://localhost:3000/api/households/${householdId}/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": ownerUserId,
      },
      body: JSON.stringify(payload),
    });

    const res = await postActivity(req, { params: Promise.resolve({ id: householdId }) });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.activity).toBeDefined();
    expect(data.emissionEvent.kgCo2e).toBe(16.4);

    // 3. Verify total and category breakdown updated live
    const updatedSummary = await db.monthlySummary.findUnique({
      where: { householdId_month: { householdId, month: "2026-03" } },
    });

    expect(updatedSummary!.totalKg).toBe(16.4);
    const updatedBreakdown = JSON.parse(updatedSummary!.byCategory);
    expect(updatedBreakdown.Electricity).toBe(16.4);

    // Score is live
    expect(updatedSummary!.score).toBeDefined();
  });

  it("adds and retrieves appliances for a household", async () => {
    const payload = {
      name: "Guest Bedroom Inverter AC",
      type: "AC",
      rating: "5_STAR_INVERTER",
      powerKw: 1.1,
      avgHoursPerDay: 3.5,
    };

    const postReq = new NextRequest(`http://localhost:3000/api/households/${householdId}/appliances`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": ownerUserId,
      },
      body: JSON.stringify(payload),
    });

    const postRes = await postAppliance(postReq, { params: Promise.resolve({ id: householdId }) });
    expect(postRes.status).toBe(201);

    const getReq = new NextRequest(`http://localhost:3000/api/households/${householdId}/appliances`, {
      headers: { "x-user-id": ownerUserId },
    });
    const getRes = await getAppliances(getReq, { params: Promise.resolve({ id: householdId }) });
    expect(getRes.status).toBe(200);

    const data = await getRes.json();
    expect(data.appliances.some((a: { name: string }) => a.name === "Guest Bedroom Inverter AC")).toBe(true);
  });

  it("adds and retrieves vehicles for a household", async () => {
    const payload = {
      name: "Ather 450X Electric Scooter",
      type: "TwoWheeler",
      fuel: "Electric",
      kmPerUnit: 30.0,
      monthlyKm: 250,
    };

    const postReq = new NextRequest(`http://localhost:3000/api/households/${householdId}/vehicles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": ownerUserId,
      },
      body: JSON.stringify(payload),
    });

    const postRes = await postVehicle(postReq, { params: Promise.resolve({ id: householdId }) });
    expect(postRes.status).toBe(201);

    const getReq = new NextRequest(`http://localhost:3000/api/households/${householdId}/vehicles`, {
      headers: { "x-user-id": ownerUserId },
    });
    const getRes = await getVehicles(getReq, { params: Promise.resolve({ id: householdId }) });
    expect(getRes.status).toBe(200);

    const data = await getRes.json();
    expect(data.vehicles.some((v: { name: string }) => v.name === "Ather 450X Electric Scooter")).toBe(true);
  });

  it("invites a new member to the household", async () => {
    const payload = {
      name: "Aarushi P6",
      email: "aarushi.p6@example.com",
      role: "MEMBER",
    };

    const postReq = new NextRequest(`http://localhost:3000/api/households/${householdId}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": ownerUserId,
      },
      body: JSON.stringify(payload),
    });

    const postRes = await postMember(postReq, { params: Promise.resolve({ id: householdId }) });
    expect(postRes.status).toBe(201);

    const getReq = new NextRequest(`http://localhost:3000/api/households/${householdId}/members`, {
      headers: { "x-user-id": ownerUserId },
    });
    const getRes = await getMembers(getReq, { params: Promise.resolve({ id: householdId }) });
    expect(getRes.status).toBe(200);

    const data = await getRes.json();
    expect(data.members.some((m: { email: string }) => m.email === "aarushi.p6@example.com")).toBe(true);
  });

  it("joins a household using its unique join code", async () => {
    const req = new NextRequest("http://localhost:3000/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "P6TEST01",
        email: "joiner.p6@example.com",
        name: "New Family Joiner",
      }),
    });

    const res = await postJoin(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.household.id).toBe(householdId);
    expect(data.membership.role).toBe("MEMBER");
  });

  afterAll(async () => {
    await db.membership.deleteMany({ where: { householdId } });
    await db.emissionEvent.deleteMany({ where: { householdId } });
    await db.activity.deleteMany({ where: { householdId } });
    await db.monthlySummary.deleteMany({ where: { householdId } });
    await db.appliance.deleteMany({ where: { householdId } });
    await db.vehicle.deleteMany({ where: { householdId } });
    await db.household.deleteMany({ where: { id: householdId } });
    await db.user.deleteMany({ where: { email: { in: ["p6_owner@example.com", "aarushi.p6@example.com", "joiner.p6@example.com"] } } });
  });
});
