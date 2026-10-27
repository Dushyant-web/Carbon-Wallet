import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { LoginSchema, badRequest } from "@/server/auth/accounts";
import { verifyPassword } from "@/server/auth/password";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { rateLimit, clientIp } from "@/server/auth/rateLimit";

const GENERIC = "Email or password is incorrect.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return badRequest(GENERIC, 401);
  const { email, password } = parsed.data;

  const limit = await rateLimit(`login:${clientIp(req)}:${email}`, 5);
  if (!limit.ok) return badRequest(`Too many attempts. Try again in ${limit.retryAfterSec}s.`, 429);

  const user = await db.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok) return badRequest(GENERIC, 401);
  if (user.status === "DELETION_PENDING") {
    const on = new Date((user.deletionRequestedAt ?? new Date()).getTime() + 30 * 86_400_000).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    return badRequest(`This account is being deleted, as you asked. Everything will be erased on ${on}.`, 403);
  }
  if (user.status !== "ACTIVE") return badRequest("This account is disabled. Contact an admin.", 403);

  const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, platformRole: user.platformRole },
  });
  setSessionCookie(res, token, expiresAt);
  return res;
}
