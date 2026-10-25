"use client";

import React, { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { CarbonPassbook, type PassbookView } from "@/components/passbook/CarbonPassbook";
import { RevealLines, Rise } from "./Atmosphere";

const EASE = [0.16, 1, 0.3, 1] as const;

function CountUp({ to, decimals = 0, suffix = "", prefix = "", duration = 1.8 }: { to: number; decimals?: number; suffix?: string; prefix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: "some" });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, reduce, to, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ heat or habit */

// An illustrative month-on-month AC story: 160 kg in April → 340 kg in May, of which +68 kg is the
// heat and +112 kg is how long the AC ran.
const TEMPS = [31, 32, 31, 33, 34, 33, 35, 36, 35, 34, 36, 37, 38, 37, 36, 38, 39, 40, 39, 38, 40, 41, 40, 39, 41, 42, 41, 40, 42, 41];

export function HeatHabit() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduce = useReducedMotion();
  const play = inView || !!reduce;
  const W = 600;
  const H = 120;
  const path = TEMPS.map((t, i) => `${i === 0 ? "M" : "L"} ${(i / (TEMPS.length - 1)) * W} ${H - ((t - 29) / 14) * H}`).join(" ");
  const max = 340;
  const bar = (kg: number) => `${(kg / max) * 100}%`;

  return (
    <section id="heat" className="mx-auto max-w-[1440px] px-5 py-28 md:px-10 md:py-40">
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">Heat or habit</p>
          <RevealLines
            className="mt-4 font-heading text-[clamp(2.6rem,5.4vw,5.2rem)] font-light leading-[0.95] tracking-[-0.03em]"
            lines={["Was it the heatwave,", <em key="e" className="italic text-secondary">or the AC left on?</em>]}
          />
          <Rise delay={0.2}>
            <p className="mt-8 max-w-md text-[17px] leading-relaxed text-ink-muted">
              We pull the real temperature for every day of your bill in your city. Then the rise splits cleanly into what the
              weather did and what you did, and only one of them is yours to fix.
            </p>
          </Rise>
        </div>

        <div ref={ref} className="relative">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">Daily temperature · May</p>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full overflow-visible" aria-hidden>
            <motion.path
              d={path}
              fill="none"
              stroke="#B7862B"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reduce ? 1 : 0 }}
              animate={{ pathLength: play ? 1 : 0 }}
              transition={{ duration: 1.8, ease: EASE }}
            />
          </svg>

          <div className="mt-10 grid grid-cols-[90px_1fr] items-center gap-x-5 gap-y-5">
            <span className="font-mono text-xs text-ink-muted">April</span>
            <div className="h-12 bg-canvas-subtle">
              <motion.div
                className="h-full bg-ink/80"
                initial={{ width: reduce ? bar(160) : 0 }}
                animate={{ width: play ? bar(160) : 0 }}
                transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
              />
            </div>
            <span className="font-mono text-xs text-ink-muted">May</span>
            <div className="flex h-12 bg-canvas-subtle">
              <motion.div className="h-full bg-ink/80" initial={{ width: reduce ? bar(160) : 0 }} animate={{ width: play ? bar(160) : 0 }} transition={{ duration: 1.2, ease: EASE, delay: 0.45 }} />
              <motion.div className="h-full bg-warning" initial={{ width: reduce ? bar(68) : 0 }} animate={{ width: play ? bar(68) : 0 }} transition={{ duration: 0.9, ease: EASE, delay: 1.5 }} />
              <motion.div className="h-full bg-secondary" initial={{ width: reduce ? bar(112) : 0 }} animate={{ width: play ? bar(112) : 0 }} transition={{ duration: 0.9, ease: EASE, delay: 2.2 }} />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6 border-t border-ink/15 pt-6">
            <div>
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
                <span className="h-2.5 w-2.5 bg-warning" /> The weather
              </p>
              <p className="mt-2 font-heading text-5xl font-light">
                +{play ? <CountUp to={68} /> : 0}
                <span className="ml-1 text-lg text-ink-muted">kg</span>
              </p>
            </div>
            <div>
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
                <span className="h-2.5 w-2.5 bg-secondary" /> Your AC use
              </p>
              <p className="mt-2 font-heading text-5xl font-light text-secondary">
                +{play ? <CountUp to={112} /> : 0}
                <span className="ml-1 text-lg text-ink-muted">kg</span>
              </p>
            </div>
          </div>
          <p className="mt-4 font-mono text-[10px] text-ink-light">Illustration. Your own split uses your bills and your city&apos;s weather.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ numbers */

const STATS: { to: number; decimals?: number; suffix?: string; prefix?: string; label: string; note: string }[] = [
  { to: 0.675, decimals: 3, label: "kg of CO₂", note: "for every unit of electricity from India's grid" },
  { to: 2.6, decimals: 1, suffix: "×", label: "more power", note: "than an AC's star label suggests, in a study of 1,500 Indian homes" },
  { to: 771, label: "kg of CO₂", note: "released by a single 1 kg top-up of the most common AC gas" },
  { to: 25, suffix: "+", label: "discoms", note: "whose bills we can read, from Delhi to Kerala" },
];

export function Numbers() {
  return (
    <section data-dark className="bg-primary text-canvas">
      <div className="mx-auto max-w-[1440px] px-5 py-28 md:px-10 md:py-40">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-canvas/50">Numbers worth knowing</p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2">
          {STATS.map((s, i) => (
            <div key={s.note} className="relative py-10 md:px-10 md:first:pl-0 md:[&:nth-child(3)]:pl-0">
              <motion.span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px origin-left bg-canvas/25"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, ease: EASE, delay: i * 0.1 }}
              />
              <p className="font-heading text-[clamp(4.5rem,11vw,10rem)] font-light leading-[0.85] tracking-[-0.04em]">
                <CountUp to={s.to} decimals={s.decimals} suffix={s.suffix} prefix={s.prefix} />
              </p>
              <p className="mt-4 text-lg">{s.label}</p>
              <p className="mt-1 max-w-sm text-[15px] leading-relaxed text-canvas/60">{s.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ passbook */

export function PassbookShowcase({ sample }: { sample: PassbookView }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [42, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [120, 0]);

  return (
    <section id="passbook" className="mx-auto max-w-[1440px] overflow-hidden px-5 py-28 md:px-10 md:py-40">
      <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">Carbon ID & passbook</p>
          <RevealLines
            className="mt-4 font-heading text-[clamp(2.6rem,5.4vw,5.2rem)] font-light leading-[0.95] tracking-[-0.03em]"
            lines={["One number for life,", <em key="e" className="italic text-secondary">like DigiLocker.</em>]}
          />
        </div>
        <Rise delay={0.15}>
          <p className="max-w-md text-[17px] leading-relaxed text-ink-muted">
            Every home gets a permanent Carbon ID and a passbook that fills itself in, month by month. Sealed months get an ink
            stamp. You choose whether to share a public page with your totals; it never shows names. Click the passbook to open it.
          </p>
        </Rise>
      </div>
      <div ref={ref} className="mt-16 [perspective:1800px]" data-cursor="Open">
        <motion.div style={reduce ? undefined : { rotateX, scale, y }} className="origin-bottom">
          <CarbonPassbook data={sample} publicPath="/signup" showShare={false} />
        </motion.div>
      </div>
    </section>
  );
}
