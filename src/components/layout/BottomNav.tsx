"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  Receipt,
  BarChart3,
  Users,
  MoreHorizontal,
  Layers,
  CalendarDays,
  Target,
  FileText,
  X,
} from "lucide-react";

const PRIMARY_TABS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/carbon-twin", label: "Twin", icon: Cpu },
  { href: "/activities", label: "Ledger", icon: Receipt },
  { href: "/compare", label: "Benchmark", icon: BarChart3 },
  { href: "/households", label: "Directory", icon: Users },
];

const MORE_LINKS = [
  { href: "/assets", label: "Household Assets", icon: Layers, desc: "Appliances & vehicles" },
  { href: "/plan", label: "Plan & Forecast", icon: CalendarDays, desc: "Predictive trajectory" },
  { href: "/actions", label: "Actions & Challenges", icon: Target, desc: "Habits & check-ins" },
  { href: "/reports", label: "Monthly Reports", icon: FileText, desc: "GHG audit certificates" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);

  const isMoreActive = MORE_LINKS.some((item) => pathname === item.href);

  return (
    <>
      {/* Fixed Bottom Navigation Bar (Mobile / Tablet < lg) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-white/95 px-2 backdrop-blur-md shadow-tier-2 lg:hidden print:hidden"
      >
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive ? "text-primary" : "text-ink-muted hover:text-ink"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  isActive ? "bg-emerald-50 text-primary" : ""
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-ink-muted"}`} />
              </div>
              <span className={`text-[10px] font-semibold tracking-tight ${isActive ? "font-bold text-primary" : ""}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* More Drawer Trigger */}
        <button
          onClick={() => setShowMoreDrawer(true)}
          aria-label="More navigation options"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isMoreActive ? "text-primary font-bold" : "text-ink-muted hover:text-ink"
          }`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
              isMoreActive ? "bg-emerald-50 text-primary" : ""
            }`}
          >
            <MoreHorizontal className={`h-4 w-4 ${isMoreActive ? "text-primary" : "text-ink-muted"}`} />
          </div>
          <span className="text-[10px] font-semibold tracking-tight">More</span>
        </button>
      </nav>

      {/* More Navigation Slide-Up Drawer */}
      {showMoreDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More Platform Domains"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/50 backdrop-blur-sm lg:hidden"
          onClick={() => setShowMoreDrawer(false)}
        >
          <div
            className="w-full rounded-t-2xl border-t border-border bg-white p-6 shadow-tier-3 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <span className="font-heading text-sm font-bold text-ink">
                Additional Platform Domains
              </span>
              <button
                onClick={() => setShowMoreDrawer(false)}
                aria-label="Close menu"
                className="rounded-full p-1 text-ink-muted hover:bg-canvas-subtle hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {MORE_LINKS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMoreDrawer(false)}
                    className={`flex items-center gap-3.5 rounded-xl p-3 transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "bg-canvas-subtle hover:bg-slate-100 text-ink"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        isActive ? "bg-white/20 text-tertiary" : "bg-white text-primary shadow-tier-1"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold leading-tight">{item.label}</span>
                      <span className={`text-[10px] ${isActive ? "text-white/80" : "text-ink-muted"}`}>
                        {item.desc}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
