"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { useHouseholdOverview, useHouseholds } from "@/hooks/useHousehold";
import { Welcome } from "@/components/dashboard/Welcome";
import { usePermissions } from "@/hooks/usePermissions";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionHeading } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { categoryColor } from "@/lib/viz";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import { GoalCard } from "@/components/dashboard/GoalCard";
import { CheckInPrompt } from "@/components/dashboard/CheckInPrompt";
import { HomeNudges } from "@/components/dashboard/HomeNudges";

type TrendPoint = {
  month: string;
  label: string;
  totalKg: number | null;
  partial: boolean;
  billedDays: number | null;
  daysInMonth: number | null;
  isReporting: boolean;
};

export default function OverviewPage() {
  const { activeHouseholdId, demoRole } = useAppStore();
  const households = useHouseholds();
  const { data, isLoading, error } = useHouseholdOverview(activeHouseholdId);
  const sealed = useQuery({
    queryKey: ["household", activeHouseholdId, "statements"],
    queryFn: async () => {
      const res = await fetch(`/api/households/${activeHouseholdId}/statements`, { headers: { "x-demo-role": demoRole } });
      if (!res.ok) throw new Error("proof service unavailable");
      return (await res.json()).statements as { period: string; anchored: boolean }[];
    },
    enabled: !!activeHouseholdId,
    retry: false,
  });
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [appliedAction, setAppliedAction] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  if (households.data && (households.data.households ?? []).length === 0) {
    return <Welcome />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-16 w-96" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Couldn't load this household"
        message="The overview request failed. Check that the dev server and database are running, or pick another household."
      />
    );
  }

  const { household, kpi, trendHistory, categoryBreakdown, nextBestAction, members, vehicles, solar, period, provenance } = data;
  const trend: TrendPoint[] = trendHistory || [];
  const maxKg = Math.max(...trend.map((p) => p.totalKg ?? 0), 1);
  const priorPoint = trend[trend.findIndex((p) => p.isReporting) - 1];
  const categories = Object.keys(categoryBreakdown).sort(
    (a, b) => (categoryBreakdown[b] || 0) - (categoryBreakdown[a] || 0),
  );
  const total = kpi.totalEmissions || 1;
  const canApplyAction = can("recommendation:apply");
  const committed = appliedAction || nextBestAction?.status === "ACCEPTED";

  async function commit() {
    if (!nextBestAction?.id) return;
    setCommitError(null);
    const res = await fetch(`/api/households/${household.id}/recommendations/${nextBestAction.id}/apply`, {
      method: "POST",
      headers: { "x-demo-role": demoRole },
    });
    if (res.ok) {
      setAppliedAction(true);
      queryClient.invalidateQueries({ queryKey: ["household", household.id] });
    } else {
      const body = await res.json().catch(() => ({}));
      setCommitError(body.error ?? "Couldn't save the commitment.");
    }
  }
  const perPerson = household.size && period.hasData ? Math.round(kpi.totalEmissions / household.size) : null;
  const sources = [
    provenance.nBills ? `${provenance.nBills} bill${provenance.nBills > 1 ? "s" : ""}` : null,
    provenance.nLogs ? `${provenance.nLogs} logged ${provenance.nLogs > 1 ? "activities" : "activity"}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-12">
      {/* Statement header */}
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="label-caps">Home</span>
          <h1 className="mt-2 font-heading text-4xl md:text-5xl font-medium tracking-tight text-ink">
            {household.name}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {[household.city, household.state].filter(Boolean).join(", ")}
            {household.size ? ` · ${household.size} people` : ""}
            {perPerson !== null ? ` · ${perPerson} kg per person` : ""}
          </p>
        </div>
        <div className="md:text-right">
          <span className="label-caps">{period.label}{period.isPartial ? " · so far" : ""}</span>
          <div className="mt-1 flex items-baseline gap-2 md:justify-end">
            <span className="font-heading text-6xl font-medium leading-none tracking-tight tabular-nums">
              {period.hasData ? kpi.totalEmissions : "—"}
            </span>
            <span className="font-mono text-sm text-ink-muted">kg CO₂</span>
          </div>
          {kpi.trendPct !== null && (
            <p className={`mt-2 font-mono text-xs tabular-nums ${kpi.trendPct <= 0 ? "text-success-text" : "text-critical-text"}`}>
              {kpi.trendPct > 0 ? "▲" : "▼"} {Math.abs(kpi.trendPct)}% vs {kpi.priorEmissions} kg the month before
            </p>
          )}
          {kpi.trendPct === null && priorPoint?.partial && (
            <p className="mt-2 font-mono text-[11px] text-ink-muted">
              Not compared: {priorPoint.label} has only {priorPoint.billedDays} of {priorPoint.daysInMonth} days billed
            </p>
          )}
          {period.newerPartial && (
            <p className="mt-1 font-mono text-[11px] text-ink-muted">
              {period.newerPartial.label} so far: {period.newerPartial.totalKg} kg ({period.newerPartial.billedDays} of{" "}
              {period.newerPartial.daysInMonth} days billed)
            </p>
          )}
          {period.soFar && period.soFar.month !== period.month && !period.newerPartial && (
            <p className="mt-1 font-mono text-[11px] text-ink-muted">
              This month so far: {period.soFar.totalKg} kg
            </p>
          )}
        </div>
      </header>

      <HomeNudges hasData={period.hasData} />

      {data.setup && <GettingStarted setup={data.setup} sealed={(sealed.data ?? []).some((x) => x.anchored)} />}

      {/* Where the headline number comes from */}
      <p className="-mt-6 border-y border-border py-2.5 font-mono text-[11px] leading-relaxed text-ink-muted">
        {period.hasData ? (
          <>
            {period.label}: worked out from {sources.join(" and ") || "no records"}
            {provenance.nBills > 0 ? ` · ${provenance.billSharePct}% of the total is from bills` : " · no bills yet"}
          </>
        ) : (
          <>
            No emissions recorded yet.{" "}
            <Link href="/bills/new" className="text-ink underline underline-offset-2">
              Add your electricity bill
            </Link>{" "}
            to start.
          </>
        )}
      </p>

      {/* KPI strip */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-8">
        <KpiCard
          label="Largest source"
          value={`${kpi.topContributor.sharePct}%`}
          unit={kpi.topContributor.category}
          metaText={`${kpi.topContributor.amountKg} kg in ${period.label}`}
        />
        <KpiCard
          label="Carbon index"
          value={kpi.score ?? "—"}
          unit={kpi.score !== null ? "/ 100" : undefined}
          deltaText={kpi.scoreBand ?? undefined}
          deltaVariant={kpi.score >= 75 ? "positive" : kpi.score >= 60 ? "neutral" : "critical"}
          metaText="Per person vs India, trend, efficiency, actions"
        />
        <KpiCard
          label="Cleaner than"
          value={kpi.peer ? `${kpi.peer.percentile}%` : "—"}
          unit={kpi.peer ? `of ${kpi.peer.cohortCount} homes` : undefined}
          deltaText={
            kpi.peer
              ? `${Math.abs(kpi.peer.differenceFromMedianPct)}% ${kpi.peer.differenceFromMedianPct <= 0 ? "below" : "above"} median ${kpi.peer.medianKg} kg`
              : undefined
          }
          deltaVariant={kpi.peer && kpi.peer.differenceFromMedianPct <= 0 ? "positive" : "warning"}
          metaText={kpi.peer ? `Homes with data for ${period.label}` : "Needs 3+ homes with data this month"}
        />
        <KpiCard
          label="Savings available"
          value={kpi.actionableSavingsKg ?? "—"}
          unit={kpi.actionableSavingsKg !== null ? "kg / month" : undefined}
          deltaText={kpi.actionableSavingsInr !== null ? `₹${Number(kpi.actionableSavingsInr).toLocaleString("en-IN")} / month` : undefined}
          deltaVariant="positive"
          metaText={kpi.actionableSavingsKg !== null ? "Top pending suggestion" : "No suggestions pending"}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <GoalCard />
        </div>
        <div className="xl:col-span-4">
          <CheckInPrompt />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-x-12 gap-y-12">
        {/* 01 Trajectory */}
        <section className="xl:col-span-7">
          <SectionHeading index="01" title="Six-month trajectory" meta={`kg CO₂ per month · to ${period.label}`} />
          <div className="mt-6 flex h-64 items-end gap-3 border-b border-ink">
            {trend.map((pt) => {
              if (pt.totalKg === null) {
                return (
                  <div key={pt.month} className="flex h-full flex-1 flex-col justify-end">
                    <span className="mb-1.5 text-center font-mono text-[10px] text-ink-light">no data</span>
                    <div className="h-[3px] border-t border-dashed border-ink-light" />
                  </div>
                );
              }
              const h = Math.max(4, (pt.totalKg / maxKg) * 85);
              return (
                <div key={pt.month} className="flex h-full flex-1 flex-col justify-end">
                  <span
                    className={`mb-1.5 text-center font-mono text-[11px] tabular-nums ${
                      pt.isReporting ? "font-semibold text-ink" : "text-ink-muted"
                    }`}
                  >
                    {Math.round(pt.totalKg)}
                  </span>
                  <div
                    className={pt.isReporting ? "bg-secondary" : pt.partial ? "border border-dashed border-ink/60 bg-ink/15" : "bg-ink/80"}
                    style={{ height: `${h}%` }}
                    title={`${pt.label}: ${pt.totalKg} kg${pt.partial ? ` (${pt.billedDays} of ${pt.daysInMonth} days billed)` : ""}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-3">
            {trend.map((pt) => (
              <span
                key={pt.month}
                className={`flex-1 text-center font-mono text-[11px] leading-tight ${pt.isReporting ? "font-semibold text-ink" : "text-ink-muted"}`}
              >
                {pt.label}
                {pt.partial && (
                  <span className="block text-[9px] text-ink-light">
                    {pt.billedDays}/{pt.daysInMonth} d
                  </span>
                )}
              </span>
            ))}
          </div>
          {trend.some((p) => p.partial) && (
            <p className="mt-3 text-[11px] text-ink-muted">
              Dashed bars are months your bills only partly cover; they fill in when the next bill arrives.
            </p>
          )}
        </section>

        {/* 02 Sources */}
        <section className="xl:col-span-5">
          <SectionHeading index="02" title="Where it comes from" meta="AC sits inside electricity" />
          <div className="mt-6 flex h-3 w-full overflow-hidden" aria-hidden>
            {categories.map((cat) => (
              <div
                key={cat}
                style={{
                  width: `${((categoryBreakdown[cat] || 0) / total) * 100}%`,
                  backgroundColor: categoryColor(cat),
                }}
              />
            ))}
          </div>
          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps pb-2 font-medium">Category</th>
                <th className="label-caps pb-2 text-right font-medium">kg</th>
                <th className="label-caps pb-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const kg = categoryBreakdown[cat] || 0;
                return (
                  <tr key={cat} className="border-b border-border/70">
                    <td className="py-2.5">
                      <span className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5" style={{ backgroundColor: categoryColor(cat) }} />
                        {cat}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{kg}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-ink-muted">
                      {Math.round((kg / total) * 100)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-muted">
            Rooftop solar:{" "}
            <span className="text-ink">
              {solar.hasSolar ? `≈ ${solar.solarKwh} kWh a month (estimated from panel size)` : "none installed"}
            </span>
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-x-12 gap-y-12">
        {/* 03 Next action */}
        <section className="xl:col-span-7">
          <SectionHeading
            index="03"
            title="Biggest lever right now"
            meta={nextBestAction ? `${String(nextBestAction.difficulty).toLowerCase()} effort` : undefined}
          />
          {nextBestAction ? (
            <div className="mt-6 border-l-2 border-secondary bg-canvas-card px-6 py-5">
              <h3 className="font-heading text-2xl font-medium tracking-tight">{nextBestAction.action}</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{nextBestAction.description}</p>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                <dl className="flex gap-10">
                  <div>
                    <dt className="label-caps">Saves</dt>
                    <dd className="mt-1 font-heading text-3xl font-medium tabular-nums">
                      {nextBestAction.kgSaved}
                      <span className="ml-1 font-mono text-xs text-ink-muted">kg / mo</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps">Bill impact</dt>
                    <dd className="mt-1 font-heading text-3xl font-medium tabular-nums">
                      ₹{Number(nextBestAction.inrSaved).toLocaleString("en-IN")}
                      <span className="ml-1 font-mono text-xs text-ink-muted">/ mo</span>
                    </dd>
                  </div>
                </dl>
                <Button variant="primary" disabled={committed || !canApplyAction || !nextBestAction.id} onClick={commit}>
                  {committed ? "Committed ✓" : canApplyAction ? "Commit to this" : "View only"}
                </Button>
              </div>
              {commitError && <p className="mt-3 font-mono text-xs text-critical-text">{commitError}</p>}
            </div>
          ) : (
            <p className="mt-6 text-sm text-ink-muted">
              No suggestions pending. They&apos;re worked out from your bills, assets and logs; see{" "}
              <Link href="/actions" className="text-ink underline underline-offset-2">
                Actions
              </Link>
              .
            </p>
          )}
        </section>

        {/* 04 Household */}
        <section className="xl:col-span-5">
          <SectionHeading index="04" title="Household" meta={`${members.length} members`} />
          <table className="mt-6 w-full text-sm">
            <tbody>
              {members.map((m: { id: string; name: string; role: string }) => (
                <tr key={m.id} className="border-b border-border/70">
                  <td className="py-2.5">{m.name}</td>
                  <td className="py-2.5 text-right font-mono text-[11px] uppercase text-ink-muted">{m.role}</td>
                </tr>
              ))}
              <tr className="border-b border-border/70">
                <td className="py-2.5 text-ink-muted">Vehicle</td>
                <td className="py-2.5 text-right">
                  {vehicles[0]?.name || "Public transport"}
                  {vehicles[0]?.fuel ? (
                    <span className="ml-2 font-mono text-[11px] uppercase text-ink-muted">{vehicles[0].fuel}</span>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

    </div>
  );
}
