"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useAppStore } from "@/store";
import { useCreateActivity } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { toActivity, type RefrigerantId } from "@/lib/quickLog";
import { SectionHeading } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EngineOffline } from "@/components/states/EngineOffline";
import { HowCalculated } from "@/components/ui/HowCalculated";
import { engine, type SimulationResult } from "@/lib/engine";
import type { AcInsights } from "@/server/services/acInsights.service";

const LABEL_KW_3STAR = 0.69; // 1,100 kWh/yr ÷ 1,600 h (BEE label convention)

const inputCls =
  "h-9 w-full rounded-sm border border-border bg-canvas-card px-2 font-mono text-sm tabular-nums text-ink focus:border-ink focus:outline-none";

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

const METHOD: Record<string, string> = {
  regression: "measured from your bills",
  single_bill: "estimated from one bill; add more bills for a precise figure",
  default: "not measured yet",
};

export default function AcPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { data, isLoading, error } = useQuery<AcInsights>({
    queryKey: ["household", activeHouseholdId, "insights-ac", demoRole],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/insights/ac`, { headers: { "x-demo-role": demoRole } });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't load AC insights");
      return body;
    },
    enabled: !!activeHouseholdId,
  });

  const cal = data?.calibration ?? null;
  const measured = !!cal && cal.method !== "default";
  const lastAc = data ? [...data.bills].reverse().find((b) => b.acHoursPerDay > 0) ?? null : null;
  const tariff = data?.tariff?.inrPerKwh ?? null;

  const [sim, setSim] = useState({ hoursCut: 1, setpointTo: 25 });
  const [simOut, setSimOut] = useState<SimulationResult | null>(null);
  useEffect(() => {
    if (!measured || !lastAc) return;
    const t = setTimeout(() => {
      engine
        .simulate({
          ac_kw: cal!.ac_kw,
          ac_hours_per_day: lastAc.acHoursPerDay,
          days: lastAc.days,
          setpoint_from_c: 22,
          setpoint_to_c: sim.setpointTo,
          hours_reduction_per_day: Math.min(sim.hoursCut, lastAc.acHoursPerDay),
          car_km_per_trip_day: 0,
          metro_days_per_week: 0,
          ...(tariff ? { tariff_inr_per_kwh: tariff } : {}),
        })
        .then(setSimOut)
        .catch(() => setSimOut(null));
    }, 200);
    return () => clearTimeout(t);
  }, [measured, cal, lastAc, sim, tariff]);

  const [refr, setRefr] = useState({ type: "R32", kg: 1 });
  const [refrKg, setRefrKg] = useState<number | null>(null);
  const [refrSaved, setRefrSaved] = useState<string | null>(null);
  const createActivity = useCreateActivity(activeHouseholdId);
  const { can } = usePermissions();
  async function addRefill() {
    const payload = toActivity({ kind: "ac_gas", gas: refr.type as RefrigerantId, kg: refr.kg });
    if (!payload) return;
    setRefrSaved(null);
    try {
      await createActivity.mutateAsync({ ...payload, occurredOn: new Date(), source: "MANUAL" });
      setRefrSaved("Added to this month's record.");
    } catch (e) {
      setRefrSaved(e instanceof Error ? e.message : "Couldn't add it. Try again.");
    }
  }
  useEffect(() => {
    engine
      .refrigerant(refr.type, refr.kg)
      .then((r) => setRefrKg(r.kg_co2e))
      .catch(() => setRefrKg(null));
  }, [refr]);

  const heat = data?.heat ?? null;
  const effects = heat
    ? [
        { name: "Hotter or cooler weather", kg: heat.result.effects_kg.weather, colour: "#B7862B" },
        { name: "More or less AC use (habit)", kg: heat.result.effects_kg.behaviour, colour: "#B4532F" },
      ]
    : [];
  const maxEffect = Math.max(1, ...effects.map((e) => Math.abs(e.kg)));
  const maxKwhDay = Math.max(1, ...(data?.bills ?? []).map((b) => b.kwhPerDay));
  const maxCddDay = Math.max(1, ...(data?.bills ?? []).map((b) => (b.cdd ?? 0) / Math.max(1, b.days)));

  return (
    <div className="flex flex-col gap-12">
      <header>
        <span className="label-caps">AC & heat · from your bills</span>
        <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight md:text-5xl">What your AC really draws</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Star labels assume 1,600 hours a year at test conditions; real Indian ACs draw far more. We measure yours from your own
          bills, then use the actual weather in your city for each bill period to separate the heat from your habits.
        </p>
      </header>

      {isLoading && <Skeleton className="h-72 w-full" />}
      {error && <p className="text-[13px] text-critical-text">{(error as Error).message}</p>}
      {data?.engineOffline && <EngineOffline />}

      {data && data.bills.length === 0 && (
        <div className="border border-dashed border-border bg-canvas-subtle/60 px-8 py-14 text-center">
          <p className="font-heading text-2xl font-medium">Add bills to measure your AC</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            One bill from a month when the AC ran and one when it didn&apos;t is enough. Tell us roughly how many hours a day it ran
            when you add each bill.
          </p>
          <Link href="/bills/new" className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" /> Add a bill
          </Link>
        </div>
      )}

      {data && data.bills.length > 0 && (
        <>
          {/* 01 Bills against the weather */}
          <section>
            <SectionHeading
              index="01"
              title="Your bills against the weather"
              meta={data.weather ? `${data.weather.location.name}${data.weather.location.admin1 ? `, ${data.weather.location.admin1}` : ""}` : undefined}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-caps pb-2 font-medium">Period</th>
                    <th className="label-caps pb-2 text-right font-medium">kWh</th>
                    <th className="label-caps pb-2 pl-6 font-medium">kWh a day</th>
                    <th className="label-caps pb-2 pl-6 font-medium">How hot it was</th>
                    <th className="label-caps pb-2 text-right font-medium">Mean °C</th>
                    <th className="label-caps pb-2 text-right font-medium">AC h/day</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bills.map((b) => (
                    <tr key={b.id} className="border-b border-border/70">
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {fmt(b.periodStart)} – {fmt(b.periodEnd)} <span className="font-mono text-[11px] text-ink-muted">{b.days}d</span>
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums">{b.kwh}</td>
                      <td className="py-2.5 pl-6">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-28 bg-canvas-subtle">
                            <div className="h-full bg-viz-electricity" style={{ width: `${(b.kwhPerDay / maxKwhDay) * 100}%` }} />
                          </div>
                          <span className="font-mono text-xs tabular-nums">{b.kwhPerDay}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pl-6">
                        {b.cdd != null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-28 bg-canvas-subtle">
                              <div className="h-full bg-warning" style={{ width: `${(b.cdd / b.days / maxCddDay) * 100}%` }} />
                            </div>
                            <span className="font-mono text-xs tabular-nums">{(b.cdd / b.days).toFixed(1)}°</span>
                          </div>
                        ) : (
                          <span className="text-ink-light">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums">{b.meanTempC ?? "—"}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums">{b.acHoursPerDay || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <HowCalculated className="mt-3">
              “How hot it was” is how many degrees above {data.weather?.baseC ?? 24} °C each day was on average, using the real daily
              temperatures {data.weather ? `in ${data.weather.location.name}` : "in your city"} for each bill period. Higher means more
              heat for your AC to fight.
            </HowCalculated>
          </section>

          {/* 02 AC measurement */}
          {cal && (
            <section>
              <SectionHeading index="02" title="Your AC, measured" meta={`${METHOD[cal.method] ?? cal.method} · ${cal.n_bills} bills`} />
              {measured ? (
                <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
                  <KpiCard
                    label="Your AC draws"
                    value={cal.ac_kw.toFixed(2)}
                    unit="kW"
                    deltaText={`range ${cal.ac_kw_range[0].toFixed(2)}–${cal.ac_kw_range[1].toFixed(2)}`}
                    metaText={
                      cal.at_limit
                        ? `At the edge of what an AC can draw (0.3–2.5 kW). Check the AC hours a day on your bills.`
                        : `A 3★ label implies ~${LABEL_KW_3STAR} kW · yours is ${(cal.ac_kw / LABEL_KW_3STAR).toFixed(1)}×`
                    }
                  />
                  <KpiCard
                    label="AC share of latest bill"
                    value={`${Math.round(cal.latest_bill.ac_share_pct)}%`}
                    unit={`${cal.latest_bill.ac_kwh} of ${cal.latest_bill.electricity_kwh} kWh`}
                    metaText={`Everything else: ${cal.baseload_kwh_per_day} kWh a day (fridge, fans, lights)`}
                  />
                  <KpiCard
                    label="AC emissions, latest bill"
                    value={cal.latest_bill.ac_kg}
                    unit="kg CO₂e"
                    deltaText={`≈ ${cal.latest_bill.ac_kg_low}–${cal.latest_bill.ac_kg_high}`}
                    deltaVariant="warning"
                    metaText={`of ${cal.latest_bill.electricity_kg} kg from the whole bill`}
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-muted">
                  None of your bills has AC hours yet.{" "}
                  <Link href="/bills" className="underline underline-offset-2">
                    Add a bill
                  </Link>{" "}
                  and enter roughly how many hours a day the AC ran.
                </p>
              )}
              {measured && (
                <HowCalculated className="mt-4">
                  Each bill is split into what your AC used (its power × the hours it ran) and everything else, and we find the AC
                  power that best fits all your bills together. The range is wider when bills disagree; more bills make it tighter.
                </HowCalculated>
              )}
            </section>
          )}

          {/* 03 Heat vs habit */}
          <section>
            <SectionHeading index="03" title="Heat or habit?" meta="Using real weather" />
            {heat ? (
              <>
                <p className="mt-6 max-w-3xl font-heading text-2xl leading-snug">
                  AC emissions went from <span className="tabular-nums">{heat.result.before_kg}</span> to{" "}
                  <span className="tabular-nums">{heat.result.after_kg} kg</span>
                  {heat.result.total_change_kg !== 0 && (
                    <>
                      .{" "}
                      <span className="text-ink-muted">
                        The weather explains {heat.result.effects_kg.weather > 0 ? "+" : ""}
                        {heat.result.effects_kg.weather} kg
                      </span>
                      ;{" "}
                      <span className="text-secondary">
                        your AC use explains {heat.result.effects_kg.behaviour > 0 ? "+" : ""}
                        {heat.result.effects_kg.behaviour} kg.
                      </span>
                    </>
                  )}
                </p>
                <div className="mt-6 grid max-w-3xl grid-cols-2 gap-6 text-[13px]">
                  {[
                    ["Earlier bill", heat.before],
                    ["Latest bill", heat.after],
                  ].map(([label, p]) => {
                    const period = p as typeof heat.before;
                    return (
                      <div key={label as string} className="border-t border-border pt-2">
                        <span className="label-caps">{label as string}</span>
                        <p className="mt-1">
                          {fmt(period.periodStart)} – {fmt(period.periodEnd)}
                        </p>
                        <p className="font-mono text-[12px] text-ink-muted">
                          average {period.meanTempC} °C · AC {period.acHoursPerDay} h/day
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex max-w-3xl flex-col gap-3">
                  {effects.map((e) => (
                    <div key={e.name} className="grid grid-cols-[minmax(0,200px)_1fr_auto] items-center gap-3 text-sm">
                      <span className="text-ink-muted">{e.name}</span>
                      <div className="h-4 bg-canvas-subtle">
                        <div className="h-full" style={{ width: `${(Math.abs(e.kg) / maxEffect) * 100}%`, backgroundColor: e.colour }} />
                      </div>
                      <span className="whitespace-nowrap text-right font-mono tabular-nums">
                        {e.kg > 0 ? "+" : ""}
                        {e.kg} kg
                      </span>
                    </div>
                  ))}
                </div>
                <HowCalculated className="mt-4">
                  We compare how hot each period was with how many hours your AC ran. The part of the change that matches the heat
                  is the weather; the rest is how much you used the AC. The two always add up to the full change.
                </HowCalculated>
              </>
            ) : (
              <ul className="mt-4 flex flex-col gap-1 text-sm text-ink-muted">
                {data.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </section>

          {/* 04 Heatwave days: cooling then is essential, so it's set apart */}
          {data.heatwave && (
            <section>
              <SectionHeading index="04" title="Heatwave days" meta={`${data.heatwave.zone} rule · real daily highs`} />
              {data.heatwave.totalDays === 0 ? (
                <p className="mt-6 max-w-3xl text-sm text-ink-muted">No heatwave days in your bill periods so far.</p>
              ) : (
                <>
                  <p className="mt-6 max-w-3xl font-heading text-2xl leading-snug">
                    {data.heatwave.totalDays} heatwave {data.heatwave.totalDays === 1 ? "day" : "days"} in your bills.{" "}
                    <span className="text-ink-muted">
                      {data.heatwave.essentialKg} kg of AC on those days{data.heatwave.essentialInr ? ` (₹${data.heatwave.essentialInr.toLocaleString("en-IN")})` : ""} is
                      counted as essential: it never counts against your goal, and we never suggest cutting it.
                    </span>
                  </p>
                  <div className="mt-6 flex max-w-3xl flex-col gap-4">
                    {data.heatwave.bills.map((b) => (
                      <div key={b.periodStart} className="border-t border-border pt-2">
                        <p className="text-[13px]">
                          {fmt(b.periodStart)} – {fmt(b.periodEnd)}{" "}
                          <span className="font-mono text-[12px] text-ink-muted">· {b.essentialKg} kg essential cooling</span>
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {b.days.map((d) => (
                            <li key={d.date} title={d.why} className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] tabular-nums">
                              {fmt(d.date)} · {d.tmax_c} °C{d.departure_c != null ? ` (+${d.departure_c})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <HowCalculated className="mt-4">
                {data.heatwave.rule} On those days we take your AC&apos;s measured power × the AC hours a day on that bill.
                Weather: {data.heatwave.source}.
              </HowCalculated>
            </section>
          )}

          {/* 04 What-if */}
          {measured && lastAc && (
            <section>
              <SectionHeading index="05" title="What if" meta={`Your latest AC bill: ${lastAc.days} days at ${lastAc.acHoursPerDay} h/day`} />
              <div className="mt-5 grid max-w-3xl grid-cols-1 gap-5 md:grid-cols-2">
                <Slider
                  label="Run the AC fewer hours a day"
                  value={sim.hoursCut}
                  min={0}
                  max={Math.max(0.5, Math.min(4, lastAc.acHoursPerDay))}
                  step={0.5}
                  unit="h"
                  onChange={(v) => setSim((s) => ({ ...s, hoursCut: v }))}
                />
                <Slider label="Thermostat (from 22 °C)" value={sim.setpointTo} min={22} max={28} step={1} unit="°C" onChange={(v) => setSim((s) => ({ ...s, setpointTo: v }))} />
              </div>
              {simOut && (
                <dl className="mt-8 grid max-w-3xl grid-cols-3 gap-6 border-t border-ink pt-4">
                  <div>
                    <dt className="label-caps">Saves that bill</dt>
                    <dd className="mt-1 font-heading text-4xl font-medium tabular-nums">{simOut.ac_saved_kg}</dd>
                    <dd className="font-mono text-[11px] text-ink-muted">
                      kg · ≈ {simOut.ac_saved_kg_low}–{simOut.ac_saved_kg_high}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps">Money</dt>
                    <dd className="mt-1 font-heading text-4xl font-medium tabular-nums">₹{simOut.inr_saved.toLocaleString("en-IN")}</dd>
                    <dd className="font-mono text-[11px] text-ink-muted">
                      {tariff ? `at your ₹${tariff}/kWh` : "at ₹7/kWh (add bill amounts for yours)"}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps">Units</dt>
                    <dd className="mt-1 font-heading text-4xl font-medium tabular-nums">{simOut.ac_saved_kwh}</dd>
                    <dd className="font-mono text-[11px] text-ink-muted">kWh off that bill</dd>
                  </div>
                </dl>
              )}
            </section>
          )}
        </>
      )}

      {/* 05 Refrigerant: user input, independent of bills */}
      <section>
        <SectionHeading index="06" title="AC gas refills" />
        <div className="mt-5 grid grid-cols-1 items-start gap-8 md:grid-cols-[260px_1fr]">
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="label-caps">Refrigerant</span>
              <select className={inputCls} value={refr.type} onChange={(e) => setRefr((s) => ({ ...s, type: e.target.value }))}>
                <option value="R32">R-32</option>
                <option value="R410A">R-410A</option>
                <option value="R22">R-22</option>
              </select>
            </label>
            <label className="flex w-24 flex-col gap-1">
              <span className="label-caps">kg added</span>
              <input type="number" min={0} max={10} step={0.1} className={inputCls} value={refr.kg} onChange={(e) => setRefr((s) => ({ ...s, kg: Number(e.target.value) }))} />
            </label>
          </div>
          {refrKg !== null && (
            <div className="border-l-2 border-secondary bg-canvas-card px-6 py-4">
              <p className="font-heading text-3xl font-medium tabular-nums">
                {refrKg} kg CO₂e <span className="text-base text-ink-muted">from one top-up</span>
              </p>
              {can("activity:create") && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={addRefill}
                    disabled={createActivity.isPending}
                    className="h-9 rounded-md bg-ink px-4 text-sm text-canvas disabled:opacity-60"
                  >
                    {createActivity.isPending ? "Adding…" : "Add this refill to my record"}
                  </button>
                  {refrSaved && <span className="text-sm text-ink-muted">{refrSaved}</span>}
                </div>
              )}
              {measured && cal && cal.latest_bill.ac_kg > 0 && (
                <p className="mt-1 text-sm text-ink-muted">
                  That&apos;s {(refrKg / cal.latest_bill.ac_kg).toFixed(1)}× the AC electricity on your latest bill. A leak test before
                  the next refill is the cheapest fix in this app.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {value} {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#1D1C18]" />
    </label>
  );
}
