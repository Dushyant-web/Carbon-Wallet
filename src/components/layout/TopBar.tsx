"use client";

import React, { useEffect } from "react";
import { HouseholdSwitcher } from "./HouseholdSwitcher";
import { RoleSwitcher } from "./RoleSwitcher";
import { Button } from "@/components/ui/Button";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Plus } from "lucide-react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import type { Role } from "@/types";
import type { PlatformRole } from "@/server/auth/session";

type TopBarUser = { name: string; email: string; platformRole: PlatformRole };

export function TopBar({ user }: { user: TopBarUser }) {
  const { setLogModalOpen, setCreateModalOpen, activeHouseholdId, demoRole, setDemoRole } = useAppStore();
  // The month the numbers on screen refer to (latest complete month with data), not today's date
  const overview = useHouseholdOverview(activeHouseholdId);
  const period: string | undefined = overview.data?.period?.label;
  const access: { role: Role; viewOnly: boolean; canAddBills: boolean } | undefined = overview.data?.access;
  // Buttons follow the real access level (e.g. platform admins see any home read-only)
  useEffect(() => {
    const rank = { VIEWER: 1, MEMBER: 2, OWNER: 3 } as const;
    if (access && rank[access.role] < rank[demoRole]) setDemoRole(access.role);
  }, [access, demoRole, setDemoRole]);

  return (
    <header className="fixed top-0 left-0 lg:left-60 right-0 z-30 flex h-16 items-center justify-between border-b border-border bg-canvas px-3 md:px-10 print:hidden">
      <div className="flex min-w-0 items-center gap-3 md:gap-5">
        <HouseholdSwitcher onOpenCreate={() => setCreateModalOpen(true)} />
        {period && <span className="hidden xl:inline label-caps">Reporting · {period}</span>}
        {access?.viewOnly && (
          <span className="shrink-0 rounded-full border border-warning-border bg-warning-subtle px-2.5 py-0.5 text-[11px] font-medium text-warning-text">
            {access.canAddBills ? "Family · view + add bills" : "View only"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="hidden md:block">
          <RoleSwitcher />
        </div>
        {!access?.viewOnly && (
          <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setLogModalOpen(true)}>
            <span className="hidden sm:inline">Log activity</span>
            <span className="sm:hidden">Log</span>
          </Button>
        )}
        <div className="hidden md:flex flex-col items-end leading-tight pl-1">
          <span className="text-xs font-semibold text-ink">{user.name}</span>
          <span className="font-mono text-[10px] uppercase text-ink-muted">
            {user.platformRole === "ADMIN" ? "Platform admin" : "Signed in"}
          </span>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
