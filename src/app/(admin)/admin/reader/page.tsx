"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeading } from "@/components/ui/Card";
import { CardScanner, type ScanStatus } from "@/components/card/CardScanner";
import { ThermalReceipt, type PaperWidth } from "@/components/card/ThermalReceipt";
import type { Receipt } from "@/server/services/card.service";

const btn = "h-9 rounded-md border border-border bg-canvas-card px-3 text-sm hover:border-ink disabled:opacity-45";

export default function ReaderPage() {
  const [status, setStatus] = useState<ScanStatus>({ kind: "idle", text: "Ready. Waiting for a card…" });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [paper, setPaper] = useState<PaperWidth>(80);
  const [autoPrint, setAutoPrint] = useState(true);
  const [origin, setOrigin] = useState("");
  const busy = useRef(false);
  const autoPrintRef = useRef(autoPrint);
  autoPrintRef.current = autoPrint;

  useEffect(() => {
    setOrigin(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
  }, []);

  const lookup = useCallback(async (input: string, source: string) => {
    if (busy.current || !input.trim()) return;
    busy.current = true;
    setStatus({ kind: "reading", text: `Read from ${source}. Looking up…` });
    try {
      const res = await fetch("/api/cards/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "err", text: body.error ?? "Card not recognised." });
        return;
      }
      setReceipt(body as Receipt);
      setStatus({ kind: "ok", text: `${body.household.name} · ${body.carbonId}` });
      if (autoPrintRef.current) window.setTimeout(() => window.print(), 450); // let the receipt render first
    } finally {
      busy.current = false;
    }
  }, []);

  // Deep link: /admin/reader?input=/p/<token>
  useEffect(() => {
    const input = new URLSearchParams(window.location.search).get("input");
    if (input) lookup(input, "link");
  }, [lookup]);

  return (
    <div className="flex flex-col gap-10">
      {/* thermal page size for the print dialog */}
      <style>{`@media print { @page { size: ${paper}mm auto; margin: 0; } body { background: #fff !important; } .cw-no-print { display: none !important; } main { padding: 0 !important; } .lg\\:pl-60 { padding-left: 0 !important; } main > div { padding-top: 0 !important; } }`}</style>

      <header className="cw-no-print">
        <span className="label-caps">Card reader · kiosk</span>
        <h1 className="mt-2 font-heading text-4xl md:text-5xl font-medium tracking-tight">Tap a card, get a receipt</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Works with a USB barcode or NFC reader (it types the card code or chip serial), a phone with NFC, the laptop
          camera (barcode on the card&apos;s back), or a typed card code. The receipt prints on any 58 or 80 mm thermal printer through the normal print dialog.
        </p>
      </header>

      <section className="cw-no-print grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <SectionHeading index="01" title="Read" meta="Four ways in" />
          <div className="mt-5">
            <CardScanner onRead={lookup} status={status} onStatus={setStatus} />
          </div>
        </div>

        <div>
          <SectionHeading index="02" title="Print" meta="Thermal receipt" />
          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="label-caps">Paper</span>
              <select
                value={paper}
                onChange={(e) => setPaper(Number(e.target.value) as PaperWidth)}
                className="h-9 rounded-sm border border-border bg-canvas-card px-2 text-sm"
              >
                <option value={80}>80 mm</option>
                <option value={58}>58 mm</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} />
              Print automatically after a read
            </label>
            <button className={btn} onClick={() => window.print()} disabled={!receipt}>
              Print again
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Tip: in the print dialog pick your thermal printer and set margins to none. Receipts show totals only, never
            member names.
          </p>
        </div>
      </section>

      <section className="flex justify-center">
        {receipt ? (
          <div className="shadow-[0_18px_40px_-20px_rgba(29,28,24,.45)] print:shadow-none">
            <ThermalReceipt receipt={receipt} paper={paper} origin={origin} />
          </div>
        ) : (
          <p className="cw-no-print font-mono text-xs text-ink-muted">The receipt will appear here.</p>
        )}
      </section>
    </div>
  );
}
