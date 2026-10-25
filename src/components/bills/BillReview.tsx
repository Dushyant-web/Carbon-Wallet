"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { BillDocumentView, ExtractedField, FieldConfidence } from "@/lib/bills";
import { useAiReread, useConfirmBill, type ConfirmBillInput } from "@/hooks/useBills";
import { BillPreview, type Highlight } from "./BillPreview";

const GRID_EF = 0.675; // CEA CO2 Baseline v22.0, FY 2025-26: the factor confirmed bills are booked at
const DAY = 86_400_000;

const COLOURS = {
  units: "#B4532F",
  period: "#B7862B",
  amount: "#3F6B4E",
  readings: "#2F5D7C",
  solar: "#6E5A8A",
};

const inputCls =
  "h-10 w-full rounded-sm border border-border bg-canvas-card px-3 font-mono text-[15px] tabular-nums text-ink focus:border-ink focus:outline-none";

function ConfidenceChip({ field }: { field: ExtractedField<unknown> | null }) {
  if (!field || field.value == null) {
    return <span className="label-caps border border-border px-1.5 py-0.5 text-ink-light">Not found</span>;
  }
  const map: Record<FieldConfidence, [string, string]> = {
    high: ["Cross-checked", "border-success-border bg-success-subtle text-success-text"],
    medium: ["Please check", "border-warning-border bg-warning-subtle text-warning-text"],
    low: ["Unsure", "border-critical-border bg-critical-subtle text-critical-text"],
  };
  const [text, cls] = map[field.confidence];
  return (
    <span className={`label-caps border px-1.5 py-0.5 ${cls}`}>
      {field.source === "ai" ? "AI · " : ""}
      {text}
    </span>
  );
}

function Provenance({ field }: { field: ExtractedField<unknown> | null }) {
  if (!field || field.value == null) return null;
  return (
    <p className="mt-1 truncate font-mono text-[11px] text-ink-muted" title={field.snippet ?? undefined}>
      {field.snippet ? `“${field.snippet}”` : ""}
      {field.reason ? ` · ${field.reason}` : ""}
      {field.page != null ? ` · page ${field.page + 1}` : ""}
    </p>
  );
}

const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/,/g, "")));
const str = (v: unknown) => (v == null ? "" : String(v));

/** Days in a bill period [start, end), the same count the engine and the ledger use. */
export function periodDays(start: string, end: string) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY);
}

/**
 * The review step. Every value starts as what the engine read, shows where it came from and how
 * sure we are, and stays editable. Nothing is booked until the user confirms.
 */
export function BillReview({
  householdId,
  document,
  onConfirmed,
  onDiscard,
}: {
  householdId: string;
  document: BillDocumentView | null; // null = typing a bill in by hand
  onConfirmed: (billId: string) => void;
  onDiscard?: () => void;
}) {
  const x = document?.extraction ?? null;
  const f = x?.fields;
  const [active, setActive] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    kwh: str(f?.units_kwh.value),
    periodStart: str(f?.period_start.value),
    periodEnd: str(f?.period_end.value),
    amountInr: str(f?.amount_inr.value),
    acHoursPerDay: "0",
    deleteOriginal: true,
  }));
  const confirm = useConfirmBill(householdId);
  const ai = useAiReread(householdId);
  const set = (patch: Partial<typeof form>) => setForm((s) => ({ ...s, ...patch }));

  const highlights: Highlight[] = useMemo(() => {
    if (!f) return [];
    const list: Highlight[] = [
      { key: "units", label: "Units", colour: COLOURS.units, field: f.units_kwh },
      { key: "period", label: "Period", colour: COLOURS.period, field: f.period_start },
      { key: "amount", label: "Amount", colour: COLOURS.amount, field: f.amount_inr },
      { key: "prev", label: "Prev reading", colour: COLOURS.readings, field: f.previous_reading },
      { key: "present", label: "Present reading", colour: COLOURS.readings, field: f.present_reading },
      { key: "import", label: "Import", colour: COLOURS.solar, field: f.import_kwh },
      { key: "export", label: "Export", colour: COLOURS.solar, field: f.export_kwh },
    ];
    return list.filter((h) => h.field.value != null && h.field.bbox);
  }, [f]);

  // Live checks on what the user is about to confirm
  const kwh = num(form.kwh);
  const amount = num(form.amountInr);
  const days = form.periodStart && form.periodEnd ? periodDays(form.periodStart, form.periodEnd) : null;
  const rate = kwh && amount ? amount / kwh : null;
  const prev = f?.previous_reading.value ?? null;
  const pres = f?.present_reading.value ?? null;
  const mf = f?.multiplying_factor.value ?? 1;
  const fromReadings = prev != null && pres != null && pres >= prev ? Math.round((pres - prev) * mf * 100) / 100 : null;
  const imp = f?.import_kwh.value ?? null;
  const exp = f?.export_kwh.value ?? null;

  const errors: string[] = [];
  if (kwh == null || !(kwh > 0)) errors.push("Enter the units billed (kWh).");
  else if (kwh > 20000) errors.push("Units look too high for a home (max 20,000 kWh).");
  if (!form.periodStart || !form.periodEnd) errors.push("Enter the billing period.");
  else if (days == null || days < 1) errors.push("The period ends before it starts.");
  else if (days > 95) errors.push("A bill period should be at most 95 days.");
  const notes: string[] = [];
  if (rate != null && (rate < 1.5 || rate > 25)) notes.push(`₹${rate.toFixed(2)}/kWh is unusual for a home tariff. Check the amount and units.`);
  if (days != null && days > 0 && (days < 20 || days > 70)) notes.push(`${days} days is unusual (bills are usually ~30 or ~60 days).`);
  if (fromReadings != null && kwh != null && imp == null && Math.abs(fromReadings - kwh) > Math.max(1, kwh * 0.02)) {
    notes.push(`Meter readings give ${fromReadings} kWh, you're confirming ${kwh} kWh.`);
  }

  const submit = () => {
    if (errors.length || kwh == null) return;
    const input: ConfirmBillInput = {
      documentId: document?.id ?? null,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      kwh,
      amountInr: amount,
      importKwh: imp,
      exportKwh: exp,
      acHoursPerDay: Math.min(24, Math.max(0, num(form.acHoursPerDay) ?? 0)),
      deleteOriginal: form.deleteOriginal,
    };
    confirm.mutate(input, { onSuccess: (r) => onConfirmed(r.bill.id) });
  };

  const fieldWrap = (key: string) =>
    `border-l-2 pl-4 transition-colors ${active === key ? "border-ink" : "border-transparent"}`;

  return (
    <div className={`grid grid-cols-1 gap-10 ${document ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" : "max-w-xl"}`}>
      {document && (
        <div className="lg:sticky lg:top-6 lg:self-start">
          <BillPreview
            householdId={householdId}
            documentId={document.id}
            pageCount={document.previewCount}
            highlights={highlights}
            active={active}
            onSelect={setActive}
          />
        </div>
      )}

      <form
        className="flex flex-col gap-7"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {x && (
          <div className="border-t border-ink pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading text-2xl font-medium tracking-tight">{x.discom.name}</h2>
              <span className="label-caps">{x.discom.state}</span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-ink-muted">
              {x.text_source === "pdf_text" ? "Read from your PDF" : "Read from your photo"}
              {x.consumer ? ` · Consumer ${x.consumer.masked}` : ""} · {(x.elapsed_ms / 1000).toFixed(1)} s
            </p>
          </div>
        )}

        {x && x.warnings.length > 0 && (
          <ul className="flex flex-col gap-1.5 border border-warning-border bg-warning-subtle px-4 py-3 text-[13px] text-warning-text">
            {x.warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}

        {x && x.needs_ai && !x.ai_used && document && x.ai_provider && (
          <div className="border border-border bg-canvas-card px-4 py-4">
            <p className="text-sm font-medium">Some numbers weren&apos;t clear. Let AI read this bill?</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              The first page is read once more by our partner service. We check every number it returns
              against the text on your bill and mark anything we can&apos;t find there as “please check”.
            </p>
            {ai.error && <p className="mt-2 text-[13px] text-critical-text">{(ai.error as Error).message}</p>}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={ai.isPending}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              onClick={() =>
                ai.mutate(document.id, {
                  onSuccess: (doc) => {
                    const g = doc.extraction.fields;
                    set({
                      kwh: str(g.units_kwh.value) || form.kwh,
                      periodStart: str(g.period_start.value) || form.periodStart,
                      periodEnd: str(g.period_end.value) || form.periodEnd,
                      amountInr: str(g.amount_inr.value) || form.amountInr,
                    });
                  },
                })
              }
            >
              {ai.isPending ? "Reading…" : "Let AI read it"}
            </Button>
          </div>
        )}

        {/* Units */}
        <div className={fieldWrap("units")} onFocus={() => setActive("units")}>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="bill-kwh" className="text-sm font-medium">
              Units billed <span className="font-normal text-ink-muted">kWh</span>
            </label>
            {f && <ConfidenceChip field={f.units_kwh} />}
          </div>
          <input
            id="bill-kwh"
            inputMode="decimal"
            className={`${inputCls} mt-2`}
            value={form.kwh}
            onChange={(e) => set({ kwh: e.target.value })}
            placeholder="e.g. 342"
          />
          {f && <Provenance field={f.units_kwh} />}
          {f && f.units_kwh.alternates.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-muted">Other numbers near a units label:</span>
              {f.units_kwh.alternates.map((a) => (
                <button
                  key={String(a)}
                  type="button"
                  onClick={() => set({ kwh: String(a) })}
                  className="border border-border px-1.5 font-mono text-[11px] hover:border-ink"
                >
                  {String(a)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Period */}
        <div className={fieldWrap("period")} onFocus={() => setActive("period")}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Billing period</span>
            {f && <ConfidenceChip field={f.period_start} />}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="label-caps">From</span>
              <input type="date" className={inputCls} value={form.periodStart} onChange={(e) => set({ periodStart: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-caps">To</span>
              <input type="date" className={inputCls} value={form.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} />
            </label>
          </div>
          {f && <Provenance field={f.period_start} />}
        </div>

        {/* Amount */}
        <div className={fieldWrap("amount")} onFocus={() => setActive("amount")}>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="bill-amount" className="text-sm font-medium">
              Amount payable <span className="font-normal text-ink-muted">₹, optional</span>
            </label>
            {f && <ConfidenceChip field={f.amount_inr} />}
          </div>
          <input
            id="bill-amount"
            inputMode="decimal"
            className={`${inputCls} mt-2`}
            value={form.amountInr}
            onChange={(e) => set({ amountInr: e.target.value })}
            placeholder="e.g. 2,480"
          />
          {f && <Provenance field={f.amount_inr} />}
        </div>

        {/* Cross-checks read from the bill */}
        {(fromReadings != null || imp != null) && (
          <div className="grid grid-cols-1 gap-3 border-y border-border py-4 text-[13px] sm:grid-cols-2">
            {fromReadings != null && (
              <div onMouseEnter={() => setActive("present")}>
                <span className="label-caps">Meter check</span>
                <p className="mt-1 font-mono tabular-nums">
                  ({pres} − {prev}){mf !== 1 ? ` × ${mf}` : ""} = {fromReadings} kWh
                </p>
                <p className={`mt-0.5 text-[12px] ${kwh != null && Math.abs(fromReadings - kwh) <= Math.max(1, kwh * 0.02) ? "text-success-text" : "text-ink-muted"}`}>
                  {kwh != null && Math.abs(fromReadings - kwh) <= Math.max(1, kwh * 0.02) ? "Matches the units billed" : "Differs from the units billed"}
                </p>
              </div>
            )}
            {imp != null && (
              <div onMouseEnter={() => setActive("import")}>
                <span className="label-caps">Rooftop solar</span>
                <p className="mt-1 font-mono tabular-nums">
                  {imp} imported − {exp ?? 0} exported = {Math.round((imp - (exp ?? 0)) * 100) / 100} kWh net
                </p>
                <p className="mt-0.5 text-[12px] text-ink-muted">Net units are what the grid supplied, so that&apos;s what we count.</p>
              </div>
            )}
          </div>
        )}

        {/* AC routine for calibration */}
        <div>
          <label htmlFor="bill-ac" className="text-sm font-medium">
            AC hours a day in this period <span className="font-normal text-ink-muted">roughly, 0 if none</span>
          </label>
          <input
            id="bill-ac"
            inputMode="decimal"
            className={`${inputCls} mt-2 max-w-[140px]`}
            value={form.acHoursPerDay}
            onChange={(e) => set({ acHoursPerDay: e.target.value })}
          />
          <p className="mt-1 text-[12px] leading-snug text-ink-muted">
            With one bill where the AC ran and one where it didn&apos;t, we can measure what your AC actually draws.
          </p>
        </div>

        {/* What confirming does */}
        {kwh != null && kwh > 0 && days != null && days > 0 && errors.length === 0 && (
          <div className="bg-primary px-5 py-4 text-canvas-card">
            <span className="label-caps text-canvas-card/60">This bill adds</span>
            <p className="mt-1 font-heading text-3xl font-medium tabular-nums">
              {(kwh * GRID_EF).toFixed(1)} <span className="text-base text-canvas-card/70">kg CO₂</span>
            </p>
            <p className="mt-1 font-mono text-[11px] text-canvas-card/70">
              {days} days · {(kwh / days).toFixed(1)} units a day
              {rate != null ? ` · ₹${rate.toFixed(2)}/kWh` : ""}
            </p>
            <p className="mt-2 text-[12px] leading-snug text-canvas-card/70">
              Split across calendar months by days. Electricity you logged by hand inside this period is already in the bill, so
              it stops counting (it stays in your ledger, marked “covered by bill”).
            </p>
          </div>
        )}

        {(errors.length > 0 || notes.length > 0) && (
          <ul className="flex flex-col gap-1 text-[13px]">
            {errors.map((e) => (
              <li key={e} className="text-critical-text">
                {e}
              </li>
            ))}
            {notes.map((n) => (
              <li key={n} className="text-warning-text">
                {n}
              </li>
            ))}
          </ul>
        )}

        {document && document.previewCount > 0 && (
          <label className="flex items-start gap-2.5 text-[13px]">
            <input
              type="checkbox"
              className="mt-0.5 accent-[#1D1C18]"
              checked={form.deleteOriginal}
              onChange={(e) => set({ deleteOriginal: e.target.checked })}
            />
            <span>
              Delete the uploaded file after confirming
              <span className="block text-ink-muted">We keep only the numbers above and a fingerprint of the file.</span>
            </span>
          </label>
        )}

        {confirm.error && <p className="text-[13px] text-critical-text">{(confirm.error as Error).message}</p>}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={errors.length > 0 || confirm.isPending} icon={<Check className="h-4 w-4" />}>
            {confirm.isPending ? "Booking…" : "Confirm bill"}
          </Button>
          {onDiscard && (
            <Button type="button" variant="ghost" size="lg" onClick={onDiscard} disabled={confirm.isPending}>
              {document ? "Discard upload" : "Cancel"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
