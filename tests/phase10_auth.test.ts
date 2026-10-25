import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as adminSignup } from "@/app/api/auth/admin/signup/route";
import { GET as adminOverview } from "@/app/api/admin/overview/route";
import { GET as listHouseholds, POST as createHousehold } from "@/app/api/households/route";
import { GET as overview } from "@/app/api/households/[id]/overview/route";
import { resetRateLimits } from "@/server/auth/rateLimit";
import { hashPassword, verifyPassword } from "@/server/auth/password";

const stamp = Date.now();
const userEmail = `p10.user.${stamp}@example.com`;
const adminEmail = `p10.admin.${stamp}@example.com`;
const PASSWORD = "Sup3rSecret!";

function req(url: string, init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...(init.headers ?? {}) };
  if (init.cookie) headers.cookie = `cw_session=${init.cookie}`;
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function sessionToken(res: Response): string {
  const set = res.headers.get("set-cookie") ?? "";
  const match = set.match(/cw_session=([^;]+)/);
  if (!match) throw new Error("no session cookie set");
  return match[1];
}

describe("Phase 10: authentication, sessions and admin access", () => {
  let userToken = "";
  let adminToken = "";

  beforeAll(() => resetRateLimits());

  it("hashes passwords with scrypt and verifies them in constant time", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("wrong-password1", hash)).toBe(false);
  });

  it("signs a user up, sets an httpOnly session cookie and rejects duplicates", async () => {
    const res = await signup(req("/api/auth/signup", { method: "POST", body: { name: "Test User", email: userEmail, password: PASSWORD } }));
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    userToken = sessionToken(res);

    const dup = await signup(req("/api/auth/signup", { method: "POST", body: { name: "Again", email: userEmail, password: PASSWORD } }));
    expect(dup.status).toBe(409);
  });

  it("rejects weak passwords", async () => {
    const res = await signup(req("/api/auth/signup", { method: "POST", body: { name: "Weak", email: `weak.${stamp}@example.com`, password: "aaaaaaaa" } }));
    expect(res.status).toBe(400);
  });

  it("logs in with the right password and refuses the wrong one", async () => {
    const bad = await login(req("/api/auth/login", { method: "POST", body: { email: userEmail, password: "Nope12345" } }));
    expect(bad.status).toBe(401);
    const ok = await login(req("/api/auth/login", { method: "POST", body: { email: userEmail, password: PASSWORD } }));
    expect(ok.status).toBe(200);
  });

  it("rate-limits repeated failed logins", async () => {
    const email = `ratelimit.${stamp}@example.com`;
    let last = 0;
    for (let i = 0; i < 6; i++) {
      last = (await login(req("/api/auth/login", { method: "POST", body: { email, password: "Wrong1234" } }))).status;
    }
    expect(last).toBe(429);
  });

  it("resolves the user from the session, and only from the session", async () => {
    const res = await me(req("/api/auth/me", { cookie: userToken }));
    expect(res.status).toBe(200);
    expect((await res.json()).user.email).toBe(userEmail);
    expect((await me(req("/api/auth/me"))).status).toBe(401);
  });

  it("ignores a spoofed x-user-id header outside the test-only DEMO_AUTH mode", async () => {
    const owner = await db.membership.findFirst({ where: { householdId: "hh_01_sharma", role: "OWNER" } });
    const prev = process.env.DEMO_AUTH;
    process.env.DEMO_AUTH = "0";
    try {
      const spoofed = await overview(
        req("/api/households/hh_01_sharma/overview", { headers: { "x-user-id": owner!.userId } }),
        { params: Promise.resolve({ id: "hh_01_sharma" }) },
      );
      expect(spoofed.status).toBe(401);

      const notMember = await overview(
        req("/api/households/hh_01_sharma/overview", { cookie: userToken }),
        { params: Promise.resolve({ id: "hh_01_sharma" }) },
      );
      expect(notMember.status).toBe(403);
    } finally {
      process.env.DEMO_AUTH = prev;
    }
  });

  it("makes the creator OWNER of a new, empty household and scopes the list to their homes", async () => {
    const prev = process.env.DEMO_AUTH;
    process.env.DEMO_AUTH = "0";
    try {
      const created = await createHousehold(
        req("/api/households", { method: "POST", cookie: userToken, body: { name: "P10 Home", city: "Pune", state: "MH", size: 3 } }),
      );
      expect(created.status).toBe(201);
      const { household } = await created.json();

      const list = await listHouseholds(req("/api/households", { cookie: userToken }));
      const ids = (await list.json()).households.map((h: { id: string }) => h.id);
      expect(ids).toEqual([household.id]);

      const ov = await overview(req(`/api/households/${household.id}/overview`, { cookie: userToken }), {
        params: Promise.resolve({ id: household.id }),
      });
      expect(ov.status).toBe(200);
      expect((await ov.json()).kpi.totalEmissions).toBe(0);
    } finally {
      process.env.DEMO_AUTH = prev;
    }
  });

  it("keeps the admin API closed to regular users", async () => {
    expect((await adminOverview(req("/api/admin/overview", { cookie: userToken }))).status).toBe(403);
    expect((await adminOverview(req("/api/admin/overview"))).status).toBe(401);
  });

  it("requires a valid invite code for admin sign-up", async () => {
    const bad = await adminSignup(
      req("/api/auth/admin/signup", { method: "POST", body: { name: "Mallory", email: `mallory.${stamp}@example.com`, password: PASSWORD, inviteCode: "guess" } }),
    );
    expect(bad.status).toBe(403);

    const ok = await adminSignup(
      req("/api/auth/admin/signup", { method: "POST", body: { name: "Ada Admin", email: adminEmail, password: PASSWORD, inviteCode: "test-invite-code" } }),
    );
    expect(ok.status).toBe(201);
    adminToken = sessionToken(ok);
    const overviewRes = await adminOverview(req("/api/admin/overview", { cookie: adminToken }));
    expect(overviewRes.status).toBe(200);
    expect((await overviewRes.json()).stats.admins).toBeGreaterThanOrEqual(1);
  });

  it("logs out by deleting the session", async () => {
    await logout(req("/api/auth/logout", { method: "POST", cookie: userToken }));
    expect((await me(req("/api/auth/me", { cookie: userToken }))).status).toBe(401);
  });

  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: { in: [userEmail, adminEmail] } } });
    const ids = users.map((u) => u.id);
    const memberships = await db.membership.findMany({ where: { userId: { in: ids } } });
    await db.household.deleteMany({ where: { id: { in: memberships.map((m) => m.householdId) }, name: "P10 Home" } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });
});

describe("Platform admins can view any household, read-only", () => {
  it("reads data but can't change it", async () => {
    const { NextRequest } = await import("next/server");
    const { POST: login } = await import("@/app/api/auth/login/route");
    const { GET: overview } = await import("@/app/api/households/[id]/overview/route");
    const { POST: addVehicle } = await import("@/app/api/households/[id]/vehicles/route");
    const { resetRateLimits } = await import("@/server/auth/rateLimit");
    resetRateLimits();
    const res = await login(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@carbonwallet.in", password: "AdminDemo#2026" }),
      }),
    );
    expect(res.status).toBe(200);
    const cookie = /cw_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")![1];
    const headers = { cookie: `cw_session=${cookie}`, "content-type": "application/json" };

    const ov = await overview(new NextRequest("http://localhost:3000/api/households/hh_02_mehta/overview", { headers }), {
      params: Promise.resolve({ id: "hh_02_mehta" }),
    });
    expect(ov.status).toBe(200);
    expect((await ov.json()).access).toEqual({ role: "VIEWER", viewOnly: true, canAddBills: false });

    const write = await addVehicle(
      new NextRequest("http://localhost:3000/api/households/hh_02_mehta/vehicles", { method: "POST", headers, body: JSON.stringify({ name: "X" }) }),
      { params: Promise.resolve({ id: "hh_02_mehta" }) },
    );
    expect(write.status).toBe(403);
  });
});
