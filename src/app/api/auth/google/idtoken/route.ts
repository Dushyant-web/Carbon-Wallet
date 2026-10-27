import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GoogleAuthError, googleConfigured, verifyIdToken } from "@/server/auth/google";
import { userForGoogle } from "@/server/auth/googleAccounts";
import { createSession } from "@/server/auth/session";
import { clientIp, rateLimit } from "@/server/auth/rateLimit";

const Body = z.object({ idToken: z.string().min(100).max(4096), as: z.enum(["household", "merchant"]).default("household") }).strict();

/**
 * For the Android apps: Credential Manager gives the app a Google ID token; we verify it here and return our own
 * session token, which the app keeps in the Android Keystore and sends as `Authorization: Bearer …`.
 */
export async function POST(req: NextRequest) {
  if (!googleConfigured()) return NextResponse.json({ error: "Google sign-in is off on this server." }, { status: 503 });
  if (!(await rateLimit(`google-idtoken:${clientIp(req)}`, 20)).ok) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send the Google ID token." }, { status: 400 });
  try {
    const profile = await verifyIdToken(parsed.data.idToken);
    const user = await userForGoogle(profile, parsed.data.as);
    if (user.platformRole === "ADMIN") return NextResponse.json({ error: "Admins use the website." }, { status: 403 });
    const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
    return NextResponse.json({ token, expiresAt: expiresAt.toISOString(), user: { id: user.id, name: user.name, email: user.email, platformRole: user.platformRole } });
  } catch (err) {
    if (err instanceof GoogleAuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error("google id token sign-in failed", err);
    return NextResponse.json({ error: "Sign-in failed." }, { status: 500 });
  }
}
