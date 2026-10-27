"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Package } from "lucide-react";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";

/** "Card & items" is one place in the menu with two tabs: what the home owns, and the Carbon Card that adds to it. */
export function CardItemsTabs() {
  const pathname = usePathname();
  const { t } = useUiPrefs();
  const tabs = [
    { href: "/assets", label: t("My items", "मेरा सामान"), Icon: Package },
    { href: "/carbon-id", label: t("Carbon Card", "कार्बन कार्ड"), Icon: CreditCard },
  ];
  return (
    <div role="tablist" aria-label={t("Card & items", "कार्ड और सामान")} className="flex gap-1 border-b border-border">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className={`-mb-px flex h-12 items-center gap-2 border-b-[3px] px-4 text-[15px] ${
              active ? "border-secondary font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
