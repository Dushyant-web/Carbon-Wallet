"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Makes the menu's pages open quickly. Once the current page is idle it prefetches each menu page (in
 * production that loads their code and data ahead of the click). In development, pages are compiled on their
 * first visit, so it also requests each one once per browser session to get the compiling done early.
 */
export function RouteWarmup({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      for (const h of hrefs) router.prefetch(h);
      if (process.env.NODE_ENV !== "development") return;
      try {
        if (sessionStorage.getItem("cw-warm")) return;
        sessionStorage.setItem("cw-warm", "1");
      } catch {
        return;
      }
      for (const h of hrefs) {
        if (cancelled) return;
        await fetch(h, { credentials: "same-origin" }).catch(() => null);
      }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const handle = w.requestIdleCallback ? w.requestIdleCallback(() => void go(), { timeout: 5000 }) : window.setTimeout(() => void go(), 3000);
    return () => {
      cancelled = true;
      if (!w.requestIdleCallback) window.clearTimeout(handle);
    };
    // the menu doesn't change while the layout is mounted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
