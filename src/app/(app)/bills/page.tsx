"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, FileText, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "@/store";
import { usePermissions } from "@/hooks/usePermissions";
import { useBills, useDeleteBill, useDiscardDocument } from "@/hooks/useBills";
import { SectionHeading } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Skeleton } from "@/components/ui/Skeleton";
import type { BillView } from "@/lib/bills";

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtInr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function BillsPage() {
  const params = useSearchParams();
  const added = params.get("added");
  const { activeHouseholdId } = useAppStore();
  const { can } = usePermissions();
  const { data, isLoading, error } = useBills(activeHouseholdId);
  const del = useDeleteBill(activeHouseholdId);
  const discard = useDiscardDocument(activeHouseholdId);
  const [confirming, setConfirming] = useState<string | null>(null);

  const bills = data?.bills ?? [];
  const totalKwh = bills.reduce((s, b) => s + b.kwh, 0);
  const totalDays = bills.reduce((s, b) => s + b.days, 0);
  const totalKg = bills.reduce((s, b) => s + b.kgCo2e, 0);
  const priced = bills.filter((b) => b.amountInr != null);
  const pricedKwh = priced.reduce((s, b) => s + b.kwh, 0);
  const avgRate = pricedKwh > 0 ? priced.reduce((s, b) => s + (b.amountInr ?? 0), 0) / pricedKwh : null;
  const cal = data?.calibration;
  const acMeasured = cal && cal.method !== "default";

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="label-caps">Bills</span>
          <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight md:text-5xl">Electricity bills</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Your bills are the most accurate record of your home&apos;s electricity. Upload one and its units become this
            account&apos;s electricity figure for those months, replacing estimates, and two or more bills measure your AC.
          </p>
        </div>
        {can("bill:create") && (
          <Link
            href="/bills/new"
            className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover md:self-auto"
          >
            <Plus className="h-4 w-4" /> Add a bill
          </Link>
        )}
      </header>

      {added && (
        <div className="flex items-start gap-3 border border-success-border bg-success-subtle px-4 py-3 text-[13px] text-success-text">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Bill booked. Monthly totals, your score, the AC calibration and your passbook now use it.{" "}
            <Link href="/dashboard" className="font-medium underline underline-offset-2">
              See the overview
            </Link>
          </span>
        </div>
      )}

      {error && <p className="text-[13px] text-critical-text">{(error as Error).message}</p>}

      {/* Pending reviews */}
      {data && data.pending.length > 0 && (
        <section>
          <SectionHeading index="00" title="Waiting for you to check" meta={`${data.pending.length} upload${data.pending.length > 1 ? "s" : ""}`} />
          <ul className="mt-4 divide-y divide-border border-b border-border">
            {data.pending.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-ink-light" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{d.fileName}</p>
                    <p className="font-mono text-[11px] text-ink-muted">
                      {d.extraction.discom.name} · {d.extraction.fields.units_kwh.value ?? "?"} kWh read ·{" "}
                      {d.status === "NEEDS_REVIEW" ? "some fields unclear" : "ready to confirm"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/bills/new?doc=${d.id}`} className="border border-ink px-3 py-1.5 text-xs font-medium hover:bg-ink hover:text-canvas-card">
                    Review
                  </Link>
                  {can("activity:delete") && (
                    <button
                      onClick={() => discard.mutate(d.id)}
                      className="px-3 py-1.5 text-xs text-ink-muted hover:text-critical-text"
                      disabled={discard.isPending}
                    >
                      Discard
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isLoading && <Skeleton className="h-64 w-full" />}

      {data && bills.length === 0 && (
        <div className="border border-dashed border-border bg-canvas-subtle/60 px-8 py-14 text-center">
          <p className="font-heading text-2xl font-medium">No bills yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Start with your latest electricity bill: the PDF from your discom&apos;s app or email, or a photo of the paper bill.
            Add a summer and a winter bill to measure your AC.
          </p>
          {can("bill:create") && (
            <Link href="/bills/new" className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              <Plus className="h-4 w-4" /> Add your first bill
            </Link>
          )}
        </div>
      )}

      {bills.length > 0 && (
        <>
          <section className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <KpiCard label="Bills on record" value={bills.length} metaText={`${totalDays} days covered`} />
            <KpiCard label="Electricity billed" value={Math.round(totalKwh).toLocaleString("en-IN")} unit="kWh" metaText={`${(totalKwh / Math.max(1, totalDays)).toFixed(1)} kWh a day on average`} />
            <KpiCard label="Emissions" value={Math.round(totalKg).toLocaleString("en-IN")} unit="kg CO₂" metaText="From the units on your bills" />
            <KpiCard
              label="Your AC draws"
              value={acMeasured ? cal!.acKw.toFixed(2) : "—"}
              unit={acMeasured ? "kW" : undefined}
              metaText={
                acMeasured ? (
                  <>
                    {cal!.acKwLow.toFixed(2)}–{cal!.acKwHigh.toFixed(2)} kW from {cal!.nBills} bills ·{" "}
                    <Link href="/calibration" className="underline underline-offset-2">
                      details
                    </Link>
                  </>
                ) : (
                  "Needs a bill with AC hours > 0"
                )
              }
            />
          </section>

          <section>
            <SectionHeading
              index="01"
              title="Booked bills"
              meta={avgRate != null ? `Average tariff ₹${avgRate.toFixed(2)}/kWh` : undefined}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-caps pb-2 font-medium">Period</th>
                    <th className="label-caps pb-2 text-right font-medium">Days</th>
                    <th className="label-caps pb-2 text-right font-medium">Units</th>
                    <th className="label-caps pb-2 text-right font-medium">Per day</th>
                    <th className="label-caps pb-2 text-right font-medium">Amount</th>
                    <th className="label-caps pb-2 text-right font-medium">kg CO₂</th>
                    <th className="label-caps pb-2 pl-6 font-medium">Source</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <BillRow
                      key={b.id}
                      bill={b}
                      highlight={b.id === added}
                      canDelete={can("activity:delete")}
                      confirming={confirming === b.id}
                      onAskDelete={() => setConfirming(b.id)}
                      onCancel={() => setConfirming(null)}
                      onDelete={() => del.mutate(b.id, { onSettled: () => setConfirming(null) })}
                      deleting={del.isPending && confirming === b.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {del.error && <p className="mt-3 text-[13px] text-critical-text">{(del.error as Error).message}</p>}
            <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-ink-muted">
              Each bill&apos;s units are shared across the calendar months it covers. Electricity
              logged by hand inside a bill&apos;s period stays in the ledger as “covered by bill” and stops counting, so nothing is
              counted twice. Deleting a bill reverses all of this.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function BillRow({
  bill: b,
  highlight,
  canDelete,
  confirming,
  deleting,
  onAskDelete,
  onCancel,
  onDelete,
}: {
  bill: BillView;
  highlight: boolean;
  canDelete: boolean;
  confirming: boolean;
  deleting: boolean;
  onAskDelete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className={`border-b border-border/70 ${highlight ? "bg-success-subtle/60" : ""}`}>
      <td className="py-3 pr-3">
        {fmtDate(b.periodStart)} – {fmtDate(b.periodEnd)}
      </td>
      <td className="py-3 text-right font-mono tabular-nums">{b.days}</td>
      <td className="py-3 text-right font-mono tabular-nums">
        {b.kwh.toLocaleString("en-IN")}
        {b.importKwh != null && b.importKwh >= b.kwh && (
          <span className="block text-[10px] text-ink-muted">
            billed net · {b.importKwh.toLocaleString("en-IN")} from grid
            {b.exportKwh ? ` · ${b.exportKwh.toLocaleString("en-IN")} solar sent out` : ""}
          </span>
        )}
      </td>
      <td className="py-3 text-right font-mono tabular-nums text-ink-muted">
        {((b.importKwh != null && b.importKwh >= b.kwh ? b.importKwh : b.kwh) / Math.max(1, b.days)).toFixed(1)}
      </td>
      <td className="py-3 text-right font-mono tabular-nums">
        {b.amountInr != null ? fmtInr(b.amountInr) : <span className="text-ink-light">—</span>}
      </td>
      <td className="py-3 text-right font-mono tabular-nums">{b.kgCo2e.toLocaleString("en-IN")}</td>
      <td className="py-3 pl-6">
        <span className="text-[13px]">{b.source === "UPLOAD" ? "Uploaded bill" : "Typed in"}</span>
        <span className="block font-mono text-[11px] text-ink-muted">
          {[b.discom, b.consumerMasked, b.acHoursPerDay > 0 ? `AC ${b.acHoursPerDay} h/day` : null].filter(Boolean).join(" · ") || "—"}
        </span>
      </td>
      <td className="py-3 text-right">
        {canDelete &&
          (confirming ? (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <button onClick={onDelete} disabled={deleting} className="text-xs font-medium text-critical-text">
                {deleting ? "Deleting…" : "Delete bill"}
              </button>
              <button onClick={onCancel} className="text-xs text-ink-muted">
                Keep
              </button>
            </span>
          ) : (
            <button onClick={onAskDelete} aria-label="Delete bill" className="p-1 text-ink-light hover:text-critical-text">
              <Trash2 className="h-4 w-4" />
            </button>
          ))}
      </td>
    </tr>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BillsPage />
    </Suspense>
  );
}
