"use client";

import React, { useEffect, useRef, useState } from "react";

export type ScanStatus = { kind: "idle" | "reading" | "ok" | "err"; text: string };

const btn = "h-9 rounded-md border border-border bg-canvas-card px-3 text-sm hover:border-ink disabled:opacity-45";

// Middle of the frame that the guide box marks and that is enlarged for a second read
const BOX = { w: 0.7, h: 0.42 };

/**
 * Reads a Carbon Card four ways and hands whatever it read to `onRead`: a USB barcode or NFC reader (it types the
 * card code or chip serial, then Enter), a phone with NFC, the camera (barcode on the card's back), or a typed code.
 * Used by the admin kiosk and the shop counter; the page decides what a read means.
 */
export function CardScanner({
  onRead,
  status,
  onStatus,
  listening = true,
  placeholder = "Card code (CW1-…) or chip UID",
  submitLabel = "Look up",
}: {
  onRead: (input: string, source: string) => void;
  status: ScanStatus;
  onStatus: (s: ScanStatus) => void;
  /** whether a USB "keyboard" reader is listened for (off while a form on the page has the keyboard) */
  listening?: boolean;
  placeholder?: string;
  submitLabel?: string;
}) {
  const [manual, setManual] = useState("");
  const [support, setSupport] = useState({ nfc: false, camera: false });
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  useEffect(() => {
    setSupport({ nfc: "NDEFReader" in window, camera: "BarcodeDetector" in window && !!navigator.mediaDevices });
  }, []);

  // USB "keyboard wedge" readers type the code very fast and press Enter.
  useEffect(() => {
    if (!listening) return;
    let buffer = "";
    let last = 0;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      const now = performance.now();
      if (now - last > 80) buffer = ""; // humans type slower than readers
      last = now;
      if (e.key === "Enter") {
        if (buffer.length >= 8) onReadRef.current(buffer, "USB reader");
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening]);

  async function phoneNfc() {
    onStatus({ kind: "reading", text: "Hold the card against the back of this phone…" });
    try {
      const ndef = new NDEFReader();
      ndef.onreading = (event) => {
        // Cards carry their code as a text record (CardStudio writes it); older ones may hold a link. Paired chips
        // without either still resolve by their serial.
        const record =
          event.message.records.find((r) => r.recordType === "text" && r.data) ??
          event.message.records.find((r) => r.recordType === "url" && r.data);
        const read = record?.data ? new TextDecoder(record.encoding || "utf-8").decode(record.data).trim() : "";
        onReadRef.current(read || event.serialNumber, "phone NFC");
      };
      await ndef.scan();
    } catch (e) {
      onStatus({ kind: "err", text: `NFC unavailable: ${e instanceof Error ? e.message : "unknown error"}` });
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
      onStatus({ kind: "reading", text: "Hold the barcode on the back of the card inside the box…" });
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
              onReadRef.current(hit.rawValue, "camera");
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
      onStatus({ kind: "err", text: `Camera unavailable: ${e instanceof Error ? e.message : "permission denied"}` });
      stopCamera();
    }
  }

  useEffect(() => () => stopCamera(), []);

  const dot =
    status.kind === "ok" ? "bg-success" : status.kind === "err" ? "bg-critical" : status.kind === "reading" ? "bg-warning animate-pulse" : "bg-ink-light animate-pulse";

  return (
    <div>
      <div className="flex items-center gap-3 border border-ink bg-canvas-card px-4 py-4">
        <span className={`h-3 w-3 shrink-0 rounded-full ${dot}`} aria-hidden />
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
          onRead(manual, "typed code");
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 min-w-0 flex-1 rounded-sm border border-border bg-canvas-card px-3 font-mono text-sm focus:border-ink focus:outline-none"
        />
        <button type="submit" className={btn} disabled={manual.trim().length < 4}>
          {submitLabel}
        </button>
      </form>
    </div>
  );
}
