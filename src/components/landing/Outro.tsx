"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Magnetic } from "./Atmosphere";
import type { Cta } from "./Hero";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ who it's for (horizontal) */

const AUDIENCE = [
  { k: "01", who: "Families", what: "See what your home really burns, fix the one thing that matters, and watch it show up on the next bill." },
  { k: "02", who: "Housing societies", what: "Every flat on one leaderboard, with challenges the whole society can join and totals only, never names." },
  { k: "03", who: "Employers", what: "Give teams a carbon record they own, with commute and home energy in one place for sustainability reports." },
  { k: "04", who: "Green-loan banks", what: "A sealed, checkable record of a home's energy, ready for rooftop-solar and efficiency loans." },
  { k: "05", who: "Schools & colleges", what: "Students track their homes, compete on challenges and learn what a unit of electricity really costs the air." },
];

export function Audience() {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [distance, setDistance] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 110, damping: 28, mass: 0.4 });
  const x = useTransform(p, [0, 1], [0, -distance]);

  useEffect(() => {
    const measure = () => {
      if (track.current) setDistance(Math.max(0, track.current.scrollWidth - window.innerWidth + 80));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <section ref={ref} className="relative" style={{ height: reduce ? "auto" : "320vh" }}>
      <div className={`${reduce ? "" : "sticky top-0 h-[100svh]"} flex flex-col justify-center overflow-hidden`}>
        <div className="mx-auto mb-12 w-full max-w-[1440px] px-5 md:px-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">Who it&apos;s for</p>
          <h2 className="mt-4 font-heading text-[clamp(2.6rem,5.4vw,5.2rem)] font-light leading-[0.95] tracking-[-0.03em]">
            Built for one home. <em className="italic text-secondary">Ready for a million.</em>
          </h2>
        </div>
        <motion.div ref={track} className={`flex gap-6 px-5 md:px-10 ${reduce ? "flex-wrap" : "w-max"}`} style={reduce ? undefined : { x }}>
          {AUDIENCE.map((a, i) => (
            <article
              key={a.k}
              className={`flex h-[52vh] min-h-[340px] w-[82vw] max-w-[460px] shrink-0 flex-col justify-between rounded-[28px] p-8 md:w-[38vw] ${
                i % 2 === 0 ? "bg-canvas-card" : "bg-secondary text-white"
              } shadow-[0_30px_60px_-35px_rgba(40,30,20,.5)]`}
            >
              <span className={`font-mono text-xs ${i % 2 === 0 ? "text-ink-muted" : "text-white/70"}`}>{a.k}</span>
              <div>
                <h3 className="font-heading text-[clamp(2.4rem,4vw,3.6rem)] font-light leading-none tracking-[-0.02em]">{a.who}</h3>
                <p className={`mt-5 max-w-sm text-[16px] leading-relaxed ${i % 2 === 0 ? "text-ink-muted" : "text-white/85"}`}>{a.what}</p>
              </div>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ closing */

export function FinalCta({ cta, loggedIn }: { cta: Cta; loggedIn: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  // the outlined words fill with ink as you arrive
  const hidden = useTransform(scrollYProgress, [0.15, 0.75], [100, 0]);
  const clip = useTransform(hidden, (h) => `inset(-30% ${h}% -30% 0)`);

  return (
    <footer ref={ref} className="relative overflow-hidden border-t border-ink/15">
      <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-28 md:px-10 md:pt-40">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">The first step takes two minutes</p>
        <h2 className="relative mt-6 font-heading text-[clamp(4rem,13.5vw,15rem)] font-light leading-[0.82] tracking-[-0.05em]">
          <span className="cw-outline block text-ink">Start with</span>
          <span className="cw-outline block italic text-ink">one bill.</span>
          <motion.span aria-hidden className="absolute inset-0 overflow-hidden text-ink" style={{ clipPath: clip }}>
            <span className="block">Start with</span>
            <span className="block italic text-secondary">one bill.</span>
          </motion.span>
        </h2>

        <div className="mt-14 flex flex-wrap items-center gap-4">
          <Magnetic>
            <Link
              href={cta.href}
              data-cursor="Go"
              className="group inline-flex h-16 items-center gap-4 rounded-full bg-ink pl-8 pr-2 text-base font-medium text-canvas"
            >
              {cta.label}
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary transition-transform duration-500 group-hover:rotate-[-45deg]">→</span>
            </Link>
          </Magnetic>
          {!loggedIn && (
            <Link href="/login" className="h-16 rounded-full border border-ink/25 px-8 text-base leading-[64px] hover:border-ink">
              Log in
            </Link>
          )}
        </div>

        <div className="mt-28 grid grid-cols-2 gap-8 border-t border-ink/15 pt-8 text-sm md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="flex items-end gap-1.5">
              <span className="font-heading text-2xl leading-none">Carbon Wallet</span>
              <span className="mb-[4px] h-1.5 w-1.5 bg-secondary" />
            </p>
            <p className="mt-3 max-w-xs text-ink-muted">Your home&apos;s carbon, measured from the bills you already pay.</p>
          </div>
          <ul className="space-y-2 text-ink-muted">
            <li><a href="#story" className="hover:text-ink">How it works</a></li>
            <li><a href="#heat" className="hover:text-ink">Heat or habit</a></li>
            <li><a href="#proof" className="hover:text-ink">Proof</a></li>
          </ul>
          <ul className="space-y-2 text-ink-muted">
            <li><Link href="/methodology" className="hover:text-ink">How we calculate</Link></li>
          </ul>
          <ul className="space-y-2 text-ink-muted">
            {!loggedIn && <li><Link href="/signup" className="hover:text-ink">Create account</Link></li>}
            {!loggedIn && <li><Link href="/login" className="hover:text-ink">Log in</Link></li>}
            <li><Link href="/admin/login" className="hover:text-ink">Admin</Link></li>
          </ul>
        </div>
        <motion.p
          className="mt-12 font-mono text-[11px] text-ink-light"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: EASE }}
        >
          © {new Date().getFullYear()} Carbon Wallet · Made in India
        </motion.p>
      </div>
    </footer>
  );
}
