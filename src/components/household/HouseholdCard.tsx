"use client";

import React, { useState } from "react";
import { categoryColor } from "@/lib/viz";
import { ROLE_LABELS } from "@/server/auth/permissions";
import type { Role } from "@/types";

type Member = { id: string; name: string; role: string };
type Appliance = { id: string; name: string; type: string; rating: string; powerKw: number };
type Vehicle = { id: string; name: string; type: string; fuel: string; monthlyKm: number };

export type HouseholdCardData = {
  household: {
    id: string;
    name: string;
    city: string;
    state: string;
    size: number;
    floorAreaM2?: number | null;
    joinCode: string;
  };
  period?: { label: string };
  kpi: {
    totalEmissions: number;
    trendPct: number | null;
    score: number | null;
    scoreBand: string | null;
    peer: { percentile: number; cohortCount: number } | null;
    topContributor: { category: string; amountKg: number; sharePct: number };
  };
  categoryBreakdown: Record<string, number>;
  members: Member[];
  appliances: Appliance[];
  vehicles: Vehicle[];
  solar: { hasSolar: boolean; solarKwh: number };
};

/** One card with everything about a household: who, where, what they own, and where their carbon stands. */
export function HouseholdCard({ data }: { data: HouseholdCardData }) {
  const { household, kpi, categoryBreakdown, members, appliances, vehicles, solar, period } = data;
  const [copied, setCopied] = useState(false);
  const acs = appliances.filter((a) => a.type === "AC");
  const otherAppliances = appliances.filter((a) => a.type !== "AC" && a.type !== "SolarPV");
  const total = kpi.totalEmissions || 1;
  const categories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
  const perPerson = household.size ? Math.round(kpi.totalEmissions / household.size) : null;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(household.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the code is visible anyway */
    }
  }

  return (
    <article className="border border-ink bg-canvas-card" aria-label={`Household card for ${household.name}`}>
      {/* Header strip */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink px-6 py-5">
        <div>
          <span className="label-caps">Your household</span>
          <h2 className="mt-1 font-heading text-3xl md:text-4xl font-medium tracking-tight">{household.name}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {household.city}, {household.state} · {household.size} people
            {household.floorAreaM2 ? ` · ${household.floorAreaM2} m²` : ""}
          </p>
        </div>
        <div className="flex items-end gap-6">
          <div className="text-right">
            <span className="label-caps">Join code · share to add family</span>
            <button
              onClick={copyCode}
              title="Copy join code"
              className="mt-1 block font-mono text-lg font-semibold tracking-wider hover:text-secondary"
            >
              {household.joinCode} <span className="text-xs font-normal text-ink-muted">{copied ? "copied ✓" : "copy"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Carbon this month */}
        <section className="border-b border-border px-6 py-5 lg:border-b-0 lg:border-r">
          <span className="label-caps">{period?.label ?? "This month"}</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-5xl font-medium leading-none tabular-nums">{kpi.totalEmissions}</span>
            <span className="font-mono text-xs text-ink-muted">kg CO₂</span>
          </div>
          {kpi.trendPct !== null && (
            <p className={`mt-2 font-mono text-xs ${kpi.trendPct <= 0 ? "text-success-text" : "text-critical-text"}`}>
              {kpi.trendPct > 0 ? "▲" : "▼"} {Math.abs(kpi.trendPct)}% vs the month before
            </p>
          )}
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3 text-sm">
            <div>
              <dt className="label-caps">Per person</dt>
              <dd className="mt-0.5 font-mono tabular-nums">{perPerson ?? "—"} kg</dd>
            </div>
            <div>
              <dt className="label-caps">Score</dt>
              <dd className="mt-0.5 font-mono tabular-nums">{kpi.score !== null ? `${kpi.score}/100` : "—"}</dd>
            </div>
            <div>
              <dt className="label-caps">Cleaner than</dt>
              <dd className="mt-0.5 font-mono tabular-nums">{kpi.peer ? `${kpi.peer.percentile}% of homes` : "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex h-2 w-full overflow-hidden" aria-hidden>
            {categories.map(([cat, kg]) => (
              <div key={cat} style={{ width: `${(kg / total) * 100}%`, backgroundColor: categoryColor(cat) }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
            {categories.filter(([, kg]) => kg > 0).map(([cat, kg]) => (
              <li key={cat} className="flex items-center gap-1.5">
                <span className="h-2 w-2" style={{ backgroundColor: categoryColor(cat) }} />
                {cat} {Math.round((kg / total) * 100)}%
              </li>
            ))}
          </ul>
        </section>

        {/* Members */}
        <section className="border-b border-border px-6 py-5 lg:border-b-0 lg:border-r">
          <span className="label-caps">Members · {members.length}</span>
          <ul className="mt-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between border-b border-border/70 py-2 text-sm last:border-b-0">
                <span>{m.name}</span>
                <span className="font-mono text-[10px] uppercase text-ink-muted">{ROLE_LABELS[m.role as Role] ?? m.role}</span>
              </li>
            ))}
            {members.length === 0 && <li className="py-2 text-sm text-ink-muted">No members yet.</li>}
          </ul>
        </section>

        {/* Assets */}
        <section className="px-6 py-5">
          <span className="label-caps">What they run</span>
          <ul className="mt-2 text-sm">
            {acs.map((a) => (
              <li key={a.id} className="flex items-center justify-between border-b border-border/70 py-2">
                <span>{a.name}</span>
                <span className="font-mono text-[11px] text-ink-muted">
                  {a.rating.replace(/_/g, " ").toLowerCase()} · {a.powerKw} kW
                </span>
              </li>
            ))}
            {otherAppliances.map((a) => (
              <li key={a.id} className="flex items-center justify-between border-b border-border/70 py-2">
                <span>{a.name}</span>
                <span className="font-mono text-[11px] text-ink-muted">{a.powerKw} kW</span>
              </li>
            ))}
            {vehicles.map((v) => (
              <li key={v.id} className="flex items-center justify-between border-b border-border/70 py-2">
                <span>{v.name}</span>
                <span className="font-mono text-[11px] text-ink-muted">
                  {v.fuel.toLowerCase()} · {v.monthlyKm} km/mo
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between py-2">
              <span>Rooftop solar</span>
              <span className="font-mono text-[11px] text-ink-muted">
                {solar.hasSolar ? `${solar.solarKwh} kWh/mo` : "none"}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ink px-6 py-3 text-[11px] text-ink-muted">
        <span>
          Largest source: <span className="text-ink">{kpi.topContributor.category}</span> ({kpi.topContributor.sharePct}%)
        </span>
        <button onClick={() => window.print()} className="underline hover:text-ink print:hidden">
          Print card
        </button>
      </footer>
    </article>
  );
}
