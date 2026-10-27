"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BellRing, CheckCheck, Flame, Info, Landmark, LifeBuoy, MapPinned, Store, Trash2, AlarmClock, type LucideIcon } from "lucide-react";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";

export type NoticeView = { id: string; kind: string; title: string; body: string; url: string; read: boolean; at: string };
type Page = { items: NoticeView[]; unread: number; total: number; page: number; pages: number };

export const NOTICE_ICON: Record<string, LucideIcon> = {
  SHOP: Store,
  REMOVAL: Trash2,
  SCHEME: Landmark,
  HELP: LifeBuoy,
  REMINDER: AlarmClock,
  MOHALLA: MapPinned,
  HEAT: Flame,
  SYSTEM: Info,
};

export function timeAgo(iso: string, t: (en: string, hi: string) => string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return t("just now", "अभी");
  const m = Math.round(s / 60);
  if (m < 60) return t(`${m} min ago`, `${m} मिनट पहले`);
  const h = Math.round(m / 60);
  if (h < 24) return t(`${h} h ago`, `${h} घंटे पहले`);
  const d = Math.round(h / 24);
  return d < 30 ? t(`${d} d ago`, `${d} दिन पहले`) : new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * The bell: unread count, the latest notices, mark as read, and a toast when something new arrives while the
 * page is open. Checks every 45 seconds and whenever the tab comes back into view.
 */
export function NotificationBell({ allHref = "/notifications", variant = "light" }: { allHref?: string; variant?: "light" | "dark" }) {
  const { t } = useUiPrefs();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const lastSeen = useRef<string | null>(null);
  const { data } = useQuery<Page>({
    queryKey: ["notifications", 1],
    queryFn: async () => {
      const res = await fetch("/api/notifications?page=1");
      if (!res.ok) throw new Error("notifications unavailable");
      return res.json();
    },
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });

  // a toast for anything newer than what this page has already seen
  useEffect(() => {
    const newest = data?.items[0];
    if (!newest) return;
    if (lastSeen.current && newest.id !== lastSeen.current && !newest.read) {
      toast(newest.title, { description: newest.body, action: { label: t("Open", "खोलें"), onClick: () => router.push(newest.url) } });
    }
    lastSeen.current = newest.id;
  }, [data, router, t]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function read(body: { all: true } | { ids: string[] }) {
    await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const unread = data?.unread ?? 0;
  const Icon = unread ? BellRing : Bell;
  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t(`Notifications, ${unread} unread`, `सूचनाएँ, ${unread} नई`)}
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-md ${variant === "dark" ? "text-white hover:bg-white/10" : "text-ink hover:bg-canvas-subtle"}`}
      >
        <Icon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-critical px-1 text-[10.5px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label={t("Notifications", "सूचनाएँ")} className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] border border-border bg-canvas-card text-ink shadow-tier-3">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="font-semibold">{t("Notifications", "सूचनाएँ")}</p>
            {unread > 0 && (
              <button onClick={() => read({ all: true })} className="flex items-center gap-1 text-[12.5px] text-gov-blue hover:underline">
                <CheckCheck className="h-4 w-4" /> {t("Mark all read", "सब पढ़ा हुआ")}
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {(data?.items ?? []).slice(0, 8).map((n) => {
              const I = NOTICE_ICON[n.kind] ?? Info;
              return (
                <li key={n.id}>
                  <Link
                    href={n.url}
                    onClick={() => {
                      setOpen(false);
                      if (!n.read) read({ ids: [n.id] });
                    }}
                    className={`flex gap-3 border-b border-border/70 px-4 py-3 hover:bg-canvas-subtle ${n.read ? "" : "bg-gov-sky/60"}`}
                  >
                    <I className="mt-0.5 h-5 w-5 shrink-0 text-gov-blue" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={`text-[13.5px] leading-snug ${n.read ? "" : "font-semibold"}`}>{n.title}</span>
                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gov-saffron" aria-label={t("unread", "नई")} />}
                      </span>
                      <span className="line-clamp-2 block text-[12.5px] text-ink-muted">{n.body}</span>
                      <span className="text-[11px] text-ink-light">{timeAgo(n.at, t)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {!data?.items.length && <li className="px-4 py-6 text-center text-[13px] text-ink-muted">{t("Nothing yet. We'll let you know when something happens.", "अभी कुछ नहीं।")}</li>}
          </ul>
          <Link href={allHref} onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-[13px] font-semibold text-gov-blue hover:bg-canvas-subtle">
            {t("See all notifications", "सभी सूचनाएँ देखें")}
          </Link>
        </div>
      )}
    </div>
  );
}
