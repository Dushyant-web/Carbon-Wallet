import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

export const SESSION_COOKIE = "cw_session";
const SESSION_DAYS = 7;

export type PlatformRole = "USER" | "ADMIN" | "MERCHANT";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole;
};

const asPlatformRole = (r: string): PlatformRole => (r === "ADMIN" || r === "MERCHANT" ? r : "USER");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createSession(userId: string, userAgent?: string | null): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return { token, expiresAt };
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_INSECURE !== "1",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function userFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  const { id, name, email, platformRole } = session.user;
  return { id, name, email, platformRole: asPlatformRole(platformRole) };
}

/** For route handlers. */
export function getRequestUser(req: NextRequest | Request): Promise<SessionUser | null> {
  const token =
    "cookies" in req && typeof (req as NextRequest).cookies?.get === "function"
      ? (req as NextRequest).cookies.get(SESSION_COOKIE)?.value
      : parseCookie(req.headers.get("cookie"), SESSION_COOKIE);
  return userFromToken(token);
}

/** For server components and layouts. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return userFromToken(store.get(SESSION_COOKIE)?.value);
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(sha256(a));
  const bb = Buffer.from(sha256(b));
  return timingSafeEqual(ab, bb);
}

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
