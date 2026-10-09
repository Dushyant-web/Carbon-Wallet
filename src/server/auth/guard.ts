import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { Capability, hasPermission } from "./permissions";
import { Role } from "@/types";

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

/**
 * Route guard checking authentication, household tenant membership, and required role capabilities.
 */
export async function requireMembership(
  req: NextRequest | Request,
  householdId: string,
  requiredCapability?: Capability
): Promise<AuthContext> {
  // 1. Resolve user ID from headers or cookies
  const headers = req.headers;
  let userId = headers.get("x-user-id");
  const demoRoleOverride = headers.get("x-demo-role") as Role | null;

  // Check cookie if no header
  if (!userId && "cookies" in req) {
    const nextReq = req as NextRequest;
    userId = nextReq.cookies.get("carbonos_user_id")?.value || null;
  }

  // Fallback for default demo: if no userId specified, pick the owner/first member of this household
  if (!userId) {
    const defaultMember = await db.membership.findFirst({
      where: { householdId, status: "ACTIVE" },
      orderBy: { joinedAt: "asc" },
    });
    if (defaultMember) {
      userId = defaultMember.userId;
    }
  }

  if (!userId) {
    throw new AuthError("Unauthenticated: No user session found", 401);
  }

  // 2. Query membership scoped to householdId
  const membership = await db.membership.findUnique({
    where: {
      householdId_userId: {
        householdId,
        userId,
      },
    },
    include: {
      user: true,
      household: true,
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new AuthError("Forbidden: You are not an active member of this household", 403);
  }

  // 3. Determine effective role (support demo role switcher)
  const effectiveRole = (demoRoleOverride || membership.role) as Role;

  // 4. Check capability
  if (requiredCapability) {
    const allowed = hasPermission(effectiveRole, requiredCapability);
    if (!allowed) {
      throw new AuthError(
        `Forbidden: Role '${effectiveRole}' lacks capability '${requiredCapability}'`,
        403
      );
    }
  }

  return {
    userId,
    householdId,
    role: effectiveRole,
  };
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
