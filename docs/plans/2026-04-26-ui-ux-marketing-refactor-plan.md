# UI/UX Marketing-Ready Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the public storefront to be marketing-ready — modernize the Tilda aesthetic with Mazzard H Extrabold + IBM Plex Sans typography, confidently animated motion, and a polished section-stack on every public page.

**Architecture:** Hybrid approach (Approach 3 from brainstorming) — minimal foundation tokens + flagship pages first, extract patterns into reusable components, then apply to the remaining pages. All work happens in `ximi4ka-shop/web/`. Backend changes limited to a small SiteSettings migration for admin-editable trust strip / testimonials / promo bar.

**Tech Stack:** Next.js 16 (App Router), React 19, TailwindCSS v4, framer-motion, Mazzard H Extrabold (self-hosted WOFF2), IBM Plex Sans (`next/font/google`), Vitest + RTL + jsdom for unit tests, `@playwright/test` for visual regression.

**Design doc:** [2026-04-26-ui-ux-marketing-refactor-design.md](2026-04-26-ui-ux-marketing-refactor-design.md)

---

## Stage Overview

| Stage | Title | Commits | Detail level |
|---|---|---|---|
| 1 | Foundation layer (tokens + primitives + motion + decor SVGs) | 1–2 | **Bite-sized below** |
| 2 | Homepage redesign + SiteSettings migration | 2–3 | **Bite-sized below** |
| 3 | Product detail redesign | 2–3 | Outline; expand before execution |
| 4 | Pattern extraction (folder restructure) | 1 | Outline |
| 5 | Apply to category list/detail, cart, CMS pages, 404 | 3–4 | Outline |
| 6 | Header + Footer harmonization | 1 | Outline |
| 7 | Final pass (Playwright visual baselines, Lighthouse audit) | 1 | Outline |

Total: 12–14 commits.

## Execution Posture

- **TDD throughout.** Every component gets a behavior test before/with implementation.
- **Frequent commits.** One commit per task or small task group.
- **Russian UI** stays the convention (per project CLAUDE.md).
- **Existing 552 tests must stay green** through every commit.
- **Browser smoke test** after each visible page change — screenshot at 375 / 768 / 1440.
- **Working directory:** `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop/`

## External Assets Owner Provides

- Mazzard H Extrabold WOFF2 — provided at `/Users/vasilijaistov/Desktop/несгораемые шрифты))/mazzard/MazzardH-ExtraBold.woff2`. Implementer copies into `web/public/fonts/`.
- Webfont license documentation — captured as a follow-up; doesn't block dev.

---

## Stage 1 — Foundation Layer

**Goal:** Land tokens, primitives, motion utilities, and decor SVGs so Stages 2+ can compose visually-rich pages without inventing styles inline.

### Task 1.1: Install fonts and motion deps

**Files:**
- Copy: `/Users/vasilijaistov/Desktop/несгораемые шрифты))/mazzard/MazzardH-ExtraBold.woff2` → `web/public/fonts/MazzardH-ExtraBold.woff2`
- Modify: `web/app/layout.tsx` — wire Mazzard H via `@font-face` and IBM Plex Sans via `next/font/google`
- Modify: `web/package.json` — add `framer-motion` runtime dep
- Modify: `web/app/globals.css` — declare `@font-face` for Mazzard, set `--font-display` and `--font-sans` variables

**Step 1:** Copy the WOFF2 file:
```bash
mkdir -p /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop/web/public/fonts
cp "/Users/vasilijaistov/Desktop/несгораемые шрифты))/mazzard/MazzardH-ExtraBold.woff2" /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop/web/public/fonts/
```

**Step 2:** Add framer-motion:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop && npm install -w web framer-motion
```

**Step 3:** In `web/app/globals.css`, add at the top (before `@theme inline`):
```css
@font-face {
  font-family: 'Mazzard H';
  src: url('/fonts/MazzardH-ExtraBold.woff2') format('woff2');
  font-weight: 800;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-024F, U+0400-04FF, U+1E00-1EFF, U+2000-206F;
}
```

**Step 4:** In `web/app/layout.tsx`, import IBM Plex Sans:
```tsx
import { IBM_Plex_Sans } from 'next/font/google'

const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
  display: 'swap',
})
```
Add `plexSans.variable` to the `<html>` className.

**Step 5:** In `globals.css` `@theme inline` block, replace the existing `--font-sans` line and add `--font-display`:
```css
--font-sans: var(--font-plex), 'IBM Plex Sans', system-ui, sans-serif;
--font-display: 'Mazzard H', 'IBM Plex Sans', system-ui, sans-serif;
```

**Step 6:** Run `npm run dev -w web`, open `http://localhost:3000/`, verify the body font changed to IBM Plex (it'll look slightly different from Arial — heavier, more crafted). Open DevTools → check that `MazzardH-ExtraBold.woff2` loaded successfully (Network tab).

**Step 7:** Commit:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
git add web/public/fonts web/app/layout.tsx web/app/globals.css web/package.json web/package-lock.json
git commit -m "feat(web): wire Mazzard H + IBM Plex Sans + framer-motion"
```

### Task 1.2: Token system in globals.css

**Files:**
- Modify: `web/app/globals.css` — extend `@theme inline` block with full token system

**Step 1:** In `@theme inline`, append:
```css
/* Typography scale */
--text-display: clamp(2.5rem, 5vw + 1rem, 5.5rem);
--text-h1: clamp(2rem, 3vw + 1rem, 3.5rem);
--text-h2: clamp(1.5rem, 2vw + 0.75rem, 2.25rem);
--text-h3: clamp(1.25rem, 1.5vw + 0.5rem, 1.625rem);
--text-lead: 1.125rem;
--text-body: 1rem;
--text-small: 0.875rem;
--text-micro: 0.75rem;

/* Tracking + line height */
--tracking-tight: -0.02em;
--leading-tight: 1.05;
--leading-body: 1.5;

/* Color extensions */
--gradient-brand: linear-gradient(135deg, rgba(141,103,255,1) 0%, rgba(200,86,255,1) 100%);
--color-surface-base: #ffffff;
--color-surface-soft: #eeebf3;
--color-surface-elevated: #ffffff;
--color-surface-glass: rgba(255, 255, 255, 0.7);
--color-text-muted: rgba(82, 70, 103, 0.6);
--color-text-on-brand: #ffffff;
--color-border-strong: #d0c8e0;
--color-border-subtle: #e8e5ef;
--color-stock-success: #2f9e44;
--color-stock-warning: #e6a23c;
--color-stock-danger: #d6336c;
--color-stock-success-soft: #d3f9d8;
--color-stock-warning-soft: #fff3bf;
--color-stock-danger-soft: #ffdeeb;

/* Spacing (extends Tailwind defaults; explicit for clarity) */
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-12: 3rem;
--space-16: 4rem;
--space-20: 5rem;
--space-24: 6rem;
--space-32: 8rem;

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgba(28, 21, 40, 0.05);
--shadow-md: 0 4px 12px -2px rgba(28, 21, 40, 0.08), 0 2px 6px -1px rgba(28, 21, 40, 0.05);
--shadow-lg: 0 10px 32px -8px rgba(28, 21, 40, 0.12), 0 4px 16px -4px rgba(28, 21, 40, 0.06);
--shadow-glow-brand: 0 8px 24px -4px rgba(131, 110, 254, 0.4), 0 4px 12px -2px rgba(200, 86, 255, 0.25);

/* Border radii */
--radius-sm: 12px;
--radius-md: 24px;
--radius-lg: 36px;
--radius-xl: 48px;
--radius-full: 9999px;
```

**Step 2:** Verify `npm run typecheck -w web` passes (CSS is unaffected; just confirm).

**Step 3:** Verify visually: open `http://localhost:3000/` — nothing should look different yet (tokens are declared but not used). Open DevTools → Elements → `:root` → confirm the new CSS variables are present.

**Step 4:** Commit:
```bash
git add web/app/globals.css
git commit -m "feat(web): add design system tokens (type scale, colors, spacing, shadows, radii)"
```

### Task 1.3: Layout primitives (Container, Section, Bleed)

**Files:**
- Create: `web/components/ui/Container.tsx`
- Create: `web/components/ui/Container.test.tsx`
- Create: `web/components/ui/Section.tsx`
- Create: `web/components/ui/Section.test.tsx`
- Create: `web/components/ui/Bleed.tsx`
- Create: `web/components/ui/Bleed.test.tsx`
- Create: `web/components/ui/index.ts` — re-exports

**Step 1: Write Container test (RED).**

`web/components/ui/Container.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Container } from './Container'

describe('Container', () => {
  it('renders children inside a max-width wrapper', () => {
    render(<Container><span>hello</span></Container>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('applies horizontal padding utility classes', () => {
    const { container } = render(<Container>x</Container>)
    expect(container.firstChild).toHaveClass('px-4')
  })

  it('caps at max-w-[1200px]', () => {
    const { container } = render(<Container>x</Container>)
    expect(container.firstChild).toHaveClass('max-w-[1200px]')
  })
})
```

**Step 2:** Run `npm test -w web -- Container` — expect FAIL (Container doesn't exist).

**Step 3: Implement Container:**

```tsx
// web/components/ui/Container.tsx
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

export function Container({ children, className = '' }: Props) {
  return (
    <div className={`mx-auto w-full max-w-[1200px] px-4 sm:px-8 lg:px-12 ${className}`}>
      {children}
    </div>
  )
}
```

**Step 4:** Run `npm test -w web -- Container` — expect PASS.

**Step 5: Write Section test (RED).**

`web/components/ui/Section.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Section } from './Section'

describe('Section', () => {
  it('renders children', () => {
    render(<Section><span>x</span></Section>)
    expect(screen.getByText('x')).toBeInTheDocument()
  })

  it('applies medium vertical padding by default', () => {
    const { container } = render(<Section>x</Section>)
    expect(container.firstChild).toHaveClass('py-16')
  })

  it('applies large vertical padding when size=lg', () => {
    const { container } = render(<Section size="lg">x</Section>)
    expect(container.firstChild).toHaveClass('py-24')
  })

  it('applies surface-soft background when surface=soft', () => {
    const { container } = render(<Section surface="soft">x</Section>)
    expect(container.firstChild).toHaveClass('bg-[var(--color-surface-soft)]')
  })
})
```

**Step 6:** Run test, expect FAIL.

**Step 7: Implement Section:**

```tsx
// web/components/ui/Section.tsx
import type { ReactNode } from 'react'

type SectionSize = 'sm' | 'md' | 'lg'
type SectionSurface = 'base' | 'soft' | 'glass' | 'gradient'

interface Props {
  children: ReactNode
  size?: SectionSize
  surface?: SectionSurface
  className?: string
  as?: 'section' | 'div' | 'header' | 'footer'
}

const sizeClass: Record<SectionSize, string> = {
  sm: 'py-8',
  md: 'py-16',
  lg: 'py-24',
}

const surfaceClass: Record<SectionSurface, string> = {
  base: 'bg-[var(--color-surface-base)]',
  soft: 'bg-[var(--color-surface-soft)]',
  glass: 'bg-[var(--color-surface-glass)] backdrop-blur-md',
  gradient: 'bg-[var(--gradient-brand)] text-[var(--color-text-on-brand)]',
}

export function Section({
  children,
  size = 'md',
  surface = 'base',
  className = '',
  as: Tag = 'section',
}: Props) {
  return (
    <Tag className={`${sizeClass[size]} ${surfaceClass[surface]} ${className}`}>
      {children}
    </Tag>
  )
}
```

**Step 8:** Run test, expect PASS.

**Step 9: Write Bleed test + implement.**

`Bleed.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Bleed } from './Bleed'

describe('Bleed', () => {
  it('renders children', () => {
    render(<Bleed><span>full</span></Bleed>)
    expect(screen.getByText('full')).toBeInTheDocument()
  })

  it('uses negative horizontal margins to break out', () => {
    const { container } = render(<Bleed>x</Bleed>)
    expect(container.firstChild).toHaveClass('-mx-4')
  })
})
```

`Bleed.tsx`:
```tsx
import type { ReactNode } from 'react'

interface Props { children: ReactNode; className?: string }

export function Bleed({ children, className = '' }: Props) {
  return (
    <div className={`-mx-4 sm:-mx-8 lg:-mx-12 ${className}`}>
      {children}
    </div>
  )
}
```

**Step 10:** Create `web/components/ui/index.ts`:
```ts
export { Container } from './Container'
export { Section } from './Section'
export { Bleed } from './Bleed'
```

**Step 11:** Run `npm test -w web` — full web suite must stay green plus the 9 new tests.

**Step 12:** Commit:
```bash
git add web/components/ui
git commit -m "feat(web): add Container/Section/Bleed layout primitives"
```

### Task 1.4: Typography primitives (Eyebrow, DisplayHeading, SectionHeading)

**Files:**
- Create: `web/components/ui/Eyebrow.tsx` + `.test.tsx`
- Create: `web/components/ui/DisplayHeading.tsx` + `.test.tsx`
- Create: `web/components/ui/SectionHeading.tsx` + `.test.tsx`
- Modify: `web/components/ui/index.ts` — add exports

**Step 1:** Write tests for all three components first (RED). Each renders props correctly, applies the right font family + size class, semantic HTML element correct.

`Eyebrow.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Eyebrow } from './Eyebrow'

describe('Eyebrow', () => {
  it('renders children with small-caps styling', () => {
    render(<Eyebrow>химия дома</Eyebrow>)
    const el = screen.getByText('химия дома')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('uppercase', 'tracking-wider')
  })
})
```

`DisplayHeading.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DisplayHeading } from './DisplayHeading'

describe('DisplayHeading', () => {
  it('defaults to h1', () => {
    render(<DisplayHeading>Заголовок</DisplayHeading>)
    expect(screen.getByRole('heading', { level: 1, name: 'Заголовок' })).toBeInTheDocument()
  })

  it('respects as prop', () => {
    render(<DisplayHeading as="h2">x</DisplayHeading>)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })

  it('uses Mazzard display font family', () => {
    const { container } = render(<DisplayHeading>x</DisplayHeading>)
    expect(container.firstChild).toHaveClass('font-[var(--font-display)]')
  })
})
```

`SectionHeading.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionHeading } from './SectionHeading'

describe('SectionHeading', () => {
  it('renders title as h2 by default', () => {
    render(<SectionHeading title="Бестселлеры" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Бестселлеры' })).toBeInTheDocument()
  })

  it('renders eyebrow when provided', () => {
    render(<SectionHeading eyebrow="каталог" title="x" />)
    expect(screen.getByText('каталог')).toBeInTheDocument()
  })

  it('renders right-aligned action link when provided', () => {
    render(<SectionHeading title="x" action={{ label: 'Все', href: '/categories' }} />)
    const link = screen.getByRole('link', { name: 'Все' })
    expect(link).toHaveAttribute('href', '/categories')
  })
})
```

**Step 2:** Run tests, expect 3 failures.

**Step 3:** Implement.

`Eyebrow.tsx`:
```tsx
import type { ReactNode } from 'react'
interface Props { children: ReactNode; className?: string }
export function Eyebrow({ children, className = '' }: Props) {
  return (
    <span className={`uppercase tracking-wider text-[length:var(--text-micro)] font-semibold text-[var(--color-brand)] ${className}`}>
      {children}
    </span>
  )
}
```

`DisplayHeading.tsx`:
```tsx
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  as?: 'h1' | 'h2'
  className?: string
}

export function DisplayHeading({ children, as: Tag = 'h1', className = '' }: Props) {
  return (
    <Tag
      className={`font-[var(--font-display)] tracking-[var(--tracking-tight)] leading-[var(--leading-tight)] text-[length:var(--text-display)] text-[var(--color-brand-text)] ${className}`}
    >
      {children}
    </Tag>
  )
}
```

`SectionHeading.tsx`:
```tsx
import Link from 'next/link'
import { Eyebrow } from './Eyebrow'

interface Props {
  title: string
  eyebrow?: string
  action?: { label: string; href: string }
  as?: 'h2' | 'h3'
  className?: string
}

export function SectionHeading({ title, eyebrow, action, as: Tag = 'h2', className = '' }: Props) {
  return (
    <div className={`mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="flex flex-col gap-2">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <Tag className="font-[var(--font-display)] tracking-[var(--tracking-tight)] leading-[var(--leading-tight)] text-[length:var(--text-h2)] text-[var(--color-brand-text)]">
          {title}
        </Tag>
      </div>
      {action && (
        <Link href={action.href} className="text-sm font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-dark)]">
          {action.label} →
        </Link>
      )}
    </div>
  )
}
```

**Step 4:** Run tests, expect PASS.

**Step 5:** Update `web/components/ui/index.ts`:
```ts
export { Container } from './Container'
export { Section } from './Section'
export { Bleed } from './Bleed'
export { Eyebrow } from './Eyebrow'
export { DisplayHeading } from './DisplayHeading'
export { SectionHeading } from './SectionHeading'
```

**Step 6:** Commit:
```bash
git add web/components/ui
git commit -m "feat(web): add typography primitives (Eyebrow, DisplayHeading, SectionHeading)"
```

### Task 1.5: Interactive primitives (Button, Pill, GlassCard, MicroTrustRow)

Same TDD rhythm as Task 1.4. One commit covering all four.

**Files:**
- Create per component: `.tsx` + `.test.tsx` in `web/components/ui/`
- Update `web/components/ui/index.ts`

**Component specs:**

- **`Button`** — variants `primary` / `secondary` / `ghost` / `link`; sizes `sm` / `md` / `lg` / `xl`; `fullWidth`, `disabled`, `loading` props; renders `<button>` by default, `<Link>` when `href` provided. Primary uses `bg-[var(--gradient-brand)]` + `shadow-[var(--shadow-glow-brand)]` + `rounded-full`.
- **`Pill`** — variants `solid-brand` / `soft-brand` / `success` / `warning` / `danger` / `neutral`; small element `<span>` with `rounded-full`, IBM Plex 500.
- **`GlassCard`** — wraps content; `bg-[var(--color-surface-glass)]` + `backdrop-blur-md` + brand border + `rounded-[var(--radius-lg)]` + `shadow-[var(--shadow-md)]`.
- **`MicroTrustRow`** — takes `items: { icon: ReactNode; label: string }[]`; renders inline (flex-wrap) row of icon + label pairs in IBM Plex 500 / 13px / muted.

**Tests:** for each, write 2–4 behavior tests covering variant rendering, accessibility (button role, disabled state, focus-visible class).

**Commit message:**
```
feat(web): add Button/Pill/GlassCard/MicroTrustRow primitives
```

### Task 1.6: Motion primitives (Reveal, Fade, Stagger)

**Files:**
- Create: `web/components/motion/Reveal.tsx` + `.test.tsx`
- Create: `web/components/motion/Fade.tsx` + `.test.tsx`
- Create: `web/components/motion/Stagger.tsx` + `.test.tsx`
- Create: `web/lib/motion.ts` — easing constants
- Create: `web/components/motion/index.ts`

**Step 1:** Write `web/lib/motion.ts`:
```ts
export const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const
export const EASE_SPRING_SOFT = { type: 'spring' as const, stiffness: 240, damping: 28 }
export const EASE_SPRING_PUNCHY = { type: 'spring' as const, stiffness: 380, damping: 22 }
```

**Step 2:** Implement `Reveal` — uses framer-motion `motion.div` with `initial={{ opacity: 0, y: 16 }}` and `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true, margin: '-50px' }}`, transition uses EASE_OUT_QUART, duration 0.5s. Prop: `delay` (number, seconds).

**Step 3:** Implement `Fade` — same as Reveal but no `y` translation, just opacity. Optional `delay` prop.

**Step 4:** Implement `Stagger` — wraps children, applies `staggerChildren: 0.08` via `motion.div` parent + each child wrapped in `motion.div` with the same transition. Or simpler: takes a `children` array and maps each through a `Reveal` with computed delay.

**Step 5:** Tests assert that each component renders children + applies the expected motion props (read via `data-*` attributes set by motion in test mode, OR mock framer-motion to spy on the props passed). Simpler: just verify children render and component doesn't crash.

**Step 6:** Add `prefers-reduced-motion` handling — if media query matches, all three components render children with no animation wrapper. Use `useReducedMotion()` hook from framer-motion.

**Step 7:** Commit:
```
feat(web): add Reveal/Fade/Stagger motion primitives + easing constants
```

### Task 1.7: Decorative SVGs (MoleculeMotif, GradientBlob)

**Files:**
- Create: `web/components/decor/MoleculeMotif.tsx` + `.test.tsx`
- Create: `web/components/decor/GradientBlob.tsx` + `.test.tsx`
- Create: `web/components/decor/index.ts`

**MoleculeMotif:** an SVG of 5–7 connected atoms (circles with stroke + lines between). Two color variants via prop (`subtle` uses `--color-border-strong` outline; `vivid` uses `--color-brand` outline). Sized via parent — uses `width="100%" height="100%"` and `viewBox="0 0 400 400"`.

**GradientBlob:** an SVG blob shape (organic asymmetric path) filled with `--gradient-brand`. Animated subtle morph via SMIL or CSS `@keyframes` (3 path variants cycling over 20s). Used as hero background accent.

Tests assert SVG renders, has expected `data-variant` attribute or class, accepts `className` for sizing.

**Commit:**
```
feat(web): add decorative SVGs (MoleculeMotif, GradientBlob)
```

### Task 1.8 (optional): Verification screenshot

Take a screenshot of the homepage at this point to confirm the foundation work hasn't broken anything visually. Pages should look identical to before (since no page consumed the new primitives yet). The only externally-visible change should be the body font (Arial → IBM Plex Sans).

If anything broke, fix before proceeding to Stage 2.

---

## Stage 2 — Homepage Redesign

**Goal:** Replace the current homepage with the full marketing-ready section stack from the design doc.

### Task 2.1: SiteSettings migration (header_promo + trust_strip + testimonials)

**Files:**
- Create: `api/src/migrations/<timestamp>-AddSiteSettingsMarketingFields.ts`
- Modify: `api/src/entities/SiteSettings.ts` — add three columns
- Modify: `api/src/routes/admin/settings.ts` — extend zod schema
- Modify: `api/src/routes/public/settings.ts` — expose three new fields publicly
- Modify: `web/components/admin/SettingsForm.tsx` — add inputs for the three fields
- Modify: `web/lib/api.ts` and `web/lib/adminApi.ts` — type extensions

**Step 1:** Add to `SiteSettings.ts`:
```ts
@Column({ type: 'text', name: 'header_promo_text', nullable: true })
headerPromoText!: string | null

@Column({ type: 'jsonb', name: 'trust_strip_items', default: () => "'[]'::jsonb" })
trustStripItems!: Array<{ icon: string; label: string }>

@Column({ type: 'jsonb', name: 'testimonials', default: () => "'[]'::jsonb" })
testimonials!: Array<{ quote: string; author: string; location: string; rating?: number }>
```

**Step 2:** Generate migration:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
npm run migration:generate -w api -- api/src/migrations/AddSiteSettingsMarketingFields
```
Apply the `import type` fix-up (the convention from earlier migrations).

**Step 3:** Run migration:
```bash
npm run migration:run -w api
```

**Step 4:** Extend zod schema in `admin/settings.ts`:
```ts
headerPromoText: z.string().max(500).nullable().optional(),
trustStripItems: z.array(z.object({
  icon: z.string().max(64),
  label: z.string().max(255),
})).max(8).optional(),
testimonials: z.array(z.object({
  quote: z.string().max(2000),
  author: z.string().max(255),
  location: z.string().max(255),
  rating: z.number().int().min(1).max(5).optional(),
})).max(20).optional(),
```

**Step 5:** Update public settings response to include the three new fields (they're public-safe).

**Step 6:** Update `web/components/admin/SettingsForm.tsx` — add a new "Маркетинг" section with three controls:
- Single `<input>` for `headerPromoText`.
- A repeatable list editor for `trustStripItems` (rows of icon + label, "+ Add" button, remove row).
- A repeatable list editor for `testimonials` (each row collapses; quote / author / location / rating).

**Step 7:** Add tests for the new settings round-trip + form interactions. ~6–8 new tests.

**Step 8:** Verify full test suite green:
```bash
npm test
```

**Step 9:** Commit:
```bash
git add api web
git commit -m "feat: SiteSettings marketing fields (header promo, trust strip, testimonials)"
```

### Task 2.2: Homepage hero + foundational sections

**Files:**
- Modify: `web/app/[locale]/(public)/page.tsx` — full rebuild
- Create inline (will extract in Stage 4):
  - Hero composition
  - Trust strip
  - Featured products section
- Update homepage test to match new structure (the existing test asserts H1 from page title; that still works since hero uses fetched home page title).

**Step 1:** Update test to assert the new section structure.

`web/app/[locale]/(public)/page.test.tsx`:
```tsx
// Smoke test stays as-is for the async-function check.
// Add: page rendered HTML contains expected section headings.
// Use a separate integration test if the existing test pattern is too tight.
```

For depth, run the page in dev and screenshot rather than fight the async-RSC test pattern.

**Step 2:** Rewrite `page.tsx` from top to bottom.
- Imports: `Container`, `Section`, `DisplayHeading`, `Eyebrow`, `Button`, `Reveal`, `Fade`, `MoleculeMotif`, `GradientBlob`.
- Async fetch: home page + 8 published products + public settings (for trust strip + testimonials).
- Section 1: **Hero**
  - `<Section size="lg">` with relative positioning.
  - Inside: `<Container>` with two-column grid on `md+`.
  - Left: `<Eyebrow>` + `<DisplayHeading>` + lead `<p>` + two `<Button>` (primary gradient + ghost secondary).
  - Right: a small product-cutout collage placeholder (3 product images from the fetched products, absolutely positioned with rotation, parallax via `useScroll` from framer-motion in a small client component called `<HeroProductStack>` — keep this component inline in the file for now).
  - Decorative `<MoleculeMotif>` absolutely positioned behind the right column.
  - Decorative `<GradientBlob>` clipped off the right edge.
- Section 2: **Trust strip** — `<Section size="sm" surface="soft">` with `<Container>` + 4 `MicroTrustRow`-style items from settings or placeholder defaults.
- Section 3: **Featured products** — `<Section>` with `<Container>` + `<SectionHeading title="Бестселлеры" action={{label: 'Смотреть всё', href: '/categories'}} />` + grid of `<ProductCard>` (still using old card component for now; refactored in Stage 3).

**Step 3:** Run dev server, visit `/`, screenshot. Expect to see a totally different hero + a grouped layout with featured products.

**Step 4:** Run typecheck, lint, tests:
```bash
npm run typecheck -w web && npm run lint -w web && npm test -w web
```

**Step 5:** Commit:
```bash
git add web
git commit -m "feat(web): redesign homepage hero + trust strip + featured products"
```

### Task 2.3: Homepage middle + bottom sections

**Files:**
- Modify: `web/app/[locale]/(public)/page.tsx` — append remaining sections

**Step 1:** Append after featured products:

- Section 4: **Category showcase** (`<SectionHeading title="Каталог по интересам" />` + 3 inline `<CategoryTile>` placeholder divs — extract proper `<CategoryTile>` component in Stage 4).
- Section 5: **How it works** (3 numbered cards — large numerals in `font-[var(--font-display)]`, body in IBM Plex). Inline `<HowItWorksStep>` in this file for now.
- Section 6: **Testimonials** (3 cards in `<GlassCard>`, content from `settings.testimonials` falling back to 3 placeholder Russian testimonials inline in the page).
- Section 7: **FAQ teaser** (uses `<BlockRenderer>` with the home page's FAQ block content; section heading «Частые вопросы» + CTA link to `/o-nas` for now since FAQ page doesn't exist yet).
- Section 8: **Pre-footer CTA** (`<Section surface="gradient">` with centered `<DisplayHeading as="h2">` + `<Button variant="secondary" />`).

**Step 2:** Wrap each section in `<Reveal>` for scroll-triggered animation.

**Step 3:** Run dev server. Screenshot at desktop + mobile.

**Step 4:** Tests + typecheck + lint green.

**Step 5:** Commit:
```bash
git add web
git commit -m "feat(web): add category showcase / how-it-works / testimonials / FAQ / pre-footer CTA"
```

### Task 2.4 (optional): Hero polish pass

If the hero looks rough after Task 2.2/2.3 — adjust spacing, color overlay, parallax intensity, decor positioning. Small tweaks until it looks production-ready. One final commit:
```
chore(web): hero polish pass
```

---

## Stage 3 — Product Detail Redesign (Outline)

**Will be expanded into bite-sized tasks before execution.** The outline:

3.1 — Refactor `ProductCard` to consume real images + new visual treatment (cutout on tinted surface, hover lift, brand-tinted backgrounds).
3.2 — Create `<PriceBlock>`, `<StockPill>`, `<QuantityStepper>`, `<MobileBuyBar>` primitives in `web/components/product/`.
3.3 — Rebuild `web/app/[locale]/(public)/product/[slug]/page.tsx` — two-column grid, sticky gallery, info column composition.
3.4 — Add long-description rendering with constrained width + `<Bleed>` for media blocks.
3.5 — Add related-products section using existing `listProductsByCategory` (filter out current product client-side).
3.6 — Wire up `<MobileBuyBar>` with IntersectionObserver.
3.7 — Polish + screenshots.

Estimated 2–3 commits. Browser smoke after each commit.

---

## Stage 4 — Pattern Extraction (Outline)

**One atomic commit:**

- Move inline-defined components from `page.tsx` files into `web/components/marketing/` and `web/components/product/`:
  - `<Hero>`, `<TrustStrip>`, `<CategoryTile>`, `<HowItWorksStep>`, `<TestimonialCard>`, `<PreFooterCta>` → marketing/
  - Already-extracted product components stay in product/
- Update consuming pages to import from new locations.
- All tests still pass.

Commit message: `refactor(web): extract reusable marketing + product components`.

---

## Stage 5 — Apply to Remaining Pages (Outline)

**3–4 commits, one per page or page group:**

5.1 — Category list page (`/categories`): hero + tile grid using `<Hero>` + `<CategoryTile>`.
5.2 — Category detail page (`/categories/[slug]`): hero (tinted by category color) + product grid using `<ProductCard>`.
5.3 — Cart page (`/cart`): two-column refactor, `<GlassCard>` summary, `<MicroTrustRow>`, restyled empty state.
5.4 — CMS pages (`/[slug]`, `/o-nas`, `/dostavka`, `/kontakty`): hero + constrained `<BlockRenderer>` + `<PreFooterCta>`.
5.5 — 404 page: hero-sized numeral + `<MoleculeMotif>` + two CTAs.

---

## Stage 6 — Header + Footer Harmonization (Outline)

**One commit:**

- Header: Mazzard H wordmark, refined nav (active route brand-color underline animated via framer-motion), restyled `<CartButton>` (pill, brand badge), promo bar conditional render, glass mobile sheet.
- Footer: 4-column with restyled column headings (small-caps), wordmark column with gradient accent line, language switcher placeholder hidden until EN content exists.

Commit: `feat(web): harmonize header + footer with new design system`.

---

## Stage 7 — Final Pass (Outline)

**One commit:**

- Install `@playwright/test` as dev dep:
  ```bash
  npm install -w web --save-dev @playwright/test
  npx playwright install --with-deps chromium
  ```
- Create `web/tests/visual/storefront.spec.ts`:
  - For each public route (`/`, `/categories`, `/categories/himicheskie-nabory`, `/product/<seeded-slug>`, `/cart`, `/o-nas`, `/dostavka`, `/kontakty`, `/404-trigger`): screenshot at viewport widths 375 / 768 / 1440.
  - Total ~24 baseline snapshots committed to `web/tests/visual/__screenshots__/`.
- Add `web/playwright.config.ts` configuring screenshot tolerance (`maxDiffPixelRatio: 0.005`).
- Add npm scripts:
  - `"test:visual": "playwright test"`
  - `"test:visual:update": "playwright test --update-snapshots"`
- Wire visual regression into CI: GitHub Actions workflow runs `npm run test:visual` after the existing test suite. Cache Playwright browsers.
- Run Lighthouse audit on `/`, `/product/:slug`, `/categories`. Target: Perf ≥90 mobile, A11y 100, Best Practices ≥95, SEO 100. Fix any below-threshold issues (likely image lazy-loading, font-display swap, color contrast on edge cases).
- Update screenshots in any docs.

Commit: `test(web): add Playwright visual regression suite + Lighthouse audit pass`.

---

## Notes on Granularity

Stages 1 and 2 are bite-sized because they're what we'll execute first and they're the highest-risk work (foundational decisions ripple through everything). Stages 3–7 will be expanded into bite-sized task lists by the executor (or by a follow-up writing-plans pass) immediately before each stage starts. This avoids stale plan content and lets early-stage learnings shape later tasks.

When a stage is ready to start, follow the same TDD-style structure: failing test → implementation → verify → commit.

## Completion Criteria

The refactor is "done" when all of the following hold:

- All 552 existing tests still pass, plus the ~40–60 new unit tests, plus the 24+ Playwright visual baselines.
- `npm run typecheck`, `npm run lint`, `npm run build` all green.
- Manual browser smoke at desktop + mobile on every public route — no broken layouts.
- Lighthouse mobile scores hit the targets above.
- Owner has reviewed screenshots of the new homepage and product detail and approved.
