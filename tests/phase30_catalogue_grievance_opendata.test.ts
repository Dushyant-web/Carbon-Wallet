import { GRID_KG_CO2E_PER_KWH as GRID } from "@/lib/ghg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { deflateSync } from "zlib";
import { db } from "@/server/db";
import { ensureHouseholdIdentity } from "@/server/services/identity.service";
import { parseCsv, CatalogueRowSchema, TEMPLATE_CSV, csvRecords, catalogueFacts } from "@/lib/catalogue";
import { importCatalogue, listCatalogue } from "@/server/services/catalogue.service";
import { scanCard, registerSale } from "@/server/services/merchant.service";
import { POST as fileGrievance, GET as myTickets } from "@/app/api/grievances/route";
import { PATCH as answer } from "@/app/api/admin/grievances/[id]/route";
import { GET as adminMap } from "@/app/api/admin/carbon-map/route";
import { GET as openDataApi } from "@/app/api/public/open-data/route";
import { POST as login } from "@/app/api/auth/login/route";
import { stateAverage } from "@/server/services/allowance.service";
import { resetRateLimits } from "@/server/auth/rateLimit";
import { createSession } from "@/server/auth/session";

const stamp = Date.now();
let merchantId = "";
let shopUserId = "";
let householdId = "";
let ownerId = "";
let adminCookie = "";
const tokens: Record<string, string> = {};

// a real 1×1 PNG with a tEXt chunk, built here so the test needs no files
function png() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("tEXt", Buffer.from("Comment\0taken at 28.46N 77.49E")),
    chunk("IDAT", deflateSync(Buffer.from([0, 255, 140, 40]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("Phase 30: shop catalogue, complaints, open data", () => {
  beforeAll(async () => {
    resetRateLimits();
    const shopUser = await db.user.create({ data: { name: "Cat Shop", email: `cat.${stamp}@p30.test`, platformRole: "MERCHANT" } });
    shopUserId = shopUser.id;
    merchantId = (await db.merchant.create({ data: { userId: shopUser.id, businessName: `P30 Shop ${stamp}`, city: "Noida", state: "UP", sells: "BOTH", status: "APPROVED" } })).id;
    const owner = await db.user.create({ data: { name: "P30 Owner", email: `owner.${stamp}@p30.test` } });
    ownerId = owner.id;
    householdId = `hh_p30_${stamp}`;
    await db.household.create({
      data: { id: householdId, name: `P30 Home ${stamp}`, city: "Noida", state: "UP", size: 3, homeType: "Apartment", floorAreaM2: 70, joinCode: `P30${stamp}`, memberships: { create: [{ userId: owner.id, role: "OWNER" }] } },
    });
    await ensureHouseholdIdentity(householdId);
    const res = await login(
      new NextRequest("http://localhost:3000/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@carbonwallet.in", password: "AdminDemo#2026" }) }),
    );
    adminCookie = /cw_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")![1];
    tokens[ownerId] = (await createSession(ownerId)).token;
    tokens[shopUserId] = (await createSession(shopUserId)).token;
  });
  afterAll(async () => {
    await db.merchantSale.deleteMany({ where: { merchantId } });
    await db.household.deleteMany({ where: { id: householdId } });
    await db.grievance.deleteMany({ where: { userId: { in: [ownerId, shopUserId] } } });
    await db.user.deleteMany({ where: { email: { endsWith: `.${stamp}@p30.test` } } });
  });

  it("reads CSVs with quotes, commas and line breaks, and the template validates", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([["a", "b"], ["x, y", 'say "hi"\nthere']]);
    const rows = csvRecords(TEMPLATE_CSV);
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(CatalogueRowSchema.safeParse(r.record).success).toBe(true);
    const bad = CatalogueRowSchema.safeParse({ ...rows[0].record, rated_power_w: "", type: "Spaceship" });
    expect(bad.success).toBe(false);
  });

  it("works out running cost, carbon and the e-scooter benefit", () => {
    const ac = catalogueFacts({ kind: "APPLIANCE", type: "AC", stars: 5, inverter: true, ratedPowerW: 1450, annualKwh: 820, fuel: null, kmPerUnit: null, batteryKwh: null });
    expect(ac).toMatchObject({ yearlyKwh: 820, yearlyRupees: 5740, yearlyKg: Math.round(820 * GRID), efficiency: "BEST" });
    const ev = catalogueFacts({ kind: "VEHICLE", type: "TwoWheeler", stars: null, inverter: false, ratedPowerW: null, annualKwh: null, fuel: "Electric", kmPerUnit: 36, batteryKwh: 3 });
    expect(ev.benefitInr).toBe(5000);
  });

  it("imports a catalogue with photos (metadata stripped), reports bad rows, and upserts by SKU", async () => {
    const merchant = await db.merchant.findUniqueOrThrow({ where: { id: merchantId } });
    const csv = TEMPLATE_CSV + "BAD-1,APPLIANCE,AC,X,Y,,,,,no,,,,,,,,,,,\n";
    const out = await importCatalogue(merchant, csv, new Map([["coolwell-18inv.jpg", png()], ["volt-30.jpg", Buffer.from("not an image")]]));
    expect(out).toMatchObject({ created: 3, updated: 0, imagesAttached: 1 });
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].line).toBe(5);
    expect(out.imagesMissing).toEqual(["frostline-260.jpg"]);
    expect(out.imagesRejected).toEqual(["volt-30.jpg"]);
    const img = await db.catalogueImage.findFirstOrThrow({ where: { item: { merchantId } } });
    expect(Buffer.from(img.data).includes(Buffer.from("28.46N"))).toBe(false);

    const again = await importCatalogue(merchant, TEMPLATE_CSV.replace("41990", "39990"), new Map());
    expect(again).toMatchObject({ created: 0, updated: 3 });
    const items = await listCatalogue(merchantId);
    expect(items.find((i) => i.sku === "AC-15-5S-INV")?.priceInr).toBe(39990);
  });

  it("registers a sale from the catalogue: label facts from the catalogue, only the serial from the counter", async () => {
    const merchant = await db.merchant.findUniqueOrThrow({ where: { id: merchantId } });
    const card = await db.household.findUniqueOrThrow({ where: { id: householdId }, select: { cardCode: true } });
    const scan = await scanCard(merchant, shopUserId, card.cardCode!);
    const item = await db.catalogueItem.findFirstOrThrow({ where: { merchantId, sku: "AC-15-5S-INV" } });
    const out = await registerSale(merchant, shopUserId, { catalogueItemId: item.id, ticket: scan.ticket, item: { serialNo: `SN-P30-${stamp}`, ratedPowerW: 1 } });
    const sale = await db.merchantSale.findUniqueOrThrow({ where: { id: out.sale.id }, include: { appliance: true } });
    expect(sale.catalogueItemId).toBe(item.id);
    expect(sale.priceInr).toBe(39990);
    expect(sale.appliance?.powerKw).toBe(1.45); // from the catalogue, not the form's ratedPowerW
    expect(sale.appliance?.serialNo).toBe(`SN-P30-${stamp}`);
    const other = await db.merchant.create({ data: { userId: (await db.user.create({ data: { name: "Other", email: `other.${stamp}@p30.test`, platformRole: "MERCHANT" } })).id, businessName: "Other", city: "X", state: "UP", sells: "BOTH", status: "APPROVED" } });
    await expect(registerSale(other, shopUserId, { catalogueItemId: item.id, ticket: scan.ticket, item: { serialNo: "SN-X-1" } })).rejects.toThrow(/catalogue/);
    await db.merchant.delete({ where: { id: other.id } });
  });

  it("files a complaint with a ticket number; only admins answer, and the owner sees the reply", async () => {
    const as = (userId: string, body?: unknown) =>
      new NextRequest("http://localhost:3000/api/grievances", {
        method: body ? "POST" : "GET",
        headers: { cookie: `cw_session=${tokens[userId]}`, "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    expect((await fileGrievance(as(ownerId, { category: "BILL", subject: "Bill", message: "short" }))).status).toBe(400);
    const res = await fileGrievance(as(ownerId, { category: "BILL", subject: "Units read wrong", message: "My March bill says 512 units but the meter photo shows 312 units.", householdId }));
    expect(res.status).toBe(201);
    const { ticket } = await res.json();
    expect(ticket).toMatch(/^CW-GRV-\d{4}-\d{6}$/);
    expect((await fileGrievance(as(shopUserId, { category: "OTHER", subject: "Not my home", message: "Trying to file for a home that is not mine at all.", householdId }))).status).toBe(403);

    const g = await db.grievance.findUniqueOrThrow({ where: { ticket } });
    const reply = (cookie: string) =>
      answer(
        new NextRequest("http://localhost:3000/x", { method: "PATCH", headers: { cookie: `cw_session=${cookie}`, "content-type": "application/json" }, body: JSON.stringify({ status: "RESOLVED", response: "Corrected to 312 units; your March total is updated." }) }),
        { params: Promise.resolve({ id: g.id }) },
      );
    expect((await reply("nope")).status).toBe(401);
    expect((await reply(adminCookie)).status).toBe(200);
    const mine = await (await myTickets(as(ownerId))).json();
    expect(mine.tickets[0]).toMatchObject({ ticket, status: "RESOLVED" });
  });

  it("keeps the admin map for admins, and open data only shows areas with enough homes", async () => {
    expect((await adminMap(new NextRequest("http://localhost:3000/api/admin/carbon-map", { headers: { cookie: `cw_session=${tokens[ownerId]}` } }))).status).toBe(403);
    const ok = await adminMap(new NextRequest("http://localhost:3000/api/admin/carbon-map", { headers: { cookie: `cw_session=${adminCookie}` } }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).states.find((s: { code: string }) => s.code === "UP")).toBeTruthy();

    const open = await (await openDataApi()).json();
    expect(open.area.every((a: { homes: number }) => a.homes >= 20)).toBe(true);
    expect(JSON.stringify(open)).not.toMatch(/hh_|@example\.com/);
  });

  it("uses the measured state average only from 20 homes, else the labelled estimate", async () => {
    const est = await stateAverage("BR", "2026-03");
    expect(est.source).toBe("ESTIMATE");
    await db.areaStat.create({ data: { level: "STATE", key: "BR", month: "2031-05", homes: 25, people: 100, kgPerPerson: 33.3, byCategory: "{}" } });
    const measured = await stateAverage("BR", "2031-05");
    expect(measured).toMatchObject({ source: "HOMES", perPersonKg: 33.3, homes: 25 });
    await db.areaStat.deleteMany({ where: { month: "2031-05" } });
  });
});
