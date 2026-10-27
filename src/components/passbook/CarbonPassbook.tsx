"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { code128Path } from "@/lib/code128";
import { InkFilterDefs, Stamp, type StampStatus } from "./Stamp";

export type PassbookView = {
  carbonId: string;
  household: { name: string; city: string; state: string; size: number; issuedOn: string };
  current: { totalKg: number; perPersonKg: number; label?: string };
  inProgress?: { label: string; totalKg: number } | null;
  months: { month: string; label: string; totalKg: number; deltaPct: number | null; status: StampStatus; batchId: number | null }[];
};

const PAPER = "#FBFAF7";
const RULE = "#E8E2D5";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function CarbonPassbook({
  data,
  publicPath,
  defaultOpen = false,
  sample = false,
  openOnHash,
  cardCode,
  showShare = true,
}: {
  data: PassbookView;
  publicPath: string;
  /** The household's private card code; shown only to its members. */
  cardCode?: string;
  /** Show the "copy public link" / "open public record" actions (the owner's choice to share). */
  showShare?: boolean;
  defaultOpen?: boolean;
  sample?: boolean;
  /** Opens the book on load when the URL hash matches, e.g. "#passbook-open". */
  openOnHash?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [stampsLive, setStampsLive] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const target = useRef({ rx: 0, ry: 0, gx: 50, gy: 30 });
  const current = useRef({ rx: 0, ry: 0, gx: 50, gy: 30 });
  const frame = useRef<number | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    setOrigin(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
  }, []);

  useEffect(() => {
    if (openOnHash && window.location.hash === openOnHash) {
      setOpen(true);
      window.setTimeout(() => setStampsLive(true), 650);
    }
  }, [openOnHash]);
  const publicUrl = origin ? `${origin}${publicPath}` : publicPath;

  // Smooth tilt: lerp toward the pointer target in rAF and write CSS variables (no React re-render per move).
  const tick = useCallback(() => {
    const c = current.current;
    const t = target.current;
    c.rx += (t.rx - c.rx) * 0.12;
    c.ry += (t.ry - c.ry) * 0.12;
    c.gx += (t.gx - c.gx) * 0.12;
    c.gy += (t.gy - c.gy) * 0.12;
    const el = tiltRef.current;
    if (el) {
      el.style.setProperty("--rx", `${c.rx.toFixed(2)}deg`);
      el.style.setProperty("--ry", `${c.ry.toFixed(2)}deg`);
      el.style.setProperty("--gx", `${c.gx.toFixed(1)}%`);
      el.style.setProperty("--gy", `${c.gy.toFixed(1)}%`);
    }
    const settled = Math.abs(t.rx - c.rx) < 0.01 && Math.abs(t.ry - c.ry) < 0.01 && Math.abs(t.gx - c.gx) < 0.1;
    frame.current = settled ? null : requestAnimationFrame(tick);
  }, []);

  const kick = useCallback(() => {
    if (frame.current === null) frame.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  function onPointerMove(e: React.PointerEvent) {
    if (reduced || e.pointerType === "touch") return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const amp = open ? 3 : 9;
    target.current = { rx: (0.5 - py) * amp, ry: (px - 0.5) * amp * 1.4, gx: px * 100, gy: py * 100 };
    kick();
  }

  function onPointerLeave() {
    target.current = { rx: 0, ry: 0, gx: 50, gy: 30 };
    kick();
  }

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next) {
        setStampsLive(false);
        window.setTimeout(() => setStampsLive(true), reduced ? 0 : 650);
      }
      return next;
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: nothing else to do */
    }
  }


  const idBody = data.carbonId.slice(0, -1);
  const idCheck = data.carbonId.slice(-1);
  const issued = new Date(data.household.issuedOn).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const flipMs = reduced ? 0 : 950;

  return (
    <div className="w-full">
      <InkFilterDefs />
      <div className="overflow-x-auto pb-2">
        <div
          ref={stageRef}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          className="relative mx-auto w-full min-w-[560px] max-w-[780px]"
          style={{ aspectRatio: "780 / 500", perspective: "2400px", containerType: "inline-size" }}
        >
          {/* slide: closed book sits centred, open book uses full spread */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translateX(${open ? "0%" : "-25%"})`,
              transition: `transform ${flipMs * 0.8}ms cubic-bezier(.3,.7,.2,1)`,
            }}
          >
            {/* tilt layer, driven by CSS variables from the rAF loop */}
            <div
              ref={tiltRef}
              className="absolute inset-0"
              style={{
                transformStyle: "preserve-3d",
                transform: "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
              }}
            >
              {/* RIGHT PAGE: statement ledger (under the cover) */}
              <div
                className="absolute right-0 top-0 h-full w-1/2"
                style={{
                  background: PAPER,
                  borderRadius: "0 8px 8px 0",
                  boxShadow:
                    "1px 0 0 #E2DCCF, 2px 1px 0 #FBFAF7, 3px 1px 0 #E2DCCF, 4px 2px 0 #FBFAF7, 5px 2px 0 #DCD5C6, 0 26px 40px -18px rgba(29,28,24,.45)",
                  backgroundImage: "linear-gradient(to right, rgba(29,28,24,.10), transparent 7%)",
                }}
              >
                <div className="flex h-full flex-col px-[3.2cqw] pb-[2.4cqw] pt-[2.6cqw]">
                  <div className="flex items-baseline justify-between border-b-2 border-ink pb-[0.6cqw]">
                    <span className="font-mono text-[1.15cqw] uppercase tracking-[0.16em] text-ink-muted">Statement of emissions</span>
                    <span className="font-mono text-[1.05cqw] text-ink-muted">kg CO₂e · p.1</span>
                  </div>
                  <div className="grid grid-cols-[1.15fr_0.9fr_0.8fr_1.35fr] items-end py-[0.6cqw] font-mono text-[1.05cqw] uppercase tracking-[0.1em] text-ink-muted">
                    <span>Month</span>
                    <span className="text-right">kg</span>
                    <span className="text-right">Change</span>
                    <span className="text-center">Status</span>
                  </div>
                  <div className="flex-1">
                    {data.months.map((m, i) => (
                      <div
                        key={m.month}
                        className="grid grid-cols-[1.15fr_0.9fr_0.8fr_1.35fr] items-center"
                        style={{ height: "4.4cqw", borderBottom: `1px solid ${RULE}` }}
                      >
                        <span className="font-heading text-[1.75cqw]">{m.label}</span>
                        <span className="text-right font-mono text-[1.6cqw] tabular-nums">{m.totalKg}</span>
                        <span
                          className={`text-right font-mono text-[1.25cqw] tabular-nums ${
                            m.deltaPct === null ? "text-ink-light" : m.deltaPct <= 0 ? "text-success-text" : "text-critical-text"
                          }`}
                        >
                          {m.deltaPct === null ? "—" : `${m.deltaPct > 0 ? "+" : ""}${m.deltaPct}%`}
                        </span>
                        <span className="flex justify-center">
                          {open && stampsLive ? (
                            <Stamp
                              status={m.status}
                              sub={m.status === "ANCHORED" && m.batchId ? `batch #${m.batchId}` : undefined}
                              stampKey={m.month}
                              animate={!reduced}
                              delayMs={i * 110}
                              className="text-[1.15cqw]"
                            />
                          ) : (
                            <span className="h-[2.6cqw]" />
                          )}
                        </span>
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 7 - data.months.length) }).map((_, i) => (
                      <div key={`blank-${i}`} style={{ height: "4.4cqw", borderBottom: `1px solid ${RULE}` }} aria-hidden />
                    ))}
                    {data.months.length === 0 && (
                      <p className="pt-[2cqw] text-[1.4cqw] text-ink-muted">No months recorded yet. Log an activity to open your first entry.</p>
                    )}
                  </div>
                  <div className="mt-[1cqw] flex items-end justify-between border-t-2 border-ink pt-[0.8cqw]">
                    <div>
                      <span className="font-mono text-[1.05cqw] uppercase tracking-[0.14em] text-ink-muted">
                        Balance{data.current.label ? ` · ${data.current.label}` : " this month"}
                      </span>
                      <p className="font-heading text-[3cqw] leading-none tabular-nums">
                        {data.current.totalKg}
                        <span className="ml-[0.5cqw] font-mono text-[1.2cqw] text-ink-muted">kg · {data.current.perPersonKg} per person</span>
                      </p>
                    </div>
                    <span className="text-right font-mono text-[0.95cqw] text-ink-muted">
                      {data.inProgress ? <>{data.inProgress.label} so far: {data.inProgress.totalKg} kg<br /></> : null}
                      Based on bills & logs
                    </span>
                  </div>
                </div>
              </div>

              {/* COVER: hinged at the spine; its inside face becomes the left page */}
              <div
                className="absolute right-0 top-0 h-full w-1/2"
                style={{
                  transformOrigin: "left center",
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${open ? -179 : 0}deg)`,
                  transition: `transform ${flipMs}ms cubic-bezier(.25,.75,.2,1)`,
                }}
              >
                {/* cover front */}
                <div
                  onClick={toggle}
                  className="absolute inset-0 cursor-pointer overflow-hidden"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    borderRadius: "4px 10px 10px 4px",
                    background:
                      "radial-gradient(130% 120% at 20% 0%, #2C4733 0%, #22372A 38%, #16241B 100%)",
                    boxShadow: "inset 6px 0 10px -6px rgba(0,0,0,.6), 0 30px 50px -22px rgba(22,36,27,.7)",
                  }}
                >
                  {/* cloth weave */}
                  <div
                    className="absolute inset-0 opacity-[0.16]"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, rgba(255,255,255,.12) 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, rgba(0,0,0,.25) 0 1px, transparent 1px 3px)",
                    }}
                  />
                  {/* spine crease */}
                  <div className="absolute inset-y-0 left-[3.2cqw] w-px bg-black/40 shadow-[1px_0_0_rgba(255,255,255,.06)]" />
                  {/* sheen follows the pointer */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: "radial-gradient(circle at var(--gx, 50%) var(--gy, 30%), rgba(255,240,210,.16), transparent 42%)" }}
                  />
                  {/* blind-embossed frame */}
                  <div
                    className="absolute inset-[2.4cqw] left-[5cqw] rounded-[6px]"
                    style={{ boxShadow: "inset 0 0 0 1px rgba(235,211,155,.35), inset 0 0 0 5px transparent, inset 0 0 0 6px rgba(235,211,155,.18)" }}
                  />
                  <div className="relative flex h-full flex-col items-center justify-between py-[5cqw] pl-[3cqw] text-center">
                    <div className="flex flex-col items-center">
                      <Emblem />
                      <span className="cw-foil mt-[1.2cqw] font-mono text-[1.15cqw] uppercase tracking-[0.42em]">Carbon Wallet</span>
                    </div>
                    <div>
                      <p className="cw-foil font-heading text-[4.6cqw] font-medium leading-[1.05] tracking-tight">
                        Carbon
                        <br />
                        Passbook
                      </p>
                      <div className="mx-auto mt-[1.6cqw] h-px w-[10cqw] bg-[rgba(235,211,155,.5)]" />
                      <p className="cw-foil mt-[1.6cqw] font-heading text-[2.2cqw] italic">{data.household.name}</p>
                    </div>
                    <div>
                      <span className="font-mono text-[0.95cqw] uppercase tracking-[0.3em] text-[rgba(235,211,155,.6)]">Carbon ID</span>
                      <p className="cw-foil mt-[0.4cqw] font-mono text-[2.1cqw] font-semibold tracking-[0.14em]">{data.carbonId}</p>
                    </div>
                  </div>
                </div>

                {/* cover inside = left page */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{
                    transform: "rotateY(180deg)",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    borderRadius: "8px 0 0 8px",
                    background: PAPER,
                    backgroundImage: "linear-gradient(to left, rgba(29,28,24,.12), transparent 8%)",
                    boxShadow: "-1px 0 0 #E2DCCF, -2px 1px 0 #FBFAF7, -3px 1px 0 #E2DCCF, 0 26px 40px -18px rgba(29,28,24,.45)",
                  }}
                >
                  <div className="flex h-full flex-col px-[3.2cqw] pb-[2.4cqw] pt-[2.6cqw]">
                    <div className="flex items-baseline justify-between border-b-2 border-ink pb-[0.6cqw]">
                      <span className="font-mono text-[1.15cqw] uppercase tracking-[0.16em] text-ink-muted">Account holder</span>
                      <span className="font-mono text-[1.05cqw] text-ink-muted">{sample ? "Sample" : "Issued " + issued}</span>
                    </div>
                    <p className="mt-[1.6cqw] font-heading text-[3.4cqw] leading-none tracking-tight">{data.household.name}</p>
                    <dl className="mt-[1.4cqw] grid grid-cols-2 gap-y-[0.7cqw] text-[1.35cqw]">
                      <dt className="text-ink-muted">Location</dt>
                      <dd>{data.household.city}, {data.household.state}</dd>
                      <dt className="text-ink-muted">Household of</dt>
                      <dd>{data.household.size} people</dd>
                      <dt className="text-ink-muted">Account</dt>
                      <dd className="text-success-text">Active</dd>
                    </dl>

                    <div className="mt-[1.8cqw] border border-ink px-[1.4cqw] py-[1cqw]">
                      <span className="font-mono text-[1cqw] uppercase tracking-[0.2em] text-ink-muted">Carbon ID</span>
                      <p className="mt-[0.3cqw] font-mono text-[2.4cqw] font-semibold tracking-[0.1em]">
                        {idBody}
                        <span className="text-secondary">{idCheck}</span>
                      </p>
                      <p className="font-mono text-[0.95cqw] text-ink-muted">Last digit is a check digit</p>
                    </div>

                    <div className="mt-auto">
                      {cardCode ? (
                        <>
                          <div className="bg-white px-[1cqw] pb-[0.6cqw] pt-[0.8cqw] ring-1 ring-border">
                            <svg viewBox="0 0 100 22" className="block h-[6cqw] w-full" aria-label="Private card barcode">
                              <path d={code128Path(cardCode, 0, 0, 100, 22)} fill="#1D1C18" />
                            </svg>
                            <p className="mt-[0.3cqw] text-center font-mono text-[1.15cqw] tracking-[0.15em]">
                              CW1-{cardCode.slice(3, 7)}-{cardCode.slice(7, 11)}-{cardCode.slice(11, 15)}
                            </p>
                          </div>
                          <p className="mt-[0.6cqw] text-[1.05cqw] leading-snug text-ink-muted">
                            Private card code. Only Carbon Wallet can read it; other scanners see just the code.
                          </p>
                        </>
                      ) : (
                        <p className="border-t border-border pt-[0.8cqw] text-[1.1cqw] leading-snug text-ink-muted">
                          Totals only. No names or personal data are ever shown.
                        </p>
                      )}
                    </div>

                    <div className="mt-[1.6cqw] flex items-end justify-between border-t border-border pt-[0.8cqw]">
                      <span className="font-heading text-[2cqw] italic text-ink">Carbon Wallet</span>
                      <span className="font-mono text-[0.95cqw] uppercase tracking-[0.14em] text-ink-muted">Authorised issuer</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls (keyboard + screen-reader friendly; the cover itself is mouse-only) */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={toggle}
          aria-expanded={open}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          {open ? "Close passbook" : "Open passbook"}
        </button>
        {showShare && (
          <>
            <button onClick={copyLink} className="h-9 rounded-md border border-border bg-canvas-card px-4 text-sm hover:border-ink">
              {copied ? "Link copied ✓" : "Share public link"}
            </button>
            <a href={publicPath} target="_blank" rel="noreferrer" className="h-9 px-3 text-sm leading-9 text-ink-muted underline hover:text-ink">
              Open public record ↗
            </a>
          </>
        )}
      </div>
      {!open && <p className="mt-2 text-center font-mono text-[11px] text-ink-muted">Click the cover to open</p>}
    </div>
  );
}

function Emblem() {
  return (
    <svg viewBox="0 0 64 64" className="h-[6.4cqw] w-[6.4cqw]" aria-hidden>
      <defs>
        <linearGradient id="cw-foil-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4E6C4" />
          <stop offset=".45" stopColor="#CBA04A" />
          <stop offset=".7" stopColor="#EBD39B" />
          <stop offset="1" stopColor="#996D20" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="none" stroke="url(#cw-foil-g)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="url(#cw-foil-g)" strokeWidth="0.75" />
      {Array.from({ length: 36 }).map((_, i) => {
        const a = (i / 36) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={(32 + Math.cos(a) * 26.5).toFixed(3)}
            y1={(32 + Math.sin(a) * 26.5).toFixed(3)}
            x2={(32 + Math.cos(a) * 28.5).toFixed(3)}
            y2={(32 + Math.sin(a) * 28.5).toFixed(3)}
            stroke="url(#cw-foil-g)"
            strokeWidth="0.8"
          />
        );
      })}
      <rect x="21" y="20" width="22" height="24" rx="1.5" fill="none" stroke="url(#cw-foil-g)" strokeWidth="1.4" />
      <line x1="24.5" y1="27" x2="39.5" y2="27" stroke="url(#cw-foil-g)" strokeWidth="1.2" />
      <line x1="24.5" y1="32" x2="39.5" y2="32" stroke="url(#cw-foil-g)" strokeWidth="1.2" />
      <line x1="24.5" y1="37" x2="34" y2="37" stroke="url(#cw-foil-g)" strokeWidth="1.2" />
      <rect x="36.5" y="35.5" width="3" height="3" fill="#B4532F" />
    </svg>
  );
}
