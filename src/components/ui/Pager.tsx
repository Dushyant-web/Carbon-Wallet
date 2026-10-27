"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";

export const PAGE_SIZE = 20;

/** Page numbers to show: first, last, and two either side of the current one, with gaps as "…". */
function pageList(page: number, pages: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 2) out.push(p);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

type Props = { page: number; pages: number; total?: number; size?: number } & ({ onPage: (p: number) => void; linkPrefix?: never } | { linkPrefix: string; onPage?: never });

/**
 * "‹ 1 2 3 … 9 ›" with "21–40 of 187". Either calls onPage, or renders links `${linkPrefix}${page}` (for
 * server-rendered lists, which can't hand a function to this client component).
 */
export function Pager({ page, pages, total, size = PAGE_SIZE, ...nav }: Props) {
  const { t } = useUiPrefs();
  if (pages <= 1) return total !== undefined && total > 0 ? <p className="mt-3 text-[12px] text-ink-muted">{t(`${total} in all`, `कुल ${total}`)}</p> : null;
  const from = (page - 1) * size + 1;
  const to = total !== undefined ? Math.min(total, page * size) : page * size;
  const cls = (active: boolean) =>
    `flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-[13px] ${active ? "border-gov-navy bg-gov-navy font-semibold text-white" : "border-border bg-canvas-card hover:border-ink"}`;
  const item = (p: number, label: React.ReactNode, aria: string, active = false, disabled = false) =>
    disabled ? (
      <span key={aria} className={`${cls(false)} opacity-40`} aria-disabled>
        {label}
      </span>
    ) : nav.linkPrefix !== undefined ? (
      <Link key={aria} href={`${nav.linkPrefix}${p}`} className={cls(active)} aria-label={aria} aria-current={active ? "page" : undefined}>
        {label}
      </Link>
    ) : (
      <button key={aria} type="button" onClick={() => nav.onPage?.(p)} className={cls(active)} aria-label={aria} aria-current={active ? "page" : undefined}>
        {label}
      </button>
    );

  return (
    <nav aria-label={t("Pages", "पेज")} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-[12.5px] text-ink-muted">
        {total !== undefined ? t(`${from}–${to} of ${total}`, `${total} में से ${from}–${to}`) : t(`Page ${page} of ${pages}`, `पेज ${page} / ${pages}`)}
      </span>
      <span className="flex flex-wrap items-center gap-1">
        {item(page - 1, <ChevronLeft className="h-4 w-4" />, t("Previous page", "पिछला पेज"), false, page <= 1)}
        {pageList(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap${i}`} className="px-1 text-ink-muted">
              …
            </span>
          ) : (
            item(p, p, t(`Page ${p}`, `पेज ${p}`), p === page)
          ),
        )}
        {item(page + 1, <ChevronRight className="h-4 w-4" />, t("Next page", "अगला पेज"), false, page >= pages)}
      </span>
    </nav>
  );
}

/** Client-side paging of a list already in memory: 20 at a time, back to page 1 when the list changes. */
export function usePaged<T>(items: T[], size = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  useEffect(() => {
    if (page > pages) setPage(1);
  }, [page, pages]);
  const slice = useMemo(() => items.slice((page - 1) * size, page * size), [items, page, size]);
  return { page: Math.min(page, pages), setPage, pages, slice, total: items.length };
}
