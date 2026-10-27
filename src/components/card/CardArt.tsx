import React, { useId } from "react";
import { code128Path } from "@/lib/code128";

/**
 * Print-accurate artwork for the physical Carbon Card: ISO/IEC 7810 ID-1 (CR80), portrait,
 * 54 × 85.6 mm. Units are millimetres. `bleed` adds 3 mm on every side for the print shop.
 */
export const CARD_W = 54;
export const CARD_H = 85.6;
export const BLEED = 3;

export type CardArtProps = {
  carbonId: string;
  householdName: string;
  stateCode: string;
  issuedYear: number;
  /** Private code printed as a barcode on the back (and written to the chip). Only Carbon Wallet resolves it. */
  cardCode?: string;
  /** @deprecated cards no longer carry a public link */
  publicUrl?: string;
  bleed?: boolean;
  className?: string;
};

const MOSS_DARK = "#16241B";
const PAPER = "#FBFAF7";
const INK = "#1D1C18";
const TERRACOTTA = "#B4532F";

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic topographic contours: every Carbon ID gets its own "fingerprint" pattern. */
function contourPaths(seed: string): string[] {
  const h = fnv1a(seed);
  const cx = 14 + (h % 26);
  const cy = 22 + ((h >>> 8) % 40);
  const p1 = ((h >>> 4) % 628) / 100;
  const p2 = ((h >>> 12) % 628) / 100;
  const p3 = ((h >>> 20) % 628) / 100;
  const paths: string[] = [];
  for (let k = 0; k < 16; k++) {
    const base = 3 + k * 3.1;
    const pts: string[] = [];
    for (let i = 0; i <= 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      const r =
        base *
        (1 + 0.16 * Math.sin(2 * t + p1 + k * 0.15) + 0.09 * Math.sin(3 * t + p2) + 0.05 * Math.sin(5 * t + p3 - k * 0.1));
      pts.push(`${(cx + r * Math.cos(t)).toFixed(2)},${(cy + r * 1.08 * Math.sin(t)).toFixed(2)}`);
    }
    paths.push(`M${pts.join("L")}Z`);
  }
  return paths;
}


function NfcMark({ x, y, s, colour }: { x: number; y: number; s: number; colour: string }) {
  // ISO-style contactless "tap" symbol: four growing arcs
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={colour} strokeWidth="0.55" strokeLinecap="round">
      {[1.2, 2.3, 3.4, 4.5].map((r) => (
        <path key={r} d={`M ${r * 0.62} ${-r * 0.78} A ${r} ${r} 0 0 1 ${r * 0.62} ${r * 0.78}`} />
      ))}
    </g>
  );
}

function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      <linearGradient id={`cc-foil-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#F4E6C4" />
        <stop offset=".35" stopColor="#CBA04A" />
        <stop offset=".55" stopColor="#F0DDAE" />
        <stop offset=".8" stopColor="#B7862B" />
        <stop offset="1" stopColor="#EBD39B" />
      </linearGradient>
      <radialGradient id={`cc-moss-${uid}`} cx="0.25" cy="0" r="1.2">
        <stop offset="0" stopColor="#2C4733" />
        <stop offset=".45" stopColor="#22372A" />
        <stop offset="1" stopColor={MOSS_DARK} />
      </radialGradient>
    </defs>
  );
}

function frame(bleed: boolean) {
  const b = bleed ? BLEED : 0;
  return {
    viewBox: `${-b} ${-b} ${CARD_W + 2 * b} ${CARD_H + 2 * b}`,
    width: `${CARD_W + 2 * b}mm`,
    height: `${CARD_H + 2 * b}mm`,
    b,
  };
}

export const CardFront = React.forwardRef<SVGSVGElement, CardArtProps>(function CardFront(
  { carbonId, householdName, stateCode, issuedYear, bleed = false, className },
  ref,
) {
  const f = frame(bleed);
  // per-instance ids: several copies of a card can be on one page (some hidden), and a url(#id) that
  // resolves to a copy inside display:none paints nothing
  const uid = `${useId().replace(/[^a-zA-Z0-9]/g, "")}${bleed ? "b" : "t"}`;
  const FOIL = `url(#cc-foil-${uid})`;
  // Fit the name inside the 43.6 mm text column: wrap long names onto two lines, then shrink to fit.
  const words = householdName.split(" ");
  const twoLines = householdName.length > 12 && words.length > 1;
  const split = twoLines ? Math.ceil(words.length / 2) : words.length;
  const line1 = words.slice(0, split).join(" ");
  const line2 = words.slice(split).join(" ");
  const longest = Math.max(line1.length, line2.length);
  const nameSize = Math.min(6.4, 43.6 / (longest * 0.5));

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={f.viewBox} width={bleed ? f.width : undefined} height={bleed ? f.height : undefined} className={className} role="img" aria-label={`Carbon Card front for ${householdName}, ${carbonId}`}>
      <Defs uid={uid} />
      <rect x={-f.b} y={-f.b} width={CARD_W + 2 * f.b} height={CARD_H + 2 * f.b} fill={`url(#cc-moss-${uid})`} rx={bleed ? 0 : 3.2} />
      <clipPath id={`cc-clip-${uid}`}>
        <rect x={-f.b} y={-f.b} width={CARD_W + 2 * f.b} height={CARD_H + 2 * f.b} rx={bleed ? 0 : 3.2} />
      </clipPath>
      <g clipPath={`url(#cc-clip-${uid})`} fill="none" stroke={FOIL} strokeWidth="0.16" opacity="0.38">
        {contourPaths(carbonId).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* header: emblem + wordmark + tap mark */}
      <g transform="translate(5.2 6.4)">
        <circle cx="3.2" cy="3.2" r="3.1" fill="none" stroke={FOIL} strokeWidth="0.3" />
        <rect x="1.7" y="1.5" width="3" height="3.4" rx="0.2" fill="none" stroke={FOIL} strokeWidth="0.25" />
        <path d="M2.2 2.5h2M2.2 3.3h2M2.2 4.1h1.2" stroke={FOIL} strokeWidth="0.2" />
        <rect x="3.75" y="3.85" width="0.45" height="0.45" fill={TERRACOTTA} />
        <text x="8.4" y="4.4" fill={FOIL} fontFamily="Newsreader, Georgia, serif" fontSize="3.4" fontWeight="500">
          Carbon Wallet
        </text>
      </g>
      <NfcMark x={46.2} y={9.6} s={0.95} colour="#EBD39B" />

      {/* title + household */}
      <text x="5.2" y="38" fill="#EBD39B" opacity="0.75" fontFamily="IBM Plex Mono, monospace" fontSize="1.9" letterSpacing="0.9">
        CARBON CARD
      </text>
      <text fill={FOIL} fontFamily="Newsreader, Georgia, serif" fontSize={nameSize} fontWeight="500">
        <tspan x="5.2" y="46">{line1}</tspan>
        {twoLines && (
          <tspan x="5.2" y={46 + nameSize * 1.12}>
            {line2}
          </tspan>
        )}
      </text>

      {/* identity strip */}
      <line x1="5.2" x2="48.8" y1="66.4" y2="66.4" stroke="#EBD39B" strokeWidth="0.15" opacity="0.5" />
      <text x="5.2" y="70.6" fill="#EBD39B" opacity="0.7" fontFamily="IBM Plex Mono, monospace" fontSize="1.7" letterSpacing="0.8">
        CARBON ID
      </text>
      <text x="5.2" y="76.6" fill={FOIL} fontFamily="IBM Plex Mono, monospace" fontSize="4.15" fontWeight="600" letterSpacing="0.35">
        {carbonId}
      </text>
      <text x="5.2" y="80.9" fill="#EBD39B" opacity="0.6" fontFamily="IBM Plex Mono, monospace" fontSize="1.6" letterSpacing="0.5">
        ISSUED {issuedYear} · {stateCode}
      </text>
      <rect x="45.6" y="78.2" width="3.2" height="3.2" fill={TERRACOTTA} />
    </svg>
  );
});

export const CardBack = React.forwardRef<SVGSVGElement, CardArtProps>(function CardBack(
  { carbonId, cardCode = "CW1000000000000", bleed = false, className },
  ref,
) {
  const f = frame(bleed);
  // per-instance ids: several copies of a card can be on one page (some hidden), and a url(#id) that
  // resolves to a copy inside display:none paints nothing
  const uid = `${useId().replace(/[^a-zA-Z0-9]/g, "")}${bleed ? "b" : "t"}`;
  const FOIL = `url(#cc-foil-${uid})`;
  const pretty = `CW1-${cardCode.slice(3, 7)}-${cardCode.slice(7, 11)}-${cardCode.slice(11, 15)}`;
  const bx = 3.5;
  const bw = CARD_W - 7;
  const by = 27;
  const bh = 15;

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={f.viewBox} width={bleed ? f.width : undefined} height={bleed ? f.height : undefined} className={className} role="img" aria-label={`Carbon Card back for ${carbonId}`}>
      <Defs uid={uid} />
      <rect x={-f.b} y={-f.b} width={CARD_W + 2 * f.b} height={CARD_H + 2 * f.b} fill={PAPER} rx={bleed ? 0 : 3.2} />
      <rect x={-f.b} y={-f.b} width={CARD_W + 2 * f.b} height={9 + f.b} fill={`url(#cc-moss-${uid})`} />
      <text x="5.2" y="5.9" fill={FOIL} fontFamily="IBM Plex Mono, monospace" fontSize="1.9" letterSpacing="0.8">
        CARBON WALLET
      </text>
      <NfcMark x={46.2} y={4.6} s={0.8} colour="#EBD39B" />

      <text x={CARD_W / 2} y="17.4" textAnchor="middle" fill={INK} fontFamily="Newsreader, Georgia, serif" fontSize="3.3">
        This home&apos;s carbon record
      </text>
      <text x={CARD_W / 2} y="21.4" textAnchor="middle" fill="#8F897D" fontFamily="IBM Plex Sans, sans-serif" fontSize="1.65">
        Scan or tap at any Carbon Wallet kiosk
      </text>

      {/* the private barcode: Code 128 of the card code, white plate with quiet zones */}
      <rect x={bx - 0.6} y={by - 1.6} width={bw + 1.2} height={bh + 7.6} fill="#FFFFFF" stroke="#DCD5C6" strokeWidth="0.2" rx="0.8" />
      <path d={code128Path(cardCode, bx, by, bw, bh)} fill={INK} />
      <text x={CARD_W / 2} y={by + bh + 4} textAnchor="middle" fill={INK} fontFamily="IBM Plex Mono, monospace" fontSize="2.3" letterSpacing="0.6">
        {pretty}
      </text>

      <text x={CARD_W / 2} y="55.4" textAnchor="middle" fill="#625D54" fontFamily="IBM Plex Sans, sans-serif" fontSize="1.9">
        Only Carbon Wallet can read this code.
      </text>
      <text x={CARD_W / 2} y="58.6" textAnchor="middle" fill="#625D54" fontFamily="'IBM Plex Sans Devanagari', 'Noto Sans Devanagari', sans-serif" fontSize="1.9">
        यह कोड केवल Carbon Wallet पढ़ सकता है
      </text>
      <text x={CARD_W / 2} y="62.2" textAnchor="middle" fill="#8F897D" fontFamily="IBM Plex Sans, sans-serif" fontSize="1.6">
        Other scanners see a meaningless code, never your data.
      </text>

      <line x1="5.2" x2="48.8" y1="70" y2="70" stroke="#DCD5C6" strokeWidth="0.2" />
      <text x="5.2" y="74.4" fill={INK} fontFamily="IBM Plex Mono, monospace" fontSize="2.6" fontWeight="600" letterSpacing="0.3">
        {carbonId}
      </text>
      {/* 45 characters of letter-spaced mono don't fit the 43.6 mm column, so the spacing is fitted to it */}
      <text x="5.2" y="78.2" fill="#8F897D" fontFamily="IBM Plex Mono, monospace" fontSize="1.5" textLength="43.6" lengthAdjust="spacing">
        NOT A PAYMENT CARD · IF FOUND, RETURN TO OWNER
      </text>
      <text x="5.2" y="81.3" fill="#8F897D" fontFamily="IBM Plex Mono, monospace" fontSize="1.5" letterSpacing="0.3">
        Issued by Carbon Wallet
      </text>
    </svg>
  );
});
