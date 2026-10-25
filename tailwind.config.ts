import type { Config } from "tailwindcss";

/*
 * "Carbon Ledger" design system.
 * Warm paper + ink, hairline rules instead of shadows, near-square corners,
 * one terracotta signal colour for emissions and a moss green for reductions.
 * Raw Tailwind scales (emerald/slate/amber/rose/red) are remapped to the same
 * palette so legacy classes in older pages stay on-system.
 */

const moss = {
  50: "#EEF2EC",
  100: "#E0E8DC",
  200: "#C3D2BC",
  300: "#9FB596",
  400: "#799770",
  500: "#5A7D52",
  600: "#476A44",
  700: "#36583F",
  800: "#2C4733",
  900: "#22372A",
  950: "#16241B",
};

const stone = {
  50: "#F7F5F0",
  100: "#EEEAE1",
  200: "#E2DCCF",
  300: "#CBC3B2",
  400: "#A49C8B",
  500: "#7D7667",
  600: "#5F594E",
  700: "#48443B",
  800: "#2F2C26",
  900: "#1D1C18",
  950: "#12110E",
};

const ochre = {
  50: "#FAF3E3",
  100: "#F4E6C4",
  200: "#EBD39B",
  300: "#DDBB6D",
  400: "#CBA04A",
  500: "#B7862B",
  600: "#996D20",
  700: "#7A5716",
  800: "#5E4312",
  900: "#45310E",
  950: "#2C1F09",
};

const brick = {
  50: "#FAEEEB",
  100: "#F3DCD6",
  200: "#E7BBB1",
  300: "#D69384",
  400: "#C06B59",
  500: "#A9493A",
  600: "#A3362A",
  700: "#862B21",
  800: "#6B221A",
  900: "#531A14",
  950: "#330F0B",
};

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1D1C18",
          hover: "#000000",
          container: "#1D1C18",
          foreground: "#FBFAF7",
        },
        secondary: {
          DEFAULT: "#B4532F",
          hover: "#95421F",
          fixed: "#F0D5C8",
          foreground: "#FFFFFF",
        },
        tertiary: {
          DEFAULT: "#3F6B4E",
          soft: "#E3EADF",
          foreground: "#1D1C18",
        },
        ink: {
          DEFAULT: "#1D1C18",
          muted: "#625D54",
          light: "#8F897D",
        },
        canvas: {
          DEFAULT: "#F4F1EA",
          card: "#FBFAF7",
          subtle: "#ECE7DC",
        },
        border: {
          DEFAULT: "#DCD5C6",
          hover: "#C4BBA8",
          focus: "#1D1C18",
        },
        warning: {
          DEFAULT: "#B7862B",
          subtle: "#F6EDD8",
          text: "#7A5716",
          border: "#E5CF9C",
        },
        critical: {
          DEFAULT: "#A3362A",
          subtle: "#F5E1DC",
          text: "#7E2419",
          border: "#E3B6AC",
        },
        success: {
          DEFAULT: "#3F6B4E",
          subtle: "#E6ECE2",
          text: "#2C4D37",
          border: "#BFCFB8",
        },
        // Data-viz categorical palette (muted, distinguishable, colour-blind aware order)
        viz: {
          electricity: "#B4532F",
          transport: "#2F5D7C",
          food: "#9A7B2E",
          cooking: "#6E5A8A",
          waste: "#5A7D52",
          flights: "#48443B",
          other: "#A49C8B",
        },
        emerald: moss,
        green: moss,
        teal: moss,
        slate: stone,
        gray: stone,
        zinc: stone,
        neutral: stone,
        amber: ochre,
        yellow: ochre,
        orange: ochre,
        rose: brick,
        red: brick,
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-newsreader)", "Georgia", "serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        none: "0",
        DEFAULT: "2px",
        sm: "1px",
        md: "2px",
        lg: "3px",
        xl: "4px",
        "2xl": "4px",
        "3xl": "6px",
        full: "9999px",
      },
      boxShadow: {
        "tier-1": "0 0 0 0 transparent",
        "tier-2": "0 1px 0 0 rgba(29, 28, 24, 0.06)",
        "tier-3": "0 18px 40px -16px rgba(29, 28, 24, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
