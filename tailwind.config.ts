import type { Config } from "tailwindcss";

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
          DEFAULT: "#064E3B",
          hover: "#043A2C",
          container: "#064E3B",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#10B981",
          hover: "#059669",
          fixed: "#6FFBBE",
          foreground: "#FFFFFF",
        },
        tertiary: {
          DEFAULT: "#34D399",
          soft: "#D1FAE5",
          foreground: "#064E3B",
        },
        ink: {
          DEFAULT: "#0F172A",
          muted: "#64748B",
          light: "#94A3B8",
        },
        canvas: {
          DEFAULT: "#F8FAFC",
          card: "#FFFFFF",
          subtle: "#F1F5F9",
        },
        border: {
          DEFAULT: "#E2E8F0",
          hover: "#CBD5E1",
          focus: "#34D399",
        },
        warning: {
          DEFAULT: "#F59E0B",
          subtle: "#FFFBEB",
          text: "#92400E",
          border: "#FDE68A",
        },
        critical: {
          DEFAULT: "#EF4444",
          subtle: "#FEF2F2",
          text: "#991B1B",
          border: "#FECACA",
        },
        success: {
          DEFAULT: "#10B981",
          subtle: "#ECFDF5",
          text: "#065F46",
          border: "#A7F3D0",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["var(--font-jakarta)", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      boxShadow: {
        "tier-1": "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)",
        "tier-2": "0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)",
        "tier-3": "0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
