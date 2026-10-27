import { NextRequest, NextResponse } from "next/server";
import { OAUTH_COOKIE, googleConfigured, safeNext, startFlow } from "@/server/auth/google";
import { clientIp, rateLimit } from "@/server/auth/rateLimit";

/** Sends the browser to Google's account chooser. ?as=merchant for shops; ?next=/path to come back to. */
export async function GET(req: NextRequest) {
  const as = req.nextUrl.searchParams.get("as") === "merchant" ? "merchant" : "household";
  const back = as === "merchant" ? "/merchant/login" : "/login";
  if (!googleConfigured()) return NextResponse.redirect(new URL(`${back}?error=google-off`, req.url));
  if (!(await rateLimit(`google-start:${clientIp(req)}`, 20)).ok) return NextResponse.redirect(new URL(`${back}?error=slow-down`, req.url));
  const next = safeNext(req.nextUrl.searchParams.get("next"), as === "merchant" ? "/merchant" : "/dashboard");
  const flow = startFlow(req.nextUrl.origin, as, next);
  const res = NextResponse.redirect(flow.url);
  res.cookies.set(OAUTH_COOKIE, flow.cookie, {
    httpOnly: true,
    sameSite: "lax", // sent on Google's top-level redirect back to us
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_INSECURE !== "1",
    path: "/api/auth/google",
    maxAge: flow.maxAge,
  });
  return res;
}
