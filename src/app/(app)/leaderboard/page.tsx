"use client";

import React, { useEffect, useState } from "react";
import { Crown, Medal, TrendingUp } from "lucide-react";
import { useAppStore } from "@/store";
import { PageIntro } from "@/components/ui/PageIntro";
import { Skeleton } from "@/components/ui/Skeleton";
import type { BenchmarkResult } from "@/server/services/benchmark.service";

type Metric = "perCapita" | "emissions";
type Row = BenchmarkResult["cohortList"][number];

const MEDAL = ["#C9A227", "#A7A9AC", "#B87333"]; // gold, silver, bronze

export default function LeaderboardPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const [data, setData] = useState<(BenchmarkResult & { period?: { label: string } }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("perCapita");
  const [state, setState] = useState("all");
  const [size, setSize] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = new URLSearchParams({ householdId: activeHouseholdId });
      if (state !== "all") q.set("state", state);
      if (size !== "all") q.set("sizeBand", size);
      const res = await fetch(`/api/benchmark?${q}`, { headers: { "x-demo-role": demoRole } });
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.ok) {
        setData(body);
        setError(null);
      } else {
        setData(null);
        setError(body.error ?? "Leaderboard unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeHouseholdId, demoRole, state, size]);

  const rows: Row[] = data ? [...data.cohortList].sort((a, b) => a[metric] - b[metric]) : [];
  const meIdx = rows.findIndex((r) => r.isCurrent);
  const me = rows[meIdx];
  const ahead = meIdx > 0 ? rows[meIdx - 1] : null;
  const unit = metric === "perCapita" ? "kg per person" : "kg";
  // Just enough to drop below the home ahead (rounded up to 0.1 kg; the tiny epsilon absorbs float noise)
  const cut = me && ahead ? (Math.ceil((me[metric] - ahead[metric]) * 10 - 1e-6) + 1) / 10 : 0;

  return (
    <div className="flex flex-col gap-10">
      <PageIntro
        section="Understand"
        title="Leaderboard"
        what={`Every Carbon Wallet home with data for ${data?.period?.label ?? "the month"}, ranked from cleanest to highest. Other homes are anonymous; only you see your name.`}
        doThis="Rank by kg per person (fair for big families) or by the whole home, and narrow to your state or family size."
        get="Your rank, and exactly how many kg you need to cut to pass the home just ahead of you."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border p-0.5 text-xs">
          {(["perCapita", "emissions"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-full px-3 py-1 ${metric === m ? "bg-ink text-canvas-card" : "text-ink-muted"}`}
            >
              {m === "perCapita" ? "Per person" : "Whole home"}
            </button>
          ))}
        </div>
        <select value={state} onChange={(e) => setState(e.target.value)} className="h-8 rounded-full border border-border bg-canvas-card px-3 text-xs">
          <option value="all">All states</option>
          {["UP", "DL", "HR", "MH", "KA", "TN", "RJ", "WB"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={size} onChange={(e) => setSize(e.target.value)} className="h-8 rounded-full border border-border bg-canvas-card px-3 text-xs">
          <option value="all">Any family size</option>
          <option value="small">1–3 people</option>
          <option value="medium">4–5 people</option>
          <option value="large">6+ people</option>
        </select>
      </div>

      {error && <p className="border border-dashed border-border px-6 py-10 text-center text-sm text-ink-muted">{error}</p>}
      {!data && !error && <Skeleton className="h-96 w-full" />}

      {data && me && (
        <>
          {/* Your position */}
          <section className="grid grid-cols-1 gap-6 bg-primary p-6 text-canvas-card md:grid-cols-3">
            <div>
              <span className="label-caps text-canvas-card/60">Your rank</span>
              <p className="mt-1 font-heading text-6xl font-medium leading-none">
                #{meIdx + 1}
                <span className="ml-2 text-lg text-canvas-card/60">of {rows.length}</span>
              </p>
            </div>
            <div>
              <span className="label-caps text-canvas-card/60">You</span>
              <p className="mt-1 font-heading text-3xl tabular-nums">
                {me[metric]} <span className="text-base text-canvas-card/60">{unit}</span>
              </p>
              <p className="mt-1 text-xs text-canvas-card/60">
                Median {metric === "perCapita" ? data.cohortMedianPerCapita : data.cohortMedianTotal} {unit}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-1 h-5 w-5 shrink-0 text-secondary-fixed" />
              <p className="text-sm leading-relaxed text-canvas-card/85">
                {ahead ? (
                  <>
                    Cut <strong className="text-canvas-card">{cut} {unit}</strong> a month to pass the home at #{meIdx}.
                    {metric === "perCapita" && ` That's ${Math.round(cut * me.size * 10) / 10} kg for your ${me.size}-person home.`}
                  </>
                ) : (
                  <>You&apos;re the cleanest home here. Keep it up.</>
                )}
              </p>
            </div>
          </section>

          {/* Podium */}
          <section className="grid grid-cols-3 items-end gap-3">
            {[1, 0, 2].map((i) => {
              const r = rows[i];
              if (!r) return <div key={i} />;
              const heights = ["h-36", "h-28", "h-20"];
              return (
                <div key={i} className="flex flex-col items-center text-center">
                  {i === 0 ? <Crown className="mb-1 h-6 w-6" style={{ color: MEDAL[0] }} /> : <Medal className="mb-1 h-5 w-5" style={{ color: MEDAL[i] }} />}
                  <span className={`text-sm ${r.isCurrent ? "font-semibold text-secondary" : ""}`}>{r.isCurrent ? "You" : r.name}</span>
                  <span className="text-[11px] text-ink-muted">{r.city}</span>
                  <div
                    className={`mt-2 flex w-full items-start justify-center pt-2 ${heights[i]} ${r.isCurrent ? "bg-secondary text-white" : "bg-canvas-subtle"}`}
                    style={{ borderTop: `4px solid ${MEDAL[i]}` }}
                  >
                    <span className="font-heading text-2xl tabular-nums">{r[metric]}</span>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Full table */}
          <section className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-ink text-left">
                  <th className="label-caps pb-2 font-medium">Rank</th>
                  <th className="label-caps pb-2 font-medium">Home</th>
                  <th className="label-caps pb-2 font-medium">City</th>
                  <th className="label-caps pb-2 text-right font-medium">People</th>
                  <th className="label-caps pb-2 text-right font-medium">Per person</th>
                  <th className="label-caps pb-2 text-right font-medium">Whole home</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={`border-b border-border/70 ${r.isCurrent ? "bg-secondary-fixed/40 font-semibold" : ""}`}>
                    <td className="py-2.5">
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px]"
                        style={i < 3 ? { backgroundColor: MEDAL[i], color: "white" } : undefined}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-2.5">{r.isCurrent ? `${r.name} (you)` : r.name}</td>
                    <td className="py-2.5 text-ink-muted">{r.city}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{r.size}</td>
                    <td className={`py-2.5 text-right font-mono tabular-nums ${metric === "perCapita" ? "text-ink" : "text-ink-muted"}`}>{r.perCapita} kg</td>
                    <td className={`py-2.5 text-right font-mono tabular-nums ${metric === "emissions" ? "text-ink" : "text-ink-muted"}`}>{r.emissions} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12px] text-ink-muted">
              {rows.length} homes with recorded data for {data.period?.label ?? "this month"}. Totals are kg CO₂ for the month.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
