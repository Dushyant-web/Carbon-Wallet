import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { Capability, hasPermission } from "./permissions";
import { getRequestUser, type SessionUser } from "./session";
import { Role } from "@/types";
import type { Merchant } from "@prisma/client";

export interface AuthContext {
  userId: string;
  householdId: string;
  role: Role;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 403) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

const ROLE_RANK: Record<Role, number> = { VIEWER: 1, MEMBER: 2, OWNER: 3 };

/**
 * Legacy identity resolution (x-user-id header, first-member fallback). Only for the automated
 * test suite: enabled when DEMO_AUTH=1, never in a normal run.
 */
async function legacyUserId(req: NextRequest | Request, householdId: string): Promise<string | null> {
  if (process.env.DEMO_AUTH !== "1") return null;
  const headerId = req.headers.get("x-user-id");
  if (headerId) return headerId;
  const first = await db.membership.findFirst({
    where: { householdId, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
  });
  return first?.userId ?? null;
}

/**
 * Route guard: session user → active membership in this household → capability check.
 * The demo "Acting as" switcher may only lower the effective role, never raise it.
 */
export async function requireMembership(
  req: NextRequest | Request,
  householdId: string,
  requiredCapability?: Capability
): Promise<AuthContext> {
  const sessionUser = await getRequestUser(req);
  const userId = sessionUser?.id ?? (await legacyUserId(req, householdId));

  if (!userId) {
    throw new AuthError("Unauthenticated: please log in", 401);
  }

  const membership = await db.membership.findUnique({
    where: { householdId_userId: { householdId, userId } },
  });
  // a household being deleted is gone for everyone, admins included (privacy.service.ts)
  const target = await db.household.findUnique({ where: { id: householdId }, select: { status: true } });
  if (target?.status === "DELETION_PENDING") throw new AuthError("Household not found", 404);

  let realRole: Role;
  if (membership && membership.status === "ACTIVE") {
    realRole = membership.role as Role;
  } else if (sessionUser?.platformRole === "ADMIN") {
    // Platform admins can look at any household for support, but only read: never change its data
    const exists = await db.household.findUnique({ where: { id: householdId }, select: { id: true } });
    if (!exists) throw new AuthError("Household not found", 404);
    realRole = "VIEWER";
  } else {
    throw new AuthError("Forbidden: You are not an active member of this household", 403);
  }

  const requested = req.headers.get("x-demo-role") as Role | null;
  const effectiveRole =
    requested && ROLE_RANK[requested] !== undefined && ROLE_RANK[requested] <= ROLE_RANK[realRole]
      ? requested
      : realRole;

  if (requiredCapability && !hasPermission(effectiveRole, requiredCapability)) {
    throw new AuthError(`Forbidden: Role '${effectiveRole}' lacks capability '${requiredCapability}'`, 403);
  }

  return { userId, householdId, role: effectiveRole };
}

export async function requireUser(req: NextRequest | Request): Promise<SessionUser> {
  const user = await getRequestUser(req);
  if (!user) throw new AuthError("Unauthenticated: please log in", 401);
  return user;
}

export async function requireAdmin(req: NextRequest | Request): Promise<SessionUser> {
  const user = await requireUser(req);
  if (user.platformRole !== "ADMIN") throw new AuthError("Forbidden: admin only", 403);
  return user;
}

/** A signed-in shop that a platform admin has approved. Merchants never belong to a household. */
export async function requireMerchant(req: NextRequest | Request): Promise<{ user: SessionUser; merchant: Merchant }> {
  const user = await requireUser(req);
  if (user.platformRole !== "MERCHANT") throw new AuthError("Forbidden: merchants only", 403);
  const merchant = await db.merchant.findUnique({ where: { userId: user.id } });
  if (!merchant) throw new AuthError("Forbidden: no shop is linked to this account", 403);
  if (merchant.status === "PENDING") throw new AuthError("Your shop is waiting for approval by Carbon Wallet.", 403);
  if (merchant.status !== "APPROVED") throw new AuthError("Your shop has been suspended. Contact Carbon Wallet.", 403);
  return { user, merchant };
}

/**
 * Helper to wrap route handlers with standardized error responses.
 */
export function handleAuthError(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: err.message, code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" },
      { status: err.status }
    );
  }
  console.error("Internal Server Error:", err);
  return NextResponse.json(
    { error: "Internal Server Error" },
    { status: 500 }
  );
}
