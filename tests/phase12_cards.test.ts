import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { normalizeUid, parseReaderInput } from "@/server/services/card.service";
import { ensureHouseholdIdentity } from "@/server/services/identity.service";
import { POST as pairCard, GET as listCards } from "@/app/api/households/[id]/cards/route";
import { DELETE as revokeCard } from "@/app/api/households/[id]/cards/[cardId]/route";
import { POST as lookup } from "@/app/api/cards/lookup/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { resetRateLimits } from "@/server/auth/rateLimit";

const HH = "hh_01_sharma";
const UID = "04:A2:3F:1B:2C:80:90";

function req(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; cookie?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...(init.headers ?? {}) };
  if (init.cookie) headers.cookie = `cw_session=${init.cookie}`;
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

describe("Phase 12: physical Carbon Card, reader and receipts", () => {
  let session = ""; // the kiosk: a platform admin
  let userSession = ""; // an ordinary signed-in user

  beforeAll(async () => {
    resetRateLimits();
    const res = await signup(
      req("/api/auth/signup", { method: "POST", body: { name: "Kiosk Operator", email: `kiosk.${Date.now()}@example.com`, password: "Kiosk12345" } }),
    );
    userSession = /cw_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")![1];
    const admin = await login(req("/api/auth/login", { method: "POST", body: { email: "admin@carbonwallet.in", password: "AdminDemo#2026" } }));
    session = /cw_session=([^;]+)/.exec(admin.headers.get("set-cookie") ?? "")![1];
  });

  it("normalises chip UIDs in the formats readers emit", () => {
    expect(normalizeUid("04:a2:3f:1b:2c:80:90")).toBe("04A23F1B2C8090");
    expect(normalizeUid("04 A2 3F 1B")).toBe("04A23F1B");
    expect(normalizeUid("xyz")).toBeNull();
    expect(normalizeUid("04A23F1B2C80")).toBeNull(); // 6 bytes is not a real UID length
  });

  it("understands links, cw: tokens, hex and 10-digit decimal UIDs", () => {
    expect(parseReaderInput("http://192.168.1.5:3000/p/sharma-demo")).toEqual({ kind: "token", token: "sharma-demo" });
    expect(parseReaderInput("cw:sharma-demo")).toEqual({ kind: "token", token: "sharma-demo" });
    expect(parseReaderInput("04A23F1B2C8090")).toEqual({ kind: "uid", uids: ["04A23F1B2C8090"] });
    const dec = parseReaderInput("0300000001");
    expect(dec.kind).toBe("uid");
    expect(dec.kind === "uid" && dec.uids).toEqual(["11E1A301", "01A3E111"]);
    expect(parseReaderInput("hello").kind).toBe("invalid");
  });

  it("lets the owner pair a card, but not a viewer", async () => {
    const asViewer = await pairCard(req(`/api/households/${HH}/cards`, { method: "POST", body: { uid: UID }, headers: { "x-demo-role": "VIEWER" } }), {
      params: Promise.resolve({ id: HH }),
    });
    expect(asViewer.status).toBe(403);

    const ok = await pairCard(req(`/api/households/${HH}/cards`, { method: "POST", body: { uid: UID } }), { params: Promise.resolve({ id: HH }) });
    expect(ok.status).toBe(201);
    expect((await ok.json()).card.uidMasked).toBe("••••8090");

    const dup = await pairCard(req(`/api/households/${HH}/cards`, { method: "POST", body: { uid: "04a23f1b2c8090" } }), { params: Promise.resolve({ id: HH }) });
    expect(dup.status).toBe(409);

    const list = await (await listCards(req(`/api/households/${HH}/cards`), { params: Promise.resolve({ id: HH }) })).json();
    expect(JSON.stringify(list)).not.toContain("04A23F1B2C8090"); // full UID never leaves the server
  });

  it("turns a tapped card into a receipt with totals only", async () => {
    expect((await lookup(req("/api/cards/lookup", { method: "POST", body: { input: UID } }))).status).toBe(401);
    // only Carbon Wallet kiosks (platform admins) can read cards; an ordinary account can't
    expect((await lookup(req("/api/cards/lookup", { method: "POST", body: { input: UID }, cookie: userSession }))).status).toBe(403);

    const res = await lookup(req("/api/cards/lookup", { method: "POST", body: { input: "04A23F1B2C8090" }, cookie: session }));
    expect(res.status).toBe(200);
    const text = await res.text();
    const receipt = JSON.parse(text);
    expect(receipt.via).toBe("card");
    expect(receipt.receiptNo).toMatch(/^R-\d{8}-[0-9A-F]{6}$/);
    expect(receipt.current.totalKg).toBeGreaterThan(0);
    const members = await db.membership.findMany({ where: { householdId: HH }, include: { user: true } });
    for (const m of members) expect(text).not.toContain(m.user.email);
    expect(text).not.toContain((await db.household.findUnique({ where: { id: HH } }))!.joinCode);

    const card = await db.card.findUnique({ where: { uid: "04A23F1B2C8090" } });
    expect(card?.lastUsedAt).not.toBeNull();
  });

  it("also prints from the QR / link on the card", async () => {
    const { publicToken } = await ensureHouseholdIdentity(HH);
    const res = await lookup(req("/api/cards/lookup", { method: "POST", body: { input: `https://anything.example/p/${publicToken}` }, cookie: session }));
    expect(res.status).toBe(200);
    expect((await res.json()).via).toBe("link");
  });

  it("stops resolving a revoked card", async () => {
    const card = await db.card.findUniqueOrThrow({ where: { uid: "04A23F1B2C8090" } });
    const del = await revokeCard(req(`/api/households/${HH}/cards/${card.id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: HH, cardId: card.id }),
    });
    expect(del.status).toBe(200);
    const res = await lookup(req("/api/cards/lookup", { method: "POST", body: { input: UID }, cookie: session }));
    expect(res.status).toBe(404);
  });
});
