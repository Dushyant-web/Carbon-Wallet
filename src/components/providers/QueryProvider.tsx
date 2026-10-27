"use client";

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClientRestore, persistQueryClientSubscribe } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const CACHE_STORAGE_KEY = "cw-cache";
const DAY = 24 * 60 * 60 * 1000;
// live or one-off answers that shouldn't come back from yesterday's cache
const NOT_KEPT = new Set(["notifications", "partner", "i18n"]);

/**
 * Data from the API is kept in this browser (localStorage) for a day, so on a slow connection a page opened
 * before shows its last numbers while fresh ones load. The cache belongs to one signed-in person: `cacheKey`
 * changes with the account, which throws the old cache away, and logging out deletes it.
 *
 * It is restored only after the page has hydrated (when the browser is idle): restoring earlier would make the
 * first paint differ from the server's HTML. Restored entries never replace newer data already fetched.
 */
export default function QueryProvider({ children, cacheKey }: { children: React.ReactNode; cacheKey: string }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // fresh for 2 minutes, then refreshed in the background
            gcTime: DAY, // kept long enough to be saved and restored
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    const persister = createSyncStoragePersister({ storage: window.localStorage, key: CACHE_STORAGE_KEY, throttleTime: 1500 });
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    const start = async () => {
      await persistQueryClientRestore({ queryClient, persister, maxAge: DAY, buster: cacheKey }).catch(() => undefined);
      if (cancelled) return;
      unsubscribe = persistQueryClientSubscribe({
        queryClient,
        persister,
        buster: cacheKey,
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === "success" && !NOT_KEPT.has(String(q.queryKey[0])) },
      });
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    const handle = w.requestIdleCallback ? w.requestIdleCallback(() => void start(), { timeout: 2000 }) : window.setTimeout(() => void start(), 300);
    return () => {
      cancelled = true;
      unsubscribe?.();
      if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [queryClient, cacheKey]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** On logout: forget this person's cached data and Partner chats in this browser. */
export function forgetBrowserData() {
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("cw-partner")) sessionStorage.removeItem(k);
  } catch {
    // storage blocked: nothing was saved either
  }
}
