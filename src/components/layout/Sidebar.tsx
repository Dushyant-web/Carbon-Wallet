"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  Receipt,
  Layers,
  CalendarDays,
  Target,
  BarChart3,
  Users,
  Leaf,
  ShieldCheck,
  FileText,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Executive Overview", icon: LayoutDashboard },
  { href: "/carbon-twin", label: "Digital Carbon Twin", icon: Cpu },
  { href: "/activities", label: "Activities & Ledger", icon: Receipt },
  { href: "/assets", label: "Household Assets", icon: Layers },
  { href: "/plan", label: "Plan & Forecast", icon: CalendarDays },
  { href: "/actions", label: "Actions & Targets", icon: Target },
  { href: "/compare", label: "Cohort Benchmarks", icon: BarChart3 },
  { href: "/reports", label: "Monthly Reports", icon: FileText },
  { href: "/households", label: "Household Directory", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 hidden lg:flex w-64 flex-col justify-between border-r border-border bg-white shadow-tier-1 print:hidden">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-tier-1">
            <Leaf className="h-4 w-4 text-tertiary" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-lg font-bold tracking-tight text-primary leading-tight">
              CarbonOS
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Intelligence Core
            </span>
          </div>
        </div>

        {/* Domain Navigation */}
        <div className="px-4 py-3">
          <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            Platform Domains
          </span>
          <nav className="mt-2 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-white shadow-tier-1"
                      : "text-ink-muted hover:bg-canvas-subtle hover:text-ink"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-tertiary" : "text-ink-muted"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Info: Grid Intensity & Smart Meter Sync */}
      <div className="border-t border-border p-4 flex flex-col gap-2 bg-canvas-subtle/50">
        <div className="flex items-center justify-between rounded-lg border border-border bg-white p-2.5 shadow-tier-1">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Regional Grid Mix
            </span>
            <span className="text-xs font-bold text-primary tabular-nums">
              0.82 kg CO₂e / kWh
            </span>
          </div>
          <div className="h-2 w-2 rounded-full bg-secondary" />
        </div>

        <div className="flex items-center justify-between px-1 text-[11px] text-ink-muted">
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
            <span>CEA Baseline v19</span>
          </div>
          <span className="font-mono text-[10px]">v1.0-RC</span>
        </div>
      </div>
    </aside>
  );
}
