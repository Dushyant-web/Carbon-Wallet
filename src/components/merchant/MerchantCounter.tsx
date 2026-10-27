"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { SectionHeading } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CardScanner, type ScanStatus } from "@/components/card/CardScanner";
import { SaleForm, type SalePayload } from "@/components/merchant/SaleForm";
import { CounterAdvice } from "@/components/merchant/CounterAdvice";
import { CataloguePicker, type PickPayload } from "@/components/merchant/CataloguePicker";
import { toast } from "sonner";
import type { ScanResult } from "@/server/services/merchant.service";

type Step = "scan" | "confirm" | "item" | "done";
type Registered = { id: string; summary: string };

const READY: ScanStatus = { kind: "idle", text: "Ready. Ask the customer for their Carbon Card…" };

function useCountdown(until: string | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [until]);
  return left;
}

/**
 * The shop counter: scan the customer's card → check it's them → register what they bought → next customer.
 * The shop sees only the home's name, city and Carbon ID; the owner is told about every item and can turn it down.
 */
export function MerchantCounter({ shop, sells }: { shop: string; sells: string }) {
  const [step, setStep] = useState<Step>("scan");
  const [status, setStatus] = useState<ScanStatus>(READY);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [registered, setRegistered] = useState<Registered[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [typing, setTyping] = useState(false); // typing the label by hand instead of picking from the catalogue
  const busy = useRef(false);
  const left = useCountdown(scan?.expiresAt ?? null);
  const expired = !!scan && left === 0;

  const reset = useCallback(() => {
    setStep("scan");
    setScan(null);
    setRegistered([]);
    setError(null);
    setStatus(READY);
  }, []);

  const read = useCallback(async (input: string, source: string) => {
    if (busy.current || !input.trim()) return;
    busy.current = true;
    setStatus({ kind: "reading", text: `Read from ${source}. Checking the card…` });
    try {
      const res = await fetch("/api/merchant/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "err", text: body.error ?? "Card not recognised." });
        return;
      }
      setScan(body as ScanResult);
      setRegistered([]);
      setStatus({ kind: "ok", text: `Card read: ${body.customer.name}` });
      setStep("confirm");
    } finally {
      busy.current = false;
    }
  }, []);

  async function register(p: SalePayload | PickPayload) {
    if (!scan) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...p, ticket: scan.ticket }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Couldn't register the item. Try again.");
        return;
      }
      setRegistered((r) => [...r, { id: body.sale.id, summary: body.sale.summary }]);
      toast.success("Registered to their home", { description: body.sale.summary });
      setStep("done");
    } finally {
      setSaving(false);
    }
  }

  const mins = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-10">
      <header>
        <span className="label-caps">Counter · {shop}</span>
        <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight md:text-5xl">Register a purchase</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Scan the customer&apos;s Carbon Card, check it&apos;s their home, then enter what they bought from the star label and the
          invoice. It goes straight onto their home, marked as registered by your shop.
        </p>
      </header>

      {step === "scan" && (
        <section className="max-w-2xl">
          <SectionHeading index="01" title="Scan the card" meta="Barcode on the back, or tap the chip" />
          <div className="mt-5">
            <CardScanner onRead={read} status={status} onStatus={setStatus} submitLabel="Check card" placeholder="Code under the barcode (CW1-…)" />
          </div>
        </section>
      )}

      {scan && step !== "scan" && (
        <section className="max-w-2xl">
          <SectionHeading index="02" title="Customer" meta={expired ? "Scan expired" : `Scan valid for ${mins}`} />
          <div className="mt-5 border border-ink bg-canvas-card p-5">
            <p className="font-heading text-2xl font-medium tracking-tight">{scan.customer.name}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {scan.customer.city}, {scan.customer.state}
            </p>
            {scan.customer.carbonId && <p className="mt-3 font-mono text-sm tracking-wide">{scan.customer.carbonId}</p>}
            {step === "confirm" && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => setStep("item")} disabled={expired}>
                  That&apos;s their home: add an item
                </Button>
                <Button variant="secondary" onClick={reset}>
                  Wrong card
                </Button>
              </div>
            )}
          </div>
          <div className="mt-4">
            <CounterAdvice ticket={scan.ticket} advice={scan.advice} disabled={expired} />
          </div>
          {expired && (
            <p className="mt-3 text-sm text-critical-text">
              This scan has expired. <button className="underline underline-offset-2" onClick={reset}>Scan the card again</button>.
            </p>
          )}
        </section>
      )}

      {step === "item" && !expired && (
        <section>
          <SectionHeading index="03" title="What did they buy?" meta="From the star label, the box and the invoice" />
          <div className="mt-5">
            {typing ? (
              <>
                <SaleForm sells={sells} busy={saving} onSubmit={register} />
                <button onClick={() => setTyping(false)} className="mt-3 text-[13px] underline">
                  Pick from the catalogue instead
                </button>
              </>
            ) : (
              <CataloguePicker busy={saving} onSubmit={register} onTypeInstead={() => setTyping(true)} />
            )}
          </div>
          {error && <p className="mt-3 border-l-2 border-critical bg-critical-subtle px-3 py-2 text-sm text-critical-text">{error}</p>}
        </section>
      )}

      {step === "done" && (
        <section className="max-w-2xl">
          <SectionHeading index="03" title="Registered" meta={`${registered.length} this visit`} />
          <ul className="mt-5 border border-ink bg-canvas-card">
            {registered.map((r) => (
              <li key={r.id} className="flex items-start gap-3 border-b border-border px-5 py-3 text-sm last:border-b-0">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                <span>{r.summary}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">The home&apos;s owner has been told and can remove anything that isn&apos;t theirs.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {!expired && <Button onClick={() => setStep("item")}>Add another item</Button>}
            <Button variant="secondary" onClick={reset}>
              Next customer
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
