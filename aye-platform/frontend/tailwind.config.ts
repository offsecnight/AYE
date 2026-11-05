import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    screens: {
      // Add xs breakpoint for very small phones (360px)
      xs:  "360px",
      sm:  "640px",
      md:  "768px",
      lg:  "1024px",
      xl:  "1280px",
      "2xl": "1536px",
    },
    extend: {
      // ── BRUTALIST PALETTE ──────────────────────────────────
      colors: {
        acid:    "#D4F542",
        ink:     "#0A0A0A",
        paper:   "#F0EFE6",
        card:    "#FFFFFF",
        danger:  "#E11D48",
        amber:   "#F59E0B",
        emerald: "#10B981",
        void:    "#0B0C10",
        surface: "#14161D",
      },

      // ── TYPOGRAPHY ────────────────────────────────────────
      fontFamily: {
        mono:    ["'Space Mono'",    "monospace"],
        grotesk: ["'Space Grotesk'", "sans-serif"],
      },

      // ── HARD OFFSET SHADOWS ───────────────────────────────
      boxShadow: {
        brutal:       "4px 4px 0px 0px #0A0A0A",
        "brutal-sm":  "2px 2px 0px 0px #0A0A0A",
        "brutal-lg":  "6px 6px 0px 0px #0A0A0A",
        "brutal-acid":"4px 4px 0px 0px #D4F542",
        "brutal-red": "4px 4px 0px 0px #E11D48",
        pressed:      "1px 1px 0px 0px #0A0A0A",
      },

      // ── BORDERS ───────────────────────────────────────────
      borderWidth: {
        "3": "3px",
      },

      // ── ANIMATION ─────────────────────────────────────────
      keyframes: {
        ticker: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0" },
        },
      },
      animation: {
        ticker: "ticker 25s linear infinite",
        blink:  "blink 1s step-end infinite",
      },
    },
  },
  plugins: [
    // scrollbar-none utility for hiding scrollbars on mobile filter chips
    function({ addUtilities }: { addUtilities: (u: Record<string, Record<string, string>>) => void }) {
      addUtilities({
        ".scrollbar-none": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
        },
        ".scrollbar-none::-webkit-scrollbar": {
          "display": "none",
        },
      });
    },
  ],
};

export default config;
