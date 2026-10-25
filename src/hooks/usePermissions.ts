"use client";

import { useAppStore } from "@/store";
import { Capability, hasPermission, getRoleCapabilities } from "@/server/auth/permissions";

export function usePermissions() {
  const role = useAppStore((s) => s.demoRole);
  const setDemoRole = useAppStore((s) => s.setDemoRole);

  return {
    role,
    setRole: setDemoRole,
    can: (cap: Capability) => hasPermission(role, cap),
    capabilities: getRoleCapabilities(role),
    isOwner: role === "OWNER",
    isMember: role === "MEMBER",
    isViewer: role === "VIEWER",
  };
}
