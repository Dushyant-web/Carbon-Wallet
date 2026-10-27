import { NextRequest, NextResponse } from "next/server";
import { GoogleAuthError, OAUTH_COOKIE, exchangeCode, googleConfigured, openFlow } from "@/server/auth/google";
import { userForGoogle } from "@/server/auth/googleAccounts";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { clientIp, rateLimit } from "@/server/auth/rateLimit";
import { safeEqual } from "@/server/auth/session";

/** Google sends the browser back here with a one-time code. */
export async function GET(req: NextRequest) {
  const flow = openFlow(req.cookies.get(OAUTH_COOKIE)?.value);
  const back = flow?.as === "merchant" ? "/merchant/login" : "/login";
  const fail = (code: string, message?: string) => {
    const url = new URL(back, req.url);
    url.searchParams.set("error", code);
    if (message) url.searchParams.set("message", message.slice(0, 160));
    const res = NextResponse.redirect(url);
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  };
  if (!googleConfigured()) return fail("google-off");
  if (!(await rateLimit(`google-callback:${clientIp(req)}`, 20)).ok) return fail("slow-down");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (req.nextUrl.searchParams.get("error")) return fail("google-cancelled");
  if (!flow || !code || !state || !safeEqual(state, flow.state)) return fail("google-state");

  try {
    const profile = await exchangeCode(code, flow, req.nextUrl.origin);
    const user = await userForGoogle(profile, flow.as);
    const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
    const dest = user.platformRole === "MERCHANT" ? "/merchant" : user.platformRole === "ADMIN" ? "/admin" : flow.next;
    const res = NextResponse.redirect(new URL(dest, req.url));
    setSessionCookie(res, token, expiresAt);
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  } catch (err) {
    if (err instanceof GoogleAuthError) return fail("google", err.message);
    console.error("google sign-in failed", err);
    return fail("google");
  }
}
