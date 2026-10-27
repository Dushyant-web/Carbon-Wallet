"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck, X } from "lucide-react";
import { MAIN_NAV, MORE_NAV, SETTINGS_NAV, isItemActive, navLabel, type NavItem } from "@/lib/nav";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { usePermissions } from "@/hooks/usePermissions";

/** ☰ on phones and tablets: every page, as a list with plain hints. */
export function MobileMenu({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { lang, t } = useUiPrefs();
  const { isOwner } = usePermissions();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const row = (item: NavItem) => {
    const Icon = item.icon;
    const active = isItemActive(pathname, item);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-3 ${active ? "bg-primary text-primary-foreground" : "bg-canvas-subtle text-ink"}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className="text-[14px] font-semibold leading-tight">{navLabel(item, lang)}</span>
          <span className={`truncate text-[12px] ${active ? "text-primary-foreground/75" : "text-ink-muted"}`}>{item.hint}</span>
        </span>
      </Link>
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-canvas-subtle lg:hidden"
        aria-label={t("All pages", "सभी पेज")}
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={t("All pages", "सभी पेज")} className="fixed inset-0 z-50 flex lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/50" aria-hidden />
          <div
            className="relative flex h-full w-[86%] max-w-sm flex-col overflow-y-auto bg-canvas-card p-4 shadow-tier-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-heading text-xl font-medium">Carbon Wallet</span>
              <button onClick={() => setOpen(false)} aria-label={t("Close", "बंद करें")} className="flex h-10 w-10 items-center justify-center text-ink-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">{MAIN_NAV.map(row)}</div>
            <p className="label-caps mb-2 mt-5">{t("More pages", "और पेज")}</p>
            <div className="flex flex-col gap-1.5">{MORE_NAV.filter((i) => !i.ownerOnly || isOwner).map(row)}</div>
            <div className="mt-5 flex flex-col gap-1.5">
              {row(SETTINGS_NAV)}
              {isAdmin && (
                <Link href="/admin" className="flex items-center gap-3 rounded-md border border-ink px-3 py-3 text-sm font-semibold">
                  <ShieldCheck className="h-5 w-5" /> Admin panel
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
