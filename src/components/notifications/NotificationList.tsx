"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCheck, Info } from "lucide-react";
import { Pager } from "@/components/ui/Pager";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUiPrefs } from "@/components/providers/UiPrefsProvider";
import { NOTICE_ICON, timeAgo, type NoticeView } from "./NotificationBell";

type Page = { items: NoticeView[]; unread: number; total: number; page: number; pages: number };

/** Every notification, 20 a page, with a link to turn on phone / desktop notifications. */
export function NotificationList({ settingsHref }: { settingsHref?: string }) {
  const { t } = useUiPrefs();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<Page>({
    queryKey: ["notifications", page],
    queryFn: async () => (await fetch(`/api/notifications?page=${page}`)).json(),
  });
  const [permission, setPermission] = useState<string | null>(null);
  React.useEffect(() => setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission), []);

  async function readAll() {
    await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ all: true }) });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="label-caps">{t("Notifications", "सूचनाएँ")}</span>
          <h1 className="mt-1.5 font-heading text-3xl font-medium tracking-tight md:text-[2.6rem]">{t("Your notifications", "आपकी सूचनाएँ")}</h1>
        </div>
        {(data?.unread ?? 0) > 0 && (
          <button onClick={readAll} className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-canvas-card px-4 text-[13px] font-semibold hover:border-ink">
            <CheckCheck className="h-4 w-4" /> {t("Mark all read", "सब पढ़ा हुआ")}
          </button>
        )}
      </header>

      {settingsHref && permission !== "granted" && permission !== "unsupported" && (
        <p className="flex flex-wrap items-center gap-2 border-l-4 border-gov-saffron bg-gov-saffronSoft px-4 py-3 text-[14px]">
          <BellRing className="h-5 w-5" />
          {t("Get these on your phone or computer even when Carbon Wallet is closed.", "Carbon Wallet बंद होने पर भी ये फ़ोन या कंप्यूटर पर पाएँ।")}{" "}
          <Link href={settingsHref} className="font-semibold underline">
            {t("Turn on notifications", "सूचनाएँ चालू करें")}
          </Link>
        </p>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data?.items.length ? (
        <p className="border border-border bg-canvas-card p-6 text-center text-[14px] text-ink-muted">{t("No notifications yet.", "अभी कोई सूचना नहीं।")}</p>
      ) : (
        <ul className="divide-y divide-border border border-border bg-canvas-card">
          {data.items.map((n) => {
            const I = NOTICE_ICON[n.kind] ?? Info;
            return (
              <li key={n.id}>
                <Link href={n.url} className={`flex gap-3 px-4 py-3.5 hover:bg-canvas-subtle ${n.read ? "" : "bg-gov-sky/50"}`}>
                  <I className="mt-0.5 h-5 w-5 shrink-0 text-gov-blue" />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[15px] ${n.read ? "" : "font-semibold"}`}>{n.title}</span>
                    <span className="block text-[13.5px] text-ink-muted">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-light">{timeAgo(n.at, t)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
    </div>
  );
}
