"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "framer-motion";
import { Magnetic } from "./Atmosphere";

import { CardBack, CardFront } from "@/components/card/CardArt";

export type Cta = { href: string; label: string; secondary?: { href: string; label: string } | null };

/* ------------------------------------------------------------------ nav */

export function LandingNav({ cta }: { cta: Cta }) {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(v > prev && v > 240);
    setSolid(v > 40);
  });
  return (
    <motion.header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${solid ? "bg-canvas/80 backdrop-blur-md" : ""}`}
      animate={{ y: hidden ? "-110%" : "0%" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 md:px-10">
        <Link href="/" className="flex items-end gap-1.5" data-cursor="Home">
          <span className="font-heading text-[1.45rem] leading-none tracking-tight">Carbon Wallet</span>
          <span className="mb-[4px] h-1.5 w-1.5 bg-secondary" />
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] text-ink-muted lg:flex">
          {[
            ["#story", "How it works"],
            ["#heat", "Heat or habit"],
            ["#passbook", "Passbook"],
            ["#proof", "Proof"],
            ["#inside", "Inside"],
          ].map(([h, l]) => (
            <a key={h} href={h} className="group relative py-1 hover:text-ink">
              {l}
              <span className="absolute inset-x-0 -bottom-0.5 h-px origin-right scale-x-0 bg-ink transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:origin-left group-hover:scale-x-100" />
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {cta.secondary && (
            <Link href={cta.secondary.href} className="hidden h-10 px-3 text-sm leading-10 hover:underline sm:block">
              {cta.secondary.label}
            </Link>
          )}
          <Magnetic strength={0.25}>
            <Link href={cta.href} className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-canvas">
              {cta.label}
            </Link>
          </Magnetic>
        </div>
      </div>
    </motion.header>
  );
}

/* ------------------------------------------------------------------ hero: the Carbon Card */

const EASE = [0.16, 1, 0.3, 1] as const;

// A sample home: no real household's name or ID ever appears on the public landing page.
const SAMPLE_CARD = { carbonId: "CW-XX-26-0000-0", householdName: "Your Home", stateCode: "XX", issuedYear: 2026, publicUrl: "/signup" };

/** What the card holds, as callouts around it. x/y: where the label sits; ax/ay: where its line meets the card (% of stage). */
const CALLOUTS = [
  { k: "This month", v: "286 kg", sub: "of CO₂ · 72 kg per person", x: 2, y: 14, big: true },
  { k: "Electricity", v: "52%", sub: "from 2 bills, read for you", x: 0, y: 50 },
  { k: "Your AC", v: "1.2 kW", sub: "real power, measured", x: 6, y: 80 },
  { k: "Car", v: "79 kg", sub: "from fuel fill-ups", x: 78, y: 12 },
  { k: "Sealed", v: "6 months ✓", sub: "nobody can edit them", x: 80, y: 48 },
  { k: "Rank", v: "#3 of 10", sub: "cleaner than 72% of homes", x: 76, y: 78 },
];

type Line = { x1: number; y1: number; x2: number; y2: number };

/** Leader lines measured from the real layout: from each label's card-facing edge to the card's edge. */
function useLeaderLines(stage: React.RefObject<HTMLDivElement | null>, card: React.RefObject<HTMLDivElement | null>, labels: React.RefObject<(HTMLDivElement | null)[]>) {
  const [lines, setLines] = useState<Line[]>([]);
  useEffect(() => {
    const measure = () => {
      const s = stage.current?.getBoundingClientRect();
      const c = card.current?.getBoundingClientRect();
      if (!s || !c) return;
      setLines(
        (labels.current ?? []).map((el) => {
          if (!el) return { x1: 0, y1: 0, x2: 0, y2: 0 };
          const r = el.getBoundingClientRect();
          const left = r.left + r.width / 2 < c.left + c.width / 2;
          const y1 = r.top + 22 - s.top;
          const y2 = Math.min(Math.max(y1, c.top - s.top + 28), c.bottom - s.top - 28);
          return left
            ? { x1: r.right - s.left + 10, y1, x2: c.left - s.left + 6, y2 }
            : { x1: r.left - s.left - 10, y1, x2: c.right - s.left - 6, y2 };
        }),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stage.current) ro.observe(stage.current);
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 400); // after fonts settle
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, [stage, card, labels]);
  return lines;
}

function HeroCard({ reduce }: { reduce: boolean }) {
  const [flipped, setFlipped] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const cardBox = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lines = useLeaderLines(stage, cardBox, labelRefs);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const tiltX = useSpring(useTransform(py, [-1, 1], [12, -12]), { stiffness: 140, damping: 16 });
  const tiltY = useSpring(useTransform(px, [-1, 1], [-18, 18]), { stiffness: 140, damping: 16 });
  const gx = useTransform(px, [-1, 1], ["15%", "85%"]);
  const gy = useTransform(py, [-1, 1], ["10%", "90%"]);
  const sheen = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgba(255,248,230,.5), rgba(255,248,230,0) 45%)`;
  const flipSpring = useSpring(0, { stiffness: 90, damping: 16 });
  const rotateY = useTransform([tiltY, flipSpring] as MotionValue<number>[], ([t, f]: number[]) => t - 14 + f);

  return (
    <div
      ref={stage}
      className="relative mx-auto aspect-[0.82/1] w-full max-w-[820px] [perspective:1500px] md:aspect-[1.25/1]"
      onPointerMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width) * 2 - 1);
        py.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      {/* leader lines */}
      <svg className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible md:block" aria-hidden>
        {lines.map((l, i) => (
          <motion.g key={i} initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 1.4 + i * 0.12 }}>
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#1D1C18" strokeOpacity={0.3} strokeWidth={1} />
            <circle cx={l.x2} cy={l.y2} r={3.5} fill="#B4532F" />
            <circle cx={l.x2} cy={l.y2} r={7} fill="none" stroke="#B4532F" strokeOpacity={0.35} />
          </motion.g>
        ))}
      </svg>

      {/* callouts */}
      {CALLOUTS.map((c, i) => (
        <motion.div
          key={c.k}
          ref={(el) => {
            labelRefs.current[i] = el;
          }}
          className="absolute hidden md:block"
          style={{ left: `${c.x}%`, top: `${c.y}%` }}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 1.25 + i * 0.12 }}
        >
          <motion.div animate={reduce ? undefined : { y: [0, i % 2 ? 4 : -4, 0] }} transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">{c.k}</p>
            <p className={`font-heading leading-none tracking-[-0.02em] ${c.big ? "text-[2.6rem] text-secondary" : "text-[1.7rem]"}`}>{c.v}</p>
            <p className="mt-1 text-[12px] text-ink-muted">{c.sub}</p>
          </motion.div>
        </motion.div>
      ))}

      {/* the card */}
      <div className="absolute left-1/2 top-[46%] w-[54%] max-w-[300px] -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d] md:top-1/2 md:w-[30%]">
        <div ref={cardBox} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 aspect-[54/85.6]" />
        <motion.div
          className="[transform-style:preserve-3d]"
          initial={reduce ? false : { rotateY: 200, rotateX: 25, y: 120, opacity: 0 }}
          animate={{ rotateY: 0, rotateX: 0, y: 0, opacity: 1 }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
        >
          <motion.div
            className="[transform-style:preserve-3d]"
            animate={reduce ? undefined : { y: [0, -14, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.button
              type="button"
              aria-label={flipped ? "Show the front of the card" : "Show the back of the card"}
              data-cursor={flipped ? "Front" : "Flip"}
              onClick={() => {
                const next = !flipped;
                setFlipped(next);
                flipSpring.set(next ? 180 : 0);
              }}
              className="relative block aspect-[54/85.6] w-full [transform-style:preserve-3d]"
              style={reduce ? undefined : { rotateX: tiltX, rotateY }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-[18px] shadow-[0_60px_100px_-35px_rgba(25,32,22,.7),0_8px_20px_-10px_rgba(25,32,22,.4)] [backface-visibility:hidden]">
                <CardFront {...SAMPLE_CARD} className="h-full w-full" />
                {!reduce && <motion.div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: sheen }} />}
              </div>
              <div className="absolute inset-0 overflow-hidden rounded-[18px] shadow-[0_60px_100px_-35px_rgba(25,32,22,.7)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <CardBack {...SAMPLE_CARD} className="h-full w-full" />
              </div>
            </motion.button>
          </motion.div>
        </motion.div>
        {/* soft floor shadow */}
        <motion.div
          aria-hidden
          className="mx-auto mt-10 h-6 w-[80%] rounded-[50%] bg-[#3A2E22] opacity-25 blur-xl"
          animate={reduce ? undefined : { scaleX: [1, 0.86, 1], opacity: [0.25, 0.16, 0.25] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

export function Hero({ cta }: { cta: Cta }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = !!useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const lift = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const line = (content: React.ReactNode, i: number) => (
    <span className="block overflow-hidden pb-[0.06em]">
      <motion.span
        className="block"
        initial={reduce ? false : { y: "110%", rotate: 3 }}
        animate={{ y: "0%", rotate: 0 }}
        transition={{ duration: 1.2, ease: EASE, delay: 0.15 + i * 0.1 }}
      >
        {content}
      </motion.span>
    </span>
  );

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[5%] h-[80vh] w-[80vh] rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(63,107,78,.22) 0%, rgba(244,241,234,0) 65%)" }}
      />
      <motion.div style={{ y: lift, opacity: fade }} className="relative mx-auto grid min-h-[100svh] max-w-[1440px] grid-cols-1 items-center gap-6 px-5 pb-12 pt-28 md:px-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:pt-20">
        <div className="relative z-10">
          <motion.p
            className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted"
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <span className="h-px w-10 bg-ink-muted" /> The Carbon Card
          </motion.p>
          <h1 className="font-heading text-[clamp(3.2rem,6.6vw,7.6rem)] font-light leading-[0.9] tracking-[-0.045em]">
            {line("Your home's", 0)}
            {line(<em className="font-light italic text-secondary">whole carbon story,</em>, 1)}
            {line("on one card.", 2)}
          </h1>
          <motion.p
            className="mt-8 max-w-[34rem] text-[17px] leading-relaxed text-ink-muted md:text-lg"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.6 }}
          >
            One card for every household, holding all of its emissions: every bill, every appliance, every month. Tap it with any
            phone to see the record, sealed so nobody can change it.
          </motion.p>
          <motion.div
            className="mt-9 flex flex-wrap items-center gap-3"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.75 }}
          >
            <Magnetic>
              <Link
                href={cta.href}
                data-cursor="Go"
                className="group inline-flex h-14 items-center gap-3 rounded-full bg-secondary pl-7 pr-2 text-[15px] font-medium text-white shadow-[0_18px_40px_-18px_rgba(180,83,47,.8)]"
              >
                {cta.label === "Start with one bill" ? "Get your card" : cta.label}
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:rotate-[-45deg]">→</span>
              </Link>
            </Magnetic>
            <a href="#card" className="inline-flex h-14 items-center rounded-full border border-ink/25 px-6 text-[15px] hover:border-ink">
              See it tapped
            </a>
          </motion.div>
          <motion.ul
            className="mt-10 grid max-w-[34rem] grid-cols-3 gap-3 border-t border-ink/15 pt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 1 }}
          >
            <li>Reads 25+ discoms</li>
            <li>Real weather data</li>
            <li>Totals only, never names</li>
          </motion.ul>
        </div>
        <div>
          <HeroCard reduce={reduce} />
          {/* on phones, what the card holds sits under it */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ink/15 pt-6 md:hidden">
            {CALLOUTS.map((c) => (
              <div key={c.k}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">{c.k}</dt>
                <dd className={`font-heading text-2xl leading-tight ${c.big ? "text-secondary" : ""}`}>{c.v}</dd>
                <dd className="text-[12px] text-ink-muted">{c.sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ marquee */

const DISCOMS = [
  "BSES Rajdhani",
  "Tata Power-DDL",
  "UPPCL",
  "Noida Power",
  "DHBVN",
  "MSEDCL",
  "Adani Electricity",
  "BEST",
  "Torrent Power",
  "BESCOM",
  "TANGEDCO",
  "KSEB",
  "TGSPDCL",
  "APSPDCL",
];

/** Discom names that drift, and speed up or reverse with your scroll. */
export function DiscomMarquee() {
  const reduce = useReducedMotion();
  const base = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const factor = useTransform(velocity, [-1500, 0, 1500], [-4, 0, 4], { clamp: false });
  const dir = useRef(1);
  const x = useTransform(base, (v) => `${((((v % 50) + 50) % 50) - 50).toFixed(3)}%`);

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const f = factor.get();
    if (f < 0) dir.current = -1;
    else if (f > 0) dir.current = 1;
    base.set(base.get() - dir.current * 1.6 * (delta / 1000) * (1 + Math.abs(f)));
  });

  const row = DISCOMS.map((d) => (
    <span key={d} className="flex items-center gap-10 pr-10">
      <span className="font-heading text-[clamp(2.2rem,5vw,4.8rem)] font-light italic tracking-tight">{d}</span>
      <span className="h-2.5 w-2.5 rotate-45 bg-secondary" />
    </span>
  ));

  return (
    <section aria-label="Electricity companies we read" className="overflow-hidden border-y border-ink/15 py-8">
      <div className="mb-4 px-5 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted md:px-10">Reads the bill from your discom</div>
      <motion.div className="flex w-max whitespace-nowrap" style={{ x }}>
        {row}
        {row}
      </motion.div>
    </section>
  );
}
