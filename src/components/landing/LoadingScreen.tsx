"use client";

import React, { useEffect, useRef, useState } from "react";
import { CardFront } from "@/components/card/CardArt";

/*
 * Loading screen for the landing page, on every load: a printer slot opens, the Carbon Card slowly prints
 * out of it, a foil glint runs across it and "Your card is ready". The curtain lifts once the page is
 * interactive and the print has finished (at least MIN_MS), and right away on a click, key or scroll.
 * The animation itself is CSS (globals.css), so it starts at first paint, before any script runs.
 */

// A sample card: no real household's name or ID ever appears on the public landing page
const SAMPLE = { carbonId: "CW-XX-26-0000-0", householdName: "Your Home", stateCode: "XX", issuedYear: 2026 };
const MIN_MS = 2300; // the print (0.35–1.75 s) and the glint (1.6–2.35 s) get to finish
const LIFT_MS = 700;

export function LoadingScreen({ onLift }: { onLift?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const liftRef = useRef(onLift);
  const [phase, setPhase] = useState<"loading" | "leaving" | "gone">("loading");

  useEffect(() => {
    liftRef.current = onLift;
  }, [onLift]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("gone");
      return;
    }
    const timers: number[] = [];
    let lifted = false;
    const lift = () => {
      if (lifted) return;
      lifted = true;
      off();
      setPhase("leaving");
      liftRef.current?.();
      timers.push(window.setTimeout(() => setPhase("gone"), LIFT_MS));
    };
    // how long the print has been running: exact from the CSS animation, else time since navigation
    const print = ref.current?.querySelector(".cw-load-print")?.getAnimations?.()[0];
    const elapsed = typeof print?.currentTime === "number" ? print.currentTime : performance.now();
    timers.push(window.setTimeout(lift, Math.max(0, MIN_MS - elapsed)));
    window.addEventListener("pointerdown", lift);
    window.addEventListener("keydown", lift);
    window.addEventListener("wheel", lift, { passive: true });
    function off() {
      window.removeEventListener("pointerdown", lift);
      window.removeEventListener("keydown", lift);
      window.removeEventListener("wheel", lift);
    }
    return () => {
      timers.forEach(window.clearTimeout);
      off();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`cw-load fixed inset-0 z-[90] flex items-center justify-center bg-canvas ${phase === "leaving" ? "is-leaving" : ""} ${phase === "gone" ? "is-gone" : ""}`}
    >
      <div className="relative flex w-[min(64vw,260px)] flex-col items-center">
        {/* the printer slot */}
        <div className="cw-load-slot relative z-10 h-3 w-[124%] rounded-full bg-ink shadow-[0_6px_14px_-6px_rgba(29,28,24,.6)]" />
        {/* clipped only along the top edge, so the card emerges from the slot and keeps its soft shadow */}
        <div className="-mt-1.5 w-full pt-1.5 [clip-path:inset(0_-200px_-200px_-200px)]">
          <div className="cw-load-print relative aspect-[54/85.6] overflow-hidden rounded-[16px] shadow-[0_40px_80px_-30px_rgba(25,32,22,.6)]">
            <CardFront {...SAMPLE} className="block h-full w-full" />
            <span className="cw-load-glint pointer-events-none absolute inset-y-[-10%] left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,240,205,.55),transparent)]" />
          </div>
        </div>
        <div className="mt-7 grid text-center font-mono text-[10px] uppercase tracking-[0.3em]">
          <p className="cw-load-cap-1 text-ink-muted [grid-area:1/1]">Printing your card…</p>
          <p className="cw-load-cap-2 text-ink [grid-area:1/1]">Your card is ready</p>
        </div>
      </div>
    </div>
  );
}
