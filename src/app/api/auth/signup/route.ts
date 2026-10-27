import { NextRequest } from "next/server";
import { registerUser, badRequest } from "@/server/auth/accounts";
import { rateLimit, clientIp } from "@/server/auth/rateLimit";

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`signup:${clientIp(req)}`, 10);
  if (!limit.ok) return badRequest(`Too many attempts. Try again in ${limit.retryAfterSec}s.`, 429);
  const body = await req.json().catch(() => null);
  return registerUser(body, "USER", req.headers.get("user-agent"));
}
