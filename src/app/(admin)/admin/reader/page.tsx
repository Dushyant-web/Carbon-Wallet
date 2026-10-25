"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeading } from "@/components/ui/Card";
import { ThermalReceipt, type PaperWidth } from "@/components/card/ThermalReceipt";
import type { Receipt } from "@/server/services/card.service";

type Status = { kind: "idle" | "reading" | "ok" | "err"; text: string };

const btn = "h-9 rounded-md border border-border bg-canvas-card px-3 text-sm hover:border-ink disabled:opacity-45";

// Middle of the frame that the guide box marks and that is enlarged for a second read
const BOX = { w: 0.7, h: 0.42 };

export default function ReaderPage() {
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "Ready. Waiting for a card…" });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [paper, setPaper] = useState<PaperWidth>(80);
  const [autoPrint, setAutoPrint] = useState(true);
  const [manual, setManual] = useState("");
  const [origin, setOrigin] = useState("");
  const [support, setSupport] = useState({ nfc: false, camera: false });
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const autoPrintRef = useRef(autoPrint);
  autoPrintRef.current = autoPrint;

  useEffect(() => {
    setOrigin(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
    setSupport({ nfc: "NDEFReader" in window, camera: "BarcodeDetector" in window && !!navigator.mediaDevices });
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

  // USB "keyboard wedge" readers type the chip serial very fast and press Enter.
  useEffect(() => {
    let buffer = "";
    let last = 0;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const now = performance.now();
      if (now - last > 80) buffer = ""; // humans type slower than readers
      last = now;
      if (e.key === "Enter") {
        if (buffer.length >= 8) lookup(buffer, "USB reader");
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lookup]);

  async function phoneNfc() {
    setStatus({ kind: "reading", text: "Hold the card against the back of this phone…" });
    try {
      const ndef = new NDEFReader();
      ndef.onreading = (event) => {
        const decoder = new TextDecoder();
        const url = event.message.records.find((r) => r.recordType === "url" && r.data);
        lookup(url?.data ? decoder.decode(url.data) : event.serialNumber, "phone NFC");
      };
      await ndef.scan();
    } catch (e) {
      setStatus({ kind: "err", text: `NFC unavailable: ${e instanceof Error ? e.message : "unknown error"}` });
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    try {
      // A card's barcode has ~220 thin bars. At the default 640×480 each bar is 1–2 pixels, too few to
      // read, so ask for HD and continuous focus where the camera has it.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      try {
        await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
      } catch {
        /* fixed-focus webcam */
      }
      streamRef.current = stream;
      setCameraOn(true);
      setStatus({ kind: "reading", text: "Hold the barcode on the back of the card inside the box…" });
      const detector = new BarcodeDetector({ formats: ["code_128", "qr_code"] });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const loop = async () => {
        if (!streamRef.current) return;
        try {
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (w && h) {
            // the guide box, enlarged so each bar gets more pixels; optionally greyscale with more contrast,
            // which rescues soft or washed-out frames (a card on a phone screen, a cheap webcam)
            const box = (filter: string) => {
              const cw = w * BOX.w;
              const ch = h * BOX.h;
              const scale = Math.min(3, 2400 / cw);
              canvas.width = Math.round(cw * scale);
              canvas.height = Math.round(ch * scale);
              ctx.imageSmoothingQuality = "high";
              ctx.filter = filter;
              ctx.drawImage(video, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
              return canvas;
            };
            let found = await detector.detect(video);
            if (!found.length) found = await detector.detect(box("none"));
            if (!found.length) found = await detector.detect(box("grayscale(1) contrast(2.2)"));
            const hit = found.find((c) => c.rawValue);
            if (hit) {
              stopCamera();
              lookup(hit.rawValue, "camera");
              return;
            }
          }
        } catch {
          /* frame not ready yet */
        }
        window.setTimeout(loop, 120);
      };
      loop();
    } catch (e) {
      setStatus({ kind: "err", text: `Camera unavailable: ${e instanceof Error ? e.message : "permission denied"}` });
      stopCamera();
    }
  }

  useEffect(() => () => stopCamera(), []);

  const dot =
    status.kind === "ok" ? "bg-success" : status.kind === "err" ? "bg-critical" : status.kind === "reading" ? "bg-warning animate-pulse" : "bg-ink-light animate-pulse";

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
          <div className="mt-5 flex items-center gap-3 border border-ink bg-canvas-card px-4 py-4">
            <span className={`h-3 w-3 rounded-full ${dot}`} aria-hidden />
            <p className="text-sm" role="status" aria-live="polite">
              {status.text}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="h-9 rounded-md border border-dashed border-border-hover px-3 text-sm leading-9 text-ink-muted">
              USB scanner: just scan or tap the card
            </span>
            <button className={btn} onClick={phoneNfc} disabled={!support.nfc} title={support.nfc ? "" : "Needs Chrome on Android"}>
              Phone NFC
            </button>
            {cameraOn ? (
              <button className={btn} onClick={stopCamera}>
                Stop camera
              </button>
            ) : (
              <button className={btn} onClick={startCamera} disabled={!support.camera} title={support.camera ? "" : "Camera scanning needs Chrome on Android, macOS or ChromeOS"}>
                Scan barcode with camera
              </button>
            )}
          </div>
          <div className={`relative mt-4 w-full max-w-md border border-ink ${cameraOn ? "" : "hidden"}`}>
            <video ref={videoRef} muted playsInline className="block w-full" />
            {/* guide box: the area that also gets an enlarged second read */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-dashed border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,.28)]"
              style={{ width: `${BOX.w * 100}%`, height: `${BOX.h * 100}%` }}
            />
            <p className="absolute inset-x-0 bottom-2 text-center font-mono text-[11px] text-white/90">Fill the box with the barcode · avoid glare</p>
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lookup(manual, "pasted link");
            }}
          >
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Card code (CW1-…) or chip UID"
              className="h-9 flex-1 rounded-sm border border-border bg-canvas-card px-3 font-mono text-sm focus:border-ink focus:outline-none"
            />
            <button type="submit" className={btn} disabled={manual.trim().length < 4}>
              Look up
            </button>
          </form>
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
