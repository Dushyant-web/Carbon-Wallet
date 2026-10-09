import { Role } from "@/types";

export type Capability =
  | "activity:create"
  | "activity:delete"
  | "member:invite"
  | "member:remove"
  | "member:change_role"
  | "household:update"
  | "household:archive"
  | "asset:create"
  | "asset:delete"
  | "recommendation:apply"
  | "challenge:join"
  | "forecast:simulate"
  | "data:read";

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  OWNER: [
    "activity:create",
    "activity:delete",
    "member:invite",
    "member:remove",
    "member:change_role",
    "household:update",
    "household:archive",
    "asset:create",
    "asset:delete",
    "recommendation:apply",
    "challenge:join",
    "forecast:simulate",
    "data:read",
  ],
  ADMIN: [
    "activity:create",
    "activity:delete",
    "member:invite",
    "member:remove",
    "household:update",
    "asset:create",
    "asset:delete",
    "recommendation:apply",
    "challenge:join",
    "forecast:simulate",
    "data:read",
  ],
  MEMBER: [
    "activity:create",
    "recommendation:apply",
    "challenge:join",
    "forecast:simulate",
    "data:read",
  ],
  VIEWER: [
    "forecast:simulate",
    "data:read",
  ],
};

/**
 * Check if a role possesses a specific capability.
 */
export function hasPermission(role: Role, capability: Capability): boolean {
  const allowed = ROLE_CAPABILITIES[role];
  return allowed ? allowed.includes(capability) : false;
}

/**
 * Get all capabilities for a role.
 */
export function getRoleCapabilities(role: Role): Capability[] {
  return ROLE_CAPABILITIES[role] || [];
}
