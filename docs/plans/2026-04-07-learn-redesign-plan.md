# XimiLearn Game-Vibe Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform XimiLearn from clean minimalism to a trendy game-inspired aesthetic with pixel-art accents, glassmorphism, noise textures, neon accents, and gamified animations.

**Architecture:** CSS-first approach. All effects via Tailwind config + CSS @keyframes + inline SVG. Single new dependency: canvas-confetti (3KB). Fonts via next/font/google.

**Tech Stack:** Tailwind CSS 3.4, Next.js 14 (next/font), CSS @keyframes, inline SVG pixel-art, canvas-confetti

**Design doc:** `docs/plans/2026-04-07-learn-redesign-design.md`

---

### Task 1: Install canvas-confetti and set up fonts

**Files:**
- Modify: `learn/package.json`
- Modify: `learn/src/app/layout.tsx`

**Step 1: Install canvas-confetti**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm install canvas-confetti`
Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm install -D @types/canvas-confetti`

**Step 2: Update root layout with IBM Plex fonts**

```tsx
// learn/src/app/layout.tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "XimiLearn — Химия для школьников",
  description: "Образовательная платформа по химии от Ximi4ka. Теория, реакции, задачи из школьной программы.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans text-text-dark bg-white min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
```

**Step 3: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add learn/package.json learn/package-lock.json learn/src/app/layout.tsx
git commit -m "feat(learn): add IBM Plex fonts and canvas-confetti dependency"
```

---

### Task 2: Update Tailwind config — colors, fonts, animations

**Files:**
- Modify: `learn/tailwind.config.ts`

**Step 1: Rewrite tailwind config with full design system**

```ts
// learn/tailwind.config.ts
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
        "glow-purple": "0 0 20px rgba(131,110,254,0.3)",
        "glow-cyan": "0 0 20px rgba(0,240,255,0.3)",
        "glow-magenta": "0 0 20px rgba(255,0,229,0.3)",
        "glow-lime": "0 0 20px rgba(160,255,0,0.3)",
        glass: "0 8px 32px rgba(131,110,254,0.08)",
        "glass-hover": "0 0 20px rgba(131,110,254,0.15), 0 8px 32px rgba(131,110,254,0.1)",
      },
    },
  },
  plugins: [],
};
export default config;
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/tailwind.config.ts
git commit -m "feat(learn): update tailwind config with neon colors, animations, glow shadows"
```

---

### Task 3: Update globals.css — noise overlay, glass utilities

**Files:**
- Modify: `learn/src/app/globals.css`

**Step 1: Rewrite globals.css**

```css
/* learn/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #1c1528;
}

body {
  color: var(--foreground);
  background: var(--background);
}

/* Global noise overlay */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
}

/* Pixelated rendering for pixel-art SVGs */
.image-rendering-pixelated {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* Shimmer gradient for text */
.text-shimmer {
  background: linear-gradient(
    90deg,
    rgba(141, 103, 255, 1) 0%,
    rgba(200, 86, 255, 1) 40%,
    rgba(0, 240, 255, 1) 60%,
    rgba(141, 103, 255, 1) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Neon text shadows */
.text-glow-cyan {
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.5), 0 0 20px rgba(0, 240, 255, 0.2);
}
.text-glow-lime {
  text-shadow: 0 0 10px rgba(160, 255, 0, 0.5), 0 0 20px rgba(160, 255, 0, 0.2);
}
.text-glow-magenta {
  text-shadow: 0 0 10px rgba(255, 0, 229, 0.5), 0 0 20px rgba(255, 0, 229, 0.2);
}
.text-glow-purple {
  text-shadow: 0 0 10px rgba(131, 110, 254, 0.5), 0 0 20px rgba(131, 110, 254, 0.2);
}

/* Accessibility: disable animations for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/app/globals.css
git commit -m "feat(learn): add noise overlay, shimmer text, neon glows, reduced-motion support"
```

---

### Task 4: Create PixelIcon component

**Files:**
- Create: `learn/src/components/ui/PixelIcon.tsx`

**Step 1: Create PixelIcon with all icons**

```tsx
// learn/src/components/ui/PixelIcon.tsx
import { clsx } from "clsx";

type IconName = "flask" | "atom" | "molecule" | "fire" | "star" | "crystal" | "potion" | "trophy" | "shield";

interface PixelIconProps {
  name: IconName;
  size?: number;
  className?: string;
}

const icons: Record<IconName, React.ReactNode> = {
  flask: (
    <>
      <rect x="6" y="1" width="4" height="1" fill="currentColor" />
      <rect x="5" y="2" width="1" height="4" fill="currentColor" />
      <rect x="10" y="2" width="1" height="4" fill="currentColor" />
      <rect x="4" y="6" width="1" height="1" fill="currentColor" />
      <rect x="11" y="6" width="1" height="1" fill="currentColor" />
      <rect x="3" y="7" width="1" height="2" fill="currentColor" />
      <rect x="12" y="7" width="1" height="2" fill="currentColor" />
      <rect x="2" y="9" width="1" height="3" fill="currentColor" />
      <rect x="13" y="9" width="1" height="3" fill="currentColor" />
      <rect x="2" y="12" width="1" height="2" fill="currentColor" />
      <rect x="13" y="12" width="1" height="2" fill="currentColor" />
      <rect x="3" y="14" width="10" height="1" fill="currentColor" />
      <rect x="6" y="2" width="4" height="1" fill="currentColor" opacity="0.3" />
      <rect x="4" y="10" width="8" height="4" fill="currentColor" opacity="0.15" />
    </>
  ),
  atom: (
    <>
      <rect x="7" y="7" width="2" height="2" fill="currentColor" />
      <rect x="6" y="3" width="1" height="1" fill="currentColor" />
      <rect x="9" y="3" width="1" height="1" fill="currentColor" />
      <rect x="4" y="5" width="1" height="1" fill="currentColor" />
      <rect x="11" y="5" width="1" height="1" fill="currentColor" />
      <rect x="3" y="7" width="1" height="2" fill="currentColor" />
      <rect x="12" y="7" width="1" height="2" fill="currentColor" />
      <rect x="4" y="10" width="1" height="1" fill="currentColor" />
      <rect x="11" y="10" width="1" height="1" fill="currentColor" />
      <rect x="6" y="12" width="1" height="1" fill="currentColor" />
      <rect x="9" y="12" width="1" height="1" fill="currentColor" />
      <rect x="2" y="4" width="1" height="1" fill="currentColor" opacity="0.5" />
      <rect x="13" y="4" width="1" height="1" fill="currentColor" opacity="0.5" />
      <rect x="2" y="11" width="1" height="1" fill="currentColor" opacity="0.5" />
      <rect x="13" y="11" width="1" height="1" fill="currentColor" opacity="0.5" />
    </>
  ),
  molecule: (
    <>
      <rect x="3" y="3" width="3" height="3" fill="currentColor" />
      <rect x="10" y="3" width="3" height="3" fill="currentColor" />
      <rect x="6" y="10" width="4" height="3" fill="currentColor" />
      <rect x="6" y="4" width="4" height="1" fill="currentColor" opacity="0.5" />
      <rect x="5" y="7" width="1" height="3" fill="currentColor" opacity="0.5" />
      <rect x="10" y="7" width="1" height="3" fill="currentColor" opacity="0.5" />
    </>
  ),
  fire: (
    <>
      <rect x="7" y="1" width="2" height="1" fill="currentColor" />
      <rect x="6" y="2" width="1" height="2" fill="currentColor" />
      <rect x="8" y="2" width="2" height="1" fill="currentColor" />
      <rect x="5" y="4" width="1" height="2" fill="currentColor" />
      <rect x="9" y="3" width="1" height="2" fill="currentColor" />
      <rect x="10" y="5" width="1" height="2" fill="currentColor" />
      <rect x="4" y="6" width="1" height="3" fill="currentColor" />
      <rect x="11" y="7" width="1" height="3" fill="currentColor" />
      <rect x="5" y="9" width="1" height="3" fill="currentColor" />
      <rect x="10" y="10" width="1" height="2" fill="currentColor" />
      <rect x="6" y="12" width="1" height="2" fill="currentColor" />
      <rect x="9" y="12" width="1" height="2" fill="currentColor" />
      <rect x="7" y="14" width="2" height="1" fill="currentColor" />
      <rect x="7" y="5" width="2" height="3" fill="currentColor" opacity="0.4" />
      <rect x="7" y="9" width="2" height="2" fill="currentColor" opacity="0.2" />
    </>
  ),
  star: (
    <>
      <rect x="7" y="1" width="2" height="2" fill="currentColor" />
      <rect x="7" y="3" width="2" height="1" fill="currentColor" />
      <rect x="1" y="5" width="14" height="2" fill="currentColor" />
      <rect x="3" y="7" width="10" height="1" fill="currentColor" />
      <rect x="4" y="8" width="8" height="1" fill="currentColor" />
      <rect x="4" y="9" width="3" height="1" fill="currentColor" />
      <rect x="9" y="9" width="3" height="1" fill="currentColor" />
      <rect x="3" y="10" width="3" height="1" fill="currentColor" />
      <rect x="10" y="10" width="3" height="1" fill="currentColor" />
      <rect x="2" y="11" width="3" height="1" fill="currentColor" />
      <rect x="11" y="11" width="3" height="1" fill="currentColor" />
      <rect x="1" y="12" width="3" height="2" fill="currentColor" />
      <rect x="12" y="12" width="3" height="2" fill="currentColor" />
    </>
  ),
  crystal: (
    <>
      <rect x="7" y="1" width="2" height="1" fill="currentColor" />
      <rect x="6" y="2" width="4" height="1" fill="currentColor" />
      <rect x="5" y="3" width="6" height="1" fill="currentColor" />
      <rect x="4" y="4" width="8" height="2" fill="currentColor" />
      <rect x="3" y="6" width="10" height="3" fill="currentColor" />
      <rect x="4" y="9" width="8" height="2" fill="currentColor" />
      <rect x="5" y="11" width="6" height="1" fill="currentColor" />
      <rect x="6" y="12" width="4" height="1" fill="currentColor" />
      <rect x="7" y="13" width="2" height="1" fill="currentColor" />
      <rect x="6" y="4" width="2" height="3" fill="currentColor" opacity="0.3" />
    </>
  ),
  potion: (
    <>
      <rect x="6" y="1" width="4" height="1" fill="currentColor" />
      <rect x="7" y="2" width="2" height="3" fill="currentColor" />
      <rect x="5" y="5" width="6" height="1" fill="currentColor" />
      <rect x="4" y="6" width="8" height="1" fill="currentColor" />
      <rect x="3" y="7" width="10" height="5" fill="currentColor" />
      <rect x="4" y="12" width="8" height="1" fill="currentColor" />
      <rect x="5" y="13" width="6" height="1" fill="currentColor" />
      <rect x="5" y="8" width="3" height="2" fill="currentColor" opacity="0.3" />
    </>
  ),
  trophy: (
    <>
      <rect x="3" y="1" width="10" height="1" fill="currentColor" />
      <rect x="2" y="2" width="12" height="1" fill="currentColor" />
      <rect x="1" y="3" width="3" height="3" fill="currentColor" />
      <rect x="12" y="3" width="3" height="3" fill="currentColor" />
      <rect x="4" y="3" width="8" height="5" fill="currentColor" />
      <rect x="5" y="8" width="6" height="1" fill="currentColor" />
      <rect x="6" y="9" width="4" height="1" fill="currentColor" />
      <rect x="7" y="10" width="2" height="2" fill="currentColor" />
      <rect x="5" y="12" width="6" height="1" fill="currentColor" />
      <rect x="4" y="13" width="8" height="1" fill="currentColor" />
      <rect x="6" y="4" width="2" height="2" fill="currentColor" opacity="0.3" />
    </>
  ),
  shield: (
    <>
      <rect x="3" y="1" width="10" height="1" fill="currentColor" />
      <rect x="2" y="2" width="12" height="3" fill="currentColor" />
      <rect x="3" y="5" width="10" height="3" fill="currentColor" />
      <rect x="4" y="8" width="8" height="2" fill="currentColor" />
      <rect x="5" y="10" width="6" height="2" fill="currentColor" />
      <rect x="6" y="12" width="4" height="1" fill="currentColor" />
      <rect x="7" y="13" width="2" height="1" fill="currentColor" />
      <rect x="7" y="3" width="2" height="4" fill="currentColor" opacity="0.3" />
      <rect x="5" y="5" width="6" height="1" fill="currentColor" opacity="0.3" />
    </>
  ),
};

export function PixelIcon({ name, size = 32, className }: PixelIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={clsx("image-rendering-pixelated", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {icons[name]}
    </svg>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/components/ui/PixelIcon.tsx
git commit -m "feat(learn): add PixelIcon component with 9 pixel-art chemistry icons"
```

---

### Task 5: Create AnimateOnScroll and XPPopup components

**Files:**
- Create: `learn/src/components/ui/AnimateOnScroll.tsx`
- Create: `learn/src/components/ui/XPPopup.tsx`

**Step 1: Create AnimateOnScroll**

```tsx
// learn/src/components/ui/AnimateOnScroll.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

interface AnimateOnScrollProps {
  children: React.ReactNode;
  animation?: "fade-in-up";
  delay?: number;
  className?: string;
}

export function AnimateOnScroll({
  children,
  animation = "fade-in-up",
  delay = 0,
  className,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={clsx(
        visible ? `animate-${animation}` : "opacity-0",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
```

**Step 2: Create XPPopup**

```tsx
// learn/src/components/ui/XPPopup.tsx
"use client";

import { useEffect, useState } from "react";

interface XPPopupProps {
  points: number;
  trigger: boolean;
}

export function XPPopup({ points, trigger }: XPPopupProps) {
  const [show, setShow] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (trigger && points > 0) {
      setKey((k) => k + 1);
      setShow(true);
      const t = setTimeout(() => setShow(false), 800);
      return () => clearTimeout(t);
    }
  }, [trigger, points]);

  if (!show) return null;

  return (
    <span
      key={key}
      className="inline-block font-mono font-bold text-neon-cyan text-glow-cyan animate-xp-pop"
    >
      +{points} XP
    </span>
  );
}
```

**Step 3: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add learn/src/components/ui/AnimateOnScroll.tsx learn/src/components/ui/XPPopup.tsx
git commit -m "feat(learn): add AnimateOnScroll and XPPopup components"
```

---

### Task 6: Update Card component — glass + noise + glow + neon variant

**Files:**
- Modify: `learn/src/components/ui/Card.tsx`

**Step 1: Rewrite Card**

```tsx
// learn/src/components/ui/Card.tsx
import { clsx } from "clsx";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  neon?: "cyan" | "magenta" | "lime" | "purple";
}

export function Card({ className, glass, neon, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "relative rounded-3xl p-6 transition-all duration-300",
        glass
          ? "bg-white/40 backdrop-blur-xl border border-white/20 shadow-glass hover:shadow-glass-hover"
          : "bg-white/60 backdrop-blur-sm border border-border shadow-glass hover:shadow-glass-hover",
        neon === "cyan" && "shadow-glow-cyan border-neon-cyan/30",
        neon === "magenta" && "shadow-glow-magenta border-neon-magenta/30",
        neon === "lime" && "shadow-glow-lime border-neon-lime/30",
        neon === "purple" && "shadow-glow-purple border-primary/30",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/components/ui/Card.tsx
git commit -m "feat(learn): update Card with glassmorphism, noise, glow, neon variants"
```

---

### Task 7: Update Button component — glow + tactile feedback

**Files:**
- Modify: `learn/src/components/ui/Button.tsx`

**Step 1: Rewrite Button**

```tsx
// learn/src/components/ui/Button.tsx
import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  glow?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", glow, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center font-medium transition-all active:scale-[0.98]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-white hover:shadow-glow-purple hover:scale-[1.02]":
              variant === "primary",
            "bg-white/60 backdrop-blur-sm text-text-dark border border-border hover:bg-white/80 hover:shadow-glass hover:scale-[1.02]":
              variant === "secondary",
            "text-text-secondary hover:text-text-dark hover:bg-white/40":
              variant === "ghost",
          },
          {
            "text-sm px-4 py-2 rounded-xl": size === "sm",
            "text-base px-6 py-3 rounded-2xl": size === "md",
            "text-lg px-8 py-4 rounded-3xl": size === "lg",
          },
          glow && "animate-pulse-glow",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/components/ui/Button.tsx
git commit -m "feat(learn): update Button with glow hover, tactile scale, pulse-glow option"
```

---

### Task 8: Update Badge component — neon glows + pixel icons

**Files:**
- Modify: `learn/src/components/ui/Badge.tsx`

**Step 1: Rewrite Badge**

```tsx
// learn/src/components/ui/Badge.tsx
import { clsx } from "clsx";
import { PixelIcon } from "./PixelIcon";

interface BadgeProps {
  variant?: "base" | "premium" | "streak" | "xp";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "base", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium",
        {
          "bg-primary/10 text-primary": variant === "base",
          "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-white shadow-glow-magenta":
            variant === "premium",
          "bg-neon-lime/10 text-neon-lime font-mono": variant === "streak",
          "bg-neon-cyan/10 text-neon-cyan font-mono": variant === "xp",
        },
        className
      )}
    >
      {variant === "streak" && (
        <PixelIcon name="fire" size={14} className="text-neon-orange animate-streak-fire" />
      )}
      {variant === "xp" && (
        <PixelIcon name="star" size={14} className="text-neon-cyan" />
      )}
      {variant === "premium" && (
        <PixelIcon name="crystal" size={14} className="text-white" />
      )}
      {children}
    </span>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/components/ui/Badge.tsx
git commit -m "feat(learn): update Badge with neon colors, pixel icons, streak animation"
```

---

### Task 9: Update ProgressBar — shimmer + cyan gradient

**Files:**
- Modify: `learn/src/components/ui/ProgressBar.tsx`

**Step 1: Rewrite ProgressBar**

```tsx
// learn/src/components/ui/ProgressBar.tsx
import { clsx } from "clsx";

interface ProgressBarProps {
  value: number;
  className?: string;
  size?: "sm" | "md";
}

export function ProgressBar({ value, className, size = "md" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={clsx(
        "w-full bg-white/30 backdrop-blur-sm rounded-full overflow-hidden border border-white/20",
        size === "sm" ? "h-2" : "h-3",
        className
      )}
    >
      <div
        className="relative h-full bg-gradient-to-r from-neon-cyan via-primary to-primary-gradient-end rounded-full transition-all duration-700 overflow-hidden"
        style={{ width: `${clamped}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer bg-[length:200%_100%]" />
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/components/ui/ProgressBar.tsx
git commit -m "feat(learn): update ProgressBar with cyan gradient and shimmer animation"
```

---

### Task 10: Update Input — neon cyan focus glow

**Files:**
- Modify: `learn/src/components/ui/Input.tsx`

**Step 1: Update focus styles**

Replace in `learn/src/components/ui/Input.tsx`:

Change `focus:ring-primary/30 focus:border-primary` to `focus:ring-neon-cyan/20 focus:border-neon-cyan/50 focus:shadow-glow-cyan`

Full updated classNames for input element:
```
"w-full px-4 py-3 rounded-2xl border bg-white/60 backdrop-blur-sm text-text-dark",
"placeholder:text-text-secondary/50",
"focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 focus:border-neon-cyan/50 focus:shadow-glow-cyan",
"transition-all",
error ? "border-red-400" : "border-border",
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/components/ui/Input.tsx
git commit -m "feat(learn): update Input with neon cyan focus glow"
```

---

### Task 11: Update Header — pixel flask icon + enhanced glass

**Files:**
- Modify: `learn/src/components/layout/Header.tsx`

**Step 1: Update Header**

```tsx
// learn/src/components/layout/Header.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 bg-white/60 backdrop-blur-xl border-b border-white/20 shadow-glass">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary hover:text-glow-purple transition-all">
          <PixelIcon name="flask" size={24} className="text-primary" />
          XimiLearn
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/modules" className="text-text-secondary hover:text-primary transition-colors">
            Модули
          </Link>
          <Link href="/pricing" className="text-text-secondary hover:text-primary transition-colors">
            Тарифы
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="text-text-secondary hover:text-primary transition-colors">
                Мой прогресс
              </Link>
              <Link href="/leaderboard" className="text-text-secondary hover:text-primary transition-colors">
                Рейтинг
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="sm">Профиль</Button>
              </Link>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Войти</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/components/layout/Header.tsx
git commit -m "feat(learn): update Header with pixel flask icon and enhanced glassmorphism"
```

---

### Task 12: Update Footer — glass style

**Files:**
- Modify: `learn/src/components/layout/Footer.tsx`

**Step 1: Update Footer**

```tsx
// learn/src/components/layout/Footer.tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/20 bg-white/40 backdrop-blur-xl py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 text-center text-text-secondary text-sm">
        <p>&copy; {new Date().getFullYear()} Ximi4ka. Все права защищены.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="https://ximi4ka.ru" className="hover:text-primary transition-colors">
            ximi4ka.ru
          </Link>
        </div>
      </div>
    </footer>
  );
}
```

**Step 2: Commit**

```bash
git add learn/src/components/layout/Footer.tsx
git commit -m "feat(learn): update Footer with glassmorphism"
```

---

### Task 13: Redesign Landing page — hero + floating pixels + shimmer + AnimateOnScroll

**Files:**
- Modify: `learn/src/app/(public)/page.tsx`

**Step 1: Rewrite landing page**

```tsx
// learn/src/app/(public)/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";

const features = [
  {
    title: "Теория",
    description: "Атомистика, элементы, вещества — понятно и с примерами",
    icon: "flask" as const,
  },
  {
    title: "Реакции",
    description: "Все реакции из школьной программы с пошаговым разбором",
    icon: "atom" as const,
  },
  {
    title: "Задачи",
    description: "Тренажёр задач с мгновенной проверкой и подсказками",
    icon: "potion" as const,
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 px-4 text-center overflow-hidden">
        {/* Radial gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(131,110,254,0.12)_0%,transparent_70%)]" />

        {/* Floating pixel-art decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <PixelIcon name="flask" size={48} className="absolute top-[15%] left-[10%] text-primary/20 animate-float" />
          <PixelIcon name="atom" size={36} className="absolute top-[25%] right-[15%] text-neon-cyan/20 animate-float-slow" />
          <PixelIcon name="molecule" size={40} className="absolute bottom-[20%] left-[20%] text-neon-magenta/20 animate-float-fast" />
          <PixelIcon name="star" size={32} className="absolute top-[60%] right-[10%] text-neon-lime/20 animate-float" />
          <PixelIcon name="potion" size={44} className="absolute bottom-[30%] right-[25%] text-primary/15 animate-float-slow" />
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold text-text-dark mb-6">
            Химия — это{" "}
            <span className="text-shimmer animate-shimmer">
              просто
            </span>
          </h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-8">
            Интерактивная платформа для изучения химии. Теория, реакции и задачи из школьной программы.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg" glow>Начать бесплатно</Button>
            </Link>
            <Link href="/modules">
              <Button variant="secondary" size="lg">Смотреть модули</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <AnimateOnScroll key={f.title} animation="fade-in-up" delay={i * 100}>
              <Card glass className="text-center h-full">
                <div className="mb-4 flex justify-center">
                  <PixelIcon name={f.icon} size={48} className="text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-text-secondary">{f.description}</p>
              </Card>
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">Тарифы</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <AnimateOnScroll animation="fade-in-up" delay={0}>
              <Card glass className="text-left h-full">
                <h3 className="text-xl font-bold mb-2">Подписка</h3>
                <p className="text-3xl font-bold font-mono text-primary text-glow-purple mb-1">
                  999 ₽<span className="text-base font-sans text-text-secondary">/мес</span>
                </p>
                <p className="text-sm text-text-secondary mb-4">Доступ ко всем базовым модулям</p>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li>✓ Все базовые модули</li>
                  <li>✓ Задачи с проверкой</li>
                  <li>✓ Прогресс и достижения</li>
                  <li>✓ Рейтинг учеников</li>
                </ul>
              </Card>
            </AnimateOnScroll>
            <AnimateOnScroll animation="fade-in-up" delay={100}>
              <Card neon="purple" glass className="text-left h-full">
                <h3 className="text-xl font-bold mb-2">С набором Ximi4ka</h3>
                <p className="text-3xl font-bold font-mono text-primary text-glow-purple mb-1">
                  499 ₽<span className="text-base font-sans text-text-secondary">/мес</span>
                </p>
                <p className="text-sm text-text-secondary mb-4">Промокод в каждом наборе</p>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li>✓ Всё из подписки</li>
                  <li>✓ 1 месяц бесплатно</li>
                  <li>✓ Скидка 50%</li>
                </ul>
              </Card>
            </AnimateOnScroll>
          </div>
          <Link href="/pricing" className="inline-block mt-6">
            <Button variant="ghost">Подробнее о тарифах →</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/app/(public)/page.tsx
git commit -m "feat(learn): redesign landing with floating pixels, shimmer hero, glass cards"
```

---

### Task 14: Update Dashboard — neon stat cards + font-mono

**Files:**
- Modify: `learn/src/app/(learn)/dashboard/page.tsx`

**Step 1: Update stat cards with neon variants and font-mono numbers**

Replace the stats grid (lines 23-40) with:

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
  <Card neon="cyan" className="text-center">
    <PixelIcon name="star" size={24} className="text-neon-cyan mx-auto mb-1" />
    <p className="text-3xl font-bold font-mono text-neon-cyan text-glow-cyan">{stats.totalXp}</p>
    <p className="text-sm text-text-secondary">XP</p>
  </Card>
  <Card neon="lime" className="text-center">
    <PixelIcon name="fire" size={24} className="text-neon-orange mx-auto mb-1 animate-streak-fire" />
    <p className="text-3xl font-bold font-mono text-neon-lime text-glow-lime">{stats.streak.current_streak}</p>
    <p className="text-sm text-text-secondary">дней подряд</p>
  </Card>
  <Card neon="purple" className="text-center">
    <PixelIcon name="potion" size={24} className="text-primary mx-auto mb-1" />
    <p className="text-3xl font-bold font-mono text-primary text-glow-purple">{stats.correctAttempts}</p>
    <p className="text-sm text-text-secondary">решено задач</p>
  </Card>
  <Card neon="magenta" className="text-center">
    <PixelIcon name="shield" size={24} className="text-neon-magenta mx-auto mb-1" />
    <p className="text-3xl font-bold font-mono text-neon-magenta text-glow-magenta">{accuracy}%</p>
    <p className="text-sm text-text-secondary">точность</p>
  </Card>
</div>
```

Also add import: `import { PixelIcon } from "@/components/ui/PixelIcon";`

Also update the two lower Cards to use `glass` prop: `<Card glass>` for achievements and continue learning sections.

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/app/(learn)/dashboard/page.tsx
git commit -m "feat(learn): update Dashboard with neon stat cards, pixel icons, font-mono"
```

---

### Task 15: Update Leaderboard — neon top-3 + glow current user

**Files:**
- Modify: `learn/src/app/(learn)/leaderboard/page.tsx`

**Step 1: Update leaderboard entries**

Add import: `import { PixelIcon } from "@/components/ui/PixelIcon";`

Update the map rendering (lines 22-40) — top 3 get neon glow, current user gets purple glow:

```tsx
{weekly?.map((entry, i) => {
  const isMe = entry.user_id === user.id;
  const neonColor = i === 0 ? "magenta" as const : i === 1 ? "cyan" as const : i === 2 ? "lime" as const : undefined;

  return (
    <Card
      key={entry.user_id}
      neon={isMe ? "purple" : neonColor}
      glass={i < 3}
      className={`flex items-center gap-4 py-3 ${i < 3 ? "scale-[1.01]" : ""}`}
    >
      <span className={`text-lg font-bold font-mono w-8 text-center ${
        i === 0 ? "text-neon-magenta text-glow-magenta" :
        i === 1 ? "text-neon-cyan text-glow-cyan" :
        i === 2 ? "text-neon-lime text-glow-lime" :
        "text-text-secondary"
      }`}>
        {i < 3 ? <PixelIcon name="trophy" size={20} className="mx-auto" /> : i + 1}
      </span>
      <div className="flex-1">
        <p className="font-medium text-sm">
          {entry.display_name || "Ученик"} {isMe && "(вы)"}
        </p>
      </div>
      <Badge variant="streak">{entry.current_streak} дн.</Badge>
      <Badge variant="xp">{entry.weekly_xp} XP</Badge>
    </Card>
  );
})}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/app/(learn)/leaderboard/page.tsx
git commit -m "feat(learn): update Leaderboard with neon top-3 and pixel trophies"
```

---

### Task 16: Update TaskBlock — shake on wrong + XPPopup on correct + confetti

**Files:**
- Modify: `learn/src/components/content/TaskBlock.tsx`

**Step 1: Update TaskBlock with animations**

Add imports at top:
```tsx
import { XPPopup } from "@/components/ui/XPPopup";
import confetti from "canvas-confetti";
```

Add shake state:
```tsx
const [shaking, setShaking] = useState(false);
```

In handleSubmit, after `setResult(data)`:
```tsx
if (data.is_correct) {
  confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
} else {
  setShaking(true);
  setTimeout(() => setShaking(false), 300);
}
```

Update Card wrapper:
```tsx
<Card className={`my-6 border-primary/20 bg-primary/5 ${shaking ? "animate-shake" : ""}`}>
```

After the result `is_correct` check mark text, add XPPopup:
```tsx
{result.is_correct && (
  <span className="ml-2">
    <XPPopup points={result.points_earned} trigger={result.is_correct} />
  </span>
)}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/components/content/TaskBlock.tsx
git commit -m "feat(learn): add shake, XP popup, confetti to TaskBlock"
```

---

### Task 17: Update Auth layout — floating pixels + glass

**Files:**
- Modify: `learn/src/app/(auth)/layout.tsx`

**Step 1: Update auth layout**

```tsx
// learn/src/app/(auth)/layout.tsx
import { PixelIcon } from "@/components/ui/PixelIcon";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-bg-light flex items-center justify-center p-4 overflow-hidden">
      {/* Radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(131,110,254,0.08)_0%,transparent_70%)]" />

      {/* Floating pixel decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <PixelIcon name="flask" size={40} className="absolute top-[10%] left-[15%] text-primary/15 animate-float" />
        <PixelIcon name="atom" size={32} className="absolute top-[20%] right-[20%] text-neon-cyan/15 animate-float-slow" />
        <PixelIcon name="star" size={28} className="absolute bottom-[15%] left-[25%] text-neon-lime/15 animate-float-fast" />
      </div>

      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/app/(auth)/layout.tsx
git commit -m "feat(learn): update auth layout with floating pixel-art and radial gradient"
```

---

### Task 18: Update ModuleCard — glass + hover glow

**Files:**
- Modify: `learn/src/components/modules/ModuleCard.tsx`

**Step 1: Update ModuleCard**

```tsx
// learn/src/components/modules/ModuleCard.tsx
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Module } from "@/lib/types";

interface ModuleCardProps {
  module: Module;
}

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <Link href={`/modules/${module.slug}`}>
      <Card
        glass
        neon={module.tier === "premium" ? "magenta" : undefined}
        className="hover:-translate-y-1 cursor-pointer h-full"
      >
        {module.cover_image_url && (
          <div className="aspect-video rounded-2xl overflow-hidden mb-4 bg-white/20">
            <img src={module.cover_image_url} alt={module.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={module.tier === "premium" ? "premium" : "base"}>
            {module.tier === "premium" ? "Продвинутый" : "Базовый"}
          </Badge>
          {module.tier === "premium" && module.price && (
            <span className="text-sm font-mono text-text-secondary">{module.price} ₽</span>
          )}
        </div>
        <h3 className="text-lg font-bold mb-1">{module.title}</h3>
        <p className="text-sm text-text-secondary line-clamp-2">{module.description}</p>
      </Card>
    </Link>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add learn/src/components/modules/ModuleCard.tsx
git commit -m "feat(learn): update ModuleCard with glass and neon premium glow"
```

---

### Task 19: Final build verification + push

**Step 1: Full build**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npx next build 2>&1 | tail -30`
Expected: Build succeeds with no errors

**Step 2: Lint**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run lint 2>&1 | tail -20`
Expected: No errors (warnings ok)

**Step 3: Push to remote**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn
git push origin main
```
