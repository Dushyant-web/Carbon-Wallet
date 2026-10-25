import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { code128Values, code128Widths, code128Modules, PATTERN_TABLE } from "@/lib/code128";
import { ensureHouseholdIdentity, formatCardCode, newCardCode } from "@/server/services/identity.service";
import { parseReaderInput } from "@/server/services/card.service";
import { POST as lookup } from "@/app/api/cards/lookup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as reissue } from "@/app/api/households/[id]/cards/reissue/route";
import { GET as publicPassbook } from "@/app/api/public/passbook/[token]/route";
import { GET as memberPassbook } from "@/app/api/households/[id]/passbook/route";
import { resetRateLimits } from "@/server/auth/rateLimit";

const HH = "hh_05_singh";
const req = (url: string, init: { method?: string; body?: unknown; cookie?: string } = {}) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", ...(init.cookie ? { cookie: `cw_session=${init.cookie}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

describe("Phase 16: the private card code and its Code 128 barcode", () => {
  let kiosk = "";
  beforeAll(async () => {
    resetRateLimits();
    const res = await login(req("/api/auth/login", { method: "POST", body: { email: "admin@carbonwallet.in", password: "AdminDemo#2026" } }));
    kiosk = /cw_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")![1];
  });

  it("encodes Code 128-B correctly", () => {
    // every symbol is 11 modules wide, the stop symbol 13
    PATTERN_TABLE.forEach((p, v) => expect(p.split("").reduce((a, b) => a + Number(b), 0)).toBe(v === 106 ? 13 : 11));
    // "Wikipedia": 104 + 55·1 + 73·2 + 75·3 + 73·4 + 80·5 + 69·6 + 68·7 + 73·8 + 65·9 = 3281; 3281 mod 103 = 88
    const values = code128Values("Wikipedia");
    expect(values[0]).toBe(104);
    expect(values.slice(1, -2)).toEqual([55, 73, 75, 73, 80, 69, 68, 73, 65]);
    expect(values[values.length - 2]).toBe(88);
    expect(values[values.length - 1]).toBe(106);
    // a card code: start + 15 characters + check + stop = 17 × 11 + 13 modules
    expect(code128Modules("CW1ABCDEFGHJKMN")).toBe(17 * 11 + 13);
    expect(code128Widths("CW1ABCDEFGHJKMN")[0]).toBe(2); // starts with a bar
  });

  it("generates unambiguous codes and reads them however a scanner types them", () => {
    const c = newCardCode();
    expect(c).toMatch(/^CW1[0-9A-HJKMNP-TV-Z]{12}$/);
    expect(formatCardCode(c)).toMatch(/^CW1-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(parseReaderInput(c)).toEqual({ kind: "code", code: c });
    expect(parseReaderInput(formatCardCode(c).toLowerCase())).toEqual({ kind: "code", code: c });
    expect(parseReaderInput("CW1-IIII-LLLL-OOOO").kind).not.toBe("code"); // letters that aren't in the alphabet
  });

  it("only kiosks resolve the code, never the public passbook, and reissuing kills the old card", async () => {
    const { cardCode, publicToken } = await ensureHouseholdIdentity(HH);
    expect(cardCode).toMatch(/^CW1/);

    const ok = await lookup(req("/api/cards/lookup", { method: "POST", body: { input: formatCardCode(cardCode) }, cookie: kiosk }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).via).toBe("card");

    // the public passbook never contains the private code; the members' passbook does
    const pub = await publicPassbook(req(`/api/public/passbook/${publicToken}`), { params: Promise.resolve({ token: publicToken }) });
    expect(JSON.stringify(await pub.json())).not.toContain(cardCode);
    const mine = await memberPassbook(req(`/api/households/${HH}/passbook`), { params: Promise.resolve({ id: HH }) });
    expect((await mine.json()).cardCode).toBe(cardCode);

    const res = await reissue(req(`/api/households/${HH}/cards/reissue`, { method: "POST" }), { params: Promise.resolve({ id: HH }) });
    expect(res.status).toBe(200);
    const fresh = (await res.json()).cardCode;
    expect(fresh).not.toBe(cardCode);
    expect((await lookup(req("/api/cards/lookup", { method: "POST", body: { input: cardCode }, cookie: kiosk }))).status).toBe(404);
    expect((await lookup(req("/api/cards/lookup", { method: "POST", body: { input: fresh }, cookie: kiosk }))).status).toBe(200);
    expect(await db.auditLog.count({ where: { householdId: HH, action: "card.reissue" } })).toBeGreaterThan(0);
  });
});
