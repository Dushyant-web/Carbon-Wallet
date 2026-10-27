import { db } from "@/server/db";
import { GoogleAuthError, googleOwnsEmail, type GoogleProfile } from "./google";
import type { PlatformRole } from "./session";

/**
 * Who a Google sign-in is: the linked account, or an existing account with that verified email (linked now), or a
 * new account. New accounts are households or shops, never platform admins. An admin may use Google only when
 * their email is on ADMIN_EMAILS.
 */
function adminAllowed(email: string) {
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export async function userForGoogle(p: GoogleProfile, as: "household" | "merchant") {
  const linked = await db.oAuthIdentity.findUnique({ where: { provider_subject: { provider: "GOOGLE", subject: p.sub } }, include: { user: true } });
  let user = linked?.user ?? null;
  if (!user) {
    const existing = await db.user.findUnique({ where: { email: p.email } });
    if (existing) {
      if (!googleOwnsEmail(p)) throw new GoogleAuthError("An account with this email exists. Log in with your password first.");
      if (existing.platformRole === "ADMIN" && !adminAllowed(existing.email)) throw new GoogleAuthError("Admins can't use Google sign-in for this account.");
      user = existing;
    } else {
      const role: PlatformRole = as === "merchant" ? "MERCHANT" : "USER";
      user = await db.user.create({ data: { name: p.name, email: p.email, platformRole: role } });
    }
    await db.oAuthIdentity.create({ data: { provider: "GOOGLE", subject: p.sub, userId: user.id, email: p.email } });
  }
  if (user.status !== "ACTIVE") throw new GoogleAuthError("This account is closed or being deleted.");
  if (user.platformRole === "ADMIN" && !adminAllowed(user.email)) throw new GoogleAuthError("Admins can't use Google sign-in for this account.");
  return user;
}
