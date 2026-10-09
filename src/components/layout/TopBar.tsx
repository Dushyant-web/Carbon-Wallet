"use client";

import React from "react";
import { HouseholdSwitcher } from "./HouseholdSwitcher";
import { RoleSwitcher } from "./RoleSwitcher";
import { Button } from "@/components/ui/Button";
import { Plus, Bell } from "lucide-react";
import { useAppStore } from "@/store";

export function TopBar({ onOpenCreateModal }: { onOpenCreateModal?: () => void }) {
  const { setLogModalOpen, setCreateModalOpen } = useAppStore();

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/95 px-3 md:px-6 backdrop-blur-md print:hidden">
      {/* Left: Household Context Switcher */}
      <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
        <HouseholdSwitcher onOpenCreate={onOpenCreateModal || (() => setCreateModalOpen(true))} />
      </div>

      {/* Right: Actions, Role Switcher & User Profile */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <RoleSwitcher />

        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setLogModalOpen(true)}
        >
          <span className="hidden sm:inline">Log Activity</span>
          <span className="sm:hidden">Log</span>
        </Button>

        <div className="hidden sm:block h-5 w-px bg-border" />

        <button
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-ink-muted hover:bg-canvas-subtle hover:text-ink transition-colors"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-critical" />
        </button>

        <div className="flex items-center gap-2 pl-0.5">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-ink leading-tight">
              Elena Rostova
            </span>
            <span className="text-[10px] text-ink-muted">
              Chief ESG Auditor
            </span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-tertiary font-bold text-xs shadow-tier-1">
            ER
          </div>
        </div>
      </div>
    </header>
  );
}
