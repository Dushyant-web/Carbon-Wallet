"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { useHouseholdOverview } from "@/hooks/useHousehold";
import { PlainSummary } from "@/components/insights/PlainSummary";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import {
  FileText,
  Printer,
  Calendar,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Zap,
  Car,
  Plane,
} from "lucide-react";
import type { MonthlyReportPayload } from "@/server/services/report.service";

export default function ReportsPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const overview = useHouseholdOverview(activeHouseholdId);
  // Months this home has data for (newest first); defaults to the reporting month
  const months: { month: string; label: string; totalKg: number | null }[] = [...(overview.data?.trendHistory ?? [])]
    .filter((m: { totalKg: number | null }) => m.totalKg !== null)
    .reverse();
  const [picked, setPicked] = useState<string | null>(null);
  const selectedMonth = picked ?? overview.data?.period?.month ?? null;
  const [report, setReport] = useState<MonthlyReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMonth) return;
    async function fetchReport() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/households/${activeHouseholdId}/reports/${selectedMonth}`, {
          headers: { "x-demo-role": demoRole },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setReport(data);
          setUnavailable(null);
        } else {
          setReport(null);
          setUnavailable(data.error ?? "No statement for this month.");
        }
      } catch (e) {
        console.error("Failed to load report:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchReport();
  }, [activeHouseholdId, selectedMonth, demoRole]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Controls (Hidden during print) */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-secondary" />
            <h1 className="font-heading text-2xl font-medium text-ink">
              Monthly report
            </h1>
          </div>
          <p className="text-xs text-ink-muted">
            One page for the month: how much CO₂, where it came from, and what to do next. Print it or save as PDF.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas-card px-3 py-1.5 shadow-tier-1">
            <Calendar className="h-4 w-4 text-ink-muted" />
            <select
              value={selectedMonth ?? ""}
              onChange={(e) => setPicked(e.target.value)}
              className="text-xs font-semibold text-ink bg-transparent outline-none"
            >
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            size="md"
            icon={<Printer className="h-4 w-4" />}
            onClick={handlePrint}
          >
            Print / Export PDF
          </Button>
        </div>
      </div>

      {isLoading && !unavailable ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : !report ? (
        <ErrorState
          title="No statement for this month"
          message={unavailable ?? "Add a bill or log activity for this month first."}
        />
      ) : (
        /* Printable Audit Report Document */
        <div className="rounded-xl border border-border bg-canvas-card p-6 md:p-10 shadow-tier-2 print:border-none print:shadow-none print:p-0">
          {selectedMonth && <PlainSummary month={selectedMonth} className="mb-8 print:break-inside-avoid" />}

          {/* Header Banner */}
          <div className="border-b-2 border-primary pb-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-tertiary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <span className="font-heading text-lg font-medium tracking-tight text-primary">
                    Carbon Wallet
                  </span>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    {report.compliance.verificationStatus === "BILL_BACKED" ? "Based on your bills" : "Based on what you logged"}
                  </span>
                </div>
                <h2 className="font-heading text-2xl font-medium text-ink">
                  Monthly carbon report
                </h2>
                <p className="text-xs text-ink-muted">
                  Month: <strong>{report.monthLabel}</strong> • For{" "}
                  <strong>{report.household.name}</strong>
                </p>
              </div>

              <div className="flex flex-col md:items-end text-xs text-ink-muted">
                <span className="font-mono font-bold text-ink text-[11px]">
                  ID: {report.reportId}
                </span>
                <span>
                  {report.household.city}, {report.household.state}
                </span>
              </div>
            </div>
          </div>

          {/* Core KPI Matrix */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-lg border border-border bg-canvas-subtle p-4">
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted">
                Total CO₂
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-ink tabular-nums">
                  {report.summary.grossEmissionsKg}
                </span>
                <span className="text-xs font-semibold text-ink-muted">kg CO₂</span>
              </div>
              <span className="text-[11px] text-ink-muted">Everything recorded this month</span>
            </div>

            <div className="rounded-lg border border-border bg-emerald-50/50 p-4">
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-emerald-800">
                From electricity bills
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-emerald-700 tabular-nums">
                  {report.provenance.billSharePct}%
                </span>
                <span className="text-xs font-semibold text-emerald-700">of the total</span>
              </div>
              <span className="text-[11px] text-emerald-700">
                {report.provenance.nBills > 0
                  ? `${report.provenance.billKg} kg from ${report.provenance.nBills} bill${report.provenance.nBills > 1 ? "s" : ""} · ${report.provenance.nLogs} logs`
                  : `No bills this month · ${report.provenance.nLogs} logs`}
              </span>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-primary">
                Total
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {report.summary.netEmissionsKg}
                </span>
                <span className="text-xs font-semibold text-primary">kg CO₂</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                {report.summary.momTrendPct === null ? (
                  <span className="text-ink-muted">No earlier month to compare</span>
                ) : parseFloat(report.summary.momTrendPct) < 0 ? (
                  <>
                    <TrendingDown className="h-3 w-3" />
                    <span>{report.summary.momTrendPct} vs last month</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-3 w-3" />
                    <span>+{report.summary.momTrendPct} vs last month</span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-canvas-subtle p-4">
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted">
                Carbon index
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-ink tabular-nums">
                  {report.summary.carbonScore}
                </span>
                <span className="text-xs font-semibold text-ink-muted">/ 100</span>
              </div>
              <span className="text-[11px] text-ink-muted">
                {report.summary.perCapitaKg} kg / person ({report.household.size} members)
              </span>
            </div>
          </div>

          {/* Section 1: where it came from (GHG Protocol scopes 1-3 under the hood) */}
          <div className="mb-8">
            <h3 className="font-heading text-sm font-medium text-ink mb-3 uppercase tracking-wider text-primary">
              1. Where it came from
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas-subtle text-[11px] font-bold uppercase text-ink-muted border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Emissions (kg CO₂)</th>
                    <th className="py-2.5 px-4">Share</th>
                    <th className="py-2.5 px-4">From</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-ink">
                  <tr>
                    <td className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Car className="h-4 w-4 text-secondary" />
                        <span>Fuel you burn</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold tabular-nums">
                      {report.scopes.scope1.totalKg} kg
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {report.scopes.scope1.percentage}%
                    </td>
                    <td className="py-3 px-4 text-ink-muted">
                      {report.scopes.scope1.sources.join(", ") || "None"}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-secondary" />
                        <span>Electricity</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold tabular-nums">
                      {report.scopes.scope2.totalKg} kg
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {report.scopes.scope2.percentage}%
                    </td>
                    <td className="py-3 px-4 text-ink-muted">
                      {report.scopes.scope2.sources.slice(0, 3).join(", ")}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Plane className="h-4 w-4 text-secondary" />
                        <span>Everything else</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold tabular-nums">
                      {report.scopes.scope3.totalKg} kg
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {report.scopes.scope3.percentage}%
                    </td>
                    <td className="py-3 px-4 text-ink-muted">
                      {report.scopes.scope3.sources.join(", ")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Category Breakdown & Top Contributors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="font-heading text-sm font-medium text-ink mb-3 uppercase tracking-wider text-primary">
                2. By category
              </h3>
              <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
                {report.categories.map((c) => (
                  <div key={c.category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">{c.category}</span>
                      <span className="font-bold text-primary tabular-nums">
                        {c.kgCo2e} kg ({c.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, c.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-heading text-sm font-medium text-ink mb-3 uppercase tracking-wider text-primary">
                3. Biggest sources
              </h3>
              <div className="rounded-lg border border-border divide-y divide-slate-100">
                {report.topContributors.map((c, i) => (
                  <div key={i} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-ink block">{c.name}</span>
                      <span className="text-[10px] text-ink-muted">{c.category} domain</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-primary tabular-nums block">
                        {c.kgCo2e} kg CO₂
                      </span>
                      <span className="text-[10px] text-ink-muted tabular-nums">
                        {c.percentage}% of the total
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Registered Household Infrastructure */}
          <div className="mb-8">
            <h3 className="font-heading text-sm font-medium text-ink mb-3 uppercase tracking-wider text-primary">
              4. Asset inventory
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4">
                <span className="text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted mb-2 block">
                  Appliances & Thermal Equipment ({report.assets.appliances.length})
                </span>
                <div className="divide-y divide-slate-100 text-xs">
                  {report.assets.appliances.map((a, i) => (
                    <div key={i} className="py-1.5 flex items-center justify-between">
                      <span className="text-ink">{a.name} ({a.type})</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                        {a.rating} • {a.powerKw} kW
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <span className="text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted mb-2 block">
                  Vehicles & Fleet Mobility ({report.assets.vehicles.length})
                </span>
                <div className="divide-y divide-slate-100 text-xs">
                  {report.assets.vehicles.map((v, i) => (
                    <div key={i} className="py-1.5 flex items-center justify-between">
                      <span className="text-ink">{v.name} ({v.type})</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                        {v.fuel} • {v.monthlyKm} km/mo
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: what the household committed to, and what the bills showed */}
          {report.recommendations.some((r) => r.status !== "PENDING") && (
            <div className="mb-8">
              <h3 className="font-heading text-sm font-medium text-ink mb-3 uppercase tracking-wider text-primary">
                5. Changes you committed to
              </h3>
              <div className="rounded-lg border border-border divide-y divide-slate-100">
                {report.recommendations
                  .filter((r) => r.status !== "PENDING")
                  .map((r, i) => (
                    <div key={i} className="p-3 flex items-center justify-between gap-4 text-xs">
                      <span className="font-semibold text-ink">{r.action}</span>
                      <span className="text-right text-ink-muted">
                        {r.verification === "BILL" || r.verification === "FUEL"
                          ? (r.realizedKg ?? 0) > 0
                            ? `Verified from your ${r.verification === "BILL" ? "bill" : "fill-ups"}: −${r.realizedKg} kg a month`
                            : "No saving showed up yet"
                          : r.verification === "DECLARED"
                            ? `Counts at half: −${r.realizedKg} kg (no bill yet)`
                            : `Expected −${r.kgSaved} kg a month, checked against the next bill`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Section 4: Attestation & Audit Signature */}
          <div className="border-t-2 border-border pt-6 mt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-ink-muted">
              <div>
                <p className="font-semibold text-ink">How this was calculated</p>
                <p className="text-[11px] leading-relaxed max-w-xl">
                  Worked out from your electricity bills, fuel fill-ups and logged activities, using published Indian figures.
                  Lock this month on the Proof check page so it can&apos;t be changed later.{" "}
                  <a href="/how-we-calculate" className="underline print:no-underline">How we calculate</a>
                </p>
              </div>

              <div className="flex flex-col md:items-end text-[11px]">
                <div className="flex items-center gap-1.5 text-primary font-bold">
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                  <span>Issued by Carbon Wallet</span>
                </div>
                <span>Generated: {new Date(report.generatedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
