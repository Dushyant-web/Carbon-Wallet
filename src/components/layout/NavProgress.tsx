"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin saffron bar at the very top that starts the moment an in-app link is clicked and finishes when the new
 * page is on screen, so a slow network never looks like a dead button.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("/api/") || href.startsWith("//")) return;
      const next = new URL(href, window.location.href);
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    const t = setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 350);
    return () => clearTimeout(t);
  }, [pathname, search]);

  if (state === "idle") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]" aria-hidden>
      <div className={`h-full bg-gov-saffron shadow-[0_0_8px_rgba(242,140,40,0.7)] ${state === "loading" ? "cw-nav-loading" : "w-full transition-[width] duration-200"}`} />
    </div>
  );
}
