"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { ALL_NAV, isItemActive, navLabel } from "@/lib/nav";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";

/** "Home › My mohalla", as on public portals, so people always know where they are. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const { lang, t } = useUiPrefs();
  const item = ALL_NAV.find((n) => n.href !== "/dashboard" && isItemActive(pathname, n));
  return (
    <nav aria-label={t("You are here", "आप यहाँ हैं")} className="hidden min-w-0 items-center gap-1.5 text-[13px] text-ink-muted md:flex">
      <Link href="/dashboard" className="flex items-center gap-1 hover:text-gov-blue hover:underline">
        <Home className="h-3.5 w-3.5" /> {t("Home", "होम")}
      </Link>
      {item && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span aria-current="page" className="truncate font-semibold text-gov-navy">{navLabel(item, lang)}</span>
        </>
      )}
    </nav>
  );
}
