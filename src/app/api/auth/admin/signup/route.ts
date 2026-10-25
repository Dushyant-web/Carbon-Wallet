import { NextRequest } from "next/server";
import { registerUser, badRequest } from "@/server/auth/accounts";
import { rateLimit, clientIp } from "@/server/auth/rateLimit";
import { safeEqual } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  const limit = rateLimit(`admin-signup:${clientIp(req)}`, 5);
  if (!limit.ok) return badRequest(`Too many attempts. Try again in ${limit.retryAfterSec}s.`, 429);

  const expected = process.env.ADMIN_INVITE_CODE;
  if (!expected) return badRequest("Admin sign-up is disabled on this server.", 503);

  const body = (await req.json().catch(() => null)) as { inviteCode?: unknown } | null;
  const code = typeof body?.inviteCode === "string" ? body.inviteCode : "";
  if (!code || !safeEqual(code, expected)) return badRequest("That invite code isn't valid.", 403);

  return registerUser(body, "ADMIN", req.headers.get("user-agent"));
}
