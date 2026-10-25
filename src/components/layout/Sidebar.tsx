"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, isActive } from "@/lib/nav";

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 hidden lg:flex w-60 flex-col justify-between border-r border-border bg-canvas print:hidden">
      <div className="flex min-h-0 flex-col">
        {/* Wordmark */}
        <Link href="/" className="flex h-16 shrink-0 items-end gap-2 border-b border-border px-6 pb-3">
          <span className="font-heading text-[1.35rem] font-medium leading-none tracking-tight text-ink">Carbon Wallet</span>
          <span className="mb-[3px] h-1.5 w-1.5 bg-secondary" aria-hidden />
        </Link>

        <nav className="flex flex-col gap-4 overflow-y-auto px-3 py-4" aria-label="Primary">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col">
              <span className="label-caps px-3 pb-1 text-ink-light">{group.title}</span>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.hint}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center gap-2.5 border-l-2 px-3 py-[6px] text-[13px] transition-colors ${
                      active
                        ? "border-secondary bg-canvas-card font-semibold text-ink"
                        : "border-transparent text-ink-muted hover:border-border-hover hover:text-ink"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-secondary" : "text-ink-light group-hover:text-ink-muted"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="mx-3 mt-1 block border border-ink px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] hover:bg-ink hover:text-canvas-card"
            >
              Admin panel →
            </Link>
          )}
        </nav>
      </div>

      <div className="shrink-0 border-t border-border px-6 py-3">
        <Link href="/how-we-calculate" className="text-[12px] text-ink-muted underline-offset-2 hover:text-ink hover:underline">
          How we calculate
        </Link>
      </div>
    </aside>
  );
}
