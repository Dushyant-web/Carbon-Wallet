import { Role } from "@/types";

export type Capability =
  | "activity:create"
  | "activity:delete"
  | "bill:create"
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
  | "goal:manage"
  | "checkin:create"
  | "data:read";

/**
 * A household has one Owner who manages everything. Family (MEMBER) can look at everything and add
 * electricity bills, nothing else. View-only (VIEWER) can only look. Appliances and vehicles bought
 * at a registered shop are added by the merchant (merchant.service.ts), not by a household role.
 */
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  OWNER: [
    "activity:create",
    "activity:delete",
    "bill:create",
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
    "goal:manage",
    "checkin:create",
    "data:read",
  ],
  MEMBER: [
    "bill:create",
    "forecast:simulate", // a what-if is worked out on the fly and saves nothing
    "data:read",
  ],
  VIEWER: [
    "forecast:simulate",
    "data:read",
  ],
};

/** What each role is called on screen. */
export const ROLE_LABELS: Record<Role, string> = { OWNER: "Owner", MEMBER: "Family", VIEWER: "View only" };

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
