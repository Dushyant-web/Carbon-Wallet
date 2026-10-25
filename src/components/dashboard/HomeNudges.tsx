"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { usePwa } from "@/components/pwa/PwaProvider";
import type { DueReminder } from "@/server/services/reminders.service";

const DISMISS_KEY = "cw-install-dismissed";

/**
 * Small nudges on Home: the electricity bill that should have arrived (the check-in and goal have their own
 * cards), and, once there's something worth coming back to, installing the app on the phone.
 */
export function HomeNudges({ hasData }: { hasData: boolean }) {
  const { activeHouseholdId, demoRole } = useAppStore();
  const pwa = usePwa();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  const { data } = useQuery<{ reminders: DueReminder[] }>({
    queryKey: ["household", activeHouseholdId, "reminders", demoRole],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/reminders`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("reminders unavailable");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });
  const bill = data?.reminders.find((r) => r.kind === "BILL");
  const offerInstall = hasData && !pwa.installed && (pwa.canInstall || pwa.isIOS) && !dismissed;
  if (!bill && !offerInstall) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode: it just shows again next time */
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {bill && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning-border bg-warning-subtle px-4 py-3 text-sm text-warning-text">
          <span>
            <strong>{bill.title}.</strong> {bill.body}
          </span>
          <Link href={bill.url} className="rounded-md bg-ink px-3 py-1.5 text-canvas">
            Upload the bill
          </Link>
        </div>
      )}
      {offerInstall && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-canvas-card px-4 py-3 text-sm">
          <span>
            <strong>Put Carbon Wallet on your phone.</strong>{" "}
            {pwa.canInstall
              ? "It opens like an app and can remind you about the weekly check-in and your next bill."
              : "On iPhone: tap Share, then “Add to Home Screen”. Reminders work from the installed app."}
          </span>
          <span className="flex gap-2">
            {pwa.canInstall && (
              <button onClick={() => pwa.install()} className="rounded-md bg-ink px-3 py-1.5 text-canvas">
                Install
              </button>
            )}
            <button onClick={dismiss} className="rounded-md border border-border px-3 py-1.5 hover:border-ink">
              Not now
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
