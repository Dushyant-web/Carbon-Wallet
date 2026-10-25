"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { ALL_NAV, MOBILE_PRIMARY, NAV_GROUPS, isActive } from "@/lib/nav";

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = MOBILE_PRIMARY.map((href) => ALL_NAV.find((n) => n.href === href)!);
  const moreActive = ALL_NAV.some((n) => !MOBILE_PRIMARY.includes(n.href) && isActive(pathname, n.href));

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-canvas/95 px-2 shadow-tier-2 backdrop-blur lg:hidden print:hidden"
      >
        {primary.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 ${active ? "text-secondary" : "text-ink-muted"}`}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className={`text-[10px] tracking-tight ${active ? "font-semibold" : ""}`}>
                {tab.label.replace("Electricity bills", "Bills").replace("Carbon ID & card", "Carbon ID")}
              </span>
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          aria-label="More pages"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 ${moreActive ? "text-secondary" : "text-ink-muted"}`}
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
          <span className="text-[10px] tracking-tight">More</span>
        </button>
      </nav>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="All pages"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/50 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-canvas-card p-5 shadow-tier-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-heading text-lg font-medium">All pages</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 text-ink-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="mb-4">
                <span className="label-caps">{group.title}</span>
                <div className="mt-1.5 grid grid-cols-1 gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${active ? "bg-primary text-primary-foreground" : "bg-canvas-subtle text-ink"}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex flex-col">
                          <span className="text-[13px] font-semibold leading-tight">{item.label}</span>
                          <span className={`text-[11px] ${active ? "text-primary-foreground/75" : "text-ink-muted"}`}>{item.hint}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
