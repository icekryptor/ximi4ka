# Shop v3 — Лабораторный Журнал Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the approved "Лабораторный Журнал" v3 design from `concept.html` into the live `ximi4ka-shop` Next.js storefront, replacing the v2 Neo-Russian system end-to-end on the public marketing surfaces.

**Architecture:** Replace v2 design tokens + components in place. Net-new primitive set in `web/components/ui/` (Section, NotebookHeader, GridOverlay, RuleAsym, MoleculeMotif, Callout). Net-new data-viz set in `web/components/dataviz/` (Timeline, Scientific, Rating, DotGrid). Major rebuilds of Hero, Manifesto, ProductCard. Footer + Header get token-level adoption + small molecular accent. Cart, checkout, admin keep v2 surfaces (cream + Inter only — no decorative chrome).

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2, TypeScript, Tailwind 4 (`@theme inline` tokens), Vitest + Testing Library, Playwright (visual regression), `next/font/google` for typeface loading.

**Source artifacts:**
- Concept: `ximi4ka/concept.html` (preview-only reference)
- Design system spec: `ximi4ka-shop/design-system/ximi4ka-v3/LABORATORY_JOURNAL.md`
- Design doc: `ximi4ka/docs/plans/2026-04-28-shop-v3-lab-journal-design.md`

**Critical rule (from `web/AGENTS.md`):** Next.js 16.2 has breaking changes vs older versions. Before writing any Next-specific code (route handlers, fonts, image, Link, dynamic, server components), check `node_modules/next/dist/docs/` first.

**Stage map (recommend 1 commit per task, ~5–6 commits per stage):**
- Stage 0 — Foundation tokens + fonts + motion + cleanup (5 tasks)
- Stage 1 — Core primitives (6 tasks)
- Stage 2 — Hero rebuild (3 tasks)
- Stage 3 — Manifesto + NumberCell + 4 data-viz components (6 tasks)
- Stage 4 — ProductCard + StatBar + Chip (4 tasks)
- Stage 5 — Header / Footer / Homepage composition (3 tasks)
- Stage 6 — Reduced motion + visual regression + cleanup (4 tasks)

**Total:** ~31 tasks, ~31 commits. Each task is bite-sized (2–5 minutes of focused work). At every stage boundary the storefront must build cleanly (`pnpm --filter @ximi4ka-shop/web build`) and all tests must pass (`pnpm --filter @ximi4ka-shop/web test`).

---

## Pre-Stage Setup

### Task 0.0: Verify worktree and baseline

**Files:** none (verification only)

**Step 1: Confirm current branch and clean state**

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop && git status`
Expected: clean working tree on a feature branch (NOT main).

If on main: `git checkout -b feat/v3-lab-journal` first.

**Step 2: Baseline test + build pass**

Run from `ximi4ka-shop/web`:
```bash
npm run typecheck
npm run test
npm run build
```

Expected: all pass before we touch anything. If anything fails on a clean checkout, stop and investigate — do not proceed with broken baseline.

**Step 3: Note which packages exist**

Run: `cat package.json | grep '"name"'`
Expected: `"name": "@ximi4ka-shop/web"` (the workspace name we'll use in pnpm filters; if no pnpm, use plain `npm` from `web/` directory).

**Step 4: Skim AGENTS.md and CLAUDE.md**

Run: `cat web/AGENTS.md web/CLAUDE.md 2>/dev/null`
Expected: see the "this is NOT the Next.js you know" warning. Confirm Next.js docs path: `ls node_modules/next/dist/docs/ | head`.

No commit for this task — verification only.

---

## Stage 0 — Foundation: tokens, fonts, motion, cleanup

### Task 0.1: Add v3 color + typography + spacing tokens to `globals.css`

**Files:**
- Modify: `web/app/globals.css` (add tokens inside the existing `@theme inline { ... }` block, keep v2 tokens until Stage 5 cleanup)

**Step 1: Open globals.css and locate `@theme inline {` block**

Run: `grep -n '@theme inline' web/app/globals.css`

**Step 2: Add Lab Journal v3 token block**

Inside `@theme inline { ... }`, append (preserve existing v2 tokens — they will be deleted in Task 5.4 once nothing consumes them):

```css
/* === v3 — Лабораторный Журнал === */

/* Cream Lab — daylight surface family */
--color-lj-cream:        #F2EFE8;
--color-lj-cream-shade:  #E8E3D7;
--color-lj-cream-line:   rgba(10, 10, 10, 0.05);

/* Ink Lab — nocturnal surface family */
--color-lj-ink:           #0A0A0A;
--color-lj-ink-elevated:  #141414;
--color-lj-bone:          #EFEDE6;
--color-lj-bone-mute:     rgba(239, 237, 230, 0.60);
--color-lj-ink-line:      rgba(239, 237, 230, 0.06);

/* Brand precision accent (re-exposed under lj- prefix for clarity) */
--color-lj-brand:         #836efe;
--color-lj-brand-deep:    #6703ff;

/* Rules */
--color-lj-rule:          rgba(10, 10, 10, 0.14);
--color-lj-rule-soft:     rgba(10, 10, 10, 0.08);
--color-lj-rule-on-ink:   rgba(239, 237, 230, 0.18);

/* Type scale (additive — old --text-* stay until Stage 5) */
--text-lj-mega:    clamp(2.75rem, 9vw, 9.5rem);
--text-lj-display: clamp(2.25rem, 5.5vw, 5.5rem);
--text-lj-mono-xs: 0.6875rem;
--text-lj-mono-sm: 0.75rem;

/* Easings */
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
--ease-out-expo:  cubic-bezier(0.19, 1, 0.22, 1);

/* Layout */
--max-lj-content: 1600px;
--max-lj-narrow:  1400px;
```

**Step 3: Verify CSS still compiles**

Run: `cd web && npm run build 2>&1 | grep -iE 'error|warning' | head -20`
Expected: no CSS errors. Some unrelated warnings OK.

**Step 4: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
git add web/app/globals.css
git commit -m "feat(v3): add lab-journal design tokens to globals.css"
```

---

### Task 0.2: Wire Unbounded + Inter + JetBrains Mono via `next/font/google`

**Files:**
- Modify: `web/app/layout.tsx` (or wherever the existing root layout configures fonts — find with `grep`)
- Modify: `web/app/globals.css` (point `--font-display`, `--font-sans`, `--font-mono` to the new font CSS variables)

**Step 1: Find current font setup**

Run: `grep -rn 'next/font/google\|Plex_Sans\|Mazzard' web/app/ | head -10`

**Step 2: Read Next.js 16 font docs first**

Run: `ls web/node_modules/next/dist/docs/ 2>/dev/null && cat web/node_modules/next/dist/docs/02-app/03-api-reference/01-components/font.mdx 2>/dev/null | head -60`

If the doc is missing or in a different path, search: `find web/node_modules/next/dist/docs/ -name '*font*' -type f`.

**Step 3: Replace existing font imports in layout**

In the root layout file (likely `web/app/layout.tsx`), replace the Mazzard / Plex setup with:

```tsx
import { Unbounded, Inter, JetBrains_Mono } from 'next/font/google'

const unbounded = Unbounded({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '700', '900'],
  variable: '--font-lj-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-lj-body',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500'],
  variable: '--font-lj-mono',
  display: 'swap',
})
```

Then on the `<html>` (or root wrapper) element add:
```tsx
<html lang="ru" className={`${unbounded.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
```

**Step 4: Wire CSS variable references in globals.css**

In `@theme inline { ... }` add (or modify if existing):

```css
--font-lj-display: var(--font-lj-display, 'Unbounded', system-ui, sans-serif);
--font-lj-body:    var(--font-lj-body, 'Inter', system-ui, sans-serif);
--font-lj-mono:    var(--font-lj-mono, 'JetBrains Mono', ui-monospace, monospace);
```

(The `next/font/google` integration sets `--font-lj-display` etc. on the `<html>` element; the `@theme inline` exposure makes them Tailwind-utility-friendly as `font-lj-display`.)

**Step 5: Verify**

Run: `cd web && npm run build` then `npm run dev` in another terminal.
Visit http://localhost:3000 and inspect any heading — should render in Unbounded.

**Step 6: Commit**

```bash
git add web/app/layout.tsx web/app/globals.css
git commit -m "feat(v3): swap to Unbounded/Inter/JetBrains Mono via next/font/google"
```

---

### Task 0.3: Extend `lib/motion.ts` with v3 constants

**Files:**
- Modify: `web/lib/motion.ts` (append, don't delete v2 — v2 deletion in Task 5.4)
- Test: `web/lib/motion.test.ts` (create, Vitest)

**Step 1: Write the failing test**

Create `web/lib/motion.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  EASE_OUT_QUART_CSS,
  EASE_OUT_EXPO_CSS,
  TICKER_DURATION_S_LJ,
  ROTATE_SLOW_S,
  ROTATE_GHOST_S,
  COUNTUP_DURATION_MS,
  STATBAR_DURATION_S,
} from './motion'

describe('Lab Journal motion constants', () => {
  it('exports easing CSS strings', () => {
    expect(EASE_OUT_QUART_CSS).toBe('cubic-bezier(0.25, 1, 0.5, 1)')
    expect(EASE_OUT_EXPO_CSS).toBe('cubic-bezier(0.19, 1, 0.22, 1)')
  })

  it('exports duration constants in expected ranges', () => {
    expect(TICKER_DURATION_S_LJ).toBe(50)
    expect(ROTATE_SLOW_S).toBe(80)
    expect(ROTATE_GHOST_S).toBe(200)
    expect(COUNTUP_DURATION_MS).toBe(1800)
    expect(STATBAR_DURATION_S).toBe(1.2)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run lib/motion.test.ts`
Expected: FAIL — exports don't exist.

**Step 3: Add exports to `web/lib/motion.ts`**

Append to `web/lib/motion.ts`:
```ts

// === v3 — Лабораторный Журнал ===

/** CSS easing strings for use in `transition` / `animation` shorthand. */
export const EASE_OUT_QUART_CSS = 'cubic-bezier(0.25, 1, 0.5, 1)'
export const EASE_OUT_EXPO_CSS = 'cubic-bezier(0.19, 1, 0.22, 1)'

/** Hero formula ticker full loop, seconds. */
export const TICKER_DURATION_S_LJ = 50
/** Hero benzene wireframe rotation, seconds. */
export const ROTATE_SLOW_S = 80
/** Manifesto background ghost molecule rotation (reverse direction), seconds. */
export const ROTATE_GHOST_S = 200
/** Count-up animation total duration, milliseconds. */
export const COUNTUP_DURATION_MS = 1800
/** Stat-bar fill animation, seconds. */
export const STATBAR_DURATION_S = 1.2
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/motion.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/lib/motion.ts web/lib/motion.test.ts
git commit -m "feat(v3): add lab-journal motion constants"
```

---

### Task 0.4: Snapshot v2 Sticker consumers (no deletion yet — just inventory)

**Files:** none (research task — output is a comment in next task)

**Step 1: Inventory all v2 component consumers**

Run:
```bash
grep -rln 'Sticker' web/{app,components}/ 2>/dev/null > /tmp/v2-consumers-sticker.txt
grep -rln 'HeroProductStack' web/{app,components}/ 2>/dev/null > /tmp/v2-consumers-hps.txt
grep -rln 'BigNumber' web/{app,components}/ 2>/dev/null > /tmp/v2-consumers-bignum.txt
grep -rln 'DarkSection' web/{app,components}/ 2>/dev/null > /tmp/v2-consumers-darksection.txt
echo "=== Sticker ===" && cat /tmp/v2-consumers-sticker.txt
echo "=== HeroProductStack ===" && cat /tmp/v2-consumers-hps.txt
echo "=== BigNumber ===" && cat /tmp/v2-consumers-bignum.txt
echo "=== DarkSection ===" && cat /tmp/v2-consumers-darksection.txt
```

**Step 2: Confirm the lists match this design doc's expectations**

Per [design doc §Migration](../../ximi4ka/docs/plans/2026-04-28-shop-v3-lab-journal-design.md):
- Sticker → delete after replacing with `<Chip>` (Task 4.1) and removing all consumers (Tasks 4.3, 5.1)
- HeroProductStack → delete (Task 2.2)
- BigNumber → keep file, rename + extend to `<NumberCell>` (Task 3.1)
- DarkSection → keep file as alias of new `<Section variant="ink">` (or migrate consumers, then delete — see Task 1.1 decision point)

**Step 3: No commit — inventory only**

---

### Task 0.5: Confirm Stage 0 baseline still passes

Run from `ximi4ka-shop/web`:
```bash
npm run typecheck
npm run test
npm run build
```

Expected: all pass. If any fails, fix before proceeding to Stage 1.

No commit (these are checkpoints, not changes).

---

## Stage 1 — Core primitives

### Task 1.1: `<Section>` primitive (cream / ink variant)

**Files:**
- Create: `web/components/ui/LabSection.tsx`
- Create: `web/components/ui/LabSection.test.tsx`
- Will-modify-later (do NOT touch yet): `web/components/ui/index.ts`

**Decision point:** name is `LabSection`, not `Section`, because `web/components/ui/Section.tsx` already exists for v2 light-only sections. Net-new component avoids accidental import resolution. We'll re-export under `Section` from `index.ts` only after all v2 consumers are migrated (Stage 5).

**Step 1: Write failing test**

Create `web/components/ui/LabSection.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LabSection } from './LabSection'

describe('<LabSection>', () => {
  it('renders cream variant with ink text by default', () => {
    render(<LabSection variant="cream" data-testid="s">hello</LabSection>)
    const el = screen.getByTestId('s')
    expect(el.className).toContain('bg-[var(--color-lj-cream)]')
    expect(el.className).toContain('text-[var(--color-lj-ink)]')
  })

  it('renders ink variant with bone text', () => {
    render(<LabSection variant="ink" data-testid="s">hello</LabSection>)
    const el = screen.getByTestId('s')
    expect(el.className).toContain('bg-[var(--color-lj-ink)]')
    expect(el.className).toContain('text-[var(--color-lj-bone)]')
  })

  it('forwards id to the underlying section element', () => {
    render(<LabSection variant="cream" id="manifesto">x</LabSection>)
    expect(document.querySelector('#manifesto')).not.toBeNull()
  })
})
```

**Step 2: Run test — see fail**

Run: `cd web && npx vitest run components/ui/LabSection.test.tsx`
Expected: FAIL (file does not exist)

**Step 3: Implement minimal**

Create `web/components/ui/LabSection.tsx`:
```tsx
import type { ReactNode, HTMLAttributes } from 'react'

interface Props extends HTMLAttributes<HTMLElement> {
  variant: 'cream' | 'ink'
  children: ReactNode
}

export function LabSection({ variant, className = '', children, ...rest }: Props) {
  const palette =
    variant === 'cream'
      ? 'bg-[var(--color-lj-cream)] text-[var(--color-lj-ink)]'
      : 'bg-[var(--color-lj-ink)] text-[var(--color-lj-bone)]'
  return (
    <section
      className={`relative overflow-hidden ${palette} ${className}`.trim()}
      {...rest}
    >
      {children}
    </section>
  )
}
```

**Step 4: Verify pass**

Run: `npx vitest run components/ui/LabSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add web/components/ui/LabSection.tsx web/components/ui/LabSection.test.tsx
git commit -m "feat(v3): add LabSection primitive with cream/ink variants"
```

---

### Task 1.2: `<NotebookHeader>` primitive

**Files:**
- Create: `web/components/ui/NotebookHeader.tsx`
- Create: `web/components/ui/NotebookHeader.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotebookHeader } from './NotebookHeader'

describe('<NotebookHeader>', () => {
  it('renders section index, label, page count, and edition', () => {
    render(
      <NotebookHeader
        section="01"
        label="Лабораторный журнал"
        page={1}
        total={3}
        edition="Ред. 2026.04 / v3"
      />,
    )
    expect(screen.getByText(/01\s*—\s*Лабораторный журнал/i)).toBeInTheDocument()
    expect(screen.getByText('стр. 01 / 03')).toBeInTheDocument()
    expect(screen.getByText('Ред. 2026.04 / v3')).toBeInTheDocument()
  })

  it('zero-pads page numbers to 2 digits', () => {
    render(<NotebookHeader section="02" label="x" page={2} total={10} />)
    expect(screen.getByText('стр. 02 / 10')).toBeInTheDocument()
  })

  it('omits edition when not provided', () => {
    render(<NotebookHeader section="01" label="x" page={1} total={3} />)
    expect(screen.queryByText(/Ред\./)).toBeNull()
  })
})
```

**Step 2: Run — fail**

Run: `npx vitest run components/ui/NotebookHeader.test.tsx`

**Step 3: Implement**

```tsx
interface Props {
  section: string
  label: string
  page: number
  total: number
  edition?: string
}

export function NotebookHeader({ section, label, page, total, edition }: Props) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="absolute top-5 left-6 right-6 z-[5] flex items-center justify-between font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em]">
      <div className="flex items-center gap-3">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-lj-brand)]" />
        <span>№ {section} — {label}</span>
      </div>
      <div className="flex gap-7">
        {edition && <span>{edition}</span>}
        <span>стр. {pad(page)} / {pad(total)}</span>
      </div>
    </div>
  )
}
```

**Step 4: Pass**

Run: `npx vitest run components/ui/NotebookHeader.test.tsx`

**Step 5: Commit**

```bash
git add web/components/ui/NotebookHeader.tsx web/components/ui/NotebookHeader.test.tsx
git commit -m "feat(v3): add NotebookHeader primitive"
```

---

### Task 1.3: `<GridOverlay>` primitive

**Files:**
- Create: `web/components/ui/GridOverlay.tsx`
- Create: `web/components/ui/GridOverlay.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GridOverlay } from './GridOverlay'

describe('<GridOverlay>', () => {
  it('renders cream-line grid by default', () => {
    const { container } = render(<GridOverlay />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('absolute')
    expect(el.className).toContain('inset-0')
    expect(el.style.backgroundImage).toContain('var(--color-lj-cream-line)')
  })

  it('renders ink-line grid when surface=ink', () => {
    const { container } = render(<GridOverlay surface="ink" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.backgroundImage).toContain('var(--color-lj-ink-line)')
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
interface Props {
  surface?: 'cream' | 'ink'
  size?: number
}

export function GridOverlay({ surface = 'cream', size = 64 }: Props) {
  const line = surface === 'ink' ? 'var(--color-lj-ink-line)' : 'var(--color-lj-cream-line)'
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  )
}
```

**Step 4: Pass**

**Step 5: Commit**

```bash
git add web/components/ui/GridOverlay.tsx web/components/ui/GridOverlay.test.tsx
git commit -m "feat(v3): add GridOverlay blueprint primitive"
```

---

### Task 1.4: `<RuleAsym>` primitive

**Files:**
- Create: `web/components/ui/RuleAsym.tsx`
- Create: `web/components/ui/RuleAsym.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RuleAsym } from './RuleAsym'

describe('<RuleAsym>', () => {
  it('renders 38% width left-aligned by default', () => {
    const { container } = render(<RuleAsym />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('38%')
    expect(el.style.left).toBe('0px')
  })

  it('renders 22% width right-aligned when align=right', () => {
    const { container } = render(<RuleAsym align="right" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('22%')
    expect(el.style.right).toBe('0px')
  })

  it('uses ink-on-rule color when surface=ink', () => {
    const { container } = render(<RuleAsym surface="ink" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.background).toContain('var(--color-lj-rule-on-ink)')
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
interface Props {
  align?: 'left' | 'right'
  surface?: 'cream' | 'ink'
}

export function RuleAsym({ align = 'left', surface = 'cream' }: Props) {
  const width = align === 'right' ? '22%' : '38%'
  const positionStyle = align === 'right' ? { right: '0px' } : { left: '0px' }
  const background = surface === 'ink' ? 'var(--color-lj-rule-on-ink)' : 'var(--color-lj-rule)'
  return (
    <div
      aria-hidden="true"
      className="absolute bottom-0 h-px"
      style={{ width, ...positionStyle, background }}
    />
  )
}
```

**Step 4: Pass**

**Step 5: Commit**

```bash
git add web/components/ui/RuleAsym.tsx web/components/ui/RuleAsym.test.tsx
git commit -m "feat(v3): add RuleAsym divider primitive"
```

---

### Task 1.5: `<MoleculeMotif>` with benzene / anthracene / water variants

**Files:**
- Create: `web/components/decor/MoleculeMotif.lj.tsx` (`.lj.` to avoid collision with existing `decor/MoleculeMotif.tsx`)
- Create: `web/components/decor/MoleculeMotif.lj.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MoleculeMotifLJ } from './MoleculeMotif.lj'

describe('<MoleculeMotifLJ>', () => {
  it('renders benzene variant as a single hexagon + circle', () => {
    const { container } = render(<MoleculeMotifLJ variant="benzene" />)
    const polygons = container.querySelectorAll('polygon')
    const circles = container.querySelectorAll('circle')
    expect(polygons.length).toBe(1)
    expect(circles.length).toBe(1)
  })

  it('renders anthracene variant as three fused hexagons', () => {
    const { container } = render(<MoleculeMotifLJ variant="anthracene" />)
    const polygons = container.querySelectorAll('polygon')
    expect(polygons.length).toBe(3)
  })

  it('renders water variant with H–O–H bonds and atom labels', () => {
    const { container } = render(<MoleculeMotifLJ variant="water" />)
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThanOrEqual(2)
    const text = container.textContent || ''
    expect(text).toContain('O')
    expect(text).toContain('H')
  })

  it('never renders C/H atom labels for benzene', () => {
    const { container } = render(<MoleculeMotifLJ variant="benzene" />)
    expect(container.textContent).not.toContain('C')
    expect(container.textContent).not.toContain('H')
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

Copy the inline SVG structures from `concept.html` (hero benzene, manifesto anthracene, hero water-detail). Drop into a single component with a `variant` switch:

```tsx
type Variant = 'benzene' | 'anthracene' | 'water' | 'methane'
interface Props {
  variant: Variant
  className?: string
  style?: React.CSSProperties
}

export function MoleculeMotifLJ({ variant, className = '', style }: Props) {
  if (variant === 'benzene') {
    return (
      <svg
        viewBox="0 0 400 400"
        aria-hidden="true"
        className={className}
        style={style}
      >
        <g stroke="currentColor" fill="none" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round">
          <polygon points="200,40 348,125 348,275 200,360 52,275 52,125" />
          <circle cx="200" cy="200" r="86" />
          <line x1="200" y1="40" x2="200" y2="2" />
          <line x1="348" y1="125" x2="386" y2="105" />
          <line x1="348" y1="275" x2="386" y2="295" />
          <line x1="200" y1="360" x2="200" y2="398" />
          <line x1="52" y1="275" x2="14" y2="295" />
          <line x1="52" y1="125" x2="14" y2="105" />
        </g>
      </svg>
    )
  }
  if (variant === 'anthracene') {
    return (
      <svg viewBox="0 0 600 280" aria-hidden="true" className={className} style={style}>
        <g stroke="currentColor" fill="none" strokeWidth={1}>
          <polygon points="100,40 200,90 200,190 100,240 0,190 0,90" />
          <circle cx="100" cy="140" r="62" />
          <polygon points="300,40 400,90 400,190 300,240 200,190 200,90" />
          <circle cx="300" cy="140" r="62" />
          <polygon points="500,40 600,90 600,190 500,240 400,190 400,90" />
          <circle cx="500" cy="140" r="62" />
        </g>
      </svg>
    )
  }
  if (variant === 'water') {
    return (
      <svg viewBox="0 0 110 60" aria-hidden="true" className={className} style={style}>
        <g stroke="currentColor" fill="none" strokeWidth={1.2} strokeLinecap="round">
          <line x1="20" y1="38" x2="55" y2="22" />
          <line x1="55" y1="22" x2="90" y2="38" />
        </g>
        <text x="14" y="44" fontFamily="var(--font-lj-mono)" fontSize="9" fill="currentColor">H</text>
        <text x="92" y="44" fontFamily="var(--font-lj-mono)" fontSize="9" fill="currentColor">H</text>
        <text x="49" y="18" fontFamily="var(--font-lj-mono)" fontSize="9" fill="currentColor">O</text>
      </svg>
    )
  }
  // methane (placeholder for future use — minimal tetrahedral)
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className} style={style}>
      <g stroke="currentColor" fill="none" strokeWidth={1.2}>
        <line x1="50" y1="50" x2="20" y2="20" />
        <line x1="50" y1="50" x2="80" y2="20" />
        <line x1="50" y1="50" x2="20" y2="80" />
        <line x1="50" y1="50" x2="80" y2="80" />
      </g>
    </svg>
  )
}
```

**Step 4: Pass**

Run: `npx vitest run components/decor/MoleculeMotif.lj.test.tsx`

**Note:** the `benzene` test asserts no `C`/`H` text — the design doc requires labels removed. If the test fails because `currentColor` text appears as a 1-letter character somewhere unexpected (e.g. the comment about `H` in the future-methane variant), tighten the selector.

**Step 5: Commit**

```bash
git add web/components/decor/MoleculeMotif.lj.tsx web/components/decor/MoleculeMotif.lj.test.tsx
git commit -m "feat(v3): add MoleculeMotif Lab Journal variants (benzene, anthracene, water, methane)"
```

---

### Task 1.6: `<Callout>` hand-drawn arrow primitive

**Files:**
- Create: `web/components/ui/Callout.tsx`
- Create: `web/components/ui/Callout.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Callout } from './Callout'

describe('<Callout>', () => {
  it('renders callout text', () => {
    render(<Callout text="48 опытов" position="right" />)
    expect(screen.getByText('48 опытов')).toBeInTheDocument()
  })

  it('positions to top-right by default', () => {
    const { container } = render(<Callout text="x" position="right" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('right-')
  })

  it('mirrors arrow path when position=left', () => {
    const { container } = render(<Callout text="x" position="left" />)
    const svg = container.querySelector('svg')
    expect(svg?.style.transform).toContain('scaleX(-1)')
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
type Position = 'right' | 'left'
interface Props {
  text: string
  position: Position
  topPercent?: number  // vertical offset 0–100
  className?: string
}

export function Callout({ text, position, topPercent = 30, className = '' }: Props) {
  const sideClass = position === 'right'
    ? 'right-[-3.5rem] items-start'
    : 'left-[-3.5rem] items-end'
  const flipStyle = position === 'left' ? { transform: 'scaleX(-1)' } : undefined
  return (
    <div
      aria-hidden="true"
      className={`absolute z-[4] pointer-events-none flex flex-col gap-1 ${sideClass} ${className}`}
      style={{ top: `${topPercent}%`, width: '110px' }}
    >
      <svg width="110" height="60" viewBox="0 0 110 60" style={flipStyle}>
        <path
          d="M5,30 Q 35,5 90,18 L82,12 M90,18 L84,26"
          fill="none"
          stroke="var(--color-lj-brand)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={220}
          strokeDashoffset={220}
          className="transition-[stroke-dashoffset] duration-[0.8s] [.callout-host:hover_&]:[stroke-dashoffset:0]"
        />
      </svg>
      <span
        className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] text-[var(--color-lj-brand-deep)] bg-[var(--color-lj-cream)] px-1.5 py-0.5 opacity-0 translate-y-1 transition-[opacity,transform] duration-[0.4s] delay-200 [.callout-host:hover_&]:opacity-100 [.callout-host:hover_&]:translate-y-0"
      >
        {text}
      </span>
    </div>
  )
}
```

The hover trigger uses Tailwind 4 arbitrary parent selector syntax `[.callout-host:hover_&]`. Parent must be `<article class="callout-host relative">` for the hover to fire — document this in a JSDoc comment above the component.

**Step 4: Pass**

**Step 5: Commit**

```bash
git add web/components/ui/Callout.tsx web/components/ui/Callout.test.tsx
git commit -m "feat(v3): add Callout hand-drawn arrow primitive"
```

---

## Stage 2 — Hero rebuild

### Task 2.1: Hero supporting detail components (4 small components)

**Files:**
- Create: `web/components/marketing/HeroFigtag.tsx`
- Create: `web/components/marketing/HeroScale.tsx`
- Create: `web/components/marketing/HeroAnnotation.tsx`
- Create: `web/components/marketing/HeroDetailMolecule.tsx`
- One combined test: `web/components/marketing/HeroDetail.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroFigtag } from './HeroFigtag'
import { HeroScale } from './HeroScale'
import { HeroAnnotation } from './HeroAnnotation'
import { HeroDetailMolecule } from './HeroDetailMolecule'

describe('Hero detail components', () => {
  it('HeroFigtag shows figure number and arr label', () => {
    render(<HeroFigtag figNumber="001-A" arr="C₆H₆" />)
    expect(screen.getByText(/fig\. 001-A/i)).toBeInTheDocument()
    expect(screen.getByText(/arr\. C₆H₆/i)).toBeInTheDocument()
  })

  it('HeroScale shows unit caption', () => {
    render(<HeroScale caption="scale 1 : 1 · 200 mm" />)
    expect(screen.getByText('scale 1 : 1 · 200 mm')).toBeInTheDocument()
  })

  it('HeroAnnotation shows two-line annotation', () => {
    render(<HeroAnnotation primary="рабочая область" secondary="1080 × 1920 mm" />)
    expect(screen.getByText('рабочая область')).toBeInTheDocument()
    expect(screen.getByText('1080 × 1920 mm')).toBeInTheDocument()
  })

  it('HeroDetailMolecule renders water molecule by default', () => {
    const { container } = render(<HeroDetailMolecule />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement (each file ~15 lines, paste from concept.html)**

`HeroFigtag.tsx`:
```tsx
interface Props { figNumber: string; arr: string }
export function HeroFigtag({ figNumber, arr }: Props) {
  return (
    <div
      aria-hidden="true"
      className="absolute top-[5.5rem] left-1/2 -translate-x-1/2 z-[2] flex gap-5 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] opacity-40 pointer-events-none"
    >
      <span className="inline-flex items-center gap-1.5 before:content-[''] before:w-3.5 before:h-px before:bg-current before:opacity-60">fig. {figNumber}</span>
      <span className="inline-flex items-center gap-1.5 before:content-[''] before:w-3.5 before:h-px before:bg-current before:opacity-60">arr. {arr}</span>
    </div>
  )
}
```

`HeroScale.tsx`:
```tsx
interface Props { caption: string }
export function HeroScale({ caption }: Props) {
  return (
    <div
      aria-hidden="true"
      className="absolute bottom-[5.5rem] left-8 z-[3] flex flex-col gap-1.5 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] opacity-55 pointer-events-none"
    >
      <svg viewBox="0 0 200 16" width="200" height="16">
        <line x1="2" y1="8" x2="198" y2="8" stroke="currentColor" strokeWidth="1" />
        <g stroke="currentColor" strokeWidth="1">
          <line x1="2" y1="3" x2="2" y2="13" />
          <line x1="42" y1="5" x2="42" y2="11" />
          <line x1="82" y1="5" x2="82" y2="11" />
          <line x1="122" y1="5" x2="122" y2="11" />
          <line x1="162" y1="5" x2="162" y2="11" />
          <line x1="198" y1="3" x2="198" y2="13" />
        </g>
      </svg>
      <span>{caption}</span>
    </div>
  )
}
```

`HeroAnnotation.tsx`:
```tsx
interface Props { primary: string; secondary: string }
export function HeroAnnotation({ primary, secondary }: Props) {
  return (
    <div
      aria-hidden="true"
      className="absolute bottom-[5.5rem] right-8 z-[3] text-right font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] opacity-55 pointer-events-none before:content-[''] before:block before:w-20 before:h-px before:bg-current before:opacity-35 before:mb-2 before:ml-auto"
    >
      {primary}<br />{secondary}
    </div>
  )
}
```

`HeroDetailMolecule.tsx`:
```tsx
import { MoleculeMotifLJ } from '@/components/decor/MoleculeMotif.lj'
interface Props { variant?: 'water' | 'methane' }
export function HeroDetailMolecule({ variant = 'water' }: Props) {
  return (
    <div
      aria-hidden="true"
      className="absolute top-[5.5rem] right-12 z-[2] opacity-55 pointer-events-none"
      style={{ width: 110, height: 60 }}
    >
      <MoleculeMotifLJ variant={variant} className="w-[110px] h-[60px] text-[var(--color-lj-ink)]" />
    </div>
  )
}
```

**Step 4: Pass**

Run: `npx vitest run components/marketing/HeroDetail.test.tsx`

**Step 5: Commit**

```bash
git add web/components/marketing/HeroFigtag.tsx web/components/marketing/HeroScale.tsx web/components/marketing/HeroAnnotation.tsx web/components/marketing/HeroDetailMolecule.tsx web/components/marketing/HeroDetail.test.tsx
git commit -m "feat(v3): add hero detail components (figtag, scale, annotation, detail molecule)"
```

---

### Task 2.2: Rebuild `<Hero>` with v3 structure

**Files:**
- Modify: `web/components/marketing/Hero.tsx` (rebuild)
- Modify: `web/components/marketing/Hero.test.tsx` (rewrite tests for v3 props)

**Step 1: Inspect current consumers and prop signature**

Run: `grep -rn 'import.*Hero[^P]' web/{app,components}/ | head -10`

Note: current Hero takes `eyebrow, title, lead, primaryCta, secondaryCta, products, emphasisWord, tickerItems`. New Hero will take the same signature minus `products` and `emphasisWord` (handled differently — see Step 3), so most consumers stay working without code change.

**Step 2: Failing test**

Replace `web/components/marketing/Hero.test.tsx` with:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hero } from './Hero'

describe('<Hero> v3', () => {
  it('renders headline rows with brand-purple emphasis word', () => {
    render(
      <Hero
        eyebrow="Опыты в коробке · Москва, с 2017"
        headlineRows={[
          { text: 'Опыт', emphasis: true },
          { text: 'вместо', offset: true },
          { text: 'объяснений' },
        ]}
        trailLine="— химия, которую держат в руках"
        lead="3 набора. От реакций меди до электролиза."
        primaryCta={{ label: 'Открыть каталог', href: '/catalog' }}
        secondaryCta={{ label: 'Что мы делаем', href: '#manifesto' }}
        tickerItems={['H₂O', 'NaCl']}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Опыт.*вместо.*объяснений/s)
    expect(screen.getByText('— химия, которую держат в руках')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Открыть каталог/ })).toHaveAttribute('href', '/catalog')
  })

  it('emphasis row gets brand-purple italic class', () => {
    const { container } = render(
      <Hero
        eyebrow="x"
        headlineRows={[{ text: 'Опыт', emphasis: true }, { text: 'rest' }]}
        trailLine="t"
        lead="l"
        primaryCta={{ label: 'a', href: '/' }}
      />,
    )
    const emphasisSpan = container.querySelector('.lj-headline-emphasis')
    expect(emphasisSpan).not.toBeNull()
    expect(emphasisSpan?.textContent).toBe('Опыт')
  })
})
```

**Step 3: Run — fail (props mismatch)**

**Step 4: Rebuild Hero**

Replace `web/components/marketing/Hero.tsx`:

```tsx
import Link from 'next/link'
import { LabSection } from '@/components/ui/LabSection'
import { GridOverlay } from '@/components/ui/GridOverlay'
import { NotebookHeader } from '@/components/ui/NotebookHeader'
import { MoleculeMotifLJ } from '@/components/decor/MoleculeMotif.lj'
import { HeroFigtag } from './HeroFigtag'
import { HeroScale } from './HeroScale'
import { HeroAnnotation } from './HeroAnnotation'
import { HeroDetailMolecule } from './HeroDetailMolecule'

interface CtaProps { label: string; href: string }
interface HeadlineRow { text: string; emphasis?: boolean; offset?: boolean }
interface Props {
  eyebrow: string
  headlineRows: HeadlineRow[]
  trailLine: string
  lead: string
  primaryCta: CtaProps
  secondaryCta?: CtaProps
  tickerItems?: string[]
}

const DEFAULT_TICKER = [
  'H₂O · вода', 'NaCl · соль', 'CuSO₄ · медь', 'pH 7.0 · нейтрально',
  'C₆H₁₂O₆ · глюкоза', 'HCl · соляная', 'Fe + S → FeS', 'NH₃ · аммиак',
  '2 H₂O₂ → 2 H₂O + O₂', 'K · калий',
]

export function Hero({
  eyebrow, headlineRows, trailLine, lead,
  primaryCta, secondaryCta,
  tickerItems = DEFAULT_TICKER,
}: Props) {
  return (
    <LabSection variant="cream" className="min-h-screen px-6 pt-24 pb-20 flex flex-col justify-center">
      <GridOverlay />
      <NotebookHeader section="001" label="Лабораторный журнал" page={1} total={3} edition="Ред. 2026.04 / v3" />
      <HeroFigtag figNumber="001-A" arr="C₆H₆" />
      <HeroDetailMolecule variant="water" />

      {/* Pinned rotating benzene */}
      <MoleculeMotifLJ
        variant="benzene"
        className="absolute z-[1] pointer-events-none text-[var(--color-lj-ink)] [animation:lj-rotate-slow_80s_linear_infinite] [mix-blend-mode:multiply]"
        style={{
          top: '48%',
          right: '-10vw',
          transform: 'translateY(-50%)',
          width: 'clamp(360px, 52vh, 620px)',
          height: 'clamp(360px, 52vh, 620px)',
          opacity: 0.42,
        }}
      />

      <div className="relative z-[2] max-w-[var(--max-lj-content)] mx-auto w-full">
        <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] mb-10 inline-flex items-center gap-3 before:content-[''] before:w-2 before:h-2 before:bg-[var(--color-lj-brand)] before:rounded-full">
          {eyebrow}
        </p>

        <h1 className="font-[var(--font-lj-display)] font-[900] text-[length:var(--text-lj-mega)] leading-[0.88] tracking-[-0.045em] uppercase mb-10 relative z-[2]">
          {headlineRows.map((row, i) => (
            <span
              key={i}
              className={`block ${row.offset ? 'pl-[9vw]' : ''}`}
            >
              {row.emphasis ? (
                <em className="lj-headline-emphasis text-[var(--color-lj-brand)] italic font-[900] not-italic-fix">
                  {row.text}
                </em>
              ) : row.text}
            </span>
          ))}
          <span className="block font-[var(--font-lj-mono)] font-normal text-[clamp(0.875rem,1vw,1.125rem)] normal-case tracking-[0.02em] opacity-55 mt-6 pl-[9vw] max-w-[36ch] leading-snug">
            {trailLine}
          </span>
        </h1>

        <p className="max-w-[540px] text-xl leading-snug opacity-78 mb-12 relative z-[2]">{lead}</p>

        <div className="flex gap-4 items-center flex-wrap relative z-[2]">
          <Link
            href={primaryCta.href}
            className="inline-flex items-center gap-3 px-7 py-4 font-[var(--font-lj-mono)] text-[0.8125rem] font-medium uppercase tracking-[0.08em] border border-[var(--color-lj-ink)] rounded-full bg-[var(--color-lj-ink)] text-[var(--color-lj-bone)] transition-all duration-400 hover:bg-[var(--color-lj-brand-deep)] hover:border-[var(--color-lj-brand-deep)]"
          >
            {primaryCta.label}
            <svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="inline-flex items-center gap-3 px-7 py-4 font-[var(--font-lj-mono)] text-[0.8125rem] font-medium uppercase tracking-[0.08em] border border-[var(--color-lj-ink)] rounded-full bg-transparent text-[var(--color-lj-ink)] transition-all duration-400 hover:bg-[var(--color-lj-ink)] hover:text-[var(--color-lj-bone)]"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </div>

      <HeroScale caption="scale 1 : 1 · 200 mm" />
      <HeroAnnotation primary="рабочая область" secondary="1080 × 1920 mm" />

      {/* Ticker */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--color-lj-rule)] bg-[var(--color-lj-cream)] overflow-hidden h-14 flex items-center z-[4]">
        <div
          className="flex gap-12 whitespace-nowrap font-[var(--font-lj-mono)] text-[0.8125rem] uppercase tracking-[0.08em] [animation:lj-ticker_50s_linear_infinite] pl-12 shrink-0"
          aria-hidden="true"
        >
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-3.5 shrink-0">
              <span className="w-1 h-1 rounded-full bg-[var(--color-lj-brand)]" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </LabSection>
  )
}
```

**Step 5: Add `@keyframes` to globals.css**

Append to `web/app/globals.css` (outside `@theme inline`):
```css
@keyframes lj-rotate-slow { to { transform: translateY(-50%) rotate(360deg); } }
@keyframes lj-rotate-slow-reverse { to { transform: translate(-50%, -50%) rotate(-360deg); } }
@keyframes lj-ticker { to { transform: translateX(-50%); } }
```

**Step 6: Pass + delete dead HeroProductStack**

Run: `npx vitest run components/marketing/Hero.test.tsx`
Run: `rm web/components/marketing/HeroProductStack.tsx web/components/marketing/HeroProductStack.test.tsx`

Verify nothing else imports it: `grep -rn 'HeroProductStack' web/ 2>/dev/null` — should return only the deleted files.

**Step 7: Update homepage Hero invocation**

Find and update: `grep -rn '<Hero' web/app/ | head` — most likely in `web/app/[locale]/(public)/page.tsx`. Replace the v2 props with v3 shape:

```tsx
<Hero
  eyebrow="Опыты в коробке · Москва, с 2017"
  headlineRows={[
    { text: 'Опыт', emphasis: true },
    { text: 'вместо', offset: true },
    { text: 'объяснений' },
  ]}
  trailLine="— химия, которую держат в руках, а не учат наизусть."
  lead="3 набора. От реакций меди до электролиза — настоящие реагенты, посуда, понятные протоколы. То, что школа показывает на видео, вы делаете руками."
  primaryCta={{ label: 'Открыть каталог', href: '/catalog' }}
  secondaryCta={{ label: 'Что мы делаем', href: '#manifesto' }}
/>
```

**Step 8: Build + commit**

```bash
cd web && npm run build
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
git add web/components/marketing/Hero.tsx web/components/marketing/Hero.test.tsx web/app/globals.css web/app/[locale]/(public)/page.tsx
git rm web/components/marketing/HeroProductStack.tsx web/components/marketing/HeroProductStack.test.tsx
git commit -m "feat(v3): rebuild Hero with Lab Journal structure, drop HeroProductStack"
```

---

### Task 2.3: Manual visual smoke-check on dev server

**Files:** none

**Step 1: Run dev server**

Run: `cd web && npm run dev`

**Step 2: Visit http://localhost:3000 and confirm**

- Hero renders with cream background
- Headline shows "ОПЫТ" in brand-purple italic
- Benzene rotates slowly behind headline (multiply blend)
- Notebook header top-corners visible
- Ticker scrolls along bottom
- Scale ruler bottom-left, annotation bottom-right, fig tag center-top, water molecule top-right

If something looks off, it's likely a Tailwind 4 arbitrary-value class miscompile — check `npm run build 2>&1 | grep -i warn` for token resolution issues.

**Step 3: No commit** — verification only. If issues found, address in next mini-commit before Stage 3.

---

## Stage 3 — Manifesto + NumberCell + 4 data-viz

### Task 3.1: `<NumberCell>` (renames + extends `BigNumber`)

**Files:**
- Create: `web/components/ui/NumberCell.tsx`
- Create: `web/components/ui/NumberCell.test.tsx`
- Will-delete (Task 5.4): `web/components/ui/BigNumber.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NumberCell } from './NumberCell'

describe('<NumberCell>', () => {
  it('renders index, top label, big static value, bottom labels', () => {
    render(
      <NumberCell
        index="01"
        topLabel="год"
        big="2023"
        bottomLeft="основано"
        bottomRight="3 года"
      />
    )
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('год')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()
    expect(screen.getByText('основано')).toBeInTheDocument()
    expect(screen.getByText('3 года')).toBeInTheDocument()
  })

  it('accepts viz children in slot', () => {
    render(
      <NumberCell index="04" topLabel="реакций" big="161">
        <div data-testid="viz-slot">viz here</div>
      </NumberCell>
    )
    expect(screen.getByTestId('viz-slot')).toBeInTheDocument()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
import type { ReactNode } from 'react'

interface Props {
  index: string
  topLabel: string
  big: string
  bigVariant?: 'default' | 'decimal'
  bottomLeft?: string
  bottomRight?: string
  children?: ReactNode  // viz slot
}

export function NumberCell({
  index, topLabel, big, bigVariant = 'default',
  bottomLeft, bottomRight, children,
}: Props) {
  const tracking = bigVariant === 'decimal' ? 'tracking-[-0.06em]' : 'tracking-[-0.045em]'
  return (
    <div className="lj-num-cell relative overflow-hidden border border-[var(--color-lj-rule-on-ink)] p-5 pb-6 min-h-[18rem] flex flex-col justify-between gap-4 bg-[rgba(239,237,230,0.015)] transition-[background,border-color] duration-500 hover:bg-[rgba(131,110,254,0.06)] hover:border-[rgba(131,110,254,0.4)]">
      <span className="absolute top-0 left-0 right-0 h-px bg-[var(--color-lj-brand)] origin-left scale-x-0 transition-transform duration-[0.6s] [.lj-num-cell:hover_&]:scale-x-100" />
      <div className="flex justify-between items-center font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] text-[var(--color-lj-bone-mute)]">
        <span>{index}</span>
        <span>{topLabel}</span>
      </div>
      <div className={`font-[var(--font-lj-display)] font-[900] leading-none ${tracking} text-[clamp(2.5rem,4.8vw,4.25rem)] text-[var(--color-lj-bone)]`}>
        {big}
      </div>
      {children && <div className="flex items-center min-h-[36px] my-1">{children}</div>}
      {(bottomLeft || bottomRight) && (
        <div className="flex justify-between gap-2 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] text-[var(--color-lj-bone-mute)]">
          <span className="text-[var(--color-lj-brand)]">{bottomLeft}</span>
          <span>{bottomRight}</span>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Pass**

**Step 5: Commit**

```bash
git add web/components/ui/NumberCell.tsx web/components/ui/NumberCell.test.tsx
git commit -m "feat(v3): add NumberCell Mendeleev-style stat cell"
```

---

### Task 3.2: `<Timeline>` data-viz component

**Files:**
- Create: `web/components/dataviz/Timeline.tsx`
- Create: `web/components/dataviz/Timeline.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Timeline } from './Timeline'

describe('<Timeline>', () => {
  it('renders one circle per point and marks active with brand fill', () => {
    const { container } = render(<Timeline points={['23', '24', '25', '26']} active={0} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(4)
    expect(circles[0].getAttribute('fill')).toBe('#836efe')
  })

  it('renders point labels', () => {
    render(<Timeline points={['23', '24']} active={0} />)
    expect(screen.getByText("'23")).toBeInTheDocument()
    expect(screen.getByText("'24")).toBeInTheDocument()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
interface Props {
  points: string[]
  active: number
}
export function Timeline({ points, active }: Props) {
  const w = 220
  const step = (w - 24) / (points.length - 1)
  return (
    <svg viewBox={`0 0 ${w} 36`} className="w-full" aria-hidden="true">
      <line x1={12} y1={18} x2={w - 12} y2={18} stroke="rgba(239,237,230,0.25)" strokeWidth={1} />
      {points.map((label, i) => {
        const cx = 12 + i * step
        const isActive = i === active
        return (
          <g key={i}>
            <circle
              cx={cx} cy={18}
              r={isActive ? 6 : 3}
              fill={isActive ? '#836efe' : 'rgba(239,237,230,0.6)'}
              stroke={isActive ? 'none' : 'rgba(239,237,230,0.6)'}
              strokeWidth={isActive ? 0 : 1.2}
            />
            <text
              x={cx} y={34}
              fontFamily="var(--font-lj-mono)"
              fontSize={8}
              fill={isActive ? '#836efe' : 'rgba(239,237,230,0.55)'}
              textAnchor="middle"
            >
              '{label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
git add web/components/dataviz/Timeline.tsx web/components/dataviz/Timeline.test.tsx
git commit -m "feat(v3): add Timeline dataviz component"
```

---

### Task 3.3: `<Scientific>` data-viz component

**Files:**
- Create: `web/components/dataviz/Scientific.tsx`
- Create: `web/components/dataviz/Scientific.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Scientific } from './Scientific'

describe('<Scientific>', () => {
  it('renders mantissa, base, exponent, and units', () => {
    render(<Scientific mantissa="2" base="10" exponent="4" units="людей" />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText(/людей/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
interface Props {
  mantissa: string
  base: string
  exponent: string
  units: string
}
export function Scientific({ mantissa, base, exponent, units }: Props) {
  return (
    <div className="flex items-baseline gap-1 font-[var(--font-lj-display)] font-[700] text-2xl tracking-[-0.03em] text-[var(--color-lj-bone)]">
      <span>{mantissa}</span>
      <span className="font-[var(--font-lj-mono)] font-normal text-[var(--color-lj-brand)] mx-0.5 text-lg">×</span>
      <span>{base}</span>
      <sup className="font-[var(--font-lj-display)] text-base text-[var(--color-lj-brand)] -translate-y-2">{exponent}</sup>
      <span className="font-[var(--font-lj-mono)] font-normal text-[0.7rem] text-[var(--color-lj-bone-mute)] uppercase tracking-[0.08em] ml-2">= {units}</span>
    </div>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
git add web/components/dataviz/Scientific.tsx web/components/dataviz/Scientific.test.tsx
git commit -m "feat(v3): add Scientific dataviz component"
```

---

### Task 3.4: `<Rating>` data-viz component

**Files:**
- Create: `web/components/dataviz/Rating.tsx`
- Create: `web/components/dataviz/Rating.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Rating } from './Rating'

describe('<Rating>', () => {
  it('renders N circles for "out of N" rating', () => {
    const { container } = render(<Rating value={4.9} max={5} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(6) // 4 filled + 1 outline + 1 partial = 6
  })

  it('handles integer ratings without partial fill', () => {
    const { container } = render(<Rating value={5} max={5} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(5)
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
interface Props { value: number; max: number }
export function Rating({ value, max }: Props) {
  const fullCount = Math.floor(value)
  const partial = value - fullCount
  const w = 220
  const cellW = w / max
  return (
    <svg viewBox={`0 0 ${w} 28`} className="w-full" aria-hidden="true">
      {Array.from({ length: fullCount }).map((_, i) => (
        <circle
          key={`full-${i}`}
          cx={cellW * (i + 0.5)} cy={14} r={11}
          fill="#836efe"
        />
      ))}
      {partial > 0 && fullCount < max && (
        <>
          <circle
            cx={cellW * (fullCount + 0.5)} cy={14} r={11}
            fill="none" stroke="#836efe" strokeWidth={1.5}
          />
          <clipPath id={`rating-clip-${fullCount}`}>
            <rect
              x={cellW * (fullCount + 0.5) - 11}
              y={3}
              width={22 * partial}
              height={22}
            />
          </clipPath>
          <circle
            cx={cellW * (fullCount + 0.5)} cy={14} r={11}
            fill="#836efe" clipPath={`url(#rating-clip-${fullCount})`}
          />
        </>
      )}
    </svg>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
git add web/components/dataviz/Rating.tsx web/components/dataviz/Rating.test.tsx
git commit -m "feat(v3): add Rating dataviz component"
```

---

### Task 3.5: `<DotGrid>` data-viz component

**Files:**
- Create: `web/components/dataviz/DotGrid.tsx`
- Create: `web/components/dataviz/DotGrid.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DotGrid } from './DotGrid'

describe('<DotGrid>', () => {
  it('renders exactly N circles for total=N', () => {
    const { container } = render(<DotGrid total={161} cols={23} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(161)
  })

  it('marks the last dot with brand color', () => {
    const { container } = render(<DotGrid total={4} cols={2} />)
    const circles = container.querySelectorAll('circle')
    expect(circles[circles.length - 1].getAttribute('fill')).toBe('#836efe')
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement (server-render the circles, no JS)**

```tsx
interface Props {
  total: number
  cols: number
  cellW?: number
  cellH?: number
  dotR?: number
}
export function DotGrid({ total, cols, cellW = 10, cellH = 14, dotR = 2 }: Props) {
  const rows = Math.ceil(total / cols)
  const dots: { cx: number; cy: number; isLast: boolean }[] = []
  for (let i = 0; i < total; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    dots.push({
      cx: c * cellW + cellW / 2,
      cy: r * cellH + cellH / 2,
      isLast: i === total - 1,
    })
  }
  return (
    <svg viewBox={`0 0 ${cols * cellW} ${rows * cellH}`} className="w-full max-h-[110px]" aria-hidden="true">
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx} cy={d.cy} r={dotR}
          fill={d.isLast ? '#836efe' : '#EFEDE6'}
          opacity={d.isLast ? 1 : 0.55}
        />
      ))}
    </svg>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
git add web/components/dataviz/DotGrid.tsx web/components/dataviz/DotGrid.test.tsx
git commit -m "feat(v3): add DotGrid literal-count dataviz component"
```

---

### Task 3.6: Rebuild `<Manifesto>`

**Files:**
- Modify: `web/components/marketing/Manifesto.tsx` (rebuild)
- Modify: `web/components/marketing/Manifesto.test.tsx`

**Step 1: Inspect current consumers + props**

Run: `grep -rn '<Manifesto' web/ | head`
Run: `cat web/components/marketing/Manifesto.tsx | head -40`

Note: most of the existing Manifesto props (statement, body, numbers) become structurally different. Plan to also update the homepage invocation in this task.

**Step 2: Failing test**

Replace `web/components/marketing/Manifesto.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Manifesto } from './Manifesto'

describe('<Manifesto> v3', () => {
  it('renders eyebrow, statement (with brand-purple emphasis), and body', () => {
    render(
      <Manifesto
        eyebrow="02.0 / Принципы лаборатории"
        statementParts={[{ text: 'Мы делаем ' }, { text: 'химию', emphasis: true }, { text: ', а не урок.' }]}
        body="Каждый набор — запечатанный комплект."
      />
    )
    expect(screen.getByText('02.0 / Принципы лаборатории')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Мы делаем химию, а не урок.')
    expect(screen.getByText(/Каждый набор/)).toBeInTheDocument()
  })

  it('renders 4 NumberCells with their data viz children', () => {
    const { container } = render(
      <Manifesto
        eyebrow="x"
        statementParts={[{ text: 'x' }]}
        body="x"
      />
    )
    expect(container.querySelectorAll('.lj-num-cell').length).toBe(4)
  })
})
```

**Step 3: Run — fail**

**Step 4: Implement**

Replace `web/components/marketing/Manifesto.tsx`:

```tsx
import { LabSection } from '@/components/ui/LabSection'
import { GridOverlay } from '@/components/ui/GridOverlay'
import { NotebookHeader } from '@/components/ui/NotebookHeader'
import { NumberCell } from '@/components/ui/NumberCell'
import { MoleculeMotifLJ } from '@/components/decor/MoleculeMotif.lj'
import { Timeline } from '@/components/dataviz/Timeline'
import { Scientific } from '@/components/dataviz/Scientific'
import { Rating } from '@/components/dataviz/Rating'
import { DotGrid } from '@/components/dataviz/DotGrid'

interface StatementPart { text: string; emphasis?: boolean }
interface Props {
  eyebrow: string
  statementParts: StatementPart[]
  body: string
}

export function Manifesto({ eyebrow, statementParts, body }: Props) {
  return (
    <LabSection variant="ink" id="manifesto" className="px-6 py-32">
      <GridOverlay surface="ink" />
      <NotebookHeader section="02" label="Манифест" page={2} total={3} />

      {/* Background ghost molecule */}
      <MoleculeMotifLJ
        variant="anthracene"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] pointer-events-none text-[var(--color-lj-bone)] opacity-[0.05] [animation:lj-rotate-slow-reverse_200s_linear_infinite]"
        style={{ width: 'clamp(600px, 90vmin, 1100px)', height: 'clamp(600px, 90vmin, 1100px)' }}
      />

      <div className="relative z-[2] max-w-[var(--max-lj-narrow)] mx-auto">
        <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] text-[var(--color-lj-bone-mute)] mb-12 inline-flex items-center gap-3 before:content-[''] before:w-2 before:h-2 before:bg-[var(--color-lj-brand)] before:rounded-full">
          {eyebrow}
        </p>

        <h2 className="font-[var(--font-lj-display)] font-[700] text-[length:var(--text-lj-display)] leading-[1.0] tracking-[-0.04em] mb-16 max-w-[18ch]">
          {statementParts.map((p, i) =>
            p.emphasis ? (
              <em key={i} className="italic text-[var(--color-lj-brand)] font-[700] relative after:absolute after:content-[''] after:left-0 after:right-0 after:bottom-1 after:h-[5px] after:bg-[var(--color-lj-brand)] after:opacity-50 after:rounded-sm">
                {p.text}
              </em>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )}
        </h2>

        <p className="max-w-[56ch] text-xl leading-[1.55] text-[rgba(239,237,230,0.78)] mb-24 pl-6 border-l border-[var(--color-lj-rule-on-ink)]">
          {body}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <NumberCell index="01" topLabel="год" big="2023" bottomLeft="основано" bottomRight="3 года">
            <Timeline points={['23', '24', '25', '26']} active={0} />
          </NumberCell>
          <NumberCell index="02" topLabel="купили" big="20 000+" bottomLeft="покупатели" bottomRight="с 2023">
            <Scientific mantissa="2" base="10" exponent="4" units="людей" />
          </NumberCell>
          <NumberCell index="03" topLabel="рейтинг" big="4,9" bigVariant="decimal" bottomLeft="из 5" bottomRight="WB & Ozon">
            <Rating value={4.9} max={5} />
          </NumberCell>
          <NumberCell index="04" topLabel="реакций" big="161" bottomLeft="в наборе" bottomRight="каждая ≠">
            <DotGrid total={161} cols={23} />
          </NumberCell>
        </div>
      </div>
    </LabSection>
  )
}
```

**Step 5: Update homepage invocation**

In `web/app/[locale]/(public)/page.tsx`, replace the existing `<Manifesto …>` with:
```tsx
<Manifesto
  eyebrow="02.0 / Принципы лаборатории"
  statementParts={[
    { text: 'Мы делаем ' },
    { text: 'химию', emphasis: true },
    { text: ', а не урок.' },
  ]}
  body="Каждый набор — запечатанный комплект реагентов, лабораторной посуды и понятных протоколов. Без воды, без слайдов, без «представьте, что произойдёт». Только реакция, наблюдение и вывод."
/>
```

**Step 6: Pass + commit**

Run: `npx vitest run components/marketing/Manifesto.test.tsx && cd web && npm run build`

```bash
git add web/components/marketing/Manifesto.tsx web/components/marketing/Manifesto.test.tsx web/app/[locale]/(public)/page.tsx
git commit -m "feat(v3): rebuild Manifesto with NumberCell + 4 data viz components"
```

---

## Stage 4 — ProductCard + StatBar + Chip

### Task 4.1: `<Chip>` primitive

**Files:**
- Create: `web/components/ui/Chip.tsx`
- Create: `web/components/ui/Chip.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Chip } from './Chip'

describe('<Chip>', () => {
  it('renders label as lowercase mono', () => {
    render(<Chip>безопасно</Chip>)
    const el = screen.getByText('безопасно')
    expect(el.className).toContain('font-[var(--font-lj-mono)]')
    expect(el.className).toContain('lowercase')
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
import type { ReactNode } from 'react'
interface Props { children: ReactNode }
export function Chip({ children }: Props) {
  return (
    <span className="inline-flex items-center px-3 py-1.5 border border-[var(--color-lj-ink)] rounded-full font-[var(--font-lj-mono)] text-[0.6875rem] lowercase tracking-[0.04em] text-[var(--color-lj-ink)] bg-transparent transition-[background,color] duration-400 group-hover/pcard:bg-[var(--color-lj-ink)] group-hover/pcard:text-[var(--color-lj-bone)]">
      {children}
    </span>
  )
}
```

(Tailwind 4 group-hover variant: parent `<article class="group/pcard …">` triggers child invert.)

**Step 4: Pass + Step 5: Commit**

```bash
git add web/components/ui/Chip.tsx web/components/ui/Chip.test.tsx
git commit -m "feat(v3): add Chip primitive with parent-card hover invert"
```

---

### Task 4.2: `<StatBar>` with on-scroll fill animation

**Files:**
- Create: `web/components/ui/StatBar.tsx` (client component — uses `useEffect` IntersectionObserver)
- Create: `web/components/ui/StatBar.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatBar } from './StatBar'

describe('<StatBar>', () => {
  it('renders index, label, and value', () => {
    render(<StatBar index="01" label="реактивов" value={18} fillPercent={100} />)
    expect(screen.getByText(/01\s*\/\s*реактивов/)).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
  })

  it('sets --w CSS custom property to fillPercent', () => {
    const { container } = render(<StatBar index="02" label="x" value={4} fillPercent={20} />)
    const bar = container.querySelector('[data-statbar]') as HTMLElement
    expect(bar.style.getPropertyValue('--w')).toBe('20%')
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
'use client'
import { useEffect, useRef } from 'react'

interface Props {
  index: string
  label: string
  value: number
  fillPercent: number
}

export function StatBar({ index, label, value, fillPercent }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.style.width = `var(--w)`
        obs.disconnect()
      }
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <li className="grid grid-cols-[minmax(7.5rem,auto)_1fr_2.5rem] items-center gap-3 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em]">
      <span className="text-[var(--color-lj-ink)] opacity-70 whitespace-nowrap">{index} / {label}</span>
      <span
        ref={ref}
        data-statbar
        className="block h-1.5 w-0 transition-[width] duration-[1.2s]"
        style={{
          '--w': `${fillPercent}%`,
          backgroundImage:
            'repeating-linear-gradient(90deg, var(--color-lj-ink) 0, var(--color-lj-ink) 4px, transparent 4px, transparent 6px)',
          backgroundSize: '6px 100%',
          backgroundRepeat: 'repeat-x',
          transitionTimingFunction: 'var(--ease-out-quart)',
        } as React.CSSProperties}
      />
      <span className="font-[var(--font-lj-display)] font-[700] text-[0.95rem] text-right tracking-[-0.02em] text-[var(--color-lj-ink)]">
        {value}
      </span>
    </li>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
git add web/components/ui/StatBar.tsx web/components/ui/StatBar.test.tsx
git commit -m "feat(v3): add StatBar with on-scroll fill animation"
```

---

### Task 4.3: Rebuild `<ProductCard>`

**Files:**
- Modify: `web/components/ProductCard.tsx`
- Modify: `web/components/ProductCard.test.tsx`

**Step 1: Inspect current shape and consumers**

Run: `cat web/components/ProductCard.tsx | head -80`
Run: `grep -rn '<ProductCard' web/{app,components}/ | head`

The v2 ProductCard takes a `Product` from shared types. v3 needs additional fields: stat counts (реактивов/инструментов/реакций) and chip strings. These may need to be added to the shared `Product` type or carried via a separate props variant. Check shared first:

Run: `cat shared/types/Product.ts 2>/dev/null || grep -rn 'export.*type.*Product' shared/ | head`

If reactant/instrument/reaction counts already exist on Product, use them. If not, add them in a separate task (5.4 cleanup) — for now pass via explicit props.

**Step 2: Failing test**

Rewrite `web/components/ProductCard.test.tsx` (preserve a couple existing tests if they still apply; replace sticker assertions):
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductCard } from './ProductCard'
import type { Product } from '@ximi4ka-shop/shared'

const product: Product = {
  id: '1', slug: 'himichka-3', sku: 'X-30', name: 'Химичка 3.0',
  shortDescription: 'Флагман.',
  priceRub: 3399, compareAtPriceRub: null,
  stockStatus: 'in_stock', isPublished: true,
  longDescriptionBlocks: [],
  // ... whatever else Product has; use defaults
} as Product

describe('<ProductCard> v3', () => {
  it('renders SKU prefix and badge', () => {
    render(
      <ProductCard
        product={product}
        emphasisWord="Химичка"
        elementSymbol="Cu"
        badge="Хит"
        stats={{ reagents: 18, instruments: 12, reactions: 161 }}
        statMaxes={{ reagents: 18, instruments: 20, reactions: 161 }}
        chips={['безопасно', 'ярко', 'от 10 лет']}
      />
    )
    expect(screen.getByText(/№\s*X-30\s*\/\s*Cu/)).toBeInTheDocument()
    expect(screen.getByText('Хит')).toBeInTheDocument()
  })

  it('renders 3 StatBars', () => {
    const { container } = render(
      <ProductCard
        product={product}
        stats={{ reagents: 18, instruments: 12, reactions: 161 }}
        statMaxes={{ reagents: 18, instruments: 20, reactions: 161 }}
      />
    )
    expect(container.querySelectorAll('[data-statbar]').length).toBe(3)
  })

  it('renders chips lowercase', () => {
    render(
      <ProductCard
        product={product}
        stats={{ reagents: 18, instruments: 12, reactions: 161 }}
        statMaxes={{ reagents: 18, instruments: 20, reactions: 161 }}
        chips={['безопасно']}
      />
    )
    expect(screen.getByText('безопасно')).toBeInTheDocument()
  })
})
```

**Step 3: Run — fail**

**Step 4: Implement (rewrite ProductCard.tsx)**

```tsx
import Link from 'next/link'
import type { Product } from '@ximi4ka-shop/shared'
import { Callout } from '@/components/ui/Callout'
import { Chip } from '@/components/ui/Chip'
import { StatBar } from '@/components/ui/StatBar'

interface Stats { reagents: number; instruments: number; reactions: number }
interface Props {
  product: Product
  emphasisWord?: string
  elementSymbol?: string
  badge?: string
  badgeVariant?: 'brand' | 'ink' | 'outline'
  stats: Stats
  statMaxes: Stats   // per-stat-type max across all visible cards in a row
  chips?: string[]
  callout?: { text: string; position: 'right' | 'left'; topPercent?: number }
  imageArt?: React.ReactNode  // SVG illustration or <Image />
  formula?: string
  hoverFormula?: string
  cornerMark?: string
}

export function ProductCard({
  product, emphasisWord, elementSymbol, badge, badgeVariant = 'brand',
  stats, statMaxes, chips = [], callout, imageArt, hoverFormula, cornerMark,
}: Props) {
  const sku = product.sku || product.slug
  const skuLabel = elementSymbol ? `№ ${sku} / ${elementSymbol}` : `№ ${sku}`
  const badgeClass = badgeVariant === 'brand'
    ? 'bg-[var(--color-lj-brand)] border-[var(--color-lj-brand)] text-[var(--color-lj-bone)]'
    : badgeVariant === 'ink'
    ? 'bg-[var(--color-lj-ink)] border-[var(--color-lj-ink)] text-[var(--color-lj-bone)]'
    : 'bg-transparent border-[var(--color-lj-ink)] text-[var(--color-lj-ink)]'

  // Render emphasis word (italic brand-purple) before the rest of name
  const renderName = () => {
    if (!emphasisWord || !product.name.includes(emphasisWord)) return product.name
    const idx = product.name.indexOf(emphasisWord)
    return (
      <>
        <em className="italic text-[var(--color-lj-brand)] font-[700] not-italic-fix">{emphasisWord}</em>
        {product.name.slice(idx + emphasisWord.length)}
      </>
    )
  }

  return (
    <article className="callout-host group/pcard relative cursor-pointer bg-transparent">
      <div className="flex justify-between items-center mb-3 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em]">
        <span className="text-[var(--color-lj-ink)] opacity-60">{skuLabel}</span>
        {badge && <span className={`px-2.5 py-1 border rounded-full text-[0.625rem] tracking-[0.1em] ${badgeClass}`}>{badge}</span>}
      </div>

      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] bg-[var(--color-lj-cream-shade)] border border-[var(--color-lj-rule)] overflow-hidden transition-[border-color] duration-500 group-hover/pcard:border-[var(--color-lj-ink)]">
          {cornerMark && (
            <span className="absolute top-3.5 left-3.5 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] text-[var(--color-lj-ink)] opacity-55">
              {cornerMark}
            </span>
          )}
          <div className="absolute inset-0 flex items-center justify-center transition-transform duration-700 group-hover/pcard:scale-[1.04]">
            {imageArt}
          </div>
          {hoverFormula && (
            <div className="absolute bottom-3.5 left-3.5 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] tracking-[0.04em] text-[var(--color-lj-ink)] bg-[var(--color-lj-cream)] px-2.5 py-1.5 border border-[var(--color-lj-ink)] opacity-0 translate-y-2 transition-[opacity,transform] duration-500 group-hover/pcard:opacity-100 group-hover/pcard:translate-y-0">
              {hoverFormula}
            </div>
          )}
        </div>
      </Link>

      <div className="pt-5">
        <h3 className="font-[var(--font-lj-display)] font-[700] text-[clamp(1.5rem,2.1vw,2rem)] leading-[0.95] tracking-[-0.035em] mb-3.5">
          <Link href={`/product/${product.slug}`}>{renderName()}</Link>
        </h3>
        <p className="text-[0.9375rem] leading-[1.45] text-[var(--color-lj-ink)] opacity-72 mb-5 max-w-[32ch]">
          {product.shortDescription}
        </p>

        <ul className="list-none p-0 m-0 mb-5 flex flex-col gap-2 border-t border-[var(--color-lj-rule)] pt-4">
          <StatBar index="01" label="реактивов" value={stats.reagents} fillPercent={Math.round((stats.reagents / statMaxes.reagents) * 100)} />
          <StatBar index="02" label="инструментов" value={stats.instruments} fillPercent={Math.round((stats.instruments / statMaxes.instruments) * 100)} />
          <StatBar index="03" label="реакций" value={stats.reactions} fillPercent={Math.round((stats.reactions / statMaxes.reactions) * 100)} />
        </ul>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {chips.map((c, i) => <Chip key={i}>{c}</Chip>)}
          </div>
        )}

        <div className="flex justify-between items-center border-t border-[var(--color-lj-rule)] pt-5 gap-4 flex-wrap">
          <span className="font-[var(--font-lj-display)] font-[900] text-3xl tracking-[-0.04em] leading-none">
            {product.priceRub.toLocaleString('ru-RU').replace(/,/g, ' ')}
            <span className="font-[var(--font-lj-mono)] font-normal text-base ml-1 opacity-70">₽</span>
          </span>
          <Link
            href={`/product/${product.slug}`}
            className="inline-flex items-center gap-2 px-4 py-3 border border-[var(--color-lj-ink)] rounded-full font-[var(--font-lj-mono)] text-[0.6875rem] uppercase tracking-[0.08em] bg-transparent text-[var(--color-lj-ink)] transition-all duration-400 group-hover/pcard:bg-[var(--color-lj-ink)] group-hover/pcard:text-[var(--color-lj-bone)]"
          >
            Заказать набор →
          </Link>
        </div>
      </div>

      {callout && <Callout text={callout.text} position={callout.position} topPercent={callout.topPercent} />}
    </article>
  )
}
```

**Step 5: Update all consumers**

For each file in `/tmp/v2-consumers-sticker.txt` (Task 0.4), replace `<Sticker>` consumers that depend on ProductCard:
- `web/app/[locale]/(public)/product/[slug]/page.tsx` — replace Sticker badges with the new ProductCard `badge` + `chips` props
- `web/app/[locale]/(public)/categories/[slug]/page.tsx` — replace category-level `<Sticker variant="accent">{count} товаров</Sticker>` with a `<Chip>` or inline mono label
- `web/app/v3-preview/page.tsx`, `v3-preview-e/page.tsx` — these are throwaway preview pages; safe to delete entirely after this stage

**Step 6: Pass + commit**

```bash
cd web && npx vitest run components/ProductCard.test.tsx && npm run build
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
git add web/components/ProductCard.tsx web/components/ProductCard.test.tsx web/app/[locale]/(public)/product/[slug]/page.tsx web/app/[locale]/(public)/categories/[slug]/page.tsx
git commit -m "feat(v3): rebuild ProductCard with stats + chips + CTA"
```

---

### Task 4.4: Update homepage product grid composition

**Files:**
- Modify: `web/app/[locale]/(public)/page.tsx`

**Step 1: Locate current product grid**

Run: `grep -n 'ProductCard\|products?.map\|catalog' web/app/[locale]/(public)/page.tsx | head`

**Step 2: Replace with asymmetric grid**

Wrap the 3-card row in:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr_1.1fr] gap-8 max-w-[var(--max-lj-content)] mx-auto px-6">
  <div className="lg:mt-0">
    <ProductCard
      product={himichka3}
      emphasisWord="Химичка"
      elementSymbol="Cu"
      badge="Хит" badgeVariant="brand"
      stats={{ reagents: 18, instruments: 12, reactions: 161 }}
      statMaxes={{ reagents: 18, instruments: 20, reactions: 161 }}
      chips={['безопасно', 'ярко', 'от 10 лет']}
      cornerMark="arr. 01"
      callout={{ text: '161 реакция', position: 'right', topPercent: 28 }}
      imageArt={/* SVG from concept.html */}
      hoverFormula="Cu + 2 AgNO₃ → Cu(NO₃)₂ + 2 Ag↓"
    />
  </div>
  <div className="lg:mt-16">
    <ProductCard
      product={miniHimichka}
      emphasisWord="Мини-"
      // ... etc (per design doc §9 dataset)
    />
  </div>
  <div className="lg:mt-32">
    <ProductCard
      product={electroHimichka}
      // ...
    />
  </div>
</div>
```

The `lg:mt-0` / `lg:mt-16` / `lg:mt-32` (= 0 / 4rem / 8rem) creates the asymmetric stagger.

**Step 3: Build + commit**

```bash
cd web && npm run build
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
git add web/app/[locale]/(public)/page.tsx
git commit -m "feat(v3): apply asymmetric product grid with 3 catalog products"
```

---

## Stage 5 — Header / Footer / Cleanup

### Task 5.1: Header active-route underline switches to brand-purple

**Files:**
- Modify: `web/components/Header.tsx`

**Step 1: Find active-route styling**

Run: `grep -n 'accent\|orange\|FF6B35\|active' web/components/Header.tsx`

**Step 2: Replace orange variable references with brand-purple**

Search for `var(--color-accent)` (orange) in Header.tsx and replace with `var(--color-lj-brand)`. Likewise `bg-[var(--color-accent)]` → `bg-[var(--color-lj-brand)]`.

**Step 3: Update test if needed**

Read `web/components/Header.test.tsx` — if any test asserts the orange class name, update to brand class.

**Step 4: Build + commit**

```bash
cd web && npm run test components/Header.test.tsx && npm run build
git add web/components/Header.tsx web/components/Header.test.tsx
git commit -m "feat(v3): switch Header active-route underline to brand-purple"
```

---

### Task 5.2: Footer adds small molecular accent

**Files:**
- Modify: `web/components/Footer.tsx`
- Modify: `web/components/Footer.test.tsx` (assert accent renders)

**Step 1: Failing test**

Add to `web/components/Footer.test.tsx`:
```tsx
it('renders a decorative MoleculeMotif accent', () => {
  const { container } = render(<Footer />)
  expect(container.querySelector('svg')).not.toBeNull()
})
```

**Step 2: Implement**

In Footer.tsx, near the wordmark column, add:
```tsx
import { MoleculeMotifLJ } from '@/components/decor/MoleculeMotif.lj'
// ...
<MoleculeMotifLJ
  variant="methane"
  className="w-12 h-12 text-[var(--color-lj-ink)] opacity-40"
/>
```

**Step 3: Pass + commit**

```bash
git add web/components/Footer.tsx web/components/Footer.test.tsx
git commit -m "feat(v3): add Footer molecular accent"
```

---

### Task 5.3: Clean up homepage `<DarkSection>` consumers + obsolete previews

**Files:**
- Modify: `web/app/[locale]/(public)/page.tsx`
- Modify: `web/app/not-found.tsx`
- Delete: `web/app/v3-preview/page.tsx`, `web/app/v3-preview-e/page.tsx`

**Step 1: Replace `<DarkSection>` invocations with `<LabSection variant="ink">`**

Find: `grep -n 'DarkSection' web/app/[locale]/(public)/page.tsx web/app/not-found.tsx`
Replace: `<DarkSection size="lg" glow>` → `<LabSection variant="ink" className="px-6 py-32">`. Drop `glow` prop entirely.

Update imports:
```tsx
// before
import { Container, Section, DarkSection, SectionHeading } from '@/components/ui'
// after
import { Container, Section, SectionHeading } from '@/components/ui'
import { LabSection } from '@/components/ui/LabSection'
```

**Step 2: Delete throwaway preview pages**

```bash
rm web/app/v3-preview/page.tsx web/app/v3-preview-e/page.tsx
rmdir web/app/v3-preview web/app/v3-preview-e 2>/dev/null
```

**Step 3: Verify nothing breaks**

```bash
cd web && npm run typecheck && npm run build
```

**Step 4: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
git add web/app/[locale]/(public)/page.tsx web/app/not-found.tsx
git rm web/app/v3-preview/page.tsx web/app/v3-preview-e/page.tsx
git commit -m "refactor(v3): replace DarkSection with LabSection, drop throwaway preview pages"
```

---

## Stage 6 — Polish + Cleanup + Visual Regression

### Task 6.1: Reduced motion handling

**Files:**
- Modify: `web/app/globals.css`

**Step 1: Append global rule at bottom of globals.css**

```css
@media (prefers-reduced-motion: reduce) {
  .lj-num-cell::before,
  [data-statbar],
  [class*="lj-rotate"],
  [class*="lj-ticker"] {
    animation: none !important;
    transition: none !important;
  }
  /* Snap stat bars to their final width */
  [data-statbar] { width: var(--w) !important; }
}
```

**Step 2: Smoke-test in Chrome**

DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`. Reload homepage. Verify ticker/benzene/cell-stroke/stat-bar all stop animating but final visual states are intact.

**Step 3: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(v3): respect prefers-reduced-motion across decorative animations"
```

---

### Task 6.2: Playwright visual regression baseline

**Files:**
- Create: `web/tests/visual/v3-homepage.spec.ts`

**Step 1: Inspect existing playwright config**

Run: `cat web/playwright.config.ts`

**Step 2: Add a visual test for hero / manifesto / products at desktop**

```ts
import { test, expect } from '@playwright/test'

test.describe('v3 Lab Journal homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
  })

  test('hero section visual', async ({ page }) => {
    await expect(page.locator('section').first()).toHaveScreenshot('hero.png', { maxDiffPixelRatio: 0.02 })
  })

  test('manifesto section visual', async ({ page }) => {
    await page.locator('#manifesto').scrollIntoViewIfNeeded()
    await expect(page.locator('#manifesto')).toHaveScreenshot('manifesto.png', { maxDiffPixelRatio: 0.02 })
  })

  test('products section visual', async ({ page }) => {
    await page.locator('text=Готовые').first().scrollIntoViewIfNeeded()
    const productsSection = page.locator('section').filter({ hasText: 'Химичка 3.0' }).first()
    await expect(productsSection).toHaveScreenshot('products.png', { maxDiffPixelRatio: 0.03 })
  })
})
```

**Step 3: Generate baseline + commit**

```bash
cd web && npm run test:visual:update
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
git add web/tests/visual/
git commit -m "test(v3): playwright visual regression baseline for hero/manifesto/products"
```

**Step 4: Run again to verify stability**

```bash
cd web && npm run test:visual
```

Expected: all pass against the baseline just generated.

---

### Task 6.3: Delete confirmed-dead v2 components

**Files:**
- Delete: `web/components/ui/Sticker.tsx` + test
- Delete: `web/components/ui/BigNumber.tsx` + test (replaced by NumberCell)
- Delete: `web/components/ui/DarkSection.tsx` + test (replaced by LabSection)

**Step 1: Final consumer check**

Run:
```bash
grep -rn 'Sticker\|BigNumber\|DarkSection' web/{app,components}/ 2>/dev/null
```

Expected: no matches except the files themselves and their tests, and possibly a `index.ts` re-export.

If matches found in app or components → fix before deleting.

**Step 2: Remove from `components/ui/index.ts`**

```bash
grep -n 'Sticker\|BigNumber\|DarkSection' web/components/ui/index.ts
```

Edit the file: delete those lines.

**Step 3: Delete files**

```bash
cd web
rm components/ui/Sticker.tsx components/ui/Sticker.test.tsx
rm components/ui/BigNumber.tsx components/ui/BigNumber.test.tsx
rm components/ui/DarkSection.tsx components/ui/DarkSection.test.tsx
```

**Step 4: Verify build**

```bash
npm run typecheck && npm run test && npm run build
```

Expected: all pass.

**Step 5: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
git add -u web/components/ui/
git commit -m "chore(v3): delete dead v2 components (Sticker, BigNumber, DarkSection)"
```

---

### Task 6.4: Token cleanup — remove orphaned v2 CSS variables

**Files:**
- Modify: `web/app/globals.css`

**Step 1: Identify orphaned tokens**

Run:
```bash
grep -E '^\s*--(color-accent|color-text-on-brand|gradient-brand-deep|color-dark-base|color-dark-elevated|color-dark-border|gradient-accent|gradient-dark-glow|color-text-muted-on-dark|color-text-on-dark)' web/app/globals.css
```

Confirm none of these are referenced anywhere else:
```bash
grep -rn 'color-accent\|gradient-brand-deep\|color-dark-base\|color-dark-elevated\|color-dark-border\|gradient-accent\|gradient-dark-glow\|color-text-muted-on-dark' web/{app,components}/ 2>/dev/null
```

**Step 2: Delete orphaned token definitions from globals.css**

Edit the `@theme inline` block — remove the v2 token lines that have no consumers. Keep all v3 (`--color-lj-*`, `--text-lj-*`, `--font-lj-*`) and any v1 tokens still consumed by admin / cart pages.

**Step 3: Verify build**

```bash
cd web && npm run build
```

**Step 4: Commit**

```bash
git add web/app/globals.css
git commit -m "chore(v3): remove orphaned v2 design tokens from globals.css"
```

---

## Acceptance — Final checks before merge

After Task 6.4:

```bash
cd web
npm run typecheck     # pass
npm run lint          # pass
npm run test          # all pass
npm run build         # successful build
npm run test:visual   # baselines hold
```

Visit http://localhost:3000 and walk the design doc acceptance criteria (§Acceptance criteria in `2026-04-28-shop-v3-lab-journal-design.md`):
1. Section rhythm cream→ink→cream throughout
2. Brand-purple budget ≤ 5 occurrences per page
3. Notebook header on every section, page-count consistent
4. Headlines use Unbounded 900 with `letter-spacing: -0.045em`
5. Hero benzene rotates without atom labels, multiply blend
6. Manifesto numbers count up on scroll, each cell has unique data viz
7. Product cards stagger asymmetrically, stats animate on scroll, chips/CTA invert on whole-card hover, callout reveals via stroke-dashoffset
8. Reduced motion preference disables decorative animations, count-up snaps
9. Lighthouse: no CLS regression vs v2

Open PR with title `feat(v3): Лабораторный Журнал design overhaul` and description linking the design doc, design system spec, and concept artifact.

---

## Plan complete and saved to `docs/plans/2026-04-28-shop-v3-lab-journal-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review the diff between tasks, fast iteration with code-review checkpoints. Best for keeping tight design fidelity.

**2. Parallel Session (separate)** — Open a new session with `superpowers:executing-plans`, batch execution with checkpoints at stage boundaries. Best for fire-and-forget; you check in periodically.

**Which approach?**
