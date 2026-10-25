"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring } from "framer-motion";

/* ---------------------------------------------------------------------------------------------
 * Page-wide atmosphere for the landing page: smooth scrolling, paper grain, a scroll progress
 * hairline and a two-part cursor. All of it switches off for reduced motion and touch screens.
 * ------------------------------------------------------------------------------------------- */

const LenisContext = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisContext);

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    if (reduce) return;
    const l = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => {
      l.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    setLenis(l);
    // In-page anchors glide instead of jumping
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const el = document.querySelector(a.getAttribute("href")!);
      if (!el) return;
      e.preventDefault();
      l.scrollTo(el as HTMLElement, { offset: -40, duration: 1.4 });
    };
    document.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      l.destroy();
      setLenis(null);
    };
  }, [reduce]);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}

/** Film-grain over everything: a tiny SVG noise tile, multiplied in. */
export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] opacity-[0.07] mix-blend-multiply"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  return <motion.div aria-hidden className="fixed inset-x-0 top-0 z-[70] h-[2px] origin-left bg-secondary" style={{ scaleX }} />;
}

/**
 * A small ink dot that tracks the pointer exactly, and a ring that trails it on a spring.
 * Over links and buttons the ring opens up; elements with data-cursor="Label" show a word inside.
 */
export function Cursor() {
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [dark, setDark] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 350, damping: 32, mass: 0.6 });
  const ry = useSpring(y, { stiffness: 350, damping: 32, mass: 0.6 });

  useEffect(() => {
    if (reduce || !window.matchMedia("(pointer: fine)").matches) return;
    setEnabled(true);
    document.documentElement.classList.add("cw-cursor-none");
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = e.target as HTMLElement;
      const labelled = t.closest("[data-cursor]") as HTMLElement | null;
      setLabel(labelled?.dataset.cursor ?? null);
      setHover(!!t.closest("a,button,[role=button],input,select,label"));
      setDark(!!t.closest("[data-dark]"));
    };
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.classList.remove("cw-cursor-none");
    };
  }, [reduce, x, y]);

  if (!enabled) return null;
  const size = label ? 86 : hover ? 54 : 30;
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[80] -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full"
        style={{ x, y, backgroundColor: dark ? "#F4F1EA" : "#1D1C18" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[80] flex items-center justify-center rounded-full border text-[11px] font-medium uppercase tracking-[0.14em]"
        style={{ x: rx, y: ry, borderColor: dark ? "rgba(244,241,234,.6)" : "rgba(29,28,24,.45)" }}
        animate={{
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          backgroundColor: label ? (dark ? "#F4F1EA" : "#1D1C18") : "rgba(0,0,0,0)",
          color: dark ? "#1D1C18" : "#F4F1EA",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
      >
        {label}
      </motion.div>
    </>
  );
}

/** Pulls its child toward the pointer while hovered, then springs back. */
export function Magnetic({ children, strength = 0.35, className = "" }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 220, damping: 15, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 15, mass: 0.4 });
  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className}`}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Display type that rises line by line out of a mask. Pass lines as an array so the breaks are
 * art-directed rather than left to the browser.
 */
export function RevealLines({
  lines,
  className = "",
  delay = 0,
  as: Tag = "h2",
  once = true,
}: {
  lines: React.ReactNode[];
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p";
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className="block will-change-transform"
            initial={reduce ? false : { y: "105%", rotate: 2 }}
            whileInView={{ y: "0%", rotate: 0 }}
            viewport={{ once, margin: "-10% 0px" }}
            transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: delay + i * 0.09 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Fades and lifts its children into view once. */
export function Rise({ children, delay = 0, className = "", y = 28 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
