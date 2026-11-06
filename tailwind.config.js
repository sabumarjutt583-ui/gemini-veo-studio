/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Gemini Veo Studio design system
        bg: {
          DEFAULT: "#0B1020",
          soft: "#0d1428",
        },
        sidebar: "#10182B",
        card: {
          DEFAULT: "#151F35",
          hover: "#1a2440",
        },
        accent: {
          DEFAULT: "#6366F1",
          hover: "#4F46E5",
          soft: "rgba(99,102,241,0.14)",
        },
        accent2: {
          DEFAULT: "#8B5CF6",
          soft: "rgba(139,92,246,0.14)",
        },
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        ink: {
          DEFAULT: "#F8FAFC",
          muted: "#94A3B8",
          faint: "#64748B",
        },
        line: "rgba(148,163,184,0.12)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -20px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(99,102,241,0.35), 0 10px 40px -12px rgba(99,102,241,0.5)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.8)", opacity: "0" },
          "100%": { opacity: "0" },
        },
        "slide-up": {
          "0%": { transform: "translateY(6px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s ease-out infinite",
        "slide-up": "slide-up 0.25s ease-out both",
        "fade-in": "fade-in 0.2s ease-out both",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
