"use client";

import React from "react";
import { useAppStore } from "@/store";
import { Role } from "@/types";
import { ROLE_LABELS } from "@/server/auth/permissions";

/**
 * Demo-only permission preview: lets an owner see the app as a lower role would.
 * The server only honours downgrades, so this can never grant extra access.
 * Hidden unless NEXT_PUBLIC_SHOW_DEMO=1.
 */
export function RoleSwitcher() {
  const { demoRole, setDemoRole } = useAppStore();

  if (process.env.NEXT_PUBLIC_SHOW_DEMO !== "1") return null;

  const roles = (["OWNER", "MEMBER", "VIEWER"] as const).map((role: Role) => ({ role, label: ROLE_LABELS[role] }));

  return (
    <label
      title="Preview what other household roles can see and do. It can only reduce permissions."
      className="flex h-8 items-center gap-2 rounded-md border border-dashed border-border-hover bg-canvas-card px-2.5 text-xs"
    >
      <span className="label-caps">Preview as</span>
      <select
        value={demoRole}
        onChange={(e) => setDemoRole(e.target.value as Role)}
        aria-label="Preview the app as another household role"
        className="cursor-pointer bg-transparent text-xs font-semibold text-ink outline-none"
      >
        {roles.map((r) => (
          <option key={r.role} value={r.role}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}
