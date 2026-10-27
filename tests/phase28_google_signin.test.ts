import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { generateKeyPairSync, createSign } from "crypto";
import { db } from "@/server/db";
import { openFlow, safeNext, sealFlow, verifyIdToken, GoogleAuthError, type GoogleFlow } from "@/server/auth/google";
import { userForGoogle } from "@/server/auth/googleAccounts";

/*
 * Google sign-in without Google: a local RSA key stands in for Google's, served from a stubbed JWKS endpoint.
 * Checks the signature, issuer, audience, expiry, nonce and email_verified rules, the signed flow cookie,
 * and when a Google account may be linked to an existing user.
 */

const CLIENT = "test-client.apps.googleusercontent.com";
const stamp = Date.now();
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: "jwk" }) as { n: string; e: string; kty: string }), kid: "test-kid", alg: "RS256", use: "sig" };

function token(claims: Record<string, unknown>, kid = "test-kid") {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "RS256", kid, typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const body = enc({ iss: "https://accounts.google.com", aud: CLIENT, iat: now, exp: now + 600, email_verified: true, ...claims });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}

describe("Phase 28: Google sign-in", () => {
  beforeAll(() => {
    vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
    vi.stubEnv("AUTH_SECRET", "test-auth-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("oauth2/v3/certs")) return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "cache-control": "max-age=3600" } });
        throw new Error(`unexpected fetch ${url}`);
      }),
    );
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await db.user.deleteMany({ where: { email: { contains: `${stamp}` } } });
  });

  it("accepts a token signed by Google's key for our app, with the right nonce", async () => {
    const p = await verifyIdToken(token({ sub: "g-1", email: `Asha.${stamp}@gmail.com`, name: "Asha", nonce: "n1" }), "n1");
    expect(p).toMatchObject({ sub: "g-1", email: `asha.${stamp}@gmail.com`, name: "Asha" });
  });

  it("rejects wrong audience, issuer, nonce, expired, unverified email, unknown key and forged signatures", async () => {
    const bad = [
      token({ sub: "x", email: "a@gmail.com", aud: "someone-else" }),
      token({ sub: "x", email: "a@gmail.com", iss: "https://evil.example" }),
      token({ sub: "x", email: "a@gmail.com", exp: Math.floor(Date.now() / 1000) - 3600 }),
      token({ sub: "x", email: "a@gmail.com", email_verified: false }),
      token({ sub: "x", email: "a@gmail.com" }, "other-kid"),
    ];
    for (const t of bad) await expect(verifyIdToken(t)).rejects.toBeInstanceOf(GoogleAuthError);
    await expect(verifyIdToken(token({ sub: "x", email: "a@gmail.com", nonce: "n1" }), "n2")).rejects.toBeInstanceOf(GoogleAuthError);
    const [h, b] = token({ sub: "x", email: "a@gmail.com" }).split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "admin", email: "admin@carbonwallet.in", aud: CLIENT, iss: "accounts.google.com", exp: 9e9, email_verified: true })).toString("base64url")}.${token({ sub: "y", email: "b@gmail.com" }).split(".")[2]}`;
    await expect(verifyIdToken(forged)).rejects.toBeInstanceOf(GoogleAuthError);
    expect(b).toBeTruthy();
  });

  it("signs the flow cookie, so state, verifier and return path can't be changed", () => {
    const flow: GoogleFlow = { state: "s", verifier: "v", nonce: "n", as: "household", next: "/bills", exp: Date.now() + 60_000 };
    const sealed = sealFlow(flow);
    expect(openFlow(sealed)).toEqual(flow);
    const [body, mac] = sealed.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...flow, next: "https://evil.example" })).toString("base64url");
    expect(openFlow(`${tampered}.${mac}`)).toBeNull();
    expect(openFlow(`${body}.x${mac.slice(1)}`)).toBeNull();
    expect(openFlow(sealFlow({ ...flow, exp: Date.now() - 1 }))).toBeNull();
    expect(safeNext("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeNext("/\\evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeNext("/mohalla", "/dashboard")).toBe("/mohalla");
  });

  it("creates households and shops, links by email only when Google owns it, and never makes admins", async () => {
    const asha = await userForGoogle({ sub: `g-asha-${stamp}`, email: `asha.${stamp}@gmail.com`, name: "Asha", hostedDomain: null }, "household");
    expect(asha.platformRole).toBe("USER");
    const again = await userForGoogle({ sub: `g-asha-${stamp}`, email: `asha.${stamp}@gmail.com`, name: "Asha", hostedDomain: null }, "merchant");
    expect(again.id).toBe(asha.id); // same Google account → same user, whatever button was used

    const shop = await userForGoogle({ sub: `g-shop-${stamp}`, email: `shop.${stamp}@gmail.com`, name: "Shop", hostedDomain: null }, "merchant");
    expect(shop.platformRole).toBe("MERCHANT");

    await db.user.create({ data: { name: "Old", email: `old.${stamp}@example.com`, passwordHash: "x" } });
    await expect(userForGoogle({ sub: `g-old-${stamp}`, email: `old.${stamp}@example.com`, name: "Old", hostedDomain: null }, "household")).rejects.toBeInstanceOf(GoogleAuthError);
    const linked = await userForGoogle({ sub: `g-ws-${stamp}`, email: `old.${stamp}@example.com`, name: "Old", hostedDomain: "example.com" }, "household");
    expect(linked.email).toBe(`old.${stamp}@example.com`);

    await expect(userForGoogle({ sub: `g-admin-${stamp}`, email: "admin@carbonwallet.in", name: "Admin", hostedDomain: "carbonwallet.in" }, "household")).rejects.toBeInstanceOf(GoogleAuthError);
    expect(await db.oAuthIdentity.count({ where: { subject: `g-admin-${stamp}` } })).toBe(0); // never linked without ADMIN_EMAILS
  });
});
