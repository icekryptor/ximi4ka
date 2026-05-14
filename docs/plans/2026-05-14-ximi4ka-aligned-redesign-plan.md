# XimiLearn — ximi4ka-aligned redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Re-align XimiLearn visuals with the ximi4ka.ru parent brand (light marketing, dark learn, no neon, no pixel-art, Manrope+Unbounded+JetBrains Mono).

**Architecture:** Two-zone visual system: marketing/auth on light theme matching ximi4ka.ru (white bg, ximi4ka purple, Arial-replaced-by-Manrope, large rounded radii, glassmorphism on key cards only); learn-zone keeps dark base but switches from neon palette to monochromatic purple. Gamification mechanics (XP, streaks, confetti, animations) preserved but recolored.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS 3.4, next/font/google, lucide-react, canvas-confetti.

**Reference design doc:** `docs/plans/2026-05-14-ximi4ka-aligned-redesign-design.md`

**Working directory:** `/Users/vasilijaistov/Desktop/continuum/ximi4ka/learn`

**Verification command (run after each batch):** `cd learn && npm run build`

---

## Task 1: Install dependencies

**Files:**
- Modify: `learn/package.json`
- Modify: `learn/package-lock.json`

**Step 1:** Install lucide-react.

```bash
cd learn && npm install lucide-react
```

**Step 2:** Verify install.

```bash
cd learn && grep '"lucide-react"' package.json
```
Expected: `"lucide-react": "^0.4..."` or similar.

**Step 3:** Commit.

```bash
git add learn/package.json learn/package-lock.json
git commit -m "chore(learn): add lucide-react for ximi4ka-aligned icons"
```

---

## Task 2: Replace fonts in layout.tsx

**Files:**
- Modify: `learn/src/app/layout.tsx`

**Step 1:** Open `learn/src/app/layout.tsx`. Replace IBM Plex imports with Manrope, Unbounded, JetBrains Mono.

```tsx
import type { Metadata } from "next";
import { Manrope, Unbounded, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "XimiLearn — химия это просто",
  description: "Интерактивная платформа для изучения химии",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${manrope.variable} ${unbounded.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans text-text-primary bg-bg-base min-h-screen flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
```

Note: keep existing `<Header />` / `<Footer />` rendering if they were in the file — preserve any other markup that's there. Only swap fonts and update body classes.

**Step 2:** Verify build still works.

```bash
cd learn && npm run build 2>&1 | tail -20
```
Expected: build succeeds.

**Step 3:** Commit.

```bash
git add learn/src/app/layout.tsx
git commit -m "feat(learn): swap fonts to Manrope + Unbounded + JetBrains Mono"
```

---

## Task 3: Rewrite tailwind.config.ts with new tokens

**Files:**
- Modify: `learn/tailwind.config.ts`

**Step 1:** Replace entire file contents:

```ts
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
```

**Step 2:** Verify build.

```bash
cd learn && npm run build 2>&1 | tail -10
```
Expected: success (may warn about unused tokens — OK).

**Step 3:** Commit.

```bash
git add learn/tailwind.config.ts
git commit -m "feat(learn): rewrite tailwind tokens — remove neon, add ximi4ka light theme"
```

---

## Task 4: Rewrite globals.css

**Files:**
- Modify: `learn/src/app/globals.css`

**Step 1:** Replace entire file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #1c1528;
}

[data-theme="dark"] {
  --background: #0f0915;
  --foreground: #f0eaff;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-feature-settings: "ss01", "cv11";
}

/* Display font utility */
.font-display {
  font-family: var(--font-display), system-ui, sans-serif;
  letter-spacing: -0.02em;
}

/* Tabular numbers for counters */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Shimmer gradient — purple only */
.text-shimmer {
  background: linear-gradient(
    90deg,
    rgba(131, 110, 254, 1) 0%,
    rgba(200, 86, 255, 1) 50%,
    rgba(131, 110, 254, 1) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Purple text glow (used in dark learn-zone) */
.text-glow-purple {
  text-shadow: 0 0 12px rgba(131, 110, 254, 0.5), 0 0 24px rgba(131, 110, 254, 0.2);
}

/* Hero radial gradient backgrounds */
.bg-hero-light {
  background:
    radial-gradient(circle at 50% 0%, rgba(131, 110, 254, 0.06) 0%, transparent 60%),
    #ffffff;
}

.bg-hero-dark {
  background:
    radial-gradient(circle at 50% 0%, rgba(131, 110, 254, 0.18) 0%, transparent 60%),
    #0f0915;
}

/* Accessibility: reduced motion */
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
  .text-pretty {
    text-wrap: pretty;
  }
}
```

**Step 2:** Verify build.

```bash
cd learn && npm run build 2>&1 | tail -5
```

**Step 3:** Commit.

```bash
git add learn/src/app/globals.css
git commit -m "feat(learn): rewrite globals.css — remove noise, neon glows; add hero gradients"
```

---

## Task 5: Delete PixelIcon component

**Files:**
- Delete: `learn/src/components/ui/PixelIcon.tsx`

**Step 1:** Delete the file.

```bash
rm learn/src/components/ui/PixelIcon.tsx
```

**Step 2:** Find all imports of PixelIcon (will be replaced in following tasks).

```bash
cd learn && grep -rn "PixelIcon" src --include="*.tsx" --include="*.ts" | head -30
```
Note: build will FAIL until those imports are replaced (next tasks). That's expected.

**Step 3:** Don't commit yet — wait until imports are gone.

---

## Task 6: Rewrite Card component

**Files:**
- Modify: `learn/src/components/ui/Card.tsx`

**Step 1:** Read current file to preserve API.

```bash
cd learn && cat src/components/ui/Card.tsx
```

**Step 2:** Replace with two-theme version. The Card adapts to its containing zone via a `theme` prop OR auto-detects from `data-theme` ancestor. Use simple approach: prop `theme?: "light" | "dark"` defaulting to "light".

```tsx
import { ReactNode, HTMLAttributes } from "react";
import { clsx } from "clsx";

type CardProps = {
  children: ReactNode;
  glass?: boolean;
  theme?: "light" | "dark";
  hover?: boolean;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export default function Card({
  children,
  glass = false,
  theme = "light",
  hover = false,
  className,
  ...rest
}: CardProps) {
  const base = "rounded-2xl transition-all duration-200";

  const surface = glass
    ? theme === "light"
      ? "bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass-light"
      : "bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] shadow-glass-dark"
    : theme === "light"
      ? "bg-white border border-border shadow-soft"
      : "bg-dark-surface border border-white/[0.08]";

  const hoverCls = hover
    ? "hover:-translate-y-0.5 hover:shadow-card-hover"
    : "";

  return (
    <div className={clsx(base, surface, hoverCls, className)} {...rest}>
      {children}
    </div>
  );
}
```

**Step 3:** Check `clsx` is available. If not, install.

```bash
cd learn && grep '"clsx"' package.json || npm install clsx
```

**Step 4:** Don't run build yet (Task 5 broke things). Continue to Task 7.

---

## Task 7: Rewrite Button component

**Files:**
- Modify: `learn/src/components/ui/Button.tsx`

**Step 1:** Replace with:

```tsx
import { ReactNode, ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  glow?: boolean;
  theme?: "light" | "dark";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  children,
  variant = "primary",
  size = "md",
  glow = false,
  theme = "light",
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold rounded-full cursor-pointer transition-all duration-200 active:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizes: Record<ButtonSize, string> = {
    sm: "text-sm px-5 py-2.5",
    md: "text-base px-6 py-3",
    lg: "text-base px-8 py-3.5",
  };

  const variants: Record<ButtonVariant, string> = {
    primary:
      "text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:shadow-glow-purple",
    secondary:
      theme === "light"
        ? "bg-white text-text-primary border border-border hover:bg-bg-tertiary"
        : "bg-white/10 text-dark-text border border-white/10 hover:bg-white/15",
    ghost:
      theme === "light"
        ? "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
        : "text-dark-text-secondary hover:text-dark-text hover:bg-white/10",
  };

  const glowCls = glow ? "animate-pulse-glow" : "";

  return (
    <button
      className={clsx(base, sizes[size], variants[variant], glowCls, className)}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
```

**Step 2:** Continue to next task (don't build yet).

---

## Task 8: Rewrite Input component

**Files:**
- Modify: `learn/src/components/ui/Input.tsx`

**Step 1:** Replace with:

```tsx
import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

type InputProps = {
  label?: string;
  error?: string;
  theme?: "light" | "dark";
} & InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, theme = "light", className, id, ...rest },
  ref
) {
  const inputId = id ?? rest.name;
  const base =
    "w-full rounded-lg px-4 py-3 text-base transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/30";

  const surface =
    theme === "light"
      ? "bg-white text-text-primary border border-border placeholder:text-text-muted focus:border-primary"
      : "bg-white/[0.05] text-dark-text border border-white/10 placeholder:text-dark-text-muted focus:border-primary";

  const errCls = error ? "border-error focus:border-error focus:ring-error/20" : "";

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={clsx(
            "block mb-2 text-sm font-medium",
            theme === "light" ? "text-text-secondary" : "text-dark-text-secondary"
          )}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(base, surface, errCls, className)}
        {...rest}
      />
      {error && <p className="mt-1.5 text-sm text-error">{error}</p>}
    </div>
  );
});

export default Input;
```

---

## Task 9: Rewrite Badge component

**Files:**
- Modify: `learn/src/components/ui/Badge.tsx`

**Step 1:** Replace with:

```tsx
import { ReactNode } from "react";
import { clsx } from "clsx";
import { Flame, Star, Sparkles } from "lucide-react";

type BadgeVariant = "streak" | "xp" | "premium" | "default";
type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  theme?: "light" | "dark";
  className?: string;
};

export default function Badge({
  children,
  variant = "default",
  theme = "light",
  className,
}: BadgeProps) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold";

  const variants: Record<BadgeVariant, string> = {
    streak: "bg-primary/10 text-primary",
    xp: "bg-primary/10 text-primary tabular-nums font-mono",
    premium:
      "text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end shadow-glow-purple",
    default:
      theme === "light"
        ? "bg-bg-secondary text-text-primary"
        : "bg-white/10 text-dark-text",
  };

  const Icon =
    variant === "streak" ? Flame : variant === "xp" ? Star : variant === "premium" ? Sparkles : null;

  return (
    <span className={clsx(base, variants[variant], className)}>
      {Icon && (
        <Icon
          className={clsx(
            "w-3.5 h-3.5",
            variant === "streak" && "animate-streak-fire"
          )}
        />
      )}
      {children}
    </span>
  );
}
```

---

## Task 10: Rewrite ProgressBar component

**Files:**
- Modify: `learn/src/components/ui/ProgressBar.tsx`

**Step 1:** Replace with:

```tsx
import { clsx } from "clsx";

type ProgressBarProps = {
  value: number;
  max?: number;
  theme?: "light" | "dark";
  showLabel?: boolean;
  className?: string;
};

export default function ProgressBar({
  value,
  max = 100,
  theme = "light",
  showLabel = false,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  const trackCls =
    theme === "light"
      ? "bg-bg-secondary border border-border-subtle"
      : "bg-white/[0.05] border border-white/[0.08]";

  return (
    <div className={clsx("w-full", className)}>
      <div
        className={clsx("relative w-full h-2.5 rounded-full overflow-hidden", trackCls)}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end transition-all duration-500 ease-out relative"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer bg-[length:200%_100%]" />
        </div>
      </div>
      {showLabel && (
        <p
          className={clsx(
            "mt-1.5 text-xs font-mono tabular-nums",
            theme === "light" ? "text-text-secondary" : "text-dark-text-secondary"
          )}
        >
          {value}/{max}
        </p>
      )}
    </div>
  );
}
```

---

## Task 11: Update Header component (light marketing variant)

**Files:**
- Modify: `learn/src/components/layout/Header.tsx`

**Step 1:** Read current file first.

```bash
cd learn && cat src/components/layout/Header.tsx
```

**Step 2:** Replace with light-themed header. Use Lucide `FlaskConical` instead of pixel flask icon.

```tsx
"use client";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <FlaskConical className="w-6 h-6 text-primary group-hover:rotate-12 transition-transform" />
          <span className="font-display text-xl font-bold text-text-primary">
            XimiLearn
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link href="/modules" className="text-text-secondary hover:text-primary transition-colors">
            Модули
          </Link>
          <Link href="/pricing" className="text-text-secondary hover:text-primary transition-colors">
            Тарифы
          </Link>
          <Link href="/leaderboard" className="text-text-secondary hover:text-primary transition-colors">
            Рейтинг
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold text-white px-5 py-2 rounded-full bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:shadow-glow-purple transition-shadow"
          >
            Начать
          </Link>
        </div>
      </div>
    </header>
  );
}
```

---

## Task 12: Update Footer component (light)

**Files:**
- Modify: `learn/src/components/layout/Footer.tsx`

**Step 1:** Read current.

```bash
cd learn && cat src/components/layout/Footer.tsx
```

**Step 2:** Replace with light Footer:

```tsx
export default function Footer() {
  return (
    <footer className="mt-auto bg-white border-t border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 text-sm text-text-muted text-center space-y-2">
        <p>© 2026 Ximi4ka. Все права защищены.</p>
        <p>
          <a
            href="https://ximi4ka.ru"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            ximi4ka.ru
          </a>
        </p>
      </div>
    </footer>
  );
}
```

---

## Task 13: Replace AnimateOnScroll uses (verify compatibility)

**Files:**
- Modify: `learn/src/components/ui/AnimateOnScroll.tsx` (only if it referenced removed tokens)

**Step 1:** Check current implementation.

```bash
cd learn && cat src/components/ui/AnimateOnScroll.tsx
```

If it doesn't reference neon colors or pixel-art, leave it. Most likely no changes needed.

---

## Task 14: Update XPPopup component (purple instead of neon-cyan)

**Files:**
- Modify: `learn/src/components/ui/XPPopup.tsx`

**Step 1:** Read current.

```bash
cd learn && cat src/components/ui/XPPopup.tsx
```

**Step 2:** Replace neon-cyan and text-glow-cyan with primary + text-glow-purple. Should be a small change. New file:

```tsx
"use client";
import { useEffect, useState } from "react";

type XPPopupProps = {
  amount: number;
  show: boolean;
  onComplete?: () => void;
};

export default function XPPopup({ amount, show, onComplete }: XPPopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 800);
      return () => clearTimeout(t);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[60]">
      <div className="font-mono font-bold text-4xl text-primary text-glow-purple animate-xp-pop tabular-nums">
        +{amount} XP
      </div>
    </div>
  );
}
```

---

## Task 15: Build checkpoint — verify components compile

**Step 1:** Try to build.

```bash
cd learn && npm run build 2>&1 | tail -40
```

Expected: build will FAIL on pages that still import `PixelIcon` or use removed tokens (`neon-*`, `bg-dark`, `text-text-dark`, etc.). That's OK — page tasks come next. Note which pages fail.

**Step 2:** Don't commit yet — pages will be fixed in following tasks.

---

## Task 16: Update landing page `/`

**Files:**
- Modify: `learn/src/app/(public)/page.tsx`

**Step 1:** Read current file.

```bash
cd learn && cat 'src/app/(public)/page.tsx'
```

**Step 2:** Rewrite as light ximi4ka-style landing.

Key requirements:
- `<main>` wraps content with `bg-hero-light` class on outer div
- Hero: H1 in `font-display` Unbounded, "просто" word with `text-shimmer animate-shimmer`
- CTA buttons: pill, primary glows, secondary clean
- Replace ALL `<PixelIcon>` with Lucide icons (`FlaskConical`, `Atom`, `TestTube`, etc.)
- Feature cards: solid white `<Card>`, no `glass`, `hover` enabled
- Pricing section: 2 cards, second one (`Premium`) is `<Card glass>` with `neon="purple"` removed → just glass
- Remove all `text-text-secondary` references that referred to old tokens — use `text-text-secondary` (it's now in new tokens)
- Replace any `text-gray-400` with `text-text-secondary`
- All buttons: replace `<Button>` usage to use new prop signature (no `glow={true}` on secondary, only on primary CTA)

```tsx
import Link from "next/link";
import {
  FlaskConical,
  Atom,
  TestTube,
  Beaker,
  Sparkles,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";

export default function HomePage() {
  return (
    <main className="flex-1">
      {/* HERO */}
      <section className="bg-hero-light relative">
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
          <h1 className="font-display text-5xl md:text-7xl font-bold text-text-primary leading-tight tracking-tight text-balance">
            Химия — это{" "}
            <span className="text-shimmer animate-shimmer">просто</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-text-secondary max-w-2xl mx-auto text-pretty">
            Интерактивная платформа для изучения химии. Теория, реакции и задачи из школьной программы.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" glow>
                Начать бесплатно
              </Button>
            </Link>
            <Link href="/modules">
              <Button size="lg" variant="secondary">
                Смотреть модули
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-bg-secondary py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-text-primary text-center mb-14">
            Всё, что нужно для химии
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Atom, title: "Теория", desc: "Атомистика, элементы, вещества — понятно и с примерами" },
              { icon: Beaker, title: "Реакции", desc: "Все реакции из школьной программы с пошаговым разбором" },
              { icon: TestTube, title: "Задачи", desc: "Тренажёр задач с мгновенной проверкой и подсказками" },
            ].map((f, i) => (
              <AnimateOnScroll key={f.title} delay={i * 100}>
                <Card hover className="p-8 h-full">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                    <f.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-text-primary mb-2">
                    {f.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed">{f.desc}</p>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-text-primary text-center mb-14">
            Тарифы
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card hover className="p-8">
              <h3 className="font-display text-2xl font-bold text-text-primary mb-2">
                Подписка
              </h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="font-mono text-4xl font-bold text-primary tabular-nums">
                  990
                </span>
                <span className="font-mono text-text-secondary">₽/мес</span>
              </div>
              <ul className="space-y-2 text-text-secondary">
                <li>✓ Все базовые модули</li>
                <li>✓ Задачи с проверкой</li>
                <li>✓ Прогресс и достижения</li>
                <li>✓ Рейтинг учеников</li>
              </ul>
            </Card>

            <Card glass hover className="p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end shadow-glow-purple">
                  <Sparkles className="w-3 h-3" />
                  С набором
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold text-text-primary mb-2">
                С набором Ximi4ka
              </h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="font-mono text-4xl font-bold text-primary tabular-nums">
                  499
                </span>
                <span className="font-mono text-text-secondary">₽/мес</span>
              </div>
              <p className="text-sm text-text-muted mb-3">Промокод в каждом наборе</p>
              <ul className="space-y-2 text-text-secondary">
                <li>✓ Всё из подписки</li>
                <li>✓ 1 месяц бесплатно</li>
                <li>✓ Скидка 50%</li>
              </ul>
            </Card>
          </div>

          <div className="text-center mt-10">
            <Link
              href="/pricing"
              className="text-primary font-medium hover:text-primary-hover transition-colors"
            >
              Подробнее о тарифах →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
```

**Step 3:** Try build.

```bash
cd learn && npm run build 2>&1 | tail -10
```

If errors mention other pages, that's expected. Don't commit yet.

---

## Task 17: Update auth pages

**Files:**
- Modify: `learn/src/app/(auth)/layout.tsx`
- Modify: `learn/src/app/(auth)/login/page.tsx`
- Modify: `learn/src/app/(auth)/register/page.tsx`

**Step 1:** Update `(auth)/layout.tsx` to light theme without floats:

```tsx
import { ReactNode } from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-hero-light flex flex-col">
      <header className="px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-primary" />
          <span className="font-display text-xl font-bold text-text-primary">
            XimiLearn
          </span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        {children}
      </main>
    </div>
  );
}
```

**Step 2:** Update login + register pages — remove old token references. Most changes: replace `text-text-secondary` (still exists in new tokens, OK), remove `bg-dark`, replace `text-gray-300` etc.

Run grep first to find issues:

```bash
cd learn && grep -n "neon-\|bg-dark\|text-gray-\|surface-dark\|PixelIcon" 'src/app/(auth)/login/page.tsx' 'src/app/(auth)/register/page.tsx'
```

Then replace each occurrence with new tokens:
- `text-gray-100` → `text-text-primary`
- `text-gray-300` → `text-text-secondary`
- `text-gray-400` → `text-text-muted`
- `bg-bg-dark` → `bg-bg-base`
- `bg-surface-dark` → `bg-white`
- `border-white/10` → `border-border`
- Use `<Card>` wrapper (defaults to light)

Use the actual edit pattern based on what's in the file.

---

## Task 18: Add `data-theme="dark"` to learn layout

**Files:**
- Modify: `learn/src/app/(learn)/layout.tsx`

**Step 1:** Read current.

```bash
cd learn && cat 'src/app/(learn)/layout.tsx'
```

**Step 2:** Wrap learn-zone in dark theme container:

```tsx
import { ReactNode } from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" className="min-h-screen flex flex-col bg-dark-base text-dark-text">
      <header className="sticky top-0 z-50 bg-dark-base/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <FlaskConical className="w-6 h-6 text-primary" />
            <span className="font-display text-xl font-bold text-dark-text">
              XimiLearn
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Главная
            </Link>
            <Link href="/learn" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Учиться
            </Link>
            <Link href="/leaderboard" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Рейтинг
            </Link>
            <Link href="/profile" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Профиль
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

If existing layout has different structure (sidebar, etc.), preserve it but apply same color/font tokens.

---

## Task 19: Update Dashboard

**Files:**
- Modify: `learn/src/app/(learn)/dashboard/page.tsx`

**Step 1:** Read current.

```bash
cd learn && cat 'src/app/(learn)/dashboard/page.tsx'
```

**Step 2:** Replace neon stat cards with monochromatic purple variants.

Key changes:
- All 4 stat cards: `<Card theme="dark" hover>` instead of neon variants
- Each shows a Lucide icon in `text-primary` inside `bg-primary/10` rounded square
- Numbers in `font-mono tabular-nums text-3xl text-primary` with `text-glow-purple`
- Lower cards: `<Card theme="dark" glass>` for hero "Continue learning"

Example stat card:
```tsx
<Card theme="dark" hover className="p-6">
  <div className="flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
      <Star className="w-6 h-6 text-primary" />
    </div>
    <div>
      <p className="text-sm text-dark-text-secondary mb-1">Опыт</p>
      <p className="font-mono text-3xl font-bold text-primary text-glow-purple tabular-nums">
        {xp}
      </p>
    </div>
  </div>
</Card>
```

Lucide mapping for stats:
- XP → `Star`
- Streak → `Flame`
- Solved → `CheckCircle`
- Accuracy → `Target`

---

## Task 20: Update Leaderboard

**Files:**
- Modify: `learn/src/app/(learn)/leaderboard/page.tsx`

**Step 1:** Read current.

```bash
cd learn && cat 'src/app/(learn)/leaderboard/page.tsx'
```

**Step 2:** Top-3 cards: all use `<Card theme="dark" glass>` with `shadow-glow-purple` (no rainbow). Trophy icons via Lucide `Trophy` in `text-primary`. Current user row: `<Card theme="dark">` with primary border accent.

---

## Task 21: Update lesson page

**Files:**
- Modify: `learn/src/app/(learn)/learn/[slug]/page.tsx`
- Modify: `learn/src/app/(learn)/learn/[slug]/[lesson]/page.tsx`

**Step 1:** Read both.

```bash
cd learn && cat 'src/app/(learn)/learn/[slug]/page.tsx' 'src/app/(learn)/learn/[slug]/[lesson]/page.tsx'
```

**Step 2:** Token replacements:
- `text-gray-400` → `text-dark-text-secondary`
- `text-text-secondary` (when in learn-zone) → `text-dark-text-secondary`
- Keep the `bg-white/95` content panel pattern (preserves readability for lesson body)
- Wrap content panel `text-text-primary` (in light card it stays dark)

---

## Task 22: Update remaining learn pages

**Files:**
- Modify: `learn/src/app/(learn)/profile/page.tsx`
- Modify: `learn/src/app/(learn)/achievements/page.tsx`

Same pattern: `theme="dark"` on all Cards, replace tokens, replace icons with Lucide.

---

## Task 23: Update modules pages (light)

**Files:**
- Modify: `learn/src/app/(public)/modules/page.tsx`
- Modify: `learn/src/app/(public)/modules/[slug]/page.tsx`
- Modify: `learn/src/components/modules/ModuleCard.tsx`

**Step 1:** Token replacements:
- Remove `bg-dark`, `surface-dark`, `text-gray-*`
- Use `bg-white`, `border-border`, `text-text-primary`, `text-text-secondary`
- ModuleCard: `<Card hover>` (light), Lucide icons, premium variant uses gradient badge

---

## Task 24: Update pricing page (light)

**Files:**
- Modify: `learn/src/app/(public)/pricing/page.tsx`

**Step 1:** Read current. Replace tokens to light theme (similar to landing pricing section). Premium tier card uses `<Card glass>`.

---

## Task 25: Update TaskBlock confetti palette

**Files:**
- Modify: `learn/src/components/content/TaskBlock.tsx`

**Step 1:** Find the `confetti(` call.

```bash
cd learn && grep -n "confetti" 'src/components/content/TaskBlock.tsx'
```

**Step 2:** Update colors prop:

```tsx
import confetti from "canvas-confetti";

// inside correct-answer handler:
confetti({
  particleCount: 80,
  spread: 70,
  origin: { y: 0.6 },
  colors: ["#836efe", "#c856ff", "#ad7afe", "#9d8aff", "#8d67ff"],
});
```

Also replace any `text-text-secondary` / `text-gray-*` with appropriate tokens — TaskBlock renders inside the `bg-white/95` content panel in lesson page, so use light tokens (`text-text-secondary`, `text-text-primary`).

---

## Task 26: Update admin layout (preserve, but ensure no broken tokens)

**Files:**
- Modify: `learn/src/app/(admin)/layout.tsx` (only if it referenced removed tokens)

**Step 1:** Check.

```bash
cd learn && grep -n "neon-\|bg-dark\|surface-dark\|PixelIcon" 'src/app/(admin)/layout.tsx'
```

If matches: replace with new tokens (`bg-white`, `text-text-primary`, etc.). Admin should remain light & functional.

---

## Task 27: Final build verification

**Step 1:** Run full build.

```bash
cd learn && npm run build 2>&1 | tail -30
```

Expected: success.

**Step 2:** Grep for forbidden tokens — must return ZERO matches.

```bash
cd learn && grep -rn "neon-cyan\|neon-magenta\|neon-lime\|neon-orange\|PixelIcon\|font-plex\|bg-dark-secondary\|surface-dark" src --include="*.tsx" --include="*.ts" --include="*.css"
```

Expected: no output.

**Step 3:** Grep for any leftover `text-gray-` (should be replaced).

```bash
cd learn && grep -rn "text-gray-" src --include="*.tsx" | head -10
```

If any remain, fix them: `text-gray-400` → `text-text-muted` (light) or `text-dark-text-muted` (dark), etc.

---

## Task 28: Visual smoke test

**Step 1:** Start preview.

```bash
cd learn && npm run dev
```

(In subagent flow: use Claude Preview to start server.)

**Step 2:** Visit and screenshot:
- `/` (light landing)
- `/pricing` (light)
- `/login` (light auth)
- `/dashboard` (dark learn)
- `/leaderboard` (dark)
- `/learn/inorganic-chemistry` (or any module)

**Step 3:** Verify visually:
- Fonts: Manrope body, Unbounded headings, JetBrains Mono numbers in dark zone
- No neon anywhere
- Light pages: white bg, large rounded cards, ximi4ka purple
- Dark pages: deep purple-black bg, purple glow accents only
- All icons render (no broken images, no pixel-art)
- Hover states feel smooth
- Animations work (CTA pulse, hero shimmer, confetti on correct answer)

---

## Task 29: Final commit and push

**Step 1:** Stage everything.

```bash
git add learn/ docs/plans/2026-05-14-ximi4ka-aligned-redesign-design.md docs/plans/2026-05-14-ximi4ka-aligned-redesign-plan.md
```

**Step 2:** Commit.

```bash
git commit -m "$(cat <<'EOF'
feat(learn): ximi4ka-aligned redesign — light marketing, dark learn, no neon

Two-zone visual system. Marketing/auth: light ximi4ka.ru style with
Manrope+Unbounded+JetBrains Mono, large rounded radii, moderate glassmorphism
on key cards. Learn-zone: dark with purple-tinted base (#0f0915), all neon
removed, monochromatic purple gamification preserved (XP, streaks, confetti
recolored, animations kept). Pixel-art replaced with Lucide icons throughout.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

**Step 3:** Push.

```bash
git push origin main
```

---

## Plan complete

Plan saved to `docs/plans/2026-05-14-ximi4ka-aligned-redesign-plan.md`. User has chosen: **subagent-driven session**.

Next: invoke superpowers:subagent-driven-development.
