import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { ensureHouseholdIdentity } from "@/server/services/identity.service";
import { createRemoval, RemovalInput } from "@/server/services/removal.service";
import { deleteItem, listCatalogue } from "@/server/services/catalogue.service";
import { sendToUser } from "@/server/services/notify.service";
import { listNotifications, markRead } from "@/server/services/notifications.service";
import { checkSql, readOnlyQuery, SqlRejected } from "@/server/partner/readOnlySql";
import { offlineAnswer, knowledgeText } from "@/server/partner/knowledge";
import { POST as partner } from "@/app/api/partner/route";
import { POST as translateApi } from "@/app/api/i18n/translate/route";
import { translate } from "@/server/services/translate.service";
import { resetClaudeClient } from "@/server/ai/claude";
import { parseUiPrefs } from "@/lib/uiPrefs";
import { LANGUAGES } from "@/lib/languages";
import { resetRateLimits } from "@/server/auth/rateLimit";
import { createSession } from "@/server/auth/session";

const stamp = Date.now();
let householdId = "";
let otherHouseholdId = "";
let ownerId = "";
let ownerToken = "";
let merchantId = "";

const json = (url: string, body: unknown, cookie?: string) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie: `cw_session=${cookie}` } : {}) },
    body: JSON.stringify(body),
  });

async function readStream(res: Response) {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { t: string; v?: string });
}

describe("Phase 31: Partner, languages, notifications, removals and catalogue fixes", () => {
  beforeAll(async () => {
    resetRateLimits();
    delete process.env.ANTHROPIC_API_KEY; // the offline paths; the AI paths need a real key
    resetClaudeClient();
    const owner = await db.user.create({ data: { name: "P31 Owner", email: `owner.${stamp}@p31.test` } });
    ownerId = owner.id;
    ownerToken = (await createSession(ownerId)).token;
    householdId = `hh_p31_${stamp}`;
    otherHouseholdId = `hh_p31b_${stamp}`;
    for (const id of [householdId, otherHouseholdId]) {
      await db.household.create({
        data: { id, name: `P31 Home ${id}`, city: "Noida", state: "UP", size: 3, homeType: "Apartment", floorAreaM2: 70, joinCode: `P31${id === householdId ? "A" : "B"}${stamp}` },
      });
      await ensureHouseholdIdentity(id);
    }
    await db.membership.create({ data: { householdId, userId: ownerId, role: "OWNER" } });
    const shopUser = await db.user.create({ data: { name: "P31 Shop", email: `shop.${stamp}@p31.test`, platformRole: "MERCHANT" } });
    merchantId = (await db.merchant.create({ data: { userId: shopUser.id, businessName: `P31 Shop ${stamp}`, city: "Noida", state: "UP", sells: "BOTH", status: "APPROVED" } })).id;
  });
  afterAll(async () => {
    await db.merchantSale.deleteMany({ where: { merchantId } });
    await db.catalogueItem.deleteMany({ where: { merchantId } });
    await db.household.deleteMany({ where: { id: { in: [householdId, otherHouseholdId] } } });
    await db.user.deleteMany({ where: { email: { endsWith: `.${stamp}@p31.test` } } });
    await db.translation.deleteMany({ where: { source: { startsWith: "P31 " } } });
  });

  it("'Not ours' and 'never had it' need no note; other reasons still need two lines", async () => {
    const ok = RemovalInput.safeParse({ kind: "APPLIANCE", itemId: "item_12345", reason: "NOT_OURS", note: "" });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.note).toMatch(/by mistake/);
    expect(RemovalInput.safeParse({ kind: "APPLIANCE", itemId: "item_12345", reason: "NEVER_HAD" }).success).toBe(true);
    const broken = RemovalInput.safeParse({ kind: "APPLIANCE", itemId: "item_12345", reason: "BROKEN", note: "dead" });
    expect(broken.success).toBe(false);

    const ac = await db.appliance.create({ data: { householdId, type: "AC", rating: "5_STAR", powerKw: 1.4, avgHoursPerDay: 6, source: "MERCHANT" } });
    await db.merchantSale.create({ data: { merchantId, householdId, kind: "APPLIANCE", applianceId: ac.id, summary: "AC" } });
    const req = await createRemoval(householdId, ownerId, { kind: "APPLIANCE", itemId: ac.id, reason: "NOT_OURS", note: "" }, []);
    expect(req).toBeTruthy();
    const row = await db.removalRequest.findFirstOrThrow({ where: { householdId, applianceId: ac.id } });
    expect(row.note).toMatch(/did not buy it/);
  });

  it("deleting a catalogue product really deletes it; its past sales keep their record", async () => {
    const item = await db.catalogueItem.create({
      data: { merchantId, sku: `P31-${stamp}`, kind: "APPLIANCE", type: "AC", brand: "B", model: "M", title: "P31 AC", priceInr: 30000, active: true },
    });
    const sale = await db.merchantSale.create({ data: { merchantId, householdId, kind: "APPLIANCE", summary: "P31 AC sold", catalogueItemId: item.id, priceInr: 30000 } });
    const out = await deleteItem(merchantId, item.id);
    expect(out.sold).toBe(1);
    expect(await db.catalogueItem.findUnique({ where: { id: item.id } })).toBeNull();
    const kept = await db.merchantSale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(kept).toMatchObject({ catalogueItemId: null, summary: "P31 AC sold", priceInr: 30000 });
    expect((await listCatalogue(merchantId)).some((i) => i.id === item.id)).toBe(false);
  });

  it("every notification lands in the bell, pages of 20, and can be marked read", async () => {
    for (let i = 0; i < 23; i++) await sendToUser(ownerId, { title: `P31 note ${i}`, body: "x", url: "/assets", tag: `merchant:p31-${i}` });
    const page1 = await listNotifications(ownerId, 1);
    expect(page1).toMatchObject({ total: 23, unread: 23, pages: 2 });
    expect(page1.items).toHaveLength(20);
    expect(page1.items[0].kind).toBe("SHOP");
    await markRead(ownerId, [page1.items[0].id]);
    expect((await listNotifications(ownerId, 1)).unread).toBe(22);
    await markRead(ownerId, "all");
    expect((await listNotifications(ownerId, 2)).unread).toBe(0);
  });

  it("Partner's database access refuses writes, extra statements and secret columns", async () => {
    for (const bad of ["DELETE FROM users", "SELECT 1; DROP TABLE users", "UPDATE households SET name = 'x'", "select 1 -- hi", "SELECT password_hash AS x FROM users", "SELECT h.card_code FROM households h", "PRAGMA table_info(users)"]) {
      expect(() => checkSql(bad), bad).toThrow(SqlRejected);
    }
    expect(checkSql("WITH x AS (SELECT 1 AS a) SELECT * FROM x;")).toBe("WITH x AS (SELECT 1 AS a) SELECT * FROM x");
    expect(checkSql("SELECT name FROM households WHERE name = 'update me'")).toBeTruthy(); // words inside quotes are fine
    const out = await readOnlyQuery(`SELECT * FROM users WHERE id = '${ownerId}'`);
    expect(out.rows[0]).toMatchObject({ email: `owner.${stamp}@p31.test` });
    expect(out.rows[0].password_hash === null || out.rows[0].password_hash === "[hidden]").toBe(true);
    const many = await readOnlyQuery("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 500) SELECT i FROM n");
    expect(many.rows).toHaveLength(200);
    expect(many.truncated).toBe(true);
  });

  it("Partner without an AI key answers from the rule book, per kind of account", async () => {
    expect(offlineAnswer("household", "how do I remove an AC I sold?")[0].title).toMatch(/remove/i);
    expect(knowledgeText("guest")).not.toMatch(/Admins: daily work/);
    expect(knowledgeText("admin")).toMatch(/read only/);
    const res = await partner(json("/api/partner", { messages: [{ role: "user", content: "What is the Carbon Card?" }] }));
    const events = await readStream(res);
    expect(events.map((e) => e.t)).toEqual(["text", "done"]);
    expect(events[0].v).toMatch(/Carbon Card/);
    const bad = await partner(json("/api/partner", { messages: [{ role: "assistant", content: "hi" }] }));
    expect(bad.status).toBe(400);
  });

  it("languages: all 23 choices, the cookie only accepts known ones", () => {
    expect(LANGUAGES).toHaveLength(23);
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(23);
    expect(parseUiPrefs(encodeURIComponent(JSON.stringify({ lang: "ta" }))).lang).toBe("ta");
    expect(parseUiPrefs(encodeURIComponent(JSON.stringify({ lang: "xx" }))).lang).toBe("en");
  });

  it("translations come from the cache; without an AI key the rest is reported unavailable", async () => {
    const { createHash } = await import("node:crypto");
    const src = "P31 Page ⟦0⟧ of ⟦1⟧";
    await db.translation.create({ data: { lang: "ta", hash: createHash("sha256").update(src).digest("hex"), source: src, text: "P31 பக்கம் ⟦0⟧ / ⟦1⟧" } });
    const out = await translate("ta", [src, "P31 Something new"]);
    expect(out.translations[src]).toBe("P31 பக்கம் ⟦0⟧ / ⟦1⟧");
    expect(out.unavailable).toBe(true);
    const res = await translateApi(json("/api/i18n/translate", { lang: "en", texts: ["x"] }));
    expect(res.status).toBe(400);
    const tooMany = await translateApi(json("/api/i18n/translate", { lang: "ta", texts: Array.from({ length: 61 }, (_, i) => `t${i}`) }));
    expect(tooMany.status).toBe(400);
    const signedIn = await translateApi(json("/api/i18n/translate", { lang: "ta", texts: [src] }, ownerToken));
    expect((await signedIn.json()).translations[src]).toBeTruthy();
  });
});
