"use client";

import React from "react";
import { useAppStore } from "@/store";
import { Role } from "@/types";
import { Shield } from "lucide-react";

export function RoleSwitcher() {
  const { demoRole, setDemoRole } = useAppStore();

  const roles: { role: Role; label: string; desc: string }[] = [
    { role: "OWNER", label: "Owner", desc: "Full administrative access" },
    { role: "ADMIN", label: "Admin", desc: "Can manage assets & members" },
    { role: "MEMBER", label: "Member", desc: "Can log activities & apply actions" },
    { role: "VIEWER", label: "Viewer", desc: "Read-only access (403 on edits)" },
  ];

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-2 py-1 text-xs shadow-tier-1">
      <Shield className="h-3.5 w-3.5 text-secondary" />
      <span className="text-[11px] font-bold text-ink-muted uppercase">Role:</span>
      <select
        value={demoRole}
        onChange={(e) => setDemoRole(e.target.value as Role)}
        aria-label="Demo simulation role switcher"
        className="bg-transparent font-bold text-primary outline-none cursor-pointer text-xs"
      >
        {roles.map((r) => (
          <option key={r.role} value={r.role}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
