import { NextRequest, NextResponse } from "next/server";
import { buildPassbook, householdIdForPublicToken } from "@/server/services/passbook.service";
import { rateLimit, clientIp } from "@/server/auth/rateLimit";

/** Public, read-only carbon record behind a household's shared link. Aggregates only: no members, join code or ids. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const limit = await rateLimit(`public-passbook:${clientIp(req)}`, 60);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { token } = await params;
  const householdId = await householdIdForPublicToken(token);
  if (!householdId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { publicToken: _omit, ...passbook } = await buildPassbook(householdId);
  void _omit;
  return NextResponse.json(passbook, { headers: { "Cache-Control": "public, max-age=60" } });
}
