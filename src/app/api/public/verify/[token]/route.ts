import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/server/auth/rateLimit";
import { EngineError, publicShare } from "@/server/services/share.service";

/** What a bank or employer sees for a share link: sealed totals and the proof to check them. No login. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const limit = rateLimit(`public-verify:${clientIp(req)}`, 60);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return NextResponse.json({ state: "not_found" }, { status: 404 });
  try {
    const out = await publicShare(token);
    return NextResponse.json(out, { status: out.state === "ok" ? 200 : out.state === "not_found" ? 404 : 410, headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof EngineError) return NextResponse.json({ error: "The proof service is unavailable right now." }, { status: 503 });
    throw err;
  }
}
