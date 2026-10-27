import { createHash, createHmac, randomBytes, timingSafeEqual, webcrypto } from "crypto";

/*
 * "Continue with Google" for the website: OAuth 2.0 authorization-code flow, done on the server, with
 * state (CSRF), PKCE (S256) and a nonce. The ID token's signature is checked against Google's published keys,
 * plus issuer, audience, expiry, nonce and email_verified. The client secret lives only in the server's env
 * (GOOGLE_CLIENT_SECRET): never in the repo, the browser or the Android app.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
export const OAUTH_COOKIE = "cw_oauth";
const FLOW_MINUTES = 10;

export type GoogleFlow = { state: string; verifier: string; nonce: string; as: "household" | "merchant"; next: string; exp: number };
export type GoogleProfile = { sub: string; email: string; name: string; hostedDomain: string | null };

export class GoogleAuthError extends Error {}

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Android sends Google ID tokens minted for its own client id; both are accepted audiences. */
function audiences() {
  return [process.env.GOOGLE_CLIENT_ID, ...(process.env.GOOGLE_ANDROID_CLIENT_IDS ?? "").split(",")].map((s) => s?.trim()).filter(Boolean) as string[];
}

export function redirectUri(origin: string) {
  return `${(process.env.APP_URL || origin).replace(/\/$/, "")}/api/auth/google/callback`;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

function flowKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.STORAGE_KEY;
  if (!secret) throw new GoogleAuthError("AUTH_SECRET is not configured");
  return createHash("sha256").update(`oauth-flow:${secret}`).digest();
}

/** The flow's secrets travel in a short-lived, signed, httpOnly cookie; nothing is stored server-side. */
export function sealFlow(flow: GoogleFlow): string {
  const body = b64url(Buffer.from(JSON.stringify(flow)));
  const mac = b64url(createHmac("sha256", flowKey()).update(body).digest());
  return `${body}.${mac}`;
}

export function openFlow(cookie: string | undefined): GoogleFlow | null {
  if (!cookie) return null;
  const [body, mac] = cookie.split(".");
  if (!body || !mac) return null;
  const want = createHmac("sha256", flowKey()).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const flow = JSON.parse(Buffer.from(body, "base64url").toString()) as GoogleFlow;
    return flow.exp > Date.now() ? flow : null;
  } catch {
    return null;
  }
}

export function safeNext(next: string | null | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next.slice(0, 200) : fallback;
}

export function startFlow(origin: string, as: "household" | "merchant", next: string) {
  const flow: GoogleFlow = {
    state: b64url(randomBytes(24)),
    verifier: b64url(randomBytes(48)),
    nonce: b64url(randomBytes(16)),
    as,
    next,
    exp: Date.now() + FLOW_MINUTES * 60_000,
  };
  const challenge = b64url(createHash("sha256").update(flow.verifier).digest());
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie: sealFlow(flow), maxAge: FLOW_MINUTES * 60 };
}

export async function exchangeCode(code: string, flow: GoogleFlow, origin: string): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body.id_token !== "string") throw new GoogleAuthError("Google sign-in was not completed.");
  return verifyIdToken(body.id_token, flow.nonce);
}

type Jwk = { kid: string; n: string; e: string; kty: string; alg?: string };
let jwks: { keys: Jwk[]; until: number } | null = null;

async function googleKeys(force = false): Promise<Jwk[]> {
  if (!force && jwks && jwks.until > Date.now()) return jwks.keys;
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!res.ok) throw new GoogleAuthError("Couldn't reach Google to check the sign-in.");
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600);
  jwks = { keys: (await res.json()).keys, until: Date.now() + Math.min(maxAge, 86_400) * 1000 };
  return jwks.keys;
}

/** Verifies a Google ID token (web callback or Android Credential Manager) and returns who signed in. */
export async function verifyIdToken(idToken: string, nonce?: string): Promise<GoogleProfile> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new GoogleAuthError("Malformed Google token.");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  if (header.alg !== "RS256" || !header.kid) throw new GoogleAuthError("Unexpected Google token.");
  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(true)).find((k) => k.kid === header.kid); // keys rotate
  if (!jwk) throw new GoogleAuthError("Unknown Google signing key.");
  const key = await webcrypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await webcrypto.subtle.verify("RSASSA-PKCS1-v1_5", key, Buffer.from(parts[2], "base64url"), Buffer.from(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new GoogleAuthError("Google token signature is invalid.");

  const c = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  const now = Math.floor(Date.now() / 1000);
  if (!ISSUERS.has(c.iss)) throw new GoogleAuthError("Wrong token issuer.");
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.some((a: string) => audiences().includes(a))) throw new GoogleAuthError("Token is for another app.");
  if (typeof c.exp !== "number" || c.exp < now - 60) throw new GoogleAuthError("Google sign-in expired. Try again.");
  if (nonce !== undefined && c.nonce !== nonce) throw new GoogleAuthError("Sign-in didn't match. Try again.");
  if (c.email_verified !== true && c.email_verified !== "true") throw new GoogleAuthError("Your Google email isn't verified.");
  if (typeof c.sub !== "string" || typeof c.email !== "string") throw new GoogleAuthError("Google didn't share your email.");
  return { sub: c.sub, email: c.email.toLowerCase(), name: String(c.name ?? c.email.split("@")[0]).slice(0, 80), hostedDomain: c.hd ?? null };
}

/**
 * Linking a Google sign-in to an existing account found by email is safe only when Google is the authority for
 * that address (gmail.com, or a Workspace domain shown in `hd`); otherwise the person must sign in the old way first.
 */
export function googleOwnsEmail(p: GoogleProfile) {
  const domain = p.email.split("@")[1];
  return domain === "gmail.com" || domain === "googlemail.com" || (!!p.hostedDomain && p.hostedDomain === domain);
}
