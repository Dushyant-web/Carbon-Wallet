"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";

export type PortalLink = { href: string; en: string; hi: string; exact?: boolean };

/** Horizontal navy menu for the shop and admin portals (households have the sidebar). */
export function PortalNav({ links, right }: { links: PortalLink[]; right?: React.ReactNode }) {
  const pathname = usePathname();
  const { lang } = useUiPrefs();
  return (
    <nav className="sticky top-0 z-30 bg-gov-navy text-white shadow-[0_2px_0_rgba(242,140,40,0.9)] print:hidden" aria-label="Main menu">
      <div className="flex items-center justify-between gap-3 px-2 md:px-6">
        <ul className="flex min-w-0 overflow-x-auto">
          {links.map((l) => {
            const active = l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <li key={l.href} className="shrink-0">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 items-center border-b-[3px] px-3 text-[14px] md:px-4 ${active ? "border-gov-saffron bg-white/10 font-semibold" : "border-transparent text-white/85 hover:bg-white/10 hover:text-white"}`}
                >
                  {lang === "hi" ? l.hi : l.en}
                </Link>
              </li>
            );
          })}
        </ul>
        {right && <div className="flex shrink-0 items-center gap-3 text-[13px]">{right}</div>}
      </div>
    </nav>
  );
}
