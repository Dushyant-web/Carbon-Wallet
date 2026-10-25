import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { putEncrypted } from "@/server/storage/encrypted";
import { existsSync } from "node:fs";
import path from "node:path";

// The proof service isn't running: count what gets shredded
const shredded: string[] = [];
vi.mock("@/server/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/engine")>();
  return {
    ...real,
    engineShredStatements: vi.fn(async (ref: string) => (shredded.push(ref), { deleted: 2 })),
    engineStatementStatus: vi.fn(async () => []),
  };
});

const { POST: signup } = await import("@/app/api/auth/signup/route");
const { POST: login } = await import("@/app/api/auth/login/route");
const { POST: createHousehold } = await import("@/app/api/households/route");
const { POST: join } = await import("@/app/api/join/route");
const { POST: logActivity } = await import("@/app/api/households/[id]/activities/route");
const { GET: exportData } = await import("@/app/api/me/export/route");
const { GET: consentStatus, POST: agree } = await import("@/app/api/me/consent/route");
const { GET: planDeletion, POST: deleteAccount } = await import("@/app/api/me/delete/route");
const { GET: overview } = await import("@/app/api/households/[id]/overview/route");
const { purgeDue } = await import("@/server/services/privacy.service");

const stamp = Date.now();
const json = (url: string, method: string, body?: unknown, cookie?: string) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const sessionOf = (res: Response) => `cw_session=${/cw_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")![1]}`;
async function newUser(tag: string, agreeToNotice = true) {
  const email = `${tag}.${stamp}@example.com`;
  const res = await signup(json("/api/auth/signup", "POST", { name: `Test ${tag}`, email, password: "Privacy12345", ...(agreeToNotice ? { agree: true } : {}) }));
  expect(res.status).toBe(201);
  return { email, cookie: sessionOf(res), id: (await res.json()).user.id as string };
}

describe("Phase 25: your data, your call", () => {
  let owner: Awaited<ReturnType<typeof newUser>>;
  let member: Awaited<ReturnType<typeof newUser>>;
  let hh = "";

  // leave the shared test database as we found it: other suites list every household
  afterAll(async () => {
    await db.household.deleteMany({ where: { name: { endsWith: ` ${stamp}` } } });
    await db.user.deleteMany({ where: { email: { endsWith: `.${stamp}@example.com` } } });
  });

  beforeAll(async () => {
    owner = await newUser("owner");
    member = await newUser("member", false);
    const made = await createHousehold(json("/api/households", "POST", { name: `Privacy Home ${stamp}`, city: "Pune", state: "MH" }, owner.cookie));
    const h = await made.json();
    hh = h.household?.id ?? h.id;
    const code = (await db.household.findUniqueOrThrow({ where: { id: hh } })).joinCode;
    expect((await join(json("/api/join", "POST", { code }, member.cookie))).status).toBeLessThan(300);
    await logActivity(json(`/api/households/${hh}/activities`, "POST", { category: "Food", type: "lpg_cooking", quantity: 14.2, unit: "kg", occurredOn: "2023-03-05T12:00:00Z" }, owner.cookie), {
      params: Promise.resolve({ id: hh }),
    });
  });

  it("records consent at sign-up, and asks anyone who hasn't agreed", async () => {
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).consentVersion).toBeTruthy();
    const before = await (await consentStatus(json("/api/me/consent", "GET", undefined, member.cookie))).json();
    expect(before.agreed).toBe(false);
    await agree(json("/api/me/consent", "POST", undefined, member.cookie));
    expect((await (await consentStatus(json("/api/me/consent", "GET", undefined, member.cookie))).json()).agreed).toBe(true);
  });

  it("exports everything about you as one file, without secrets or other people's details", async () => {
    const res = await exportData(json("/api/me/export", "GET", undefined, owner.cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="carbon-wallet-my-data-/);
    const text = await res.text();
    const data = JSON.parse(text);
    expect(data.format).toBe("carbon-wallet-export/v1");
    expect(data.you.email).toBe(owner.email);
    expect(data.households[0].household.name).toBe(`Privacy Home ${stamp}`);
    expect(data.households[0].activities.some((a: { type: string }) => a.type === "lpg_cooking")).toBe(true);
    expect(text).not.toContain("passwordHash");
    expect(text).not.toMatch(/scrypt\$/);
    expect(text).not.toContain(member.email); // the other member's details aren't yours to download
  });

  it("won't orphan a shared household, checks the password, then signs you out everywhere", async () => {
    const plan = await (await planDeletion(json("/api/me/delete", "GET", undefined, owner.cookie))).json();
    expect(plan.households).toEqual([expect.objectContaining({ householdId: hh, outcome: "choose", otherMembers: 1 })]);
    expect((await deleteAccount(json("/api/me/delete", "POST", { password: "Privacy12345" }, owner.cookie))).status).toBe(409);
    expect((await deleteAccount(json("/api/me/delete", "POST", { password: "wrong-one", deleteHouseholds: [hh] }, owner.cookie))).status).toBe(403);

    const ok = await deleteAccount(json("/api/me/delete", "POST", { password: "Privacy12345", deleteHouseholds: [hh] }, owner.cookie));
    expect(ok.status).toBe(200);
    expect(await db.session.count({ where: { userId: owner.id } })).toBe(0);
    expect((await exportData(json("/api/me/export", "GET", undefined, owner.cookie))).status).toBe(401);
    const again = await login(json("/api/auth/login", "POST", { email: owner.email, password: "Privacy12345" }));
    expect(again.status).toBe(403);
    expect((await again.json()).error).toMatch(/being deleted/);
    // the household is gone for its other member too
    expect((await overview(json(`/api/households/${hh}/overview`, "GET", undefined, member.cookie), { params: Promise.resolve({ id: hh }) })).status).toBe(404);
  });

  it("erases everything 30 days later: rows, stored files and the salts of sealed months; only a count remains", async () => {
    await putEncrypted(["bills", hh, "doc1", "original.bin"], Buffer.from("a bill"));
    const dir = path.join(process.env.STORAGE_DIR!, "bills", hh);
    expect(existsSync(dir)).toBe(true);

    expect(await purgeDue(new Date(Date.now() + 10 * 86_400_000))).toEqual({ users: 0, households: 0, statements: 0 });
    const out = await purgeDue(new Date(Date.now() + 31 * 86_400_000));
    expect(out).toMatchObject({ users: 1, households: 1, statements: 2 });
    expect(shredded).toContain(hh);
    expect(existsSync(dir)).toBe(false);
    expect(await db.household.findUnique({ where: { id: hh } })).toBeNull();
    expect(await db.activity.count({ where: { householdId: hh } })).toBe(0);
    expect(await db.user.findUnique({ where: { id: owner.id } })).toBeNull();
    expect(await db.user.findUnique({ where: { id: member.id } })).not.toBeNull(); // the other member keeps their account
    const log = await db.erasureLog.findFirstOrThrow({ orderBy: { at: "desc" } });
    expect(log).toMatchObject({ users: 1, households: 1, statements: 2, files: 1 });
  });

  it("a member who isn't the owner just leaves; the household carries on", async () => {
    const lead = await newUser("lead");
    const leaver = await newUser("leaver");
    const made = await createHousehold(json("/api/households", "POST", { name: `Stays ${stamp}`, city: "Pune", state: "MH" }, lead.cookie));
    const h = await made.json();
    const id = h.household?.id ?? h.id;
    await join(json("/api/join", "POST", { code: (await db.household.findUniqueOrThrow({ where: { id } })).joinCode }, leaver.cookie));
    const plan = await (await planDeletion(json("/api/me/delete", "GET", undefined, leaver.cookie))).json();
    expect(plan.households[0].outcome).toBe("you_leave");
    expect((await deleteAccount(json("/api/me/delete", "POST", { password: "Privacy12345" }, leaver.cookie))).status).toBe(200);
    expect(await db.membership.count({ where: { householdId: id, userId: leaver.id } })).toBe(0);
    expect((await db.household.findUniqueOrThrow({ where: { id } })).status).toBe("ACTIVE");
  });
});
