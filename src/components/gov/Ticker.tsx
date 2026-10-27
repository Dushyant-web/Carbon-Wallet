"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import type { PortalStats, Update } from "@/server/services/portal.service";

/** "What's new" strip, as on public portals. It can be paused (moving text must be stoppable), and stays still for reduced motion. */
export function Ticker() {
  const { lang, t } = useUiPrefs();
  const [paused, setPaused] = useState(false);
  const { data } = useQuery<{ updates: Update[]; stats: PortalStats }>({
    queryKey: ["portal", "updates"],
    queryFn: async () => (await fetch("/api/public/updates")).json(),
    staleTime: 10 * 60_000,
  });
  const items = data?.updates ?? [];
  if (!items.length) return <div className="h-10 border-b border-gov-navy/15 bg-gov-sky" aria-hidden />;

  const row = (copy: number) =>
    items.map((u, i) => (
      <Link key={`${copy}-${i}`} href={u.href} className="mx-6 inline-flex shrink-0 items-center gap-2 hover:underline" tabIndex={copy ? -1 : 0}>
        <span className="h-1.5 w-1.5 rotate-45 bg-gov-saffron" aria-hidden />
        {lang === "hi" ? u.hi : u.en}
      </Link>
    ));

  return (
    <div className="flex h-10 items-stretch border-b border-gov-navy/15 bg-gov-sky text-[13px] text-gov-navy print:hidden" role="region" aria-label={t("What's new", "नया क्या है")}>
      <span className="flex shrink-0 items-center bg-gov-saffron px-3 font-semibold text-white md:px-4">
        <span className="font-devanagari">{t("What's new", "नया क्या है")}</span>
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="cw-ticker flex h-full w-max items-center whitespace-nowrap" style={{ animationPlayState: paused ? "paused" : undefined }}>
          <div className="flex">{row(0)}</div>
          <div className="flex" aria-hidden>{row(1)}</div>
        </div>
      </div>
      <button
        onClick={() => setPaused((p) => !p)}
        className="flex w-10 shrink-0 items-center justify-center border-l border-gov-navy/15 hover:bg-white"
        aria-label={paused ? t("Play updates", "अपडेट चलाएँ") : t("Pause updates", "अपडेट रोकें")}
        aria-pressed={paused}
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </button>
    </div>
  );
}
