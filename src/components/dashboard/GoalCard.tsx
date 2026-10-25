"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { usePermissions } from "@/hooks/usePermissions";
import type { GoalView } from "@/server/services/goal.service";

const STATE: Record<GoalView["current"]["state"], { label: string; cls: string }> = {
  on_track: { label: "On track", cls: "bg-success-subtle text-success-text" },
  watch: { label: "Close to target", cls: "bg-warning-subtle text-warning-text" },
  likely_over: { label: "Likely over", cls: "bg-critical-subtle text-critical" },
  no_data: { label: "Not enough data yet", cls: "bg-canvas-subtle text-ink-muted" },
};

const kg = (n: number) => Math.round(n).toLocaleString("en-IN");
const inr = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN")}`;

function headline(g: GoalView): React.ReactNode {
  const c = g.current;
  const gap = c.target - c.forecast;
  if (c.state === "no_data") return <>We need this month&apos;s baseline before we can say where it&apos;s heading.</>;
  if (c.state === "on_track")
    return (
      <>
        On track: about {c.inrVsTarget ? `${inr(c.inrVsTarget)} and ` : ""}
        {kg(gap)} kg under {c.label}&apos;s target.
      </>
    );
  if (c.state === "watch")
    return (
      <>
        Close: heading for {kg(c.forecast)} kg against a {kg(c.target)} kg target.
      </>
    );
  return (
    <>
      At this pace, about {kg(c.forecast)} kg against a {kg(c.target)} kg target
      {c.inrVsTarget && c.inrVsTarget > 0 ? ` (${inr(c.inrVsTarget)} more electricity than planned)` : ""}.
    </>
  );
}

export function GoalCard() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const key = ["household", activeHouseholdId, "goal", demoRole];

  const { data, isLoading } = useQuery<{ goal: GoalView | null }>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/goals`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("Couldn't load the goal");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });

  const change = useMutation({
    mutationFn: async (body: { targetPct: number; glideMonths: number } | null) => {
      const res = await fetch(`/api/households/${activeHouseholdId}/goals`, {
        method: body ? "POST" : "DELETE",
        headers: { "content-type": "application/json", "x-demo-role": demoRole },
        body: body ? JSON.stringify(body) : undefined,
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Couldn't save the goal");
      return out;
    },
    onSuccess: (out) => {
      setError(null);
      qc.setQueryData(key, out);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save the goal"),
  });

  if (isLoading) return <div className="h-40 animate-pulse rounded-md bg-canvas-subtle" />;
  const goal = data?.goal ?? null;
  const manage = can("goal:manage");

  if (!goal) {
    return (
      <section className="rounded-md border border-border bg-canvas-card p-5 md:p-6">
        <p className="label-caps text-ink-muted">Your goal</p>
        <h2 className="mt-2 font-heading text-2xl">Pick how much to cut</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          We measure every month against the same month last year, so summer is compared with summer. The cut grows a little
          each month over six months, and heatwave days never count against you.
        </p>
        {manage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {[5, 10, 15].map((pct) => (
              <button
                key={pct}
                onClick={() => change.mutate({ targetPct: pct, glideMonths: 6 })}
                disabled={change.isPending}
                className={`h-10 rounded-md px-4 text-sm ${pct === 10 ? "bg-ink text-canvas" : "border border-border hover:border-ink"}`}
              >
                Cut {pct}%{pct === 10 ? " (a good start)" : ""}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">The household owner can set a goal.</p>
        )}
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
      </section>
    );
  }

  const st = STATE[goal.current.state];
  const top = Math.max(1, ...goal.months.map((m) => Math.max(m.target, m.actual ?? 0)), goal.current.forecast);
  const endLabel = goal.months[goal.months.length - 1]?.label ?? goal.endMonth;

  return (
    <section className="rounded-md border border-border bg-canvas-card p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label-caps text-ink-muted">
          Your goal · cut {goal.targetPct}% by {endLabel}
        </p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
      </div>
      <p className="mt-3 max-w-3xl font-heading text-2xl leading-snug">{headline(goal)}</p>
      {goal.current.state === "likely_over" && goal.lever && (
        <p className="mt-2 text-sm">
          Biggest lever:{" "}
          <Link href="/actions" className="underline underline-offset-2">
            {goal.lever.action}
          </Link>{" "}
          <span className="text-ink-muted">
            (−{goal.lever.kgSaved} kg{goal.lever.inrSaved > 0 ? `, ₹${goal.lever.inrSaved.toLocaleString("en-IN")}` : ""} a month)
          </span>
        </p>
      )}

      {/* month by month: target tick, actual bar when the month is over, forecast for this month */}
      <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${goal.months.length}, minmax(0, 1fr))` }}>
        {goal.months.map((m) => {
          const isNow = m.month === goal.current.month;
          const value = m.complete ? m.actual : isNow ? goal.current.forecast : null;
          return (
            <div key={m.month} className="flex flex-col items-center gap-1">
              <div className="relative h-20 w-full max-w-[56px] bg-canvas-subtle" title={`Target ${m.target} kg`}>
                {value != null && (
                  <div
                    className={`absolute inset-x-0 bottom-0 ${m.complete ? (m.met ? "bg-success" : "bg-secondary") : "bg-ink/25"}`}
                    style={{ height: `${(value / top) * 100}%` }}
                  />
                )}
                <div className="absolute inset-x-0 border-t-2 border-dashed border-ink" style={{ bottom: `${(m.target / top) * 100}%` }} />
              </div>
              <span className={`font-mono text-[10px] ${isNow ? "text-ink" : "text-ink-muted"}`}>{m.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-muted">
        Dashed line: each month&apos;s target. Measured against {goal.baselineBasis}
        {goal.current.essentialKg > 0 ? `; ${goal.current.essentialKg} kg of heatwave cooling this month is left out` : "; heatwave cooling is left out"}.
        {manage && (
          <>
            {" "}
            <button onClick={() => change.mutate(null)} className="underline underline-offset-2 hover:text-ink">
              Stop this goal
            </button>
          </>
        )}
      </p>
      {error && <p className="mt-2 text-sm text-critical">{error}</p>}
    </section>
  );
}
