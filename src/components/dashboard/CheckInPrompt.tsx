"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import type { CheckInState } from "@/server/services/checkin.service";

/** Home's nudge for the weekly check-in: one minute, once a week. */
export function CheckInPrompt() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { data } = useQuery<CheckInState>({
    queryKey: ["household", activeHouseholdId, "checkin", demoRole],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/checkins`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("Couldn't load the check-in");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });
  if (!data) return <div className="h-full min-h-40 animate-pulse rounded-md bg-canvas-subtle" />;

  return (
    <section className="flex h-full flex-col justify-between rounded-md border border-border bg-canvas-card p-5 md:p-6">
      <div>
        <p className="label-caps text-ink-muted">Weekly check-in</p>
        {data.done ? (
          <>
            <p className="mt-2 font-heading text-2xl">Done for this week ✓</p>
            <p className="mt-1 text-sm text-ink-muted">
              {data.streak} {data.streak === 1 ? "week" : "weeks"} in a row.
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 font-heading text-2xl">This week&apos;s check-in</p>
            <p className="mt-1 text-sm text-ink-muted">
              About a minute: car km, metro and bus, AC hours.{data.streak > 0 ? ` Keep your ${data.streak}-week streak.` : ""}
            </p>
          </>
        )}
      </div>
      <Link
        href="/check-in"
        className={`mt-4 inline-flex h-10 w-fit items-center rounded-md px-4 text-sm ${data.done ? "border border-border hover:border-ink" : "bg-ink text-canvas"}`}
      >
        {data.done ? "See or change it" : data.hasLast ? "Check in (same as last week?)" : "Check in"}
      </Link>
    </section>
  );
}
