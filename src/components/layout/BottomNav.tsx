"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV, isItemActive, navLabel } from "@/lib/nav";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";

/** Phone bottom bar: the same five places as the sidebar. Everything else is in the ☰ menu at the top. */
export function BottomNav() {
  const pathname = usePathname();
  const { lang, t } = useUiPrefs();

  return (
    <nav
      aria-label={t("Main menu", "मुख्य मेनू")}
      className="fixed bottom-0 left-0 right-0 z-40 grid h-[68px] grid-cols-5 border-t border-border bg-canvas/95 pb-[env(safe-area-inset-bottom)] shadow-tier-2 backdrop-blur lg:hidden print:hidden"
    >
      {MAIN_NAV.map((tab) => {
        const Icon = tab.icon;
        const active = isItemActive(pathname, tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-col items-center justify-center gap-1 px-0.5 ${active ? "text-secondary" : "text-ink-muted"}`}
          >
            {active && <span className="absolute inset-x-3 top-0 h-[3px] rounded-b bg-secondary" aria-hidden />}
            <Icon className="h-[22px] w-[22px]" />
            <span className={`line-clamp-1 text-center text-[10.5px] leading-tight ${active ? "font-semibold" : ""}`}>
              {navLabel(tab, lang).replace("Electricity bill", "Bill").replace("Card & items", "Card")}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
