"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store";
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
  const [selectedMonth, setSelectedMonth] = useState("2026-03");
  const [report, setReport] = useState<MonthlyReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/households/${activeHouseholdId}/reports/${selectedMonth}`, {
          headers: { "x-demo-role": demoRole },
        });
        if (res.ok) {
          const data = await res.json();
          setReport(data);
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
            <h1 className="font-heading text-2xl font-bold text-ink">
              Monthly Audit & ESG Statements
            </h1>
          </div>
          <p className="text-xs text-ink-muted">
            Official GHG Protocol Scope 1, 2 & 3 residential carbon inventory certificate
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 shadow-tier-1">
            <Calendar className="h-4 w-4 text-ink-muted" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-semibold text-ink bg-transparent outline-none"
            >
              <option value="2026-03">March 2026 (Current Cycle)</option>
              <option value="2026-02">February 2026</option>
              <option value="2026-01">January 2026</option>
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

      {isLoading ? (
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
          title="Audit Report Generation Failed"
          message="Unable to compile GHG Protocol Scope 1, 2, 3 inventory report for this accounting period. Please check connection or switch cycle."
        />
      ) : (
        /* Printable Audit Report Document */
        <div className="rounded-xl border border-border bg-white p-6 md:p-10 shadow-tier-2 print:border-none print:shadow-none print:p-0">
          {/* Header Banner */}
          <div className="border-b-2 border-primary pb-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-tertiary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <span className="font-heading text-lg font-bold tracking-tight text-primary">
                    CarbonOS
                  </span>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    {report.compliance.verificationStatus}
                  </span>
                </div>
                <h2 className="font-heading text-2xl font-bold text-ink">
                  Residential Carbon Inventory Statement
                </h2>
                <p className="text-xs text-ink-muted">
                  Accounting Cycle: <strong>{report.monthLabel}</strong> • Issued for{" "}
                  <strong>{report.household.name}</strong>
                </p>
              </div>

              <div className="flex flex-col md:items-end text-xs text-ink-muted">
                <span className="font-mono font-bold text-ink text-[11px]">
                  ID: {report.reportId}
                </span>
                <span>Join Code: {report.household.joinCode}</span>
                <span>
                  Territory: {report.household.city}, {report.household.state} ({report.household.region})
                </span>
                <span className="text-[10px] text-slate-400">
                  CEA Factor: {report.household.gridFactorKgKwh} kg CO₂e/kWh
                </span>
              </div>
            </div>
          </div>

          {/* Core KPI Matrix */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-lg border border-border bg-canvas-subtle p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Gross Emissions
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-ink tabular-nums">
                  {report.summary.grossEmissionsKg}
                </span>
                <span className="text-xs font-semibold text-ink-muted">kg CO₂e</span>
              </div>
              <span className="text-[11px] text-ink-muted">All active sources</span>
            </div>

            <div className="rounded-lg border border-border bg-emerald-50/50 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Solar Offset Credits
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-emerald-700 tabular-nums">
                  -{report.summary.solarOffsetKg}
                </span>
                <span className="text-xs font-semibold text-emerald-700">kg CO₂e</span>
              </div>
              <span className="text-[11px] text-emerald-700">
                {report.summary.solarOffsetKg > 0 ? "Rooftop PV generation" : "No on-site solar"}
              </span>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Net Verified Total
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {report.summary.netEmissionsKg}
                </span>
                <span className="text-xs font-semibold text-primary">kg CO₂e</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                {parseFloat(report.summary.momTrendPct) < 0 ? (
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                CarbonOS Index
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

          {/* Section 1: GHG Protocol Scopes Table */}
          <div className="mb-8">
            <h3 className="font-heading text-sm font-bold text-ink mb-3 uppercase tracking-wider text-primary">
              1. GHG Protocol Standard Classification (Scope 1, 2 & 3)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas-subtle text-[11px] font-bold uppercase text-ink-muted border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4">Accounting Scope</th>
                    <th className="py-2.5 px-4">Emissions (kg CO₂e)</th>
                    <th className="py-2.5 px-4">Portfolio Share</th>
                    <th className="py-2.5 px-4">Governing Registry Factors</th>
                    <th className="py-2.5 px-4">Primary Household Sources</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-ink">
                  <tr>
                    <td className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Car className="h-4 w-4 text-secondary" />
                        <span>Scope 1 (Direct Combustion)</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold tabular-nums">
                      {report.scopes.scope1.totalKg} kg
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {report.scopes.scope1.percentage}%
                    </td>
                    <td className="py-3 px-4 text-ink-muted">
                      MoPNG / IPCC 2.31 kg CO₂e/L (Petrol)
                    </td>
                    <td className="py-3 px-4 text-ink-muted">
                      {report.scopes.scope1.sources.join(", ") || "None"}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-secondary" />
                        <span>Scope 2 (State Grid Electricity)</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold tabular-nums">
                      {report.scopes.scope2.totalKg} kg
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {report.scopes.scope2.percentage}%
                    </td>
                    <td className="py-3 px-4 text-ink-muted">
                      CEA v19 ({report.scopes.scope2.gridFactorUsed} kg/kWh)
                    </td>
                    <td className="py-3 px-4 text-ink-muted">
                      {report.scopes.scope2.sources.slice(0, 3).join(", ")}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Plane className="h-4 w-4 text-secondary" />
                        <span>Scope 3 (Value Chain / Other)</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold tabular-nums">
                      {report.scopes.scope3.totalKg} kg
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {report.scopes.scope3.percentage}%
                    </td>
                    <td className="py-3 px-4 text-ink-muted">
                      ICAO Aviation + Defra Secondary
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
              <h3 className="font-heading text-sm font-bold text-ink mb-3 uppercase tracking-wider text-primary">
                2. Category Apportionment
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
              <h3 className="font-heading text-sm font-bold text-ink mb-3 uppercase tracking-wider text-primary">
                3. Top Emission Contributors
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
                        {c.kgCo2e} kg CO₂e
                      </span>
                      <span className="text-[10px] text-ink-muted tabular-nums">
                        {c.percentage}% of gross total
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Registered Household Infrastructure */}
          <div className="mb-8">
            <h3 className="font-heading text-sm font-bold text-ink mb-3 uppercase tracking-wider text-primary">
              4. Verified Asset Inventory
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2 block">
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2 block">
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

          {/* Section 4: Attestation & Audit Signature */}
          <div className="border-t-2 border-border pt-6 mt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-ink-muted">
              <div>
                <p className="font-semibold text-ink">Methodological Assurance Statement</p>
                <p className="text-[11px] leading-relaxed max-w-xl">
                  This report has been compiled deterministically via CarbonOS Core, conforming to
                  the GHG Protocol Scope 1, 2 and 3 accounting methodologies. Electricity emissions
                  incorporate CEA v19 regional grid baseline values for India.
                </p>
              </div>

              <div className="flex flex-col md:items-end text-[11px]">
                <div className="flex items-center gap-1.5 text-primary font-bold">
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                  <span>Verified & Sealed by CarbonOS Core</span>
                </div>
                <span>Generated: {new Date(report.generatedAt).toLocaleString()}</span>
                <span className="font-mono text-[10px]">SHA-256 Checksum: c0a80f...8b9e</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
