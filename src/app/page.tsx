"use client";

import React, { useState } from "react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { usePermissions } from "@/hooks/usePermissions";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { LogActivityModal } from "@/components/dashboard/LogActivityModal";
import {
  Cloud,
  Zap,
  Shield,
  Users,
  TrendingDown,
  Sparkles,
  Sun,
  Car,
  CheckCircle2,
} from "lucide-react";

export default function OverviewPage() {
  const { activeHouseholdId } = useAppStore();
  const { data, isLoading, error } = useHouseholdOverview(activeHouseholdId);
  const { can } = usePermissions();
  const [appliedAction, setAppliedAction] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <Skeleton className="xl:col-span-7 h-80 w-full" />
          <Skeleton className="xl:col-span-5 h-80 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to Load Household Overview"
        message="Could not connect to the CarbonOS telemetry pipeline for this household. Please verify network connection or select another household."
      />
    );
  }

  const { household, kpi, trendHistory, categoryBreakdown, nextBestAction, members, vehicles, solar } = data;

  const trendPoints = trendHistory || [];
  const maxVal = Math.max(...trendPoints.map((p: { totalKg: number }) => p.totalKg), 400);
  const minVal = Math.min(...trendPoints.map((p: { totalKg: number }) => p.totalKg), 100);

  // SVG Chart rendering
  const width = 600;
  const height = 180;
  const stepX = trendPoints.length > 1 ? width / (trendPoints.length - 1) : width;

  let pathD = "";
  let areaD = "";
  trendPoints.forEach((pt: { totalKg: number }, i: number) => {
    const x = i * stepX;
    const y = height - ((pt.totalKg - minVal) / (maxVal - minVal || 1)) * (height - 40) - 20;

    if (i === 0) {
      pathD += `M ${x} ${y}`;
      areaD += `M ${x} ${height} L ${x} ${y}`;
    } else {
      const prevX = (i - 1) * stepX;
      const prevY = height - ((trendPoints[i - 1].totalKg - minVal) / (maxVal - minVal || 1)) * (height - 40) - 20;
      const cX1 = prevX + stepX / 2;
      const cY1 = prevY;
      const cX2 = prevX + stepX / 2;
      const cY2 = y;
      pathD += ` C ${cX1} ${cY1}, ${cX2} ${cY2}, ${x} ${y}`;
      areaD += ` C ${cX1} ${cY1}, ${cX2} ${cY2}, ${x} ${y}`;
    }

    if (i === trendPoints.length - 1) {
      areaD += ` L ${x} ${height} Z`;
    }
  });

  const categories = Object.keys(categoryBreakdown);
  const totalCategoryEmissions = kpi.totalEmissions || 1;

  const canApplyAction = can("recommendation:apply");

  return (
    <div className="flex flex-col gap-6">
      {/* Top 5 KPI Cards Mosaic */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* KPI 1: Total Emissions */}
        <KpiCard
          label="Total Emissions"
          value={kpi.totalEmissions}
          unit="kg CO₂e"
          icon={<Cloud className="h-5 w-5" />}
          deltaText={`${kpi.trendPct > 0 ? "+" : ""}${kpi.trendPct}% vs prior month`}
          deltaVariant={kpi.trendPct <= 0 ? "positive" : "critical"}
          metaText="Current Cycle"
        />

        {/* KPI 2: Top Contributor */}
        <Card className="flex flex-col justify-between p-5">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Top Contributor
            </span>
            <Zap className="h-5 w-5 text-secondary" />
          </div>
          <div className="my-2 flex flex-col">
            <span className="text-xl font-bold text-primary font-heading truncate">
              {kpi.topContributor.category}
            </span>
            <span className="text-xs text-ink-muted tabular-nums">
              {kpi.topContributor.amountKg} kg CO₂e ({kpi.topContributor.sharePct}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, kpi.topContributor.sharePct)}%` }}
            />
          </div>
        </Card>

        {/* KPI 3: CarbonOS Index */}
        <KpiCard
          label="CarbonOS Index"
          value={kpi.score}
          unit="/ 100"
          icon={<Shield className="h-5 w-5" />}
          deltaText={kpi.scoreBand}
          deltaVariant={kpi.score >= 75 ? "positive" : kpi.score >= 60 ? "neutral" : "critical"}
          metaText="Prototype metric"
        />

        {/* KPI 4: Peer Cohort */}
        <KpiCard
          label="Peer Cohort"
          value={`${kpi.peerPercentile}th`}
          unit="Percentile"
          icon={<Users className="h-5 w-5" />}
          deltaText={kpi.totalEmissions < 250 ? "Better than cohort" : "Action required"}
          deltaVariant={kpi.totalEmissions < 250 ? "positive" : "warning"}
          metaText={`vs ${household.state} Peers`}
        />

        {/* KPI 5: Actionable Savings */}
        <KpiCard
          label="Actionable Savings"
          value={kpi.actionableSavingsKg}
          unit="kg CO₂e/mo"
          icon={<Sparkles className="h-5 w-5" />}
          deltaText={`₹${kpi.actionableSavingsInr} / mo potential`}
          deltaVariant="positive"
          metaText="Algorithmic targets"
        />
      </div>

      {/* Analytics Split: 6-Month Trajectory & Consumption Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Trajectory SVG Chart (7 cols) */}
        <Card className="xl:col-span-7 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading text-base font-bold text-ink">
                6-Month Emission Trajectory
              </h3>
              <p className="text-xs text-ink-muted">
                Calibrated monthly polyline tracking seasonal baseline
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-canvas-subtle px-2.5 py-1 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
              <span className="font-semibold text-ink">Measured CO₂e</span>
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="relative w-full h-56 flex items-end justify-between pt-4 pb-2">
            <svg
              className="w-full h-full overflow-visible"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={areaD} fill="url(#areaGrad)" />
              <path
                d={pathD}
                fill="none"
                stroke="#064E3B"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {trendPoints.map((pt: { totalKg: number }, idx: number) => {
                const x = idx * stepX;
                const y =
                  height -
                  ((pt.totalKg - minVal) / (maxVal - minVal || 1)) *
                    (height - 40) -
                  20;
                return (
                  <g key={idx}>
                    <circle
                      cx={x}
                      cy={y}
                      r={idx === trendPoints.length - 1 ? 6 : 4}
                      fill={idx === trendPoints.length - 1 ? "#064E3B" : "#FFFFFF"}
                      stroke="#064E3B"
                      strokeWidth="2.5"
                    />
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      fill="#0F172A"
                      fontSize="11"
                      fontWeight="600"
                      className="tabular-nums"
                    >
                      {pt.totalKg} kg
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between items-center text-center pt-2 text-xs text-ink-muted border-t border-border">
            {trendPoints.map((pt: { label: string; month: string }, idx: number) => (
              <span
                key={idx}
                className={
                  idx === trendPoints.length - 1 ? "font-bold text-primary" : ""
                }
              >
                {pt.label}
              </span>
            ))}
          </div>
        </Card>

        {/* Category Drill-down Breakdown (5 cols) */}
        <Card className="xl:col-span-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-heading text-base font-bold text-ink">
                Consumption by Category
              </h3>
              <p className="text-xs text-ink-muted">
                Category drill-down (AC is aggregated inside Electricity)
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-ink-muted uppercase">
              Live Pipeline
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {categories.map((cat) => {
              const val = categoryBreakdown[cat] || 0;
              const pct = Math.round((val / totalCategoryEmissions) * 100) || 0;

              return (
                <div key={cat} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink">{cat}</span>
                    <span className="text-ink-muted tabular-nums">
                      {val} kg CO₂e ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-canvas-subtle p-3 text-xs">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <span className="text-ink-muted">
                Rooftop Solar PV:{" "}
                <strong className="text-ink tabular-nums">
                  {solar.hasSolar ? `${solar.solarKwh} kWh Clean Offset` : "None Installed"}
                </strong>
              </span>
            </div>
            <span className="font-bold text-primary">
              {solar.hasSolar ? "Clean Renewable Feed" : "100% Grid Dependent"}
            </span>
          </div>
        </Card>
      </div>

      {/* Action & Members Banner */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Next Best Action Card (8 cols) */}
        <div className="xl:col-span-8 rounded-xl bg-primary p-6 text-white shadow-tier-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-secondary-fixed text-primary">
                Algorithmic Recommendation
              </span>
              <span className="text-xs text-emerald-200">
                {nextBestAction.difficulty} Difficulty • High ROI
              </span>
            </div>
            <h3 className="font-heading text-lg font-bold text-white">
              {nextBestAction.action}
            </h3>
            <p className="text-xs text-emerald-100 leading-relaxed">
              {nextBestAction.description}
            </p>
            <div className="mt-2 flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1 text-secondary-fixed">
                <TrendingDown className="h-4 w-4" />
                <span>-{nextBestAction.kgSaved} kg CO₂e / month</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-200">
                <span>₹{nextBestAction.inrSaved} monthly bill reduction</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <Button
              variant="mint"
              size="md"
              disabled={appliedAction || !canApplyAction}
              onClick={() => setAppliedAction(true)}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              {appliedAction
                ? "Applied"
                : canApplyAction
                ? "Apply Recommendation"
                : "View Only (Locked)"}
            </Button>
            <span className="text-[11px] text-emerald-200">
              {appliedAction ? "Thermostat rule enrolled" : "Live optimization trigger"}
            </span>
          </div>
        </div>

        {/* Household Profile & Garage (4 cols) */}
        <Card className="xl:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
              <h3 className="font-heading text-sm font-bold text-ink">
                Household Members
              </h3>
              <span className="text-xs text-ink-muted">
                {members.length} Active Profiles
              </span>
            </div>
            <div className="flex flex-col divide-y divide-slate-100">
              {members.map((m: { id: string; name: string; role: string }) => (
                <div key={m.id} className="py-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">{m.name}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-3 flex items-center justify-between text-xs text-ink-muted">
            <div className="flex items-center gap-1.5">
              <Car className="h-4 w-4 text-secondary" />
              <span>
                Vehicle:{" "}
                <strong className="text-ink">
                  {vehicles[0]?.name || "Public Transit"}
                </strong>
              </span>
            </div>
            <span className="text-secondary font-semibold">
              {vehicles[0]?.fuel || "Clean Commute"}
            </span>
          </div>
        </Card>
      </div>

      {/* Log Activity Modal */}
      <LogActivityModal />
    </div>
  );
}
