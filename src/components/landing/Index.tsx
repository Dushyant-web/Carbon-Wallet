"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { RevealLines } from "./Atmosphere";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ what's inside */

type Feature = { name: string; line: string; viz: "bars" | "box" | "line" | "ring" | "stamp" | "rank" | "fuel" | "split" };
const FEATURES: Feature[] = [
  { name: "Electricity bills", line: "Upload a PDF or a photo; the units are read and boxed for you.", viz: "box" },
  { name: "Insights", line: "Which month, which appliance, which vehicle, and why.", viz: "bars" },
  { name: "AC & heat", line: "Your AC's real power, and the summer split into heat and habit.", viz: "split" },
  { name: "Fuel from a photo", line: "Snap the pump screen; litres become exact CO₂.", viz: "fuel" },
  { name: "What if", line: "Fewer AC hours, an EV, rooftop solar: see the kg before you spend.", viz: "line" },
  { name: "Challenges", line: "Daily habits with streaks, points and badges.", viz: "ring" },
  { name: "Leaderboard", line: "Rank per person against every home with data.", viz: "rank" },
  { name: "Carbon ID & card", line: "A passbook, and a card with a private barcode and tap chip.", viz: "stamp" },
];

function Viz({ kind }: { kind: Feature["viz"] }) {
  const common = { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.9, ease: EASE } };
  switch (kind) {
    case "bars":
      return (
        <div className="flex h-24 items-end gap-2">
          {[40, 62, 55, 90, 74, 48].map((h, i) => (
            <motion.div key={i} className={i === 3 ? "flex-1 bg-secondary" : "flex-1 bg-canvas/40"} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.7, ease: EASE, delay: i * 0.05 }} />
          ))}
        </div>
      );
    case "box":
      return (
        <div className="space-y-2 font-mono text-[11px] text-canvas/70">
          <p>Billing period · 01-03 → 31-03</p>
          <p className="relative inline-block px-1">
            Units consumed · 342 kWh
            <motion.span className="absolute inset-0 border-2 border-secondary" initial={{ clipPath: "inset(0 100% 0 0)" }} animate={{ clipPath: "inset(0 0% 0 0)" }} transition={{ duration: 0.7, ease: EASE }} />
          </p>
          <p>Net payable · ₹2,486.40</p>
        </div>
      );
    case "line":
      return (
        <svg viewBox="0 0 200 80" className="h-24 w-full">
          <motion.path d="M0 20 C 50 22, 80 30, 110 46 S 170 70, 200 72" fill="none" stroke="#E8A27F" strokeWidth="3" {...common} />
          <path d="M0 20 C 50 20, 120 18, 200 20" fill="none" stroke="rgba(244,241,234,.35)" strokeWidth="2" strokeDasharray="4 5" />
        </svg>
      );
    case "ring":
      return (
        <svg viewBox="0 0 80 80" className="h-24 w-24">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(244,241,234,.2)" strokeWidth="8" />
          <motion.circle cx="40" cy="40" r="32" fill="none" stroke="#E8A27F" strokeWidth="8" strokeLinecap="round" transform="rotate(-90 40 40)" initial={{ pathLength: 0 }} animate={{ pathLength: 0.72 }} transition={{ duration: 0.9, ease: EASE }} />
          <text x="40" y="46" textAnchor="middle" fontSize="18" fill="#F4F1EA" fontFamily="var(--font-newsreader)">10/14</text>
        </svg>
      );
    case "stamp":
      return (
        <motion.div className="inline-block rotate-[-8deg] rounded border-[3px] border-double border-[#E8A27F] px-4 py-2 font-mono text-sm font-semibold uppercase tracking-[0.2em] text-[#E8A27F]" initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.45, ease: EASE }}>
          CW-XX-26-0000-0
        </motion.div>
      );
    case "rank":
      return (
        <div className="space-y-1.5 font-mono text-[12px] text-canvas/70">
          {["#1 · 33 kg", "#2 · 44 kg", "#3 · 45 kg"].map((r, i) => (
            <motion.p key={r} initial={{ x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.08, ease: EASE }} className={i === 0 ? "text-[#E8A27F]" : ""}>
              {r}
            </motion.p>
          ))}
        </div>
      );
    case "fuel":
      return (
        <div className="font-mono text-canvas/80">
          <p className="text-[11px] text-canvas/50">VOLUME (L)</p>
          <motion.p className="text-3xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            20.73
          </motion.p>
          <p className="mt-1 text-[12px] text-[#E8A27F]">= 47.9 kg CO₂</p>
        </div>
      );
    case "split":
      return (
        <div className="flex h-8 w-full overflow-hidden">
          <motion.div className="bg-canvas/40" initial={{ width: 0 }} animate={{ width: "45%" }} transition={{ duration: 0.6, ease: EASE }} />
          <motion.div className="bg-[#B7862B]" initial={{ width: 0 }} animate={{ width: "20%" }} transition={{ duration: 0.5, ease: EASE, delay: 0.4 }} />
          <motion.div className="bg-secondary" initial={{ width: 0 }} animate={{ width: "35%" }} transition={{ duration: 0.5, ease: EASE, delay: 0.7 }} />
        </div>
      );
  }
}

export function FeatureIndex() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 180, damping: 22, mass: 0.5 });
  const y = useSpring(my, { stiffness: 180, damping: 22, mass: 0.5 });

  return (
    <section id="inside" className="mx-auto max-w-[1440px] px-5 py-28 md:px-10 md:py-40">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">What&apos;s inside</p>
      <RevealLines
        className="mt-4 max-w-4xl font-heading text-[clamp(2.6rem,5.4vw,5.2rem)] font-light leading-[0.95] tracking-[-0.03em]"
        lines={["Eight tools.", <em key="e" className="italic text-secondary">One honest number.</em>]}
      />
      <ul
        className="relative mt-16 border-t border-ink/15"
        onPointerMove={(e) => {
          mx.set(e.clientX + 24);
          my.set(e.clientY - 90);
        }}
        onPointerLeave={() => setActive(null)}
      >
        {FEATURES.map((f, i) => (
          <li
            key={f.name}
            onPointerEnter={() => setActive(i)}
            className="group relative grid cursor-default grid-cols-[44px_1fr] items-baseline gap-4 border-b border-ink/15 py-6 md:grid-cols-[80px_minmax(0,1.1fr)_minmax(0,1fr)] md:py-8"
          >
            <span className="font-mono text-xs text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
            <span className="font-heading text-[clamp(1.9rem,3.6vw,3.4rem)] font-light leading-none tracking-[-0.02em] transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:translate-x-4 group-hover:italic group-hover:text-secondary">
              {f.name}
            </span>
            <span className="col-start-2 text-[15px] text-ink-muted md:col-start-3">{f.line}</span>
          </li>
        ))}
      </ul>
      {!reduce && (
        <motion.div className="pointer-events-none fixed left-0 top-0 z-40 hidden w-64 md:block" style={{ x, y }}>
          <AnimatePresence mode="wait">
            {active !== null && (
              <motion.div
                key={active}
                className="rounded-xl bg-primary p-5 text-canvas shadow-[0_30px_60px_-20px_rgba(20,15,10,.55)]"
                initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
                animate={{ opacity: 1, scale: 1, rotate: -2 }}
                exit={{ opacity: 0, scale: 0.9, rotate: 2 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-canvas/50">{FEATURES[active].name}</p>
                <Viz kind={FEATURES[active].viz} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ proof, live */

async function fingerprint(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const HEX = "0123456789abcdef";

/** A short code that scrambles for a moment whenever it changes, then settles. */
function Scramble({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setShown(value.split("").map((c, i) => (i < frame * 2 ? c : HEX[Math.floor(Math.random() * 16)])).join(""));
      if (frame * 2 >= value.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [value, reduce]);
  return <>{shown}</>;
}

export function ProofDemo() {
  const [kg, setKg] = useState(286);
  const [sealed, setSealed] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const statement = `Carbon Wallet · CW-XX-26-0000-0 · March 2026 · ${kg} kg CO2`;
  useEffect(() => {
    fingerprint(statement).then(setCurrent);
  }, [statement]);
  const matches = sealed !== null && sealed === current;
  const broken = sealed !== null && sealed !== current;
  const short = (h: string) => (h ? `${h.slice(0, 10)}…${h.slice(-10)}` : "");

  return (
    <section id="proof" data-dark className="relative overflow-hidden bg-[#141311] text-canvas">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-16 px-5 py-28 md:px-10 md:py-40 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-canvas/50">Proof, not promises</p>
          <RevealLines
            className="mt-4 font-heading text-[clamp(2.6rem,5.4vw,5.2rem)] font-light leading-[0.95] tracking-[-0.03em]"
            lines={["Numbers nobody", <em key="e" className="italic text-[#E8A27F]">can quietly change.</em>]}
          />
          <p className="mt-8 max-w-md text-[17px] leading-relaxed text-canvas/65">
            Lock a month and its totals become a fingerprint, sealed in a public record that nobody, including us, can edit.
            Your name and address never leave Carbon Wallet. Try it: seal the month, then try to sneak a number past it.
          </p>
        </div>

        <div className="flex flex-col justify-center">
          <motion.div
            className={`relative rounded-2xl border p-7 transition-colors duration-500 ${broken ? "border-[#E36E5A]" : matches ? "border-[#7FB08E]" : "border-canvas/15"}`}
            animate={broken ? { x: [0, -10, 9, -6, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-canvas/50">March 2026 · a sample home</p>
            <div className="mt-4 flex items-baseline gap-3">
              <motion.span key={kg} className="font-heading text-7xl font-light tabular-nums" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                {kg}
              </motion.span>
              <span className="text-canvas/60">kg CO₂</span>
            </div>
            <p className="mt-6 font-mono text-[11px] text-canvas/45">fingerprint</p>
            <p className="font-mono text-[13px] tracking-wider text-canvas/85">
              <Scramble value={short(current)} />
            </p>

            <AnimatePresence>
              {sealed && (
                <motion.div
                  key={broken ? "broken" : "ok"}
                  className={`absolute -right-3 -top-5 rotate-[-8deg] rounded-md border-[3px] border-double px-3 py-1.5 font-mono text-sm font-semibold uppercase tracking-[0.18em] ${broken ? "border-[#E36E5A] text-[#E36E5A]" : "border-[#7FB08E] text-[#7FB08E]"}`}
                  initial={{ scale: 2.2, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, opacity: 1, rotate: -8 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  {broken ? "Doesn't match ✗" : "Sealed ✓"}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => {
                setKg(286);
                fingerprint(`Carbon Wallet · CW-XX-26-0000-0 · March 2026 · 286 kg CO2`).then(setSealed);
              }}
              className="h-12 rounded-full bg-canvas px-6 text-sm font-medium text-ink transition-transform active:scale-95"
            >
              {sealed ? "Seal again" : "1 · Seal March"}
            </button>
            <button
              disabled={!sealed}
              onClick={() => setKg((k) => (k === 286 ? 311 : 286))}
              className="h-12 rounded-full border border-canvas/30 px-6 text-sm transition-transform hover:border-canvas active:scale-95 disabled:opacity-30"
            >
              {kg === 286 ? "2 · Try to change it to 311" : "Put it back to 286"}
            </button>
          </div>
          <p className="mt-4 min-h-[1.5em] text-sm text-canvas/60">
            {broken
              ? "Caught. One changed digit makes a completely different fingerprint, so the seal no longer matches."
              : matches
                ? "Genuine: this is exactly what was sealed."
                : "Not sealed yet."}
          </p>
        </div>
      </div>
    </section>
  );
}
