import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: "#836efe",
        "primary-hover": "#6c54fc",
        "primary-dark": "#6703ff",
        "primary-gradient-start": "rgba(141,103,255,1)",
        "primary-gradient-end": "rgba(200,86,255,1)",

        // Light (marketing + auth)
        "bg-base": "#ffffff",
        "bg-secondary": "#eeebf3",
        "bg-tertiary": "#f6f4fa",
        "text-primary": "#1c1528",
        "text-secondary": "#524667",
        "text-muted": "#8479a3",
        border: "#e8e5ef",
        "border-subtle": "#f0edf5",

        // Dark (learn)
        "dark-base": "#0f0915",
        "dark-elevated": "#1a1228",
        "dark-surface": "#221833",
        "dark-surface-hover": "#2a1f3d",
        "dark-text": "#f0eaff",
        "dark-text-secondary": "#a89fc4",
        "dark-text-muted": "#6f6489",

        // Semantic
        success: "#5dc973",
        "success-dark": "#6ee7a0",
        error: "#f56565",
        "error-dark": "#fc8181",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "32px",
        "3xl": "40px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
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
          "0%, 100%": { boxShadow: "0 0 15px rgba(131,110,254,0.25)" },
          "50%": { boxShadow: "0 0 30px rgba(131,110,254,0.5)" },
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
        shimmer: "shimmer 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "float-slow": "float 6s ease-in-out infinite",
        shake: "shake 0.3s ease-in-out",
        "count-up": "count-up 0.4s ease-out",
        "xp-pop": "xp-pop 0.8s ease-out forwards",
        "streak-fire": "streak-fire 0.6s ease-in-out infinite",
      },
      boxShadow: {
        // Light shadows
        soft: "0 4px 20px rgba(28,21,40,0.06)",
        "soft-lg": "0 10px 40px rgba(28,21,40,0.08)",
        "card-hover": "0 12px 32px rgba(131,110,254,0.12)",

        // Glassmorphism
        "glass-light": "0 8px 32px rgba(131,110,254,0.08)",
        "glass-dark": "0 8px 32px rgba(0,0,0,0.32)",

        // Purple glow (only purple — no neon)
        "glow-purple": "0 0 20px rgba(131,110,254,0.35), 0 0 40px rgba(131,110,254,0.15)",
        "glow-purple-strong": "0 0 30px rgba(131,110,254,0.5), 0 0 60px rgba(131,110,254,0.2)",
      },
    },
  },
  plugins: [],
};
export default config;
