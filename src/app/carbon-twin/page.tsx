"use client";

import React, { useState } from "react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Cpu,
  Sliders,
  Zap,
  Car,
  TrendingDown,
  Sun,
} from "lucide-react";

export default function CarbonTwinPage() {
  const { activeHouseholdId } = useAppStore();
  const { data, isLoading } = useHouseholdOverview(activeHouseholdId);

  // What-if simulator interactive sliders
  const [acReductionHours, setAcReductionHours] = useState(1.5);
  const [swapCarEv, setSwapCarEv] = useState(false);
  const [solarPanelsKw, setSolarPanelsKw] = useState(0);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const { household, kpi, appliances, vehicles } = data;

  // Simulator math:
  // AC reduction: acReductionHours * 1.5 kW * 30 days * 0.82 kg/kWh
  const acMonthlySavings = Number((acReductionHours * 1.5 * 30 * 0.82).toFixed(1));

  // Car swap to EV: petrol car 380 km * (0.165 - 0.101) = ~24.3 kg saved, or diesel car ~90 kg saved
  const primaryVehicle = vehicles[0];
  const isDiesel = primaryVehicle?.fuel === "Diesel";
  const evMonthlySavings = swapCarEv ? (isDiesel ? 85.0 : 24.5) : 0;

  // Solar addition: solarPanelsKw * 4 hrs * 30 days * 0.82 kg/kWh
  const solarSavings = Number((solarPanelsKw * 4 * 30 * 0.82).toFixed(1));

  const totalSimulatedSavings = Number(
    (acMonthlySavings + evMonthlySavings + solarSavings).toFixed(1)
  );

  const simulatedMonthlyEmissions = Math.max(
    40,
    Number((kpi.totalEmissions - totalSimulatedSavings).toFixed(1))
  );

  const simulatedPctReduction = Number(
    ((totalSimulatedSavings / kpi.totalEmissions) * 100).toFixed(1)
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Cpu className="h-6 w-6 text-secondary" />
          <h1 className="font-heading text-2xl font-bold text-ink">
            Digital Carbon Twin Replica
          </h1>
        </div>
        <p className="text-xs text-ink-muted">
          Thermodynamic asset model and interactive parametric simulation engine for {household.name}
        </p>
      </div>

      {/* Hero What-If Simulator Box */}
      <Card className="bg-gradient-to-r from-emerald-950 via-primary to-emerald-900 text-white p-6 shadow-tier-3 border-none">
        <div className="flex items-center justify-between border-b border-emerald-800 pb-3 mb-6">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-tertiary" />
            <span className="font-heading text-base font-bold text-white">
              Interactive What-If Scenario Simulator
            </span>
          </div>
          <span className="rounded-full bg-secondary-fixed/20 px-3 py-1 text-xs font-bold text-secondary-fixed">
            Live Parametric Feed
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sliders (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Slider 1: AC Cooling modulation */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-100">
                  <Zap className="h-4 w-4 text-tertiary" />
                  Reduce AC cooling runtime:
                </span>
                <span className="font-bold text-secondary-fixed tabular-nums">
                  -{acReductionHours} hours / day (-{acMonthlySavings} kg/mo)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="0.5"
                value={acReductionHours}
                onChange={(e) => setAcReductionHours(parseFloat(e.target.value))}
                className="w-full accent-secondary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-emerald-300">
                <span>0 h (No change)</span>
                <span>3 h/day</span>
                <span>6 h/day (Max efficiency)</span>
              </div>
            </div>

            {/* Slider 2: Fleet Electrification */}
            <div className="flex items-center justify-between rounded-lg border border-emerald-800 bg-emerald-900/60 p-3.5">
              <div className="flex items-center gap-2.5">
                <Car className="h-5 w-5 text-tertiary" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">
                    Electrify Primary Vehicle ({primaryVehicle?.name || "Sedan"})
                  </span>
                  <span className="text-[11px] text-emerald-200">
                    Swap combustion fuel commute for 100% Electric Vehicle
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={swapCarEv}
                  onChange={(e) => setSwapCarEv(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-emerald-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
              </label>
            </div>

            {/* Slider 3: Rooftop Solar Addition */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-100">
                  <Sun className="h-4 w-4 text-tertiary" />
                  Install Rooftop Solar PV Capacity:
                </span>
                <span className="font-bold text-secondary-fixed tabular-nums">
                  {solarPanelsKw} kW On-Grid (-{solarSavings} kg/mo)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={solarPanelsKw}
                onChange={(e) => setSolarPanelsKw(parseFloat(e.target.value))}
                className="w-full accent-secondary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-emerald-300">
                <span>0 kW</span>
                <span>3 kW Residential</span>
                <span>8 kW Net Export</span>
              </div>
            </div>
          </div>

          {/* Real-time Outcome Card (5 cols) */}
          <div className="lg:col-span-5 rounded-xl bg-white/10 backdrop-blur-md p-5 border border-emerald-700/50 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
                Projected Impact On Run-Rate
              </span>
              <div className="my-3 flex items-baseline gap-2">
                <span className="text-4xl font-bold font-heading text-secondary-fixed tabular-nums">
                  {simulatedMonthlyEmissions}
                </span>
                <span className="text-sm font-semibold text-emerald-200">
                  kg CO₂e / mo
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <TrendingDown className="h-4 w-4 text-tertiary" />
                <span>
                  ↓ {totalSimulatedSavings} kg / mo reduction ({simulatedPctReduction}%)
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-800 flex items-center justify-between text-xs text-emerald-200">
              <span>Annual CO₂e Avoided:</span>
              <strong className="text-white tabular-nums">
                {Math.round(totalSimulatedSavings * 12)} kg / yr
              </strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Connected Twin Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appliances */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="font-heading text-sm font-bold text-ink">
                Connected Appliance Twin Assets
              </h3>
              <span className="text-xs text-ink-muted">
                {appliances.length} Registered Nodes
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {appliances.map((app: { id: string; name: string; rating: string; powerKw: number }) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-canvas-subtle p-3 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-secondary" />
                    <span className="font-semibold text-ink">{app.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold text-primary border border-border">
                      {app.rating}
                    </span>
                    <span className="text-ink-muted tabular-nums">
                      {app.powerKw} kW draw
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Vehicles */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="font-heading text-sm font-bold text-ink">
                Mobility & Vehicle Fleet Assets
              </h3>
              <span className="text-xs text-ink-muted">
                {vehicles.length} Vehicles
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {vehicles.map((v: { id: string; name: string; fuel: string; monthlyKm: number }) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-canvas-subtle p-3 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-secondary" />
                    <span className="font-semibold text-ink">{v.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold text-primary border border-border">
                      {v.fuel}
                    </span>
                    <span className="text-ink-muted tabular-nums">
                      {v.monthlyKm} km / mo
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
