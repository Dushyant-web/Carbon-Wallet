import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { hasPermission, getRoleCapabilities } from "@/server/auth/permissions";
import { POST as postActivity, GET as getActivities } from "@/app/api/households/[id]/activities/route";

describe("Phase 3: Auth, Memberships & Permission Guard", () => {
  const householdId = "hh_01_sharma";
  let viewerUserId = "";
  let memberUserId = "";
  let nonMemberUserId = "";

  beforeAll(async () => {
    // Find Sharma's viewer (Meera Sharma) and member (Rohan Sharma)
    const viewerMembership = await db.membership.findFirst({
      where: { householdId, role: "VIEWER" },
      include: { user: true },
    });
    const memberMembership = await db.membership.findFirst({
      where: { householdId, role: "MEMBER" },
      include: { user: true },
    });

    if (viewerMembership) {
      viewerUserId = viewerMembership.userId;
    } else {
      const viewerUser = await db.user.create({
        data: { name: "Test Viewer", email: "viewer_test@example.com" },
      });
      await db.membership.create({
        data: { householdId, userId: viewerUser.id, role: "VIEWER" },
      });
      viewerUserId = viewerUser.id;
    }

    if (memberMembership) {
      memberUserId = memberMembership.userId;
    } else {
      const memberUser = await db.user.create({
        data: { name: "Test Member", email: "member_test@example.com" },
      });
      await db.membership.create({
        data: { householdId, userId: memberUser.id, role: "MEMBER" },
      });
      memberUserId = memberUser.id;
    }

    // Create a user who belongs to a different household (Mehta)
    const outsider = await db.user.upsert({
      where: { email: "outsider@example.com" },
      update: {},
      create: { name: "Outsider User", email: "outsider@example.com" },
    });
    nonMemberUserId = outsider.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("verifies capability matrix correctly maps roles", () => {
    // activity:create allowed for OWNER, ADMIN, MEMBER; disallowed for VIEWER
    expect(hasPermission("OWNER", "activity:create")).toBe(true);
    expect(hasPermission("ADMIN", "activity:create")).toBe(true);
    expect(hasPermission("MEMBER", "activity:create")).toBe(true);
    expect(hasPermission("VIEWER", "activity:create")).toBe(false);

    // data:read allowed for all
    expect(hasPermission("VIEWER", "data:read")).toBe(true);
    expect(hasPermission("MEMBER", "data:read")).toBe(true);

    // household:archive only for OWNER
    expect(hasPermission("OWNER", "household:archive")).toBe(true);
    expect(hasPermission("ADMIN", "household:archive")).toBe(false);
    expect(hasPermission("MEMBER", "household:archive")).toBe(false);
    expect(hasPermission("VIEWER", "household:archive")).toBe(false);

    expect(getRoleCapabilities("VIEWER")).toContain("data:read");
    expect(getRoleCapabilities("VIEWER")).not.toContain("activity:create");
  });

  it("Done when criterion: Viewer gets 403 on POST /api/households/:id/activities", async () => {
    const payload = {
      category: "Electricity",
      type: "ac_cooling",
      quantity: 4,
      unit: "hours",
      occurredOn: new Date().toISOString(),
    };

    const req = new NextRequest(`http://localhost:3000/api/households/${householdId}/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": viewerUserId,
      },
      body: JSON.stringify(payload),
    });

    const res = await postActivity(req, { params: Promise.resolve({ id: householdId }) });
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toContain("Forbidden");
    expect(data.error).toContain("VIEWER");
  });

  it("allows Member to POST /api/households/:id/activities with 201 Created", async () => {
    const payload = {
      category: "Electricity",
      type: "grid_electricity",
      quantity: 12,
      unit: "kWh",
      occurredOn: new Date().toISOString(),
      notes: "Member logged electricity usage",
    };

    const req = new NextRequest(`http://localhost:3000/api/households/${householdId}/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": memberUserId,
      },
      body: JSON.stringify(payload),
    });

    const res = await postActivity(req, { params: Promise.resolve({ id: householdId }) });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.activity).toBeDefined();
    expect(data.activity.quantity).toBe(12);
    expect(data.emissionEvent).toBeDefined();
    expect(data.monthlySummary).toBeDefined();
  });

  it("blocks outsider user from accessing a household they are not a member of", async () => {
    const req = new NextRequest(`http://localhost:3000/api/households/${householdId}/activities`, {
      method: "GET",
      headers: {
        "x-user-id": nonMemberUserId,
      },
    });

    const res = await getActivities(req, { params: Promise.resolve({ id: householdId }) });
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toContain("not an active member");
  });

  it("allows Viewer to GET activities with 200 OK", async () => {
    const req = new NextRequest(`http://localhost:3000/api/households/${householdId}/activities`, {
      method: "GET",
      headers: {
        "x-user-id": viewerUserId,
      },
    });

    const res = await getActivities(req, { params: Promise.resolve({ id: householdId }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.activities)).toBe(true);
    expect(data.activities.length).toBeGreaterThan(0);
  });
});
