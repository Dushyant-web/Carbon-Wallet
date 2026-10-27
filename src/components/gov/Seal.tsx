import React from "react";

/**
 * Carbon Wallet's own round seal: a home with a leaf inside a ring of bilingual text.
 * Deliberately not the State Emblem or any government mark: this is a citizen service, and its look must not
 * pretend otherwise.
 */
export function Seal({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label="Carbon Wallet seal">
      <defs>
        <path id="cw-ring-top" d="M 18 60 A 42 42 0 0 1 102 60" />
        <path id="cw-ring-bottom" d="M 22 66 A 38 38 0 0 0 98 66" />
      </defs>
      <circle cx="60" cy="60" r="58" fill="#12284C" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="#F28C28" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="33" fill="#FBFAF7" />
      <text fontFamily="var(--font-plex-sans), sans-serif" fontSize="10.5" fontWeight="600" letterSpacing="2.2" fill="#FBFAF7">
        <textPath href="#cw-ring-top" startOffset="50%" textAnchor="middle">CARBON WALLET</textPath>
      </text>
      <text fontFamily="var(--font-plex-deva), sans-serif" fontSize="10" fontWeight="600" fill="#FBFAF7">
        <textPath href="#cw-ring-bottom" startOffset="50%" textAnchor="middle">कार्बन वॉलेट</textPath>
      </text>
      {/* home */}
      <path d="M44 62 L60 48 L76 62 L76 77 L44 77 Z" fill="#12284C" />
      <rect x="55" y="66" width="10" height="11" fill="#FBFAF7" />
      {/* leaf over the roof */}
      <path d="M60 50 C 66 38, 79 36, 82 34 C 80 46, 72 54, 60 50 Z" fill="#138808" />
      <path d="M61 49.5 C 68 44, 74 40, 81 35" stroke="#FBFAF7" strokeWidth="1" fill="none" />
      <circle cx="21" cy="60" r="2.2" fill="#F28C28" />
      <circle cx="99" cy="60" r="2.2" fill="#F28C28" />
    </svg>
  );
}
