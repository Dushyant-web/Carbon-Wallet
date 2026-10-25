import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { hashPassword, passwordProblem } from "./password";
import { CONSENT_VERSION } from "@/server/services/privacy.service";
import { createSession, setSessionCookie, type PlatformRole } from "./session";
import type { Prisma } from "@prisma/client";

export const SignupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(200),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(1).max(200),
});

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Creates a user with the given platform role and returns a response carrying the session cookie.
 * `withUser` adds rows that belong to the new account (e.g. a merchant's shop) in the same transaction.
 */
export async function registerUser(
  body: unknown,
  platformRole: PlatformRole,
  userAgent: string | null,
  withUser?: (tx: Prisma.TransactionClient, userId: string) => Promise<unknown>,
): Promise<NextResponse> {
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) return badRequest("Enter your name, a valid email and a password of 8+ characters.");
  const { name, email, password } = parsed.data;
  const problem = passwordProblem(password);
  if (problem) return badRequest(problem);

  // Any existing row (including invited users without a password) blocks sign-up: claiming an
  // account by email alone would let anyone take over invited members. Needs email verification first.
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return badRequest("An account with this email already exists. Log in instead.", 409);

  const passwordHash = await hashPassword(password);
  // consent to the privacy notice, when given on the form (anyone without it is asked inside the app)
  const agreed = !!body && typeof body === "object" && (body as { agree?: unknown }).agree === true;
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name, email, passwordHash, platformRole, ...(agreed ? { consentVersion: CONSENT_VERSION, consentAt: new Date() } : {}) },
    });
    await withUser?.(tx, created.id);
    return created;
  });

  const { token, expiresAt } = await createSession(user.id, userAgent);
  const res = NextResponse.json(
    { user: { id: user.id, name: user.name, email: user.email, platformRole: user.platformRole } },
    { status: 201 },
  );
  setSessionCookie(res, token, expiresAt);
  return res;
}
