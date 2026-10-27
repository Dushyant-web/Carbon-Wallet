import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { decrypt } from "@/server/storage/encrypted";
import { cleanImage, stripJpeg } from "@/server/storage/imageClean";
import { matchScheme } from "@/server/services/scheme.service";
import { computeAreaStats } from "@/server/services/mohalla.service";
import { indianAqi } from "@/server/services/weather.service";
import { carbonStatus, monthlyAllowance } from "@/lib/allowance";
import { GET as getSchemes } from "@/app/api/households/[id]/schemes/route";
import { POST as markApplied } from "@/app/api/households/[id]/schemes/[slug]/route";
import { GET as listRemovals, POST as askRemoval } from "@/app/api/households/[id]/removals/route";
import { GET as getPhoto } from "@/app/api/households/[id]/removals/[reqId]/photos/[photoId]/route";
import { PATCH as decide } from "@/app/api/admin/removals/[reqId]/route";
import { PUT as putLocation } from "@/app/api/households/[id]/location/route";
import { GET as getMohalla } from "@/app/api/households/[id]/mohalla/route";
import { POST as login } from "@/app/api/auth/login/route";
import { resetRateLimits } from "@/server/auth/rateLimit";

const stamp = Date.now();
const HH = `hh_p27_${stamp}`;
let ownerId = "";
let familyId = "";
let outsiderId = "";
let acId = "";
let adminCookie = "";
const p = <T extends Record<string, string>>(v: T) => ({ params: Promise.resolve(v) });
const as = (userId: string, url: string, init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? "GET",
    headers: { "x-user-id": userId, "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

// A tiny JPEG with an EXIF block carrying a GPS-looking string, to prove metadata is stripped before storage
const EXIF = Buffer.concat([Buffer.from("Exif\0\0"), Buffer.from("GPSLatitude 28.5706 N; Serial CAM-1234")]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1"),
  Buffer.from([0xff, 0xe1]), Buffer.from([0x00, EXIF.length + 2]), EXIF,
  Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0]), Buffer.from([1, 2, 3, 4, 5]),
  Buffer.from([0xff, 0xd9]),
]);

function removalForm(fields: Record<string, string>, photos: Buffer[] = []) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  photos.forEach((ph, i) => form.append("photos", new Blob([new Uint8Array(ph)], { type: "image/jpeg" }), `p${i}.jpg`));
  return form;
}
const postRemoval = (userId: string, form: FormData) =>
  askRemoval(new NextRequest(`http://localhost:3000/api/households/${HH}/removals`, { method: "POST", body: form, headers: { "x-user-id": userId } }), p({ id: HH }));

describe("Phase 27: schemes, removal requests, mohalla", () => {
  beforeAll(async () => {
    resetRateLimits();
    const mk = (name: string) => db.user.create({ data: { name, email: `${name.toLowerCase()}.${stamp}@p27.test` } });
    const [owner, family, outsider] = await Promise.all([mk("Owner"), mk("Family"), mk("Outsider")]);
    ownerId = owner.id;
    familyId = family.id;
    outsiderId = outsider.id;
    await db.household.create({
      data: {
        id: HH,
        name: `P27 Home ${stamp}`,
        city: "New Delhi",
        state: "DL",
        size: 4,
        homeType: "APARTMENT",
        floorAreaM2: 90,
        joinCode: `P27${stamp}`,
        memberships: { create: [{ userId: ownerId, role: "OWNER" }, { userId: familyId, role: "MEMBER" }] },
        appliances: { create: [{ name: "Old Split AC", type: "AC", rating: "3_STAR", powerKw: 1.6, avgHoursPerDay: 6 }] },
        vehicles: { create: [{ name: "Old Scooter", type: "TwoWheeler", fuel: "Petrol", kmPerUnit: 45, monthlyKm: 400, year: 2010 }] },
      },
    });
    acId = (await db.appliance.findFirstOrThrow({ where: { householdId: HH } })).id;
    const res = await login(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@carbonwallet.in", password: "AdminDemo#2026" }),
      }),
    );
    adminCookie = /cw_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")![1];
  });

  afterAll(async () => {
    await db.household.deleteMany({ where: { id: HH } });
    await db.user.deleteMany({ where: { email: { endsWith: `.${stamp}@p27.test` } } });
  });

  it("works out the state-average allowance and the colour", () => {
    expect(monthlyAllowance("UP", 4)).toBeGreaterThan(80);
    expect(monthlyAllowance("DL", 4)).toBeGreaterThan(monthlyAllowance("BR", 4));
    const a = monthlyAllowance("UP", 4);
    expect(carbonStatus("UP", 4, a * 0.8).status).toBe("GREEN");
    expect(carbonStatus("UP", 4, a).status).toBe("AMBER");
    expect(carbonStatus("UP", 4, a * 1.5).status).toBe("RED");
  });

  it("matches schemes on what the home owns, and says why", () => {
    const base = { state: "DL", ownsHome: true, discoms: [], avgMonthlyKwh: 240, appliances: [], vehicles: [] };
    expect(matchScheme("pm-surya-ghar", base)?.estimateInr).toBe(60000);
    expect(matchScheme("pm-surya-ghar", { ...base, ownsHome: false })).toBeNull();
    expect(matchScheme("pm-surya-ghar", { ...base, appliances: [{ type: "SolarPV", rating: "UNRATED", name: null }] })).toBeNull();
    expect(matchScheme("pm-e-drive", { ...base, vehicles: [{ type: "TwoWheeler", fuel: "Petrol", year: 2020, name: "Activa" }] })?.reason).toMatch(/Activa/);
    expect(matchScheme("vehicle-scrappage", { ...base, vehicles: [{ type: "Car", fuel: "Diesel", year: 2014, name: null }] }, new Date("2026-10-26"))).not.toBeNull();
    expect(matchScheme("vehicle-scrappage", { ...base, vehicles: [{ type: "Car", fuel: "Petrol", year: 2020, name: null }] }, new Date("2026-10-26"))).toBeNull();
    const ac = { ...base, appliances: [{ type: "AC", rating: "3_STAR", name: "Bedroom AC" }] };
    expect(matchScheme("tpddl-ac-replacement", ac)?.reason).toMatch(/Tata Power-DDL/);
    expect(matchScheme("tpddl-ac-replacement", { ...ac, discoms: ["BSES Rajdhani"] })).toBeNull();
    expect(matchScheme("tpddl-ac-replacement", { ...ac, state: "UP" })).toBeNull();
  });

  it("shows the home its schemes; only the owner records an application", async () => {
    const res = await getSchemes(as(familyId, `/api/households/${HH}/schemes`), p({ id: HH }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const slugs = body.forYou.map((s: { slug: string }) => s.slug);
    expect(slugs).toEqual(expect.arrayContaining(["pm-e-drive", "vehicle-scrappage", "tpddl-ac-replacement"]));
    expect(body.all.length).toBeGreaterThanOrEqual(5);
    expect((await getSchemes(as(outsiderId, `/api/households/${HH}/schemes`), p({ id: HH }))).status).toBe(403);
    expect((await markApplied(as(familyId, "/x", { method: "POST" }), p({ id: HH, slug: "pm-e-drive" }))).status).toBe(403);
    expect((await markApplied(as(ownerId, "/x", { method: "POST" }), p({ id: HH, slug: "pm-e-drive" }))).status).toBe(201);
    expect((await markApplied(as(ownerId, "/x", { method: "POST" }), p({ id: HH, slug: "no-such-scheme" }))).status).toBe(404);
  });

  it("strips photo metadata and refuses files that aren't pictures", () => {
    expect(JPEG.includes(Buffer.from("GPSLatitude"))).toBe(true);
    const clean = stripJpeg(JPEG);
    expect(clean.includes(Buffer.from("GPSLatitude"))).toBe(false);
    expect(clean.includes(Buffer.from("JFIF"))).toBe(true);
    expect(cleanImage(Buffer.from("%PDF-1.7 not a photo"))).toBeNull();
  });

  it("removal: owner asks with photos and a note, the item stays until an admin decides", async () => {
    const fields = { kind: "APPLIANCE", itemId: acId, reason: "BROKEN", note: "Compressor died in May; the mechanic says it can't be repaired." };
    expect((await postRemoval(familyId, removalForm(fields, [JPEG]))).status).toBe(403);
    expect((await postRemoval(ownerId, removalForm(fields))).status).toBe(400); // a broken item needs a photo
    expect((await postRemoval(ownerId, removalForm({ ...fields, note: "broken" }, [JPEG]))).status).toBe(400); // two lines, please
    expect((await postRemoval(ownerId, removalForm(fields, [Buffer.from("not an image at all")]))).status).toBe(415);
    const ok = await postRemoval(ownerId, removalForm(fields, [JPEG]));
    expect(ok.status).toBe(201);
    const { id: reqId } = await ok.json();

    const stored = await db.removalPhoto.findFirstOrThrow({ where: { requestId: reqId } });
    expect(Buffer.from(stored.data).includes(Buffer.from("JFIF"))).toBe(false); // encrypted at rest
    expect(decrypt(Buffer.from(stored.data)).includes(Buffer.from("GPSLatitude"))).toBe(false);

    const photo = await getPhoto(as(familyId, "/x"), p({ id: HH, reqId, photoId: stored.id }));
    expect(photo.status).toBe(200);
    expect(photo.headers.get("content-type")).toBe("image/jpeg");
    expect(photo.headers.get("cache-control")).toContain("no-store");
    expect((await getPhoto(as(outsiderId, "/x"), p({ id: HH, reqId, photoId: stored.id }))).status).toBe(403);

    const list = await (await listRemovals(as(familyId, `/api/households/${HH}/removals`), p({ id: HH }))).json();
    expect(list.requests[0]).toMatchObject({ status: "PENDING", reason: "BROKEN" });
    expect(await db.appliance.count({ where: { id: acId } })).toBe(1);

    const admin = (body: unknown) =>
      decide(
        new NextRequest("http://localhost:3000/x", { method: "PATCH", headers: { cookie: `cw_session=${adminCookie}`, "content-type": "application/json" }, body: JSON.stringify(body) }),
        p({ reqId }),
      );
    expect((await admin({ decision: "REJECT" })).status).toBe(400); // the owner must be told why
    expect((await admin({ decision: "REJECT", note: "The photo shows a different AC. Send one of the label." })).status).toBe(200);
    expect(await db.appliance.count({ where: { id: acId } })).toBe(1);
    expect((await admin({ decision: "APPROVE" })).status).toBe(409); // decided once
    expect(await db.auditLog.count({ where: { householdId: HH, action: "removal.rejected" } })).toBe(1);
  });

  it("stores only H3 cells for the home's place, and hides areas with too few homes", async () => {
    const place = { lat: 28.5677, lng: 77.2433, source: "MANUAL", pincode: "110024", locality: "Lajpat Nagar" };
    expect((await putLocation(as(familyId, "/x", { method: "PUT", body: place }), p({ id: HH }))).status).toBe(403);
    expect((await putLocation(as(ownerId, "/x", { method: "PUT", body: { ...place, lat: 51.5, lng: -0.12 } }), p({ id: HH }))).status).toBe(400);
    expect((await putLocation(as(ownerId, "/x", { method: "PUT", body: place }), p({ id: HH }))).status).toBe(200);

    const loc = await db.householdLocation.findUniqueOrThrow({ where: { householdId: HH } });
    expect(loc.h3Cell).toMatch(/^8a/); // resolution 10
    expect(loc.h3Area).toMatch(/^87/); // resolution 7
    expect(JSON.stringify(loc)).not.toContain("28.5677");
    expect(loc.mohallaId).toBeTruthy();

    const month = "2026-03";
    await db.monthlySummary.create({ data: { householdId: HH, month, totalKg: 200, byCategory: JSON.stringify({ Electricity: 150, Transport: 50 }), score: 60 } });
    await computeAreaStats(month);
    const india = await db.areaStat.findUniqueOrThrow({ where: { level_key_month: { level: "INDIA", key: "IN", month } } });
    expect(india.homes).toBeGreaterThanOrEqual(2);

    const view = await (await getMohalla(as(familyId, `/api/households/${HH}/mohalla`), p({ id: HH }))).json();
    expect(view.minHomes).toBe(20);
    const level = (l: string) => view.levels.find((x: { level: string }) => x.level === l);
    expect(level("HOME").kgPerPerson).toBe(50);
    for (const l of ["MOHALLA", "CITY"]) {
      expect(level(l).hidden).toBe(true);
      expect(level(l).kgPerPerson).toBeNull();
    }
    expect(view.weather).toBeNull(); // the weather API is off in tests
  });

  it("works out the Indian AQI from PM2.5 and PM10", () => {
    expect(indianAqi(25, 40)).toEqual({ aqi: 42, band: "Good" });
    expect(indianAqi(95, 120).band).toBe("Poor");
    expect(indianAqi(null, null)).toEqual({ aqi: null, band: null });
  });
});
