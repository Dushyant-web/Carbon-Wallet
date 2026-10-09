"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { BarChart3, Info, ShieldCheck, Filter, ArrowUpRight, ArrowDownRight, Users } from "lucide-react";
import type { BenchmarkResult } from "@/server/services/benchmark.service";

export default function ComparePage() {
  const { activeHouseholdId, setActiveHouseholdId, demoRole } = useAppStore();
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("all");
  const [sizeBandFilter, setSizeBandFilter] = useState("all");
  const [homeTypeFilter, setHomeTypeFilter] = useState("all");
  const [showHowModal, setShowHowModal] = useState(false);

  useEffect(() => {
    async function fetchBenchmark() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          householdId: activeHouseholdId,
          month: "2026-03",
        });
        if (stateFilter !== "all") params.set("state", stateFilter);
        if (sizeBandFilter !== "all") params.set("sizeBand", sizeBandFilter);
        if (homeTypeFilter !== "all") params.set("homeType", homeTypeFilter);

        const res = await fetch(`/api/benchmark?${params.toString()}`, {
          headers: { "x-demo-role": demoRole },
        });
        if (res.ok) {
          const data = await res.json();
          setBenchmark(data);
        }
      } catch (e) {
        console.error("Failed to load benchmark:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBenchmark();
  }, [activeHouseholdId, stateFilter, sizeBandFilter, homeTypeFilter, demoRole]);

  if (isLoading || !benchmark) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Visual marker position: min 132kg (Patel) to max 398kg (Kapoor)
  const markerPct = Math.max(
    5,
    Math.min(95, Math.round(((benchmark.householdEmissions - 132) / (398 - 132)) * 100))
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-secondary" />
            <h1 className="font-heading text-2xl font-bold text-ink">
              Multi-Household Cohort Benchmarking
            </h1>
          </div>
          <p className="text-xs text-ink-muted">
            Normalized peer cohort distribution comparing {benchmark.householdName} against matched demography
          </p>
        </div>

        <button
          onClick={() => setShowHowModal(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <Info className="h-4 w-4" />
          <span>How is this calculated?</span>
        </button>
      </div>

      {/* Cohort Filters Rail */}
      <Card className="p-4 bg-canvas-subtle border-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <Filter className="h-3.5 w-3.5 text-ink-muted" />
              <span>Cohort Filters:</span>
            </div>

            {/* State filter */}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="rounded-lg border border-border bg-white px-2.5 py-1 text-xs text-ink outline-none"
            >
              <option value="all">All States & Territories</option>
              <option value="Uttar Pradesh">Uttar Pradesh (NCR)</option>
              <option value="Delhi">Delhi (NCT)</option>
              <option value="Maharashtra">Maharashtra (Mumbai/Pune)</option>
              <option value="Karnataka">Karnataka (Bengaluru)</option>
              <option value="Rajasthan">Rajasthan (Jaipur)</option>
              <option value="Haryana">Haryana (Gurugram)</option>
              <option value="Tamil Nadu">Tamil Nadu (Chennai)</option>
              <option value="West Bengal">West Bengal (Kolkata)</option>
            </select>

            {/* Size Band filter */}
            <select
              value={sizeBandFilter}
              onChange={(e) => setSizeBandFilter(e.target.value)}
              className="rounded-lg border border-border bg-white px-2.5 py-1 text-xs text-ink outline-none"
            >
              <option value="all">All Family Sizes</option>
              <option value="small">Small Family (1-3 persons)</option>
              <option value="medium">Medium Family (4-5 persons)</option>
              <option value="large">Large Family (6+ persons)</option>
            </select>

            {/* Home type filter */}
            <select
              value={homeTypeFilter}
              onChange={(e) => setHomeTypeFilter(e.target.value)}
              className="rounded-lg border border-border bg-white px-2.5 py-1 text-xs text-ink outline-none"
            >
              <option value="all">All Dwelling Types</option>
              <option value="Apartment">Apartment</option>
              <option value="Independent House">Independent House</option>
              <option value="Villa">Villa</option>
            </select>
          </div>

          <div className="text-xs text-ink-muted font-medium">
            Active Cohort Pool: <strong className="text-ink">{benchmark.cohortCount} households</strong>
          </div>
        </div>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex flex-col justify-between p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            Per-Capita Monthly Load
          </span>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-ink font-heading tabular-nums">
              {benchmark.perCapitaEmissions}
            </span>
            <span className="text-xs font-semibold text-ink-muted">kg / person</span>
          </div>
          <span className="text-[11px] text-ink-muted">
            Cohort Median: {benchmark.cohortMedianPerCapita} kg
          </span>
        </Card>

        <Card className="flex flex-col justify-between p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            Total Monthly Carbon
          </span>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-primary font-heading tabular-nums">
              {benchmark.householdEmissions}
            </span>
            <span className="text-xs font-semibold text-ink-muted">kg CO₂e</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold">
            {benchmark.differenceFromMedianPct <= 0 ? (
              <span className="text-emerald-700 flex items-center gap-0.5">
                <ArrowDownRight className="h-3.5 w-3.5" />
                {Math.abs(benchmark.differenceFromMedianPct)}% lower than median
              </span>
            ) : (
              <span className="text-rose-600 flex items-center gap-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" />
                +{benchmark.differenceFromMedianPct}% above median
              </span>
            )}
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            Cohort Percentile Rank
          </span>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-secondary font-heading tabular-nums">
              {benchmark.percentile}th
            </span>
            <span className="text-xs font-semibold text-ink-muted">Percentile</span>
          </div>
          <span className="text-[11px] text-ink-muted">
            Higher indicates cleaner than peers
          </span>
        </Card>

        <Card className="flex flex-col justify-between p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            Cohort Benchmark Leader
          </span>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-800 font-heading tabular-nums">
              {benchmark.leader.emissions}
            </span>
            <span className="text-xs font-semibold text-ink-muted">kg CO₂e</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold truncate">
            {benchmark.leader.name} ({benchmark.leader.perCapita} kg/capita)
          </span>
        </Card>
      </div>

      {/* Distribution Range Bar */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading text-base font-bold text-ink">
              Portfolio Distribution Spectrum
            </h3>
            <p className="text-xs text-ink-muted">
              Current household placement across observed peer footprint spectrum (132 kg to 398 kg)
            </p>
          </div>
        </div>

        {/* Visual Gradient Gauge */}
        <div className="relative w-full py-8">
          <div className="h-4 rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-500 w-full" />

          {/* Marker Pin */}
          <div
            className="absolute top-1 flex flex-col items-center transition-all duration-500"
            style={{ left: `${markerPct}%` }}
          >
            <div className="rounded bg-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-tier-2 whitespace-nowrap tabular-nums">
              {benchmark.householdName}: {benchmark.householdEmissions} kg
            </div>
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-primary" />
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-ink-muted border-t border-border pt-3">
          <span>{benchmark.leader.name} ({benchmark.leader.emissions} kg - Cleanest)</span>
          <span>Median Cohort ({benchmark.cohortMedianTotal} kg)</span>
          <span>{benchmark.highest.name} ({benchmark.highest.emissions} kg - Highest)</span>
        </div>
      </Card>

      {/* Cohort Comparison Table */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-border bg-canvas-subtle p-4 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-sm font-bold text-ink flex items-center gap-2">
              <Users className="h-4 w-4 text-secondary" />
              Cohort Peer Directory ({benchmark.cohortList?.length || 0} Matched Households)
            </h3>
            <p className="text-xs text-ink-muted">
              Ranked ascending by total monthly greenhouse emissions
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-canvas-subtle text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Household Name</th>
                <th className="py-3 px-4">Territory</th>
                <th className="py-3 px-4">Size & Dwelling</th>
                <th className="py-3 px-4">Monthly Footprint</th>
                <th className="py-3 px-4">Per-Capita</th>
                <th className="py-3 px-4">Delta vs Median</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-ink">
              {benchmark.cohortList?.map((peer, idx) => {
                const deltaFromMedian = benchmark.cohortMedianTotal > 0
                  ? Number((((peer.emissions - benchmark.cohortMedianTotal) / benchmark.cohortMedianTotal) * 100).toFixed(1))
                  : 0;

                return (
                  <tr
                    key={peer.id}
                    className={`transition-colors hover:bg-slate-50 ${
                      peer.isCurrent ? "bg-emerald-50/60 font-semibold" : ""
                    }`}
                  >
                    <td className="py-3 px-4 tabular-nums text-ink-muted">#{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            idx === 0
                              ? "bg-secondary"
                              : peer.isCurrent
                              ? "bg-primary ring-2 ring-primary/30"
                              : "bg-slate-300"
                          }`}
                        />
                        <span>{peer.name}</span>
                        {peer.isCurrent && (
                          <span className="rounded bg-primary px-1.5 py-0.2 text-[9px] font-bold text-white">
                            Current
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-ink-muted">{peer.city || peer.state}</td>
                    <td className="py-3 px-4 text-ink-muted">
                      {peer.size} members • {peer.homeType}
                    </td>
                    <td className="py-3 px-4 font-bold text-primary tabular-nums">
                      {peer.emissions} kg CO₂e
                    </td>
                    <td className="py-3 px-4 text-ink-muted tabular-nums">
                      {peer.perCapita} kg / person
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {deltaFromMedian <= 0 ? (
                        <span className="text-emerald-700">{deltaFromMedian}%</span>
                      ) : (
                        <span className="text-rose-600">+{deltaFromMedian}%</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant={peer.isCurrent ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setActiveHouseholdId(peer.id)}
                      >
                        {peer.isCurrent ? "Selected" : "Switch"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* How is this calculated Modal */}
      {showHowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-tier-3">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-secondary" />
                <h3 className="font-heading text-base font-bold text-ink">
                  Benchmarking Methodology
                </h3>
              </div>
              <button
                onClick={() => setShowHowModal(false)}
                className="text-ink-muted hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-ink-muted leading-relaxed flex flex-col gap-3">
              <p>
                CarbonOS normalizes raw household emissions across three primary dimensions:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-ink">
                <li><strong>Per-Capita:</strong> Total emissions divided by verified household size.</li>
                <li><strong>Spatial Density:</strong> Total emissions divided by registered floor area in m².</li>
                <li><strong>Regional Grid Baseline:</strong> Evaluated against CEA state grid carbon factors.</li>
              </ul>
              <div className="rounded-lg bg-canvas-subtle p-3 border border-border">
                <p className="font-semibold text-ink mb-1">Active Query Parameters:</p>
                <p>• State Filter: <strong>{benchmark.filtersApplied.state}</strong></p>
                <p>• Size Band: <strong>{benchmark.filtersApplied.sizeBand}</strong></p>
                <p>• Total Households Compared: <strong>{benchmark.filtersApplied.totalConsidered} cohorts</strong></p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowHowModal(false)}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
