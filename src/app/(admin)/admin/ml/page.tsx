"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrainCircuit, RefreshCw, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

type Scores = { mae_kg: number; mape_pct: number; r2: number };
type Info = {
  version: string;
  trained_at: string;
  algorithm: string;
  target: string;
  homes: number;
  rows: number;
  months: { from: string; to: string } | null;
  weather: string;
  held_out: { rows: number; model: Scores; same_as_last_month: Scores; same_month_last_year: Scores } | null;
  beats_baseline: boolean;
  importances: { feature: string; label: string; importance: number }[];
};
type Status = {
  trained: boolean;
  info: Info | null;
  training?: { running: boolean; started_at: string | null; finished_at: string | null; error: string | null };
  error?: string;
  data: { homesWithHistory: number; homeMonths: number; demoHomes: number; realHomes: number };
};

const NEEDED = [
  ["Real electricity bills", "At least 12 months of bills (so it has seen every season change once) from 30–50 real homes: units, dates, amount. This is what the model learns from; the demo homes are synthetic."],
  ["Who lives there", "People in the home and home type for those homes (already asked at sign-up)."],
  ["Their big items", "ACs (tonnage, stars, inverter or not) and other appliances, registered by shops or the owner."],
  ["AC hours, a few times", "Owners' own guess of AC hours a day in two or three months: lets the model tell habit from heat."],
  ["Fuel fill-ups", "For homes with a car or scooter: pump photos over a few months, so transport can be forecast too."],
] as const;

/** The next-month forecast model: how it was trained, how well it does on unseen months, what it needs. */
export default function AdminMlPage() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery<Status>({
    queryKey: ["admin", "ml"],
    queryFn: async () => (await fetch("/api/admin/ml")).json(),
    refetchInterval: (q) => (q.state.data?.training?.running ? 3000 : false), // watch a retrain finish
  });

  async function retrain() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ml", { method: "POST" });
      const body = await res.json();
      if (res.ok) toast.success(body.started ? "Retraining started. It takes about half a minute." : "Already retraining.");
      else toast.error(body.error ?? "Retraining failed");
      qc.invalidateQueries({ queryKey: ["admin", "ml"] });
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !data) return <Skeleton className="h-[480px] w-full" />;
  const info = data.info;
  const ho = info?.held_out;
  const maxImp = Math.max(...(info?.importances.map((i) => i.importance) ?? [1]), 0.0001);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label-caps flex items-center gap-1.5">
            <BrainCircuit className="h-4 w-4" /> Machine learning
          </span>
          <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight">Next-month forecast</h1>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
            Predicts each home&apos;s CO₂ for next month, with a likely range and the reasons in kg (SHAP), from its recent
            months, its ACs and appliances, how many people live there, and the real weather at its city. Retrained every night.
          </p>
        </div>
        <button onClick={retrain} disabled={busy || data?.training?.running} className="inline-flex h-11 items-center gap-2 rounded-md bg-gov-navy px-5 text-[14px] font-semibold text-white disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy || data?.training?.running ? "animate-spin" : ""}`} /> {busy || data?.training?.running ? "Retraining…" : "Retrain now"}
        </button>
      </header>

      {data.training?.error && <p className="border-l-4 border-critical bg-critical-subtle px-4 py-3 text-[14px]">The last retraining failed: {data.training.error}</p>}

      {data.data.realHomes < 30 && (
        <p className="flex items-start gap-2 border-l-4 border-gov-saffron bg-gov-saffronSoft px-4 py-3 text-[14px]">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            Trained mostly on <strong>{data.data.demoHomes} simulated homes</strong>. Their averages match each state&apos;s real home
            electricity and they follow the real weather at their city, but every home itself is made up, so the scores show how
            well it learns the pattern, not yet how well it knows real families. Real bills (see the list below) make it trustworthy.
          </span>
        </p>
      )}

      {!data.trained || !info ? (
        <p className="border border-border bg-canvas-card p-5 text-[14px]">
          {data.error ? `The engine isn't reachable: ${data.error}` : "Not trained yet. Press “Retrain now”, or it trains itself the first time a home opens its forecast."}
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
            {[
              ["Trained", new Date(info.trained_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })],
              ["Homes", String(info.homes)],
              ["Home-months", String(info.rows)],
              ["Months", info.months ? `${info.months.from} → ${info.months.to}` : "–"],
            ].map(([k, v]) => (
              <div key={k} className="bg-canvas-card p-4">
                <p className="label-caps">{k}</p>
                <p className="mt-1 font-heading text-xl">{v}</p>
              </div>
            ))}
          </section>

          <section>
            <h2 className="font-heading text-2xl font-medium">How good is it?</h2>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              Scored on each home&apos;s last two months, which the model did not see while learning ({ho?.rows ?? 0} home-months).
              {info.beats_baseline ? " It beats both simple guesses." : " It does not beat the simple guess yet: don't show it to homes."}
            </p>
            {ho && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="label-caps pb-2 font-medium">Method</th>
                      <th className="label-caps pb-2 text-right font-medium">Avg. error (kg)</th>
                      <th className="label-caps pb-2 text-right font-medium">Avg. error (%)</th>
                      <th className="label-caps pb-2 text-right font-medium">R²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["This model", ho.model, true],
                        ["Same as last month", ho.same_as_last_month, false],
                        ["Same month last year", ho.same_month_last_year, false],
                      ] as const
                    ).map(([name, s, bold]) => (
                      <tr key={name} className={`border-b border-border/70 ${bold ? "font-semibold" : ""}`}>
                        <td className="py-2.5">{name}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">{s.mae_kg}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">{s.mape_pct}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">{s.r2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="font-heading text-2xl font-medium">What it pays attention to</h2>
            <ul className="mt-3 flex max-w-2xl flex-col gap-2">
              {info.importances.slice(0, 10).map((i) => (
                <li key={i.feature} className="grid grid-cols-[220px_1fr_56px] items-center gap-3 text-[13.5px]">
                  <span>{i.label}</span>
                  <span className="h-2.5 bg-canvas-subtle">
                    <span className="block h-full bg-gov-blue" style={{ width: `${(i.importance / maxImp) * 100}%` }} />
                  </span>
                  <span className="text-right font-mono tabular-nums">{(i.importance * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 max-w-3xl text-[12.5px] text-ink-muted">
              {info.algorithm}. Target: {info.target.toLowerCase()}. Weather: {info.weather}.
            </p>
          </section>
        </>
      )}

      <section>
        <h2 className="font-heading text-2xl font-medium">What would make it trustworthy</h2>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Now: {data.data.homesWithHistory} homes with history, {data.data.homeMonths} home-months; {data.data.realHomes} real homes, {data.data.demoHomes} demo.
        </p>
        <ol className="mt-3 flex max-w-3xl list-decimal flex-col gap-2 pl-5 text-[14px]">
          {NEEDED.map(([k, v]) => (
            <li key={k}>
              <strong>{k}.</strong> {v}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
