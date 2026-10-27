"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { HouseholdSwitcher } from "./HouseholdSwitcher";
import { RoleSwitcher } from "./RoleSwitcher";
import { MobileMenu } from "./MobileMenu";
import { Breadcrumbs } from "@/components/gov/Breadcrumbs";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import type { Role } from "@/types";
import type { PlatformRole } from "@/server/auth/session";

type TopBarUser = { name: string; email: string; platformRole: PlatformRole };

export function TopBar({ user }: { user: TopBarUser }) {
  const { setCreateModalOpen, activeHouseholdId, demoRole, setDemoRole } = useAppStore();
  const { t } = useUiPrefs();
  const overview = useHouseholdOverview(activeHouseholdId);
  const access: { role: Role; viewOnly: boolean; canAddBills: boolean } | undefined = overview.data?.access;
  // Buttons follow the real access level (e.g. platform admins see any home read-only)
  useEffect(() => {
    const rank = { VIEWER: 1, MEMBER: 2, OWNER: 3 } as const;
    if (access && rank[access.role] < rank[demoRole]) setDemoRole(access.role);
  }, [access, demoRole, setDemoRole]);

  const roleWord =
    access?.role === "OWNER" ? t("Owner", "मालिक") : access?.role === "MEMBER" ? t("Family", "परिवार") : access ? t("View only", "सिर्फ़ देखें") : null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border bg-white/95 px-2 shadow-[0_1px_0_rgba(18,40,76,0.06)] backdrop-blur md:px-8 print:hidden">
      <div className="flex min-w-0 items-center gap-1.5 md:gap-4">
        <MobileMenu isAdmin={user.platformRole === "ADMIN"} />
        <HouseholdSwitcher onOpenCreate={() => setCreateModalOpen(true)} />
        <span className="hidden h-6 w-px bg-border md:block" aria-hidden />
        <Breadcrumbs />
        {roleWord && (
          <span
            className={`hidden shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium sm:inline ${
              access?.role === "OWNER" ? "border-border bg-canvas-card text-ink-muted" : "border-warning-border bg-warning-subtle text-warning-text"
            }`}
            title={access?.canAddBills && access.viewOnly ? t("Can see everything and add bills", "सब देख सकते हैं, बिल डाल सकते हैं") : undefined}
          >
            {roleWord}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <div className="hidden xl:block">
          <RoleSwitcher />
        </div>
        <NotificationBell allHref="/notifications" />
        {access?.canAddBills && (
          <Link
            href="/bills/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-gov-saffron px-3 text-sm font-semibold text-white hover:brightness-95 md:px-4"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">{t("Add bill", "बिल डालें")}</span>
            <span className="sm:hidden">{t("Bill", "बिल")}</span>
          </Link>
        )}
        <div className="hidden flex-col items-end pl-1 leading-tight md:flex">
          <span className="max-w-[160px] truncate text-xs font-semibold text-ink">{user.name}</span>
          <span className="font-mono text-[10px] uppercase text-ink-muted">
            {user.platformRole === "ADMIN" ? "Platform admin" : t("Signed in", "लॉग इन")}
          </span>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
