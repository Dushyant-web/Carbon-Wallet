import { createHash, createHmac, randomBytes } from "crypto";

/**
 * Signs a call from this server to the engine (backend/app/signing.py): HMAC-SHA256 over the time, a nonce,
 * the method, path and body hash, keyed with ENGINE_API_KEY. The key never goes over the wire, and a captured request
 * stops working after 5 minutes (and can't be replayed within them).
 */
export function engineHeaders(method: string, url: string, body?: Buffer | Uint8Array | string): Record<string, string> {
  const key = process.env.ENGINE_API_KEY;
  if (!key) return {};
  const u = new URL(url);
  const ts = String(Math.floor(Date.now() / 1000));
  const bytes = body === undefined ? Buffer.alloc(0) : typeof body === "string" ? Buffer.from(body) : Buffer.from(body);
  const nonce = randomBytes(16).toString("hex");
  const msg = `${ts}\n${nonce}\n${method.toUpperCase()}\n${u.pathname}${u.search}\n${createHash("sha256").update(bytes).digest("hex")}`;
  return { "x-engine-ts": ts, "x-engine-nonce": nonce, "x-engine-sig": createHmac("sha256", key).update(msg).digest("hex") };
}
