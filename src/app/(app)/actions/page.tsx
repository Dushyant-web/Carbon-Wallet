"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Check, Sun, Thermometer, Zap } from "lucide-react";
import { useAppStore } from "@/store";
import { usePermissions } from "@/hooks/usePermissions";
import { PageIntro } from "@/components/ui/PageIntro";
import { Skeleton } from "@/components/ui/Skeleton";

type Rec = {
  id: string;
  action: string;
  description: string | null;
  category: string | null;
  kgSaved: number;
  inrSaved: number;
  difficulty: string;
  status: string;
  commitMonth: string | null;
  expectedLow: number | null;
  expectedHigh: number | null;
  realizedKg: number | null;
  verification: "BILL" | "FUEL" | "DECLARED" | null;
  verifyNote: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Where a commitment stands: waiting for data, measured, or counted at half as a promise. */
function Verified({ r }: { r: Rec }) {
  if (!r.commitMonth) return null;
  const from = r.category === "Transport" ? "fill-ups" : "bill";
  if (r.verification === "BILL" || r.verification === "FUEL") {
    const saved = (r.realizedKg ?? 0) > 0;
    return (
      <p className={`mt-2 text-[13px] ${saved ? "text-success-text" : "text-ink-muted"}`}>
        {saved ? `Verified from your ${from}: −${r.realizedKg} kg a month.` : `No saving showed up in your ${from} yet (+${Math.abs(r.realizedKg ?? 0)} kg).`}
        {r.verifyNote && <span className="block text-[12px] text-ink-muted">{r.verifyNote}</span>}
      </p>
    );
  }
  if (r.verification === "DECLARED") {
    return <p className="mt-2 text-[13px] text-ink-muted">Counts at half for now (−{r.realizedKg} kg) until a {from} shows it.</p>;
  }
  return (
    <p className="mt-2 text-[13px] text-ink-muted">
      We&apos;ll check it against your next {from} ({monthName(r.commitMonth)} onwards). Expected −{r.expectedLow}–{r.expectedHigh} kg a month.
    </p>
  );
}

const EFFORT: Record<string, string> = { EASY: "Easy", MEDIUM: "Some effort", HARD: "Big step" };
const icon = (r: Rec) =>
  r.category === "Transport" ? Car : /solar/i.test(r.action) ? Sun : /AC|°C/.test(r.action) ? Thermometer : Zap;

export default function SuggestionsPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery<{ recommendations: Rec[] }>({
    queryKey: ["household", activeHouseholdId, "recommendations", demoRole],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/recommendations`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("Couldn't load suggestions");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });

  async function commit(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/households/${activeHouseholdId}/recommendations/${id}/apply`, {
      method: "POST",
      headers: { "x-demo-role": demoRole },
    });
    if (res.ok) qc.invalidateQueries({ queryKey: ["household", activeHouseholdId] });
    else setError((await res.json().catch(() => ({}))).error ?? "Couldn't save");
    setBusy(null);
  }

  const recs = data?.recommendations ?? [];
  const pending = recs.filter((r) => r.status === "PENDING");
  const committed = recs.filter((r) => r.status !== "PENDING");
  const committedKg = committed.reduce((s, r) => s + r.kgSaved, 0);
  const verifiedKg = committed.reduce((s, r) => s + (r.verification && r.verification !== "DECLARED" && (r.realizedKg ?? 0) > 0 ? r.realizedKg! : 0), 0);
  const maxKg = Math.max(1, ...recs.map((r) => r.kgSaved));

  return (
    <div className="flex flex-col gap-10">
      <PageIntro
        section="Improve"
        title="Suggestions"
        what="The changes that would cut the most CO₂ in your home, biggest first. Each one is worked out from your own AC, car and electricity rate, with the sum shown."
        doThis="Pick one and press Commit. It's then counted in your forecast on the Insights page."
        get="A clear saving in kg and rupees a month for each change."
        actions={
          <Link href="/challenges" className="inline-flex h-9 items-center rounded-md border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-canvas-card">
            Prefer daily habits? Try challenges
          </Link>
        }
      />

      {error && <p className="text-[13px] text-critical-text">{error}</p>}
      {committed.length > 0 && (
        <p className="border border-success-border bg-success-subtle px-4 py-3 text-sm text-success-text">
          You&apos;ve committed to {committed.length} change{committed.length > 1 ? "s" : ""}: about {Math.round(committedKg)} kg a month less.
          {verifiedKg > 0 && ` ${Math.round(verifiedKg)} kg a month of it is already verified from your bills and fill-ups.`}
        </p>
      )}

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : recs.length === 0 ? (
        <p className="border border-dashed border-border px-6 py-12 text-center text-sm text-ink-muted">
          Nothing to suggest yet. Add an electricity bill, your AC or a vehicle in{" "}
          <Link href="/assets" className="underline">Appliances &amp; vehicles</Link>, and suggestions appear here.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {[...pending, ...committed].map((r, i) => {
            const Icon = icon(r);
            const done = r.status !== "PENDING";
            return (
              <li key={r.id} className={`grid grid-cols-1 gap-4 border p-5 md:grid-cols-[auto_1fr_auto] md:items-center ${done ? "border-success-border bg-success-subtle/40" : "border-border bg-canvas-card"}`}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink-light">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas-subtle">
                    <Icon className="h-5 w-5 text-secondary" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h3 className="font-heading text-xl font-medium">{r.action}</h3>
                    <span className="text-xs text-ink-muted">{EFFORT[r.difficulty] ?? r.difficulty}</span>
                  </div>
                  {r.description && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">{r.description}</p>}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 w-40 bg-canvas-subtle">
                      <div className="h-full bg-tertiary" style={{ width: `${(r.kgSaved / maxKg) * 100}%` }} />
                    </div>
                    <span className="font-mono text-sm tabular-nums">−{r.kgSaved} kg</span>
                    {r.inrSaved > 0 && <span className="text-sm text-ink-muted">· ₹{r.inrSaved.toLocaleString("en-IN")} a month</span>}
                  </div>
                  {done && <Verified r={r} />}
                </div>
                <div>
                  {done ? (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-success-text">
                      <Check className="h-4 w-4" /> Committed
                    </span>
                  ) : (
                    <button
                      disabled={!can("recommendation:apply") || busy === r.id}
                      onClick={() => commit(r.id)}
                      className="h-10 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-40"
                    >
                      {busy === r.id ? "Saving…" : "Commit"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
