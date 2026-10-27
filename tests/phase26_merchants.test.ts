import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { ensureHouseholdIdentity } from "@/server/services/identity.service";
import { POST as merchantSignup } from "@/app/api/auth/merchant/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as scan } from "@/app/api/merchant/scan/route";
import { GET as listSales, POST as registerSale } from "@/app/api/merchant/sales/route";
import { GET as adminMerchants } from "@/app/api/admin/merchants/route";
import { PATCH as reviewMerchant } from "@/app/api/admin/merchants/[id]/route";
import { PATCH as editAppliance, DELETE as deleteAppliance } from "@/app/api/households/[id]/appliances/[applianceId]/route";
import { POST as askRemoval } from "@/app/api/households/[id]/removals/route";
import { PATCH as decideRemoval } from "@/app/api/admin/removals/[reqId]/route";
import { GET as overview } from "@/app/api/households/[id]/overview/route";
import { POST as createHousehold } from "@/app/api/households/route";
import { resetRateLimits } from "@/server/auth/rateLimit";

const stamp = Date.now();
const cookieOf = (res: Response) => /cw_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")![1];

function req(url: string, init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...(init.headers ?? {}) };
  if (init.cookie) headers.cookie = `cw_session=${init.cookie}`;
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
const p = <T extends Record<string, string>>(v: T) => ({ params: Promise.resolve(v) });

const AC = {
  type: "AC",
  brand: "Coolwell",
  model: "CW-18INV-5S",
  stars: 5,
  inverter: true,
  labelYear: 2026,
  ratedPowerW: 1450,
  capacityTon: 1.5,
  annualKwh: 820,
  refrigerant: "R32",
  serialNo: `SN-${stamp}-1`,
  invoiceRef: "INV-0042",
};
const CAR = { type: "Car", fuel: "Petrol", make: "Demo", model: "Hatch", variant: "VX", year: 2026, kmPerUnit: 19.5, vin: "MA1TEST0000012345" };

async function signUpShop(name: string, sells: string) {
  const res = await merchantSignup(
    req("/api/auth/merchant/signup", {
      method: "POST",
      body: { name: `${name} Owner`, email: `${name.toLowerCase()}.${stamp}@shop.test`, password: "Shop12345x", businessName: `${name} ${stamp}`, city: "Noida", state: "Uttar Pradesh", sells },
    }),
  );
  expect(res.status).toBe(201);
  const cookie = cookieOf(res);
  const merchant = await db.merchant.findFirstOrThrow({ where: { businessName: `${name} ${stamp}` } });
  return { cookie, merchant };
}

describe("Phase 26: shops register what a household bought, from its Carbon Card", () => {
  let admin = "";
  let shop: { cookie: string; merchant: { id: string } };
  let dealer: { cookie: string; merchant: { id: string } };
  let HH = "";
  let cardCode = "";
  let publicToken = "";
  let ownerId = "";
  let familyId = "";
  let ticket = "";
  let applianceId = "";

  beforeAll(async () => {
    resetRateLimits();
    admin = cookieOf(await login(req("/api/auth/login", { method: "POST", body: { email: "admin@carbonwallet.in", password: "AdminDemo#2026" } })));
    shop = await signUpShop("Appliances", "APPLIANCES");
    dealer = await signUpShop("Motors", "VEHICLES");

    // a home of its own, so nothing here touches the seeded households other suites check
    const owner = await db.user.create({ data: { name: "Counter Owner", email: `counter.owner.${stamp}@example.com` } });
    const family = await db.user.create({ data: { name: "Counter Family", email: `counter.family.${stamp}@example.com` } });
    const hh = await db.household.create({
      data: {
        name: `Counter Home ${stamp}`,
        city: "Lucknow",
        state: "Uttar Pradesh",
        size: 3,
        homeType: "Apartment",
        floorAreaM2: 90,
        joinCode: `CTR${String(stamp).slice(-6)}`,
        memberships: { create: [{ userId: owner.id, role: "OWNER" }, { userId: family.id, role: "MEMBER" }] },
      },
    });
    HH = hh.id;
    ownerId = owner.id;
    familyId = family.id;
    const identity = await ensureHouseholdIdentity(HH);
    cardCode = identity!.cardCode!;
    publicToken = identity!.publicToken!;
  });

  // other suites list and rank every household, so this one leaves nothing behind
  afterAll(async () => {
    await db.household.deleteMany({ where: { id: HH } });
    await db.user.deleteMany({ where: { email: { contains: `.${stamp}@` } } }); // owner, family and both shops
  });

  it("keeps a shop off the counter until an admin approves it", async () => {
    const res = await scan(req("/api/merchant/scan", { method: "POST", cookie: shop.cookie, body: { input: cardCode } }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/waiting for approval/);

    expect((await reviewMerchant(req("/x", { method: "PATCH", cookie: shop.cookie, body: { status: "APPROVED" } }), p({ id: shop.merchant.id }))).status).toBe(403);
    for (const m of [shop, dealer]) {
      expect((await reviewMerchant(req("/x", { method: "PATCH", cookie: admin, body: { status: "APPROVED" } }), p({ id: m.merchant.id }))).status).toBe(200);
    }
  });

  it("turns a scanned card into a short ticket, and tells the shop only who the home is", async () => {
    const dashed = cardCode.replace(/^(CW1)(.{4})(.{4})(.{4})$/, "$1-$2-$3-$4");
    const res = await scan(req("/api/merchant/scan", { method: "POST", cookie: shop.cookie, body: { input: dashed.toLowerCase() } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["advice", "customer", "expiresAt", "ticket"]);
    expect(Object.keys(body.customer).sort()).toEqual(["carbonId", "city", "name", "state"]);
    // the shop gets a colour and a sentence, never the home's numbers
    expect(Object.keys(body.advice.status).sort()).toEqual(["colour", "sentence"]);
    expect(JSON.stringify(body.advice)).not.toMatch(/\d+(\.\d+)?\s?kg/);
    expect(body.customer.name).toBe(`Counter Home ${stamp}`);
    const text = JSON.stringify(body);
    for (const secret of [cardCode, publicToken, HH, "counter.owner", "joinCode"]) expect(text).not.toContain(secret);
    expect(new Date(body.expiresAt).getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    ticket = body.ticket;
    // only the ticket's hash is stored
    expect(await db.merchantScan.count({ where: { tokenHash: ticket } })).toBe(0);
    expect(await db.auditLog.count({ where: { householdId: HH, action: "merchant.scan" } })).toBe(1);
  });

  it("refuses shared links, unknown codes and homes being deleted", async () => {
    const link = await scan(req("/api/merchant/scan", { method: "POST", cookie: shop.cookie, body: { input: `https://carbonwallet.in/p/${publicToken}` } }));
    expect(link.status).toBe(422);
    expect((await scan(req("/api/merchant/scan", { method: "POST", cookie: shop.cookie, body: { input: "CW1-ZZZZ-ZZZZ-ZZZZ" } }))).status).toBe(404);
    await db.household.update({ where: { id: HH }, data: { status: "DELETION_PENDING" } });
    expect((await scan(req("/api/merchant/scan", { method: "POST", cookie: shop.cookie, body: { input: cardCode } }))).status).toBe(404);
    await db.household.update({ where: { id: HH }, data: { status: "ACTIVE" } });
    // and households are not for shop accounts
    const own = await createHousehold(
      req("/api/households", { method: "POST", cookie: shop.cookie, body: { name: "Shop Home", city: "Noida", state: "Uttar Pradesh", size: 2, homeType: "Apartment", floorAreaM2: 60 } }),
    );
    expect(own.status).toBe(403);
  });

  it("registers an AC to the home: locked specs, the shop's record, an audit row", async () => {
    const res = await registerSale(req("/api/merchant/sales", { method: "POST", cookie: shop.cookie, body: { kind: "APPLIANCE", ticket, item: AC } }));
    expect(res.status).toBe(201);
    const { sale, item } = await res.json();
    expect(sale.summary).toBe("1.5 t 5-star inverter air conditioner · Coolwell CW-18INV-5S");
    applianceId = item.id;

    const ac = await db.appliance.findUniqueOrThrow({ where: { id: applianceId } });
    expect(ac).toMatchObject({ householdId: HH, source: "MERCHANT", type: "AC", rating: "5_STAR_INVERTER", powerKw: 1.45, avgHoursPerDay: 6, labelYear: 2026, refrigerant: "R32" });
    expect((await db.merchantSale.findUniqueOrThrow({ where: { id: sale.id } })).status).toBe("REGISTERED");
    expect(await db.auditLog.count({ where: { householdId: HH, action: "merchant.register" } })).toBe(1);

    const ov = await (await overview(req(`/api/households/${HH}/overview`, { headers: { "x-user-id": ownerId } }), p({ id: HH }))).json();
    const listed = ov.appliances.find((a: { id: string }) => a.id === applianceId);
    expect(listed.registeredBy.shop).toBe(`Appliances ${stamp}`);

    const again = await registerSale(req("/api/merchant/sales", { method: "POST", cookie: shop.cookie, body: { kind: "APPLIANCE", ticket, item: AC } }));
    expect(again.status).toBe(409); // same serial number, same home
  });

  it("holds each shop to its own tickets, goods and time limit", async () => {
    const car = { kind: "VEHICLE", ticket, item: CAR };
    expect((await registerSale(req("/api/merchant/sales", { method: "POST", cookie: dealer.cookie, body: car }))).status).toBe(403); // not their scan
    expect((await registerSale(req("/api/merchant/sales", { method: "POST", cookie: shop.cookie, body: car }))).status).toBe(403); // appliances only

    const own = await (await scan(req("/api/merchant/scan", { method: "POST", cookie: dealer.cookie, body: { input: cardCode } }))).json();
    const sold = await registerSale(req("/api/merchant/sales", { method: "POST", cookie: dealer.cookie, body: { ...car, ticket: own.ticket } }));
    expect(sold.status).toBe(201);
    const v = await db.vehicle.findFirstOrThrow({ where: { householdId: HH, vin: CAR.vin } });
    expect(v).toMatchObject({ source: "MERCHANT", kmPerUnit: 19.5, year: 2026, name: "Demo Hatch VX" });

    await db.merchantScan.updateMany({ where: { merchantId: dealer.merchant.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const late = await registerSale(req("/api/merchant/sales", { method: "POST", cookie: dealer.cookie, body: { ...car, ticket: own.ticket, item: { ...CAR, vin: "MA1TEST0000099999" } } }));
    expect(late.status).toBe(410);
  });

  it("lets the owner change how it's used, not the shop's specs", async () => {
    const asOwner = { "x-user-id": ownerId };
    const specs = await editAppliance(req("/x", { method: "PATCH", headers: asOwner, body: { powerKw: 0.5 } }), p({ id: HH, applianceId }));
    expect(specs.status).toBe(400);
    expect((await specs.json()).error).toMatch(/locked/);
    const hours = await editAppliance(req("/x", { method: "PATCH", headers: asOwner, body: { avgHoursPerDay: 9 } }), p({ id: HH, applianceId }));
    expect(hours.status).toBe(200);
    expect((await db.appliance.findUniqueOrThrow({ where: { id: applianceId } })).avgHoursPerDay).toBe(9);
  });

  it("lets only the owner dispute an item; an admin decides, and the shop and admins see it", async () => {
    // nothing is deleted directly any more
    expect((await deleteAppliance(req("/x", { method: "DELETE", headers: { "x-user-id": ownerId } }), p({ id: HH, applianceId }))).status).toBe(403);
    const dispute = (who: string) => {
      const form = new FormData();
      form.set("kind", "APPLIANCE");
      form.set("itemId", applianceId);
      form.set("reason", "NOT_OURS");
      form.set("note", "We bought nothing at this shop this month.");
      return askRemoval(new NextRequest(`http://localhost:3000/api/households/${HH}/removals`, { method: "POST", body: form, headers: { "x-user-id": who } }), p({ id: HH }));
    };
    expect((await dispute(familyId)).status).toBe(403);
    const asked = await dispute(ownerId);
    expect(asked.status).toBe(201);
    const { id: requestId } = await asked.json();
    expect(await db.appliance.findUnique({ where: { id: applianceId } })).not.toBeNull(); // still counted until decided
    expect((await dispute(ownerId)).status).toBe(409);

    expect((await decideRemoval(req("/x", { method: "PATCH", cookie: shop.cookie, body: { decision: "APPROVE" } }), p({ reqId: requestId }))).status).toBe(403);
    const ok = await decideRemoval(req("/x", { method: "PATCH", cookie: admin, body: { decision: "APPROVE" } }), p({ reqId: requestId }));
    expect(ok.status).toBe(200);
    expect(await db.appliance.findUnique({ where: { id: applianceId } })).toBeNull();
    expect(await db.auditLog.count({ where: { householdId: HH, action: "merchant.sale.rejected" } })).toBe(1);

    const history = await (await listSales(req("/api/merchant/sales", { cookie: shop.cookie }))).json();
    expect(history.sales).toHaveLength(1);
    expect(history.sales[0]).toMatchObject({ status: "REJECTED", invoiceRef: "INV-0042" });
    expect(history.sales[0].carbonId).toMatch(/^CW-UP-/);
    expect(JSON.stringify(history)).not.toContain(HH);

    const list = await (await adminMerchants(req("/api/admin/merchants", { cookie: admin }))).json();
    expect(list.merchants.find((m: { id: string }) => m.id === shop.merchant.id)).toMatchObject({ registered: 1, rejected: 1, status: "APPROVED" });
    expect((await adminMerchants(req("/api/admin/merchants", { cookie: shop.cookie }))).status).toBe(403);
  });

  it("stops a suspended shop at once, and rate-limits scanning", async () => {
    const fresh = await (await scan(req("/api/merchant/scan", { method: "POST", cookie: shop.cookie, body: { input: cardCode } }))).json();
    await reviewMerchant(req("/x", { method: "PATCH", cookie: admin, body: { status: "SUSPENDED" } }), p({ id: shop.merchant.id }));
    expect((await scan(req("/api/merchant/scan", { method: "POST", cookie: shop.cookie, body: { input: cardCode } }))).status).toBe(403);
    await reviewMerchant(req("/x", { method: "PATCH", cookie: admin, body: { status: "APPROVED" } }), p({ id: shop.merchant.id }));
    const stale = await registerSale(req("/api/merchant/sales", { method: "POST", cookie: shop.cookie, body: { kind: "APPLIANCE", ticket: fresh.ticket, item: { ...AC, serialNo: `SN-${stamp}-2` } } }));
    expect(stale.status).toBe(410); // its open tickets ended with the suspension

    resetRateLimits();
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await scan(req("/api/merchant/scan", { method: "POST", cookie: dealer.cookie, body: { input: "CW1-ZZZZ-ZZZZ-ZZZZ" } }))).status;
    expect(last).toBe(429);
  });
});
