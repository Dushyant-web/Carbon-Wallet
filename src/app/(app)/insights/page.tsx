"use client";

import React, { useState } from "react";
import { HowCalculated } from "@/components/ui/HowCalculated";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Car, Sparkles, Zap } from "lucide-react";
import { useAppStore } from "@/store";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionHeading } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Insights } from "@/server/services/insights.service";

type Forecast = {
  totalCommittedSavingsKg: number;
  projection: { label: string; basis: "same_month_last_year" | "recent_average"; baselineKg: number; withActionsKg: number }[];
};
type Narrative = { bullets: string[]; model: string | null; reason: string | null };

const UP = "#B4532F";
const DOWN = "#3F6B4E";

export default function InsightsPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const [month, setMonth] = useState<string | null>(null);
  const headers = { "x-demo-role": demoRole };

  const insights = useQuery<Insights>({
    queryKey: ["household", activeHouseholdId, "insights", month, demoRole],
    queryFn: async () => {
      const q = month ? `?month=${month}` : "";
      const res = await fetch(`/api/households/${activeHouseholdId}/insights${q}`, { headers });
      if (!res.ok) throw new Error("Couldn't load insights");
      return res.json();
    },
    enabled: !!activeHouseholdId,
    placeholderData: (prev) => prev,
  });
  const focus = month ?? insights.data?.focusMonth ?? null;
  const narrative = useQuery<Narrative>({
    queryKey: ["household", activeHouseholdId, "narrative", focus],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/insights/narrative${focus ? `?month=${focus}` : ""}`, { headers });
      return res.json();
    },
    enabled: !!activeHouseholdId && !!insights.data?.available,
    staleTime: 10 * 60_000,
  });
  const forecast = useQuery<Forecast>({
    queryKey: ["household", activeHouseholdId, "forecast", demoRole],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/forecast`, { headers });
      if (!res.ok) throw new Error("forecast failed");
      return res.json();
    },
    enabled: !!activeHouseholdId,
  });

  const d = insights.data;
  const fm = d?.months.find((m) => m.month === focus) ?? d?.months[d.months.length - 1];
  const aiBullets = narrative.data?.bullets ?? [];
  const usingAi = aiBullets.length >= 2;

  return (
    <div className="flex flex-col gap-12">
      <PageIntro
        section="Understand"
        title="Insights"
        what="What made your CO₂ go up or down each month, which appliance and which vehicle matter most, and where you're heading next."
        doThis="Pick a month to see what drove it. Read the summary at the top for the short version."
        get="Plain answers: what pushed each month up or down, by how many kg, and what to do about it."
      />

      {insights.isLoading && <Skeleton className="h-96 w-full" />}
      {d && !d.available && (
        <p className="border border-dashed border-border px-6 py-12 text-center text-sm text-ink-muted">{d.reason}</p>
      )}

      {d?.available && fm && (
        <>
          {/* In short */}
          <section className="bg-primary p-6 text-canvas-card md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 label-caps text-canvas-card/70">
                <Sparkles className="h-4 w-4 text-secondary-fixed" /> In short · {fm.label}
              </span>

            </div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {(usingAi ? aiBullets : d.bullets).map((b) => (
                <li key={b} className="flex gap-3 text-[15px] leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary-fixed" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Month drivers */}
          <section>
            <SectionHeading index="01" title="What changed this month" />
            <div className="mt-4 flex flex-wrap gap-1.5">
              {d.months.map((m) => (
                <button
                  key={m.month}
                  onClick={() => setMonth(m.month)}
                  className={`rounded-full border px-3 py-1 text-xs ${m.month === fm.month ? "border-ink bg-ink text-canvas-card" : "border-border text-ink-muted hover:border-ink"}`}
                >
                  {m.label.replace(/ \d{4}$/, (y) => ` ’${y.slice(-2)}`)}
                </button>
              ))}
            </div>
            <Waterfall base={d.baseKg} month={fm} />
            <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-ink-muted">
              Starting from your normal month ({d.baseKg} kg), each bar shows how many kg that source added (red) or saved (green).
              Together they make {fm.label}&apos;s {fm.totalKg} kg.
            </p>
          </section>

          {/* Year grid */}
          <section>
            <SectionHeading index="02" title="Your year at a glance" meta={d.peak ? `Highest: ${d.peak.label}, ${d.peak.kg} kg` : undefined} />
            <YearGrid d={d} focus={fm.month} onPick={setMonth} />
          </section>

          {/* Appliances and vehicles */}
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <section>
              <SectionHeading index="03" title="Which appliance" meta={fm.label} />
              {d.appliances.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">
                  Add your appliances in <Link href="/assets" className="underline">Appliances &amp; vehicles</Link> to see this.
                </p>
              ) : (
                <BarList rows={d.appliances.map((a) => ({ name: a.name, kg: a.kg, note: `${a.sharePct}% of electricity` }))} icon={<Zap className="h-4 w-4 text-secondary" />} />
              )}
              <HowCalculated className="mt-3">
                An estimate: the month&apos;s electricity is shared out by how much power each appliance uses and how many hours it
                runs. Once you&apos;ve added bills, your AC uses its real measured power.
              </HowCalculated>
            </section>
            <section>
              <SectionHeading index="04" title="Which vehicle" meta={fm.label} />
              {d.vehicles.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">No vehicle trips or fuel recorded this month.</p>
              ) : (
                <BarList rows={d.vehicles.map((v) => ({ name: v.name, kg: v.kg, note: v.fuel }))} icon={<Car className="h-4 w-4 text-secondary" />} />
              )}
              <p className="mt-3 text-[12px] text-ink-muted">
                From logged trips and fuel fill-ups. Add fuel from a pump photo in{" "}
                <Link href="/assets/fuel" className="underline">Appliances &amp; vehicles</Link>.
              </p>
            </section>
          </div>
        </>
      )}

      {/* Forecast */}
      <section>
        <SectionHeading
          index="05"
          title="Next six months"
          meta={forecast.data ? `Committed savings: ${forecast.data.totalCommittedSavingsKg} kg/month` : undefined}
        />
        {forecast.data && forecast.data.projection.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps pb-2 font-medium">Month</th>
                  <th className="label-caps pb-2 font-medium">Based on</th>
                  <th className="label-caps pb-2 text-right font-medium">If nothing changes</th>
                  <th className="label-caps pb-2 text-right font-medium">With your commitments</th>
                </tr>
              </thead>
              <tbody>
                {forecast.data.projection.map((p) => (
                  <tr key={p.label} className="border-b border-border/70">
                    <td className="py-2.5">{p.label}</td>
                    <td className="py-2.5 text-xs text-ink-muted">{p.basis === "same_month_last_year" ? "same month last year" : "your recent average"}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{Math.round(p.baselineKg)} kg</td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">{Math.round(p.withActionsKg)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12px] text-ink-muted">
              Commit to changes on the <Link href="/actions" className="underline">Suggestions</Link> page and the right-hand column drops.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">{forecast.isLoading ? "Loading…" : "Not enough history to forecast yet."}</p>
        )}
      </section>
    </div>
  );
}

function Waterfall({ base, month }: { base: number; month: Insights["months"][number] }) {
  const drivers = month.drivers.slice(0, 7);
  const rest = month.drivers.slice(7).reduce((s, x) => s + x.kg, 0);
  const steps = [...drivers, ...(Math.abs(rest) >= 0.1 ? [{ source: "Smaller changes", kg: Math.round(rest * 10) / 10 }] : [])];
  // running positions
  let run = base;
  const bars = steps.map((s) => {
    const from = run;
    run += s.kg;
    return { ...s, from, to: run };
  });
  const lo = Math.min(base, month.totalKg, ...bars.map((b) => Math.min(b.from, b.to))) * 0.92;
  const hi = Math.max(base, month.totalKg, ...bars.map((b) => Math.max(b.from, b.to))) * 1.04;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const w = (a: number, b: number) => `${(Math.abs(b - a) / (hi - lo)) * 100}%`;

  const Row = ({ label, children, value }: { label: string; children: React.ReactNode; value: string }) => (
    <div className="grid grid-cols-[minmax(0,180px)_1fr_80px] items-center gap-3 text-[13px]">
      <span className="truncate" title={label}>{label}</span>
      <div className="relative h-6 bg-canvas-subtle/60">{children}</div>
      <span className="text-right font-mono tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="mt-6 flex flex-col gap-2">
      <Row label="Your average month" value={`${base} kg`}>
        <div className="absolute inset-y-0 left-0 bg-ink/70" style={{ width: x(base) }} />
      </Row>
      {bars.map((b) => (
        <Row key={b.source} label={b.source} value={`${b.kg > 0 ? "+" : ""}${b.kg} kg`}>
          <div
            className="absolute inset-y-1 transition-all duration-500"
            style={{ left: x(Math.min(b.from, b.to)), width: w(b.from, b.to), backgroundColor: b.kg > 0 ? UP : DOWN }}
          />
        </Row>
      ))}
      <Row label={month.label} value={`${month.totalKg} kg`}>
        <div className="absolute inset-y-0 left-0 bg-secondary" style={{ width: x(month.totalKg) }} />
      </Row>
    </div>
  );
}

function YearGrid({ d, focus, onPick }: { d: Insights; focus: string; onPick: (m: string) => void }) {
  const max = Math.max(1, ...d.heat.flatMap((h) => h.values));
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-[11px]">
        <thead>
          <tr>
            <th />
            {d.months.map((m) => (
              <th key={m.month} className={`pb-1 font-mono font-normal ${m.month === focus ? "text-ink" : "text-ink-muted"}`}>
                <button onClick={() => onPick(m.month)}>{m.label.slice(0, 3)}</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.heat.map((h) => (
            <tr key={h.source}>
              <td className="whitespace-nowrap pr-2 text-ink-muted">{h.source}</td>
              {h.values.map((v, i) => (
                <td
                  key={i}
                  title={`${h.source}, ${d.months[i].label}: ${v} kg`}
                  className={`h-7 min-w-9 text-center font-mono tabular-nums ${d.months[i].month === focus ? "outline outline-1 outline-ink" : ""}`}
                  style={{ backgroundColor: `rgba(180, 83, 47, ${0.06 + (v / max) * 0.8})`, color: v / max > 0.55 ? "white" : undefined }}
                >
                  {v >= 1 ? Math.round(v) : ""}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="pr-2 font-semibold">Total</td>
            {d.months.map((m) => (
              <td key={m.month} className={`text-center font-mono font-semibold tabular-nums ${d.peak?.month === m.month ? "text-secondary" : ""}`}>
                {Math.round(m.totalKg)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-ink-muted">Darker = more kg. Click a month to see what drove it.</p>
    </div>
  );
}

function BarList({ rows, icon }: { rows: { name: string; kg: number; note: string }[]; icon: React.ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.kg));
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
          {icon}
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span>{r.name}</span>
              <span className="text-[11px] text-ink-muted">{r.note}</span>
            </div>
            <div className="mt-1 h-2 bg-canvas-subtle">
              <div className="h-full bg-secondary transition-all duration-500" style={{ width: `${(r.kg / max) * 100}%` }} />
            </div>
          </div>
          <span className="font-mono tabular-nums">{r.kg} kg</span>
        </li>
      ))}
    </ul>
  );
}
