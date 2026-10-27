"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Car, Sun, Thermometer } from "lucide-react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { useQueryClient } from "@tanstack/react-query";
import { PageIntro } from "@/components/ui/PageIntro";
import { Skeleton } from "@/components/ui/Skeleton";

type Sim = { acKg: number; evKg: number; solarKg: number; acKw: number; acKwSource: "bills" | "appliance" | "none"; carMonthlyKm: number };

export default function WhatIfPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const { data, isLoading } = useHouseholdOverview(activeHouseholdId);
  const [acHours, setAcHours] = useState(1);
  const [ev, setEv] = useState(false);
  const [solar, setSolar] = useState(0);
  const [sim, setSim] = useState<Sim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goalMsg, setGoalMsg] = useState<string | null>(null);
  const { can } = usePermissions();
  const qc = useQueryClient();

  async function makeGoal(targetPct: number) {
    setGoalMsg(null);
    const res = await fetch(`/api/households/${activeHouseholdId}/goals`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-role": demoRole },
      body: JSON.stringify({ targetPct, glideMonths: 6 }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["household", activeHouseholdId, "goal"] });
      setGoalMsg("done");
    } else setGoalMsg(body.error ?? "Couldn't set the goal");
  }

  // Every number comes from the server: this home's measured AC, its own car, the CEA grid factor
  useEffect(() => {
    if (!activeHouseholdId) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/forecast`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-demo-role": demoRole },
        body: JSON.stringify({ acReductionHours: acHours, swapCarEv: ev, solarPanelsKw: solar }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setSim(body.simulation);
        setError(null);
      } else setError(body.error ?? "Couldn't run the simulation");
    }, 150);
    return () => clearTimeout(t);
  }, [activeHouseholdId, demoRole, acHours, ev, solar]);

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const { kpi, period, vehicles } = data;
  const fuelCar = (vehicles as { name: string; fuel: string; monthlyKm: number }[]).find((v) => v.fuel !== "Electric");
  const saved = sim ? sim.acKg + sim.evKg + sim.solarKg : 0;
  const base = kpi.totalEmissions as number;
  const after = Math.max(0, base - saved);
  const pct = base > 0 ? Math.round((saved / base) * 100) : 0;

  const levers = [
    { key: "ac", label: "Run the AC less", kg: sim?.acKg ?? 0, icon: Thermometer },
    { key: "ev", label: "Switch the car to electric", kg: sim?.evKg ?? 0, icon: Car },
    { key: "solar", label: "Rooftop solar", kg: sim?.solarKg ?? 0, icon: Sun },
  ];
  const maxLever = Math.max(1, ...levers.map((l) => l.kg));

  return (
    <div className="flex flex-col gap-10">
      <PageIntro
        section="Understand"
        title="What if"
        what={`Try a change and see what it would do to your CO₂, before spending a rupee. It starts from your ${period?.label ?? "latest"} total.`}
        doThis="Move the sliders. Nothing is saved; this is a sandbox."
        get="How many kg a month each change saves, worked out from your own AC, car and electricity."
      />
      {error && <p className="text-[13px] text-critical-text">{error}</p>}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Levers */}
        <div className="flex flex-col gap-8">
          <div className="border-t border-ink pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 font-medium">
                <Thermometer className="h-4 w-4 text-secondary" /> Run the AC fewer hours a day
              </span>
              <span className="font-mono text-sm tabular-nums">−{acHours} h</span>
            </div>
            <input type="range" min={0} max={6} step={0.5} value={acHours} onChange={(e) => setAcHours(Number(e.target.value))} className="mt-3 w-full accent-[#B4532F]" />
            <p className="mt-1 text-[12px] text-ink-muted">
              {sim?.acKwSource === "bills"
                ? `Based on your AC's real power (${sim.acKw} kW), measured from your bills.`
                : sim?.acKwSource === "appliance"
                  ? `Based on the power on your AC's label (${sim.acKw} kW). Add bills to use its real power.`
                  : "No AC on record. Add one in Appliances & vehicles."}
            </p>
          </div>

          <div className="border-t border-ink pt-4">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-medium">
                <Car className="h-4 w-4 text-secondary" /> Switch {fuelCar ? `the ${fuelCar.name}` : "your car"} to electric
              </span>
              <input type="checkbox" checked={ev} disabled={!fuelCar} onChange={(e) => setEv(e.target.checked)} className="h-5 w-5 accent-[#B4532F]" />
            </label>
            <p className="mt-1 text-[12px] text-ink-muted">
              {fuelCar
                ? `Based on your ${fuelCar.monthlyKm} km a month, compared with charging an electric car from the grid.`
                : "No petrol, diesel or CNG vehicle on record."}
            </p>
          </div>

          <div className="border-t border-ink pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 font-medium">
                <Sun className="h-4 w-4 text-secondary" /> Put solar panels on the roof
              </span>
              <span className="font-mono text-sm tabular-nums">{solar} kW</span>
            </div>
            <input type="range" min={0} max={8} step={0.5} value={solar} onChange={(e) => setSolar(Number(e.target.value))} className="mt-3 w-full accent-[#B4532F]" />
            <p className="mt-1 text-[12px] text-ink-muted">Each kW of panels makes about 4 units of electricity a day in India.</p>
          </div>
        </div>

        {/* Result */}
        <aside className="self-start bg-primary p-6 text-canvas-card lg:sticky lg:top-24">
          <span className="label-caps text-canvas-card/60">Your month would be</span>
          <p className="mt-2 font-heading text-6xl font-medium leading-none tabular-nums">
            {Math.round(after)}
            <span className="ml-2 text-lg text-canvas-card/70">kg CO₂e</span>
          </p>
          <p className="mt-2 font-mono text-xs text-canvas-card/70">
            from {Math.round(base)} kg · {saved > 0 ? `−${saved.toFixed(1)} kg (${pct}%)` : "no change yet"}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {levers.map((l) => (
              <div key={l.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-[13px]">
                <span className="text-canvas-card/80">{l.label}</span>
                <span className="font-mono tabular-nums">−{l.kg} kg</span>
                <div className="col-span-2 h-1.5 bg-canvas-card/10">
                  <div className="h-full bg-secondary transition-all duration-300" style={{ width: `${(l.kg / maxLever) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-canvas-card/15 pt-4">
            <div>
              <dt className="label-caps text-canvas-card/60">In a year</dt>
              <dd className="mt-1 font-heading text-2xl tabular-nums">{Math.round(saved * 12)} kg</dd>
            </div>
            <div>
              <dt className="label-caps text-canvas-card/60">Like planting</dt>
              {/* A mature tree absorbs roughly 21 kg CO2 a year (commonly cited estimate) */}
              <dd className="mt-1 font-heading text-2xl tabular-nums">{Math.round((saved * 12) / 21)} trees</dd>
            </div>
          </dl>
          {can("goal:manage") && pct >= 5 && (
            <div className="mt-5 border-t border-canvas-card/15 pt-4">
              <button
                onClick={() => makeGoal(Math.min(30, pct))}
                className="h-9 w-full rounded-md bg-canvas-card px-3 text-sm font-medium text-ink hover:bg-canvas"
              >
                Make a {Math.min(30, pct)}% cut my goal
              </button>
              {goalMsg === "done" ? (
                <p className="mt-2 text-[12px] text-canvas-card/80">
                  Goal set. Track it on <Link href="/dashboard" className="underline">Home</Link>.
                </p>
              ) : (
                goalMsg && <p className="mt-2 text-[12px] text-canvas-card/80">{goalMsg}</p>
              )}
            </div>
          )}
          <p className="mt-4 text-[11px] leading-snug text-canvas-card/60">
            Like these changes? The <Link href="/actions" className="underline">Suggestions</Link> page lets you commit to them.
          </p>
        </aside>
      </div>
    </div>
  );
}
