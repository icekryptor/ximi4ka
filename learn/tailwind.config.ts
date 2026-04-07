import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#836efe",
        "primary-dark": "#6703ff",
        "primary-gradient-start": "rgba(141,103,255,1)",
        "primary-gradient-end": "rgba(200,86,255,1)",
        "text-dark": "#1c1528",
        "text-secondary": "#524667",
        border: "#e8e5ef",
        "bg-light": "#eeebf3",
        "bg-dark": "#0f0a1a",
        "bg-dark-secondary": "#1a1326",
        "surface-dark": "#261e35",
        neon: {
          cyan: "#00f0ff",
          magenta: "#ff00e5",
          lime: "#a0ff00",
          orange: "#ff6b00",
        },
        glow: {
          cyan: "rgba(0,240,255,0.4)",
          magenta: "rgba(255,0,229,0.4)",
          lime: "rgba(160,255,0,0.4)",
          purple: "rgba(131,110,254,0.4)",
        },
      },
      borderRadius: {
        xl: "20px",
        "2xl": "30px",
        "3xl": "40px",
        "4xl": "55px",
      },
      fontFamily: {
        sans: ["var(--font-plex)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 15px rgba(131,110,254,0.2)" },
          "50%": { boxShadow: "0 0 25px rgba(131,110,254,0.5)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px) rotate(-1deg)" },
          "75%": { transform: "translateX(4px) rotate(1deg)" },
        },
        "count-up": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)" },
        },
        "xp-pop": {
          "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(-30px) scale(1.1)" },
        },
        "streak-fire": {
          "0%, 100%": { transform: "scaleY(1) scaleX(1)" },
          "25%": { transform: "scaleY(1.1) scaleX(0.9)" },
          "50%": { transform: "scaleY(0.95) scaleX(1.05)" },
          "75%": { transform: "scaleY(1.05) scaleX(0.95)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        shimmer: "shimmer 2s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "float-slow": "float 5s ease-in-out infinite",
        "float-fast": "float 2s ease-in-out infinite",
        shake: "shake 0.3s ease-in-out",
        "count-up": "count-up 0.4s ease-out",
        "xp-pop": "xp-pop 0.8s ease-out forwards",
        "streak-fire": "streak-fire 0.6s ease-in-out infinite",
      },
      boxShadow: {
        "glow-purple": "0 0 25px rgba(131,110,254,0.4), 0 0 50px rgba(131,110,254,0.15)",
        "glow-cyan": "0 0 25px rgba(0,240,255,0.4), 0 0 50px rgba(0,240,255,0.15)",
        "glow-magenta": "0 0 25px rgba(255,0,229,0.4), 0 0 50px rgba(255,0,229,0.15)",
        "glow-lime": "0 0 25px rgba(160,255,0,0.4), 0 0 50px rgba(160,255,0,0.15)",
        glass: "0 8px 32px rgba(131,110,254,0.12)",
        "glass-hover": "0 0 25px rgba(131,110,254,0.2), 0 8px 32px rgba(131,110,254,0.15)",
      },
    },
  },
  plugins: [],
};
export default config;
