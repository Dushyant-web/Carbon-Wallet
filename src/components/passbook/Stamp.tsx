import React from "react";

export type StampStatus = "ANCHORED" | "RECORDED" | "OPEN";

const STYLE: Record<StampStatus, { colour: string; border: string; label: string }> = {
  ANCHORED: { colour: "#B4532F", border: "double", label: "Sealed ✓" },
  RECORDED: { colour: "#48443B", border: "solid", label: "Recorded" },
  OPEN: { colour: "#996D20", border: "dashed", label: "Open" },
};

/** Deterministic small rotation per key, so stamps look hand-applied but never jump between renders. */
function tiltFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return (Math.abs(h) % 15) - 9; // -9..5 degrees
}

/** SVG filter that gives stamps an uneven, rubber-ink texture. Render once per page. */
export function InkFilterDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <filter id="cw-ink">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.3" result="speckle" />
        <feComposite in="SourceGraphic" in2="speckle" operator="in" result="inked" />
        <feDisplacementMap in="inked" in2="noise" scale="1.4" />
      </filter>
    </svg>
  );
}

export function Stamp({
  status,
  sub,
  stampKey,
  animate = false,
  delayMs = 0,
  className = "",
}: {
  status: StampStatus;
  sub?: string;
  stampKey: string;
  animate?: boolean;
  delayMs?: number;
  className?: string;
}) {
  const s = STYLE[status];
  return (
    <span
      className={`inline-flex flex-col items-center justify-center rounded-[4px] px-[0.6em] py-[0.15em] font-mono font-semibold uppercase leading-tight tracking-[0.12em] ${
        animate ? "cw-stamp-in" : ""
      } ${className}`}
      style={
        {
          color: s.colour,
          border: `${status === "ANCHORED" ? 3 : 1.5}px ${s.border} ${s.colour}`,
          transform: `rotate(${tiltFor(stampKey)}deg)`,
          filter: "url(#cw-ink)",
          opacity: 0.94,
          "--r": `${tiltFor(stampKey)}deg`,
          animationDelay: `${delayMs}ms`,
        } as React.CSSProperties
      }
    >
      <span>{s.label}</span>
      {sub && <span className="text-[0.72em] font-medium tracking-[0.08em] opacity-80">{sub}</span>}
    </span>
  );
}
