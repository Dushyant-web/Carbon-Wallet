"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";

/*
 * "From a bill to proof": a pinned stage that plays the product's real flow as you scroll.
 *   01 a paper bill tilts in · 02 boxes draw round the numbers we read · 03 the units fly into a CO2
 *   statement · 04 the statement is stamped Sealed.
 * Example values: 342 units × 0.675 kg = 230.9 kg CO2.
 */

const STEPS = [
  { k: "01", title: "Upload your bill", body: "A PDF from your discom's app, or a photo of the paper bill. Nothing to type." },
  { k: "02", title: "We read it", body: "Units, billing dates and the amount are found and boxed on the bill itself, so you can check every number." },
  { k: "03", title: "It becomes CO₂", body: "Each unit is converted with India's official grid figure and shared across the months the bill covers." },
  { k: "04", title: "Sealed for good", body: "Lock the month and it's sealed in a public record. Change one digit later and the check fails." },
];

const useSeg = (p: MotionValue<number>, a: number, b: number) => useTransform(p, [a, b], [0, 1], { clamp: true });

function Box({ show, className, label }: { show: MotionValue<number>; className: string; label: string }) {
  const clip = useTransform(show, (v) => `inset(0 ${100 - v * 100}% 0 0)`);
  const opacity = useTransform(show, [0, 0.2], [0, 1]);
  return (
    <motion.div className={`absolute rounded-[3px] border-2 border-secondary bg-secondary/10 ${className}`} style={{ clipPath: clip, opacity }}>
      <span className="absolute -top-5 left-0 whitespace-nowrap bg-secondary px-1.5 font-mono text-[10px] leading-4 text-white">{label}</span>
    </motion.div>
  );
}

function Counter({ value, decimals = 1 }: { value: MotionValue<number>; decimals?: number }) {
  const [v, setV] = useState(0);
  useMotionValueEvent(value, "change", (x) => setV(x));
  return <>{v.toFixed(decimals)}</>;
}

export function BillStory() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const [step, setStep] = useState(0);
  useMotionValueEvent(p, "change", (v) => setStep(v < 0.22 ? 0 : v < 0.46 ? 1 : v < 0.72 ? 2 : 3));

  // 01 the bill tilts in
  const tiltIn = useSeg(p, 0, 0.2);
  const rotX = useTransform(tiltIn, [0, 1], [58, 14]);
  const rotY = useTransform(tiltIn, [0, 1], [-26, -10]);
  const rotZ = useTransform(tiltIn, [0, 1], [6, 2]);
  const billScale = useTransform(tiltIn, [0, 1], [0.78, 1]);
  const billY = useTransform(tiltIn, [0, 1], ["18%", "0%"]);
  // 02 boxes draw
  const b1 = useSeg(p, 0.24, 0.31);
  const b2 = useSeg(p, 0.3, 0.37);
  const b3 = useSeg(p, 0.36, 0.43);
  // 03 units fly to the statement, which counts up
  const fly = useSeg(p, 0.48, 0.62);
  const chipLeft = useTransform(fly, [0, 1], ["21%", "64%"]);
  const chipTop = useTransform(fly, [0, 0.5, 1], ["57%", "40%", "47%"]);
  const chipScale = useTransform(fly, [0, 0.5, 1], [1, 1.25, 0.9]);
  const chipOpacity = useTransform(fly, [0, 0.05, 0.9, 1], [0, 1, 1, 0]);
  const stmtIn = useSeg(p, 0.46, 0.56);
  const stmtX = useTransform(stmtIn, [0, 1], ["30%", "0%"]);
  const kg = useTransform(useSeg(p, 0.6, 0.7), [0, 1], [0, 230.9]);
  const billDim = useTransform(fly, [0, 1], [1, 0.45]);
  const share = useTransform(kg, [0, 230.9], ["0%", "62%"]);
  // 04 the stamp lands
  const stamp = useSeg(p, 0.76, 0.84);
  const stampScale = useTransform(stamp, [0, 1], [2.4, 1]);
  const stampOpacity = useTransform(stamp, [0, 0.4, 1], [0, 1, 1]);
  const stampRot = useTransform(stamp, [0, 1], [-24, -9]);
  const rail = useTransform(p, [0, 1], ["0%", "100%"]);

  return (
    <section id="story" ref={ref} className="relative" style={{ height: reduce ? "auto" : "440vh" }}>
      <div className={`${reduce ? "" : "sticky top-0 h-[100svh]"} overflow-hidden`}>
        <div className="mx-auto grid h-full max-w-[1440px] grid-cols-1 gap-8 px-5 pb-8 pt-24 md:px-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16 lg:py-0">
          {/* Stage */}
          <div className="relative order-2 h-full min-h-[420px] [perspective:1600px] lg:order-1">
            {/* the bill */}
            <motion.div
              className="absolute left-[2%] top-[12%] w-[62%] max-w-[440px] origin-bottom rounded-[6px] bg-white p-5 shadow-[0_40px_80px_-30px_rgba(40,30,20,.45)] [transform-style:preserve-3d] md:p-7"
              style={reduce ? undefined : { rotateX: rotX, rotateY: rotY, rotateZ: rotZ, scale: billScale, y: billY, opacity: billDim }}
            >
              <div className="flex items-start justify-between border-b border-ink/10 pb-3">
                <div>
                  <p className="font-heading text-lg leading-tight">Electricity Bill</p>
                  <p className="font-mono text-[10px] text-ink-muted">Domestic · Consumer ••••4321</p>
                </div>
                <span className="font-mono text-[10px] text-ink-muted">Bill date 03-04-2026</span>
              </div>
              <dl className="relative mt-4 space-y-3 font-mono text-[11px] md:text-[12px]">
                {(
                  [
                    ["Billing period", "01-03-2026 to 31-03-2026", b1, "Period"],
                    ["Previous reading", "10458", null, ""],
                    ["Present reading", "10800", null, ""],
                    ["Units consumed", "342 kWh", b2, "Units"],
                    ["Energy charges", "₹2,154.60", null, ""],
                    ["Net amount payable", "₹2,486.40", b3, "Amount"],
                  ] as [string, string, MotionValue<number> | null, string][]
                ).map(([k, v, box, label]) => (
                  <div key={k} className="relative flex justify-between gap-4">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                    {box && !reduce && <Box show={box} label={label} className="-inset-x-1.5 -inset-y-1" />}
                  </div>
                ))}
              </dl>
              <div className="mt-6 flex h-16 items-end gap-1.5 border-t border-ink/10 pt-3" aria-hidden>
                {[150, 140, 205, 370, 517, 342].map((h, i) => (
                  <div key={i} className="flex-1 bg-ink/15" style={{ height: `${(h / 517) * 100}%` }} />
                ))}
              </div>
              <p className="mt-1 font-mono text-[9px] text-ink-light">Consumption history (last 6 months)</p>
            </motion.div>

            {/* the units, flying */}
            {!reduce && (
              <motion.div className="absolute z-20" style={{ left: chipLeft, top: chipTop, opacity: chipOpacity }}>
                <div className="-translate-x-1/2 -translate-y-1/2">
                  <motion.div className="whitespace-nowrap rounded-full bg-secondary px-4 py-2 font-mono text-sm text-white shadow-lg" style={{ scale: chipScale }}>
                    342 kWh
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* the statement */}
            <motion.div
              className="absolute right-[2%] top-[30%] w-[48%] max-w-[340px] rounded-[6px] bg-primary p-6 text-canvas shadow-[0_40px_80px_-30px_rgba(20,15,10,.6)]"
              style={reduce ? undefined : { x: stmtX, opacity: stmtIn }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-canvas/60">March 2026 · electricity</p>
              <p className="mt-3 font-heading text-6xl font-light tabular-nums leading-none">
                {reduce ? "230.9" : <Counter value={kg} />}
              </p>
              <p className="mt-1 text-sm text-canvas/70">kg CO₂</p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-canvas/15">
                <motion.div className="h-full bg-secondary" style={{ width: share }} />
              </div>
              <p className="mt-2 font-mono text-[10px] text-canvas/50">62% of the home&apos;s month</p>
              <motion.div
                className="absolute -right-5 -top-6 rounded-md border-[3px] border-double border-[#E8A27F] px-3 py-1.5 font-mono text-sm font-semibold uppercase tracking-[0.2em] text-[#E8A27F]"
                style={reduce ? undefined : { scale: stampScale, opacity: stampOpacity, rotate: stampRot }}
              >
                Sealed ✓
              </motion.div>
            </motion.div>
          </div>

          {/* Steps */}
          <div className="order-1 flex flex-col justify-center lg:order-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">From a bill to proof</p>
            <h2 className="mt-3 font-heading text-[clamp(2.4rem,4.6vw,4.4rem)] font-light leading-[0.95] tracking-[-0.03em]">
              The bill you already pay is the <em className="italic text-secondary">best data</em> you have.
            </h2>
            <div className="mt-10 flex gap-6">
              <div className="relative hidden w-px shrink-0 bg-ink/15 lg:block">
                <motion.div className="absolute inset-x-0 top-0 bg-secondary" style={{ height: rail }} />
              </div>
              <ol className="flex flex-col gap-6">
                {STEPS.map((s, i) => (
                  <motion.li
                    key={s.k}
                    animate={{ opacity: reduce || step === i ? 1 : 0.32, x: reduce || step === i ? 0 : -6 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="grid grid-cols-[44px_1fr] gap-2"
                  >
                    <span className="font-mono text-xs text-secondary">{s.k}</span>
                    <div>
                      <p className="font-heading text-2xl">{s.title}</p>
                      <p className="mt-1 max-w-sm text-[15px] leading-relaxed text-ink-muted">{s.body}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
