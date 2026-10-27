import { createHash } from "crypto";

/*
 * Fixed-window rate limits. On a single server the in-memory counter is enough; on Netlify (many short-lived
 * function instances) set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN so every instance shares one counter.
 * Keys are hashed before they leave the server (they can contain emails or IP addresses). If Redis is unreachable
 * the in-memory counter still applies, so a Redis outage never opens the door completely.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
type Result = { ok: boolean; retryAfterSec: number };

function memory(key: string, limit: number, windowMs: number): Result {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

async function shared(key: string, limit: number, windowMs: number): Promise<Result | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const window = Math.floor(Date.now() / windowMs);
  const k = `rl:${createHash("sha256").update(key).digest("base64url").slice(0, 32)}:${window}`;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([["INCR", k], ["PEXPIRE", k, String(windowMs)]]),
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const count = Number((await res.json())?.[0]?.result);
    if (!Number.isFinite(count)) return null;
    const retryAfterSec = Math.ceil(((window + 1) * windowMs - Date.now()) / 1000);
    return count > limit ? { ok: false, retryAfterSec } : { ok: true, retryAfterSec: 0 };
  } catch {
    return null;
  }
}

export async function rateLimit(key: string, limit = 5, windowMs = 60_000): Promise<Result> {
  const local = memory(key, limit, windowMs);
  if (!local.ok) return local;
  return (await shared(key, limit, windowMs)) ?? local;
}

export function clientIp(req: Request): string {
  // Netlify and Render put the real client first; never trust a value the client could add after it
  return req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function resetRateLimits() {
  buckets.clear();
}
