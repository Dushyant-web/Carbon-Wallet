"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { CardBack, CardFront } from "@/components/card/CardArt";

/*
 * The Carbon Card, pinned while you scroll:
 *   it spins in · flips to the private barcode on the back · lies down · a phone slides in and taps it ·
 *   NFC rings ripple · the Carbon Wallet app opens the home's record.
 * On top of the scroll choreography the card also tilts toward the pointer, with a moving sheen.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
// A sample card: no real household's name, ID or address ever appears on the public landing page
const CARD = { carbonId: "CW-XX-26-0000-0", householdName: "Your Home", stateCode: "XX", issuedYear: 2026 };

const useSeg = (p: MotionValue<number>, a: number, b: number) => useTransform(p, [a, b], [0, 1], { clamp: true });

function PhoneScreen({ open }: { open: boolean }) {
  return (
    <div className="flex h-full flex-col bg-canvas px-4 pb-4 pt-9 text-ink">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
      <motion.div initial={false} animate={{ opacity: open ? 1 : 0, y: open ? 0 : 12 }} transition={{ duration: 0.6, ease: EASE }} className="flex flex-1 flex-col">
        <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-ink-muted">Carbon Wallet</p>
        <p className="mt-1 font-heading text-[17px] leading-tight">Your Home</p>
        <p className="font-mono text-[9px] text-ink-muted">{CARD.carbonId} · sample</p>
        <div className="mt-4 rounded-lg bg-primary p-3 text-canvas">
          <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-canvas/60">March 2026</p>
          <p className="font-heading text-3xl font-light leading-none">286</p>
          <p className="text-[10px] text-canvas/70">kg CO₂e · 72 kg per person</p>
        </div>
        <div className="mt-3 space-y-1.5">
          {[
            ["Feb 2026", "312", true],
            ["Jan 2026", "318", true],
            ["Dec 2025", "325", true],
          ].map(([m, kg, sealed]) => (
            <div key={m as string} className="flex items-center justify-between border-b border-ink/10 pb-1 text-[10px]">
              <span className="text-ink-muted">{m}</span>
              <span className="font-mono">{kg} kg</span>
              {sealed && <span className="rounded border border-secondary px-1 font-mono text-[7px] uppercase text-secondary">Sealed</span>}
            </div>
          ))}
        </div>
        <p className="mt-auto text-center text-[8px] text-ink-light">Totals only · no names</p>
      </motion.div>
    </div>
  );
}

export function CardShowcase() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 110, damping: 26, mass: 0.4 });
  const [phase, setPhase] = useState(0);
  useMotionValueEvent(p, "change", (v) => setPhase(v < 0.28 ? 0 : v < 0.52 ? 1 : v < 0.7 ? 2 : 3));

  // scroll choreography
  const enter = useSeg(p, 0, 0.22);
  const flip = useSeg(p, 0.28, 0.48);
  const lie = useSeg(p, 0.52, 0.64);
  const phoneIn = useSeg(p, 0.54, 0.68);
  const scrollRotY = useTransform([enter, flip] as MotionValue<number>[], ([e, f]: number[]) => -70 + e * 56 + f * 180);
  const scrollRotX = useTransform([enter, lie] as MotionValue<number>[], ([e, l]: number[]) => 30 - e * 22 + l * 46);
  const cardY = useTransform(enter, [0, 1], ["35%", "0%"]);
  const cardX = useTransform(lie, [0, 1], ["0%", "-62%"]);
  const cardScale = useTransform([enter, lie] as MotionValue<number>[], ([e, l]: number[]) => 0.72 + e * 0.28 - l * 0.12);
  const phoneX = useTransform(phoneIn, [0, 1], ["170%", "10%"]);
  const phoneOpacity = useTransform(phoneIn, [0, 0.12], [0, 1]);
  const phoneRot = useTransform(phoneIn, [0, 1], [18, -6]);
  const tap = useSeg(p, 0.68, 0.74);
  const phoneY = useTransform(tap, [0, 0.5, 1], ["0%", "6%", "0%"]);

  // pointer tilt + sheen, layered on the scroll rotation
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const tiltX = useSpring(useTransform(py, [-1, 1], [10, -10]), { stiffness: 150, damping: 18 });
  const tiltY = useSpring(useTransform(px, [-1, 1], [-14, 14]), { stiffness: 150, damping: 18 });
  const rotateY = useTransform([scrollRotY, tiltY] as MotionValue<number>[], ([a, b]: number[]) => a + b);
  const rotateX = useTransform([scrollRotX, tiltX] as MotionValue<number>[], ([a, b]: number[]) => a + b);
  const gx = useTransform(px, [-1, 1], ["10%", "90%"]);
  const gy = useTransform(py, [-1, 1], ["10%", "90%"]);
  const sheen = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgba(255,250,235,.42), rgba(255,250,235,0) 46%)`;

  const card = origin ? { ...CARD, publicUrl: `${origin}/signup` } : null;
  const tapped = phase >= 3;

  return (
    <section id="card" ref={ref} className="relative bg-[#EFEAE0]" style={{ height: reduce ? "auto" : "380vh" }}>
      <div
        className={`${reduce ? "py-24" : "sticky top-0 h-[100svh]"} overflow-hidden`}
        onPointerMove={(e) => {
          px.set((e.clientX / window.innerWidth) * 2 - 1);
          py.set((e.clientY / window.innerHeight) * 2 - 1);
        }}
        onPointerLeave={() => {
          px.set(0);
          py.set(0);
        }}
      >
        <div className="mx-auto grid h-full max-w-[1440px] grid-cols-1 items-center gap-6 px-5 pt-20 md:px-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:pt-0">
          {/* copy */}
          <div className="relative z-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted">The Carbon Card</p>
            <h2 className="mt-4 font-heading text-[clamp(2.6rem,5vw,5rem)] font-light leading-[0.95] tracking-[-0.03em]">
              Tap it. <em className="italic text-secondary">See everything.</em>
            </h2>
            <ol className="mt-10 flex flex-col gap-5">
              {[
                ["Unique to your home", "Its contour pattern is generated from your Carbon ID. No two cards look alike."],
                ["A private barcode on the back", "Only Carbon Wallet can read it. Any other scanner app sees a meaningless code."],
                ["Tap with Carbon Wallet", "The chip inside holds the same private code. Our app and kiosks open your record and print a receipt."],
                ["Always up to date", "The card never changes; the record behind it fills in every month."],
              ].map(([t, d], i) => (
                <motion.li
                  key={t}
                  animate={{ opacity: reduce || phase === i ? 1 : 0.3 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="grid grid-cols-[34px_1fr] gap-2"
                >
                  <span className="font-mono text-xs text-secondary">0{i + 1}</span>
                  <div>
                    <p className="font-heading text-xl">{t}</p>
                    <p className="mt-0.5 max-w-sm text-[15px] leading-relaxed text-ink-muted">{d}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>

          {/* stage */}
          <div className="relative h-[62vh] min-h-[420px] [perspective:1400px]">
            {/* NFC rings, travelling with the card */}
            {!reduce && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 w-[clamp(200px,22vw,300px)] -translate-x-1/2 -translate-y-1/2">
                <motion.div className="relative aspect-[54/85.6]" style={{ x: cardX }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="absolute left-1/2 top-1/2 h-0 w-0">
                      <motion.span
                        className="absolute -left-20 -top-20 block h-40 w-40 rounded-full border-2 border-secondary"
                        initial={false}
                        animate={tapped ? { scale: [0.4, 2.6], opacity: [0.9, 0] } : { scale: 0.4, opacity: 0 }}
                        transition={tapped ? { duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: "easeOut" } : { duration: 0.2 }}
                      />
                    </span>
                  ))}
                </motion.div>
              </div>
            )}

            {/* the card */}
            <div className="absolute left-1/2 top-1/2 w-[clamp(200px,22vw,300px)] -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d]">
            <motion.div
              className="[transform-style:preserve-3d]"
              style={reduce ? undefined : { rotateX, rotateY, y: cardY, x: cardX, scale: cardScale }}
              data-cursor="Tilt"
            >
              <div className="relative aspect-[54/85.6] [transform-style:preserve-3d]">
                <div className="absolute inset-0 overflow-hidden rounded-[16px] shadow-[0_50px_90px_-30px_rgba(25,30,20,.65)] [backface-visibility:hidden]">
                  {card ? <CardFront {...card} className="h-full w-full" /> : <div className="h-full w-full bg-[#24382B]" />}
                  {!reduce && <motion.div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: sheen }} />}
                </div>
                <div className="absolute inset-0 overflow-hidden rounded-[16px] shadow-[0_50px_90px_-30px_rgba(25,30,20,.65)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  {card ? <CardBack {...card} className="h-full w-full" /> : <div className="h-full w-full bg-[#24382B]" />}
                </div>
              </div>
            </motion.div>
            </div>

            {/* the phone */}
            {!reduce && (
              <div className="absolute right-[6%] top-1/2 w-[clamp(170px,16vw,230px)] -translate-y-1/2">
              <motion.div style={{ x: phoneX, rotate: phoneRot, y: phoneY, opacity: phoneOpacity }}>
                <div className="relative aspect-[9/19] rounded-[34px] bg-[#151413] p-[7px] shadow-[0_50px_90px_-30px_rgba(20,15,10,.7)]">
                  <div className="absolute left-1/2 top-[10px] z-10 h-[16px] w-[64px] -translate-x-1/2 rounded-full bg-black" />
                  <div className="h-full overflow-hidden rounded-[27px]">
                    <PhoneScreen open={tapped} />
                  </div>
                </div>
              </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
