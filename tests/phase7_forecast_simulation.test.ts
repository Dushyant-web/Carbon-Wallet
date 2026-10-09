import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { GET as getForecast, POST as simulateForecast } from "@/app/api/households/[id]/forecast/route";
import { POST as applyRecommendation } from "@/app/api/households/[id]/recommendations/[rid]/apply/route";

describe("Phase 7: Carbon Twin, What-If Simulator & Forecast Engine", () => {
  const householdId = "hh_03_verma";
  let ownerUserId = "";
  let viewerUserId = "";
  let targetRecId = "";

  beforeAll(async () => {
    const ownerMembership = await db.membership.findFirst({
      where: { householdId, role: "OWNER" },
    });
    ownerUserId = ownerMembership?.userId || "";

    // Create a viewer for Verma
    const viewer = await db.user.upsert({
      where: { email: "verma_viewer@example.com" },
      update: {},
      create: { name: "Verma Viewer", email: "verma_viewer@example.com" },
    });
    viewerUserId = viewer.id;

    await db.membership.upsert({
      where: { householdId_userId: { householdId, userId: viewer.id } },
      update: { role: "VIEWER" },
      create: { householdId, userId: viewer.id, role: "VIEWER" },
    });

    // Reset recommendations for Verma to PENDING
    await db.recommendation.updateMany({
      where: { householdId },
      data: { status: "PENDING", appliedAt: null },
    });

    const rec = await db.recommendation.findFirst({
      where: { householdId },
    });
    targetRecId = rec?.id || "";
  });

  afterAll(async () => {
    // Reset back
    await db.recommendation.updateMany({
      where: { householdId },
      data: { status: "PENDING", appliedAt: null },
    });
    await db.$disconnect();
  });

  it("Done when criterion: Applying an action changes the forecast projection dynamically", async () => {
    // 1. Initial Forecast before action
    const reqInitial = new NextRequest(`http://localhost:3000/api/households/${householdId}/forecast`, {
      headers: { "x-user-id": ownerUserId },
    });
    const resInitial = await getForecast(reqInitial, { params: Promise.resolve({ id: householdId }) });
    expect(resInitial.status).toBe(200);

    const initialData = await resInitial.json();
    expect(initialData.totalCommittedSavingsKg).toBe(0);
    // Baseline equals withActions when no actions applied
    expect(initialData.projection[0].withActionsKg).toBe(initialData.projection[0].baselineKg);

    // 2. Apply Recommendation
    const applyReq = new NextRequest(
      `http://localhost:3000/api/households/${householdId}/recommendations/${targetRecId}/apply`,
      {
        method: "POST",
        headers: { "x-user-id": ownerUserId },
      }
    );
    const applyRes = await applyRecommendation(applyReq, {
      params: Promise.resolve({ id: householdId, rid: targetRecId }),
    });
    expect(applyRes.status).toBe(200);

    const applyData = await applyRes.json();
    expect(applyData.recommendation.status).toBe("ACCEPTED");

    // 3. Updated Forecast after action
    const reqUpdated = new NextRequest(`http://localhost:3000/api/households/${householdId}/forecast`, {
      headers: { "x-user-id": ownerUserId },
    });
    const resUpdated = await getForecast(reqUpdated, { params: Promise.resolve({ id: householdId }) });
    expect(resUpdated.status).toBe(200);

    const updatedData = await resUpdated.json();
    expect(updatedData.totalCommittedSavingsKg).toBeGreaterThan(0);
    // With actions is now strictly lower than baseline
    expect(updatedData.projection[0].withActionsKg).toBeLessThan(updatedData.projection[0].baselineKg);
    expect(updatedData.projection[0].avoidedKg).toBeGreaterThan(0);

    // 4. Verify audit log was recorded
    const audit = await db.auditLog.findFirst({
      where: { householdId, action: "recommendation.apply" },
    });
    expect(audit).toBeDefined();
    expect(audit?.entity).toBe("Recommendation");
  });

  it("blocks Viewer from applying recommendations with 403 Forbidden", async () => {
    const applyReq = new NextRequest(
      `http://localhost:3000/api/households/${householdId}/recommendations/${targetRecId}/apply`,
      {
        method: "POST",
        headers: { "x-user-id": viewerUserId },
      }
    );
    const applyRes = await applyRecommendation(applyReq, {
      params: Promise.resolve({ id: householdId, rid: targetRecId }),
    });
    expect(applyRes.status).toBe(403);
  });

  it("runs parametric Monte Carlo What-If simulator dynamically", async () => {
    const payload = {
      acReductionHours: 2.0,
      swapCarEv: true,
      solarPanelsKw: 4.0,
    };

    const simReq = new NextRequest(`http://localhost:3000/api/households/${householdId}/forecast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": ownerUserId,
      },
      body: JSON.stringify(payload),
    });

    const simRes = await simulateForecast(simReq, { params: Promise.resolve({ id: householdId }) });
    expect(simRes.status).toBe(200);

    const simData = await simRes.json();
    // High simulated savings from AC + EV + Solar
    expect(simData.totalCommittedSavingsKg).toBeGreaterThan(80);
    expect(simData.projection[0].avoidedKg).toBeGreaterThan(50);
  });
});
