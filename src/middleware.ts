import { NextRequest, NextResponse } from "next/server";

// Runs on the edge, so it can only check that a session cookie exists. The real session lookup
// (expiry, disabled users, roles) happens in the (app)/(admin) layouts and in every API guard.
const SESSION_COOKIE = "cw_session";

const PUBLIC_PAGES = new Set(["/", "/login", "/signup", "/admin/login", "/admin/signup", "/merchant/login", "/merchant/signup", "/methodology", "/privacy"]);
const PUBLIC_ENGINE = ["/py/api/v1/health", "/py/api/v1/verify", "/py/api/v1/factors"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  // CSRF: state-changing requests must come from this origin.
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host")) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/api/")) return NextResponse.next(); // route handlers enforce auth

  if (pathname.startsWith("/py/")) {
    if (!hasSession && !PUBLIC_ENGINE.some((p) => pathname.startsWith(p))) {
      return NextResponse.json({ error: "Unauthenticated: please log in" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // /p/<token>: public record; /verify/<token>: sealed months for a bank or employer. Both only from a link the owner shares
  if (PUBLIC_PAGES.has(pathname) || pathname.startsWith("/p/") || pathname.startsWith("/verify/")) return NextResponse.next();

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.startsWith("/admin") ? "/admin/login" : pathname.startsWith("/merchant") ? "/merchant/login" : "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|samples/|sw.js|offline.html|manifest.webmanifest|.*\\.(?:png|jpg|svg|pdf|ico|webp)$).*)"],
};
