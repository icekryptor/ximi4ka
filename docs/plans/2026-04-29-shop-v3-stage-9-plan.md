# Shop v3 — Stage 9 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the last meaningful v2 islands on the public storefront — cart full v3 (calm aesthetic) + Header chrome rebuild (Mazzard SVG logo + mono nav + full-screen mobile menu) + Footer colophon rebuild + 3 documented technical-debt cleanups.

**Architecture:** 2 net-new components (HeaderLogo, MobileMenuOverlay), 8 modified files, 1 processed asset (logo SVG). Mazzard registered logo serves as inline SVG with `currentColor` fills. Header exposes `--lj-header-height` CSS variable so sticky surfaces auto-track header height. ParagraphBlock becomes surface-aware via `--lj-prose-color` set per LabSection variant. TrustStrip kept as-is (admin-only consumer).

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2, TypeScript, Tailwind 4 (`@theme inline` tokens), Vitest + Testing Library, Playwright.

**Source artifacts:**
- Design doc: `ximi4ka/docs/plans/2026-04-29-shop-v3-stage-9-design.md`
- Logo source: `ximi4ka-shop/web/public/logo-himichka-source.svg` (28 KB raw, processed in Task 9.1 → ~5 KB clean)
- Mazzard Italic: `ximi4ka-shop/web/public/fonts/MazzardH-ExtraBoldItalic.woff2` (28 KB)

**Critical rules:**
- Per `web/AGENTS.md`: Next.js 16.2 has breaking changes — check `node_modules/next/dist/docs/` before writing Next-specific code.
- Cart and admin remain v2-locked per design intent — only the cart page + drawer get v3, NOT checkout flow (when it ships) and NOT admin panels.

**Stage map (~12 task-commits):**
- Stage 9.0 — Worktree setup + baseline (1 verification)
- Stage 9.1 — Process logo SVG (1 task)
- Stage 9.2 — Wire Mazzard Italic font (1 task)
- Stage 9.3 — `<HeaderLogo>` component (1 task)
- Stage 9.4 — `--lj-prose-color` CSS variable + ParagraphBlock consume (1 task)
- Stage 9.5 — `<MobileMenuOverlay>` component (1 task)
- Stage 9.6 — Header rebuild (1 task)
- Stage 9.7 — CategoryFilterBar `--lj-header-height` (1 task)
- Stage 9.8 — Footer colophon rebuild (1 task)
- Stage 9.9 — Cart page calm v3 (1 task)
- Stage 9.10 — CartDrawer calm v3 (1 task)
- Stage 9.11 — Playwright baselines (1 task)
- Stage 9.12 — Final verification (no commit)

Each task = 1 commit. At every stage boundary the storefront builds clean.

---

## Pre-Stage Setup

### Task 9.0: Worktree + baseline

**Files:** none (verification + worktree setup)

**Step 1: Worktree**

From `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop`:
```bash
git worktree add -b feat/v3-stage-9 /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9 main
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
npm install   # ~2 min
```

**Step 2: Baseline**

```bash
cd web
npm run typecheck   # clean
npm run test 2>&1 | tail -5   # 647 tests pass
npm run build 2>&1 | tail -5   # clean
```

**Step 3: Confirm logo + font assets**

```bash
ls -la web/public/logo-himichka-source.svg web/public/fonts/MazzardH-ExtraBoldItalic.woff2
```

Both files should be present (committed to main in the brainstorming session).

No commit — verification only.

---

## Stage 9.1 — Process logo SVG

### Task 9.1: Strip foreignObject + gradient, convert fills to currentColor

**Files:**
- Create: `web/public/logo-himichka.svg` (cleaned version)
- Modify: `web/public/logo-himichka-source.svg` (keep as audit trail of the original)

The source SVG contains:
- A `<foreignObject>` with `backdrop-filter: blur(31px)` — Safari/Firefox handle inconsistently in inline SVGs
- A linear gradient overlay (`paint0_linear_4638_2`) creating a horizontal sheen — only works on dark backgrounds
- Two layered paths (the wordmark + a second stroke-outline overlay)
- All fills are `white` or gradient — won't show on cream Header

**Goal:** produce a clean SVG that renders the wordmark in `currentColor` so it inherits parent text color across surfaces.

**Step 1: Read source SVG**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
cat web/public/logo-himichka-source.svg | head -10
```

**Step 2: Write the cleaned version**

Create `web/public/logo-himichka.svg` (handcraft based on the source — keep ONLY the first solid path, drop everything else):

```svg
<svg width="554" height="78" viewBox="0 0 554 78" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ХИМИЧКА">
  <path fill="currentColor" d="M35.3203 37.9309L16.0026 0.651061L41.4207 0.651061L51.249 19.7429L67.8555 0.651061L93.2735 0.651061L60.7384 37.9309L80.9599 76.9053L55.5418 76.9053L44.8098 56.2319L26.8477 76.9053L1.42958 76.9053L35.3203 37.9309ZM140.162 36.4623L104.351 76.9053L84.3552 76.9053L97.7985 0.651061L119.15 0.651061L112.033 41.207L147.731 0.651061L167.726 0.651061L154.396 76.9053L133.045 76.9053L140.162 36.4623ZM181.707 76.9053L160.808 76.9053L174.251 0.651061L195.151 0.651061L210.966 41.4329L240.903 0.651061L261.802 0.651061L248.472 76.9053L227.573 76.9053L234.012 39.8514L212.887 69.4493L198.766 69.4493L188.146 40.0773L181.707 76.9053ZM310.829 36.4623L275.018 76.9053L255.022 76.9053L268.466 0.651061L289.817 0.651061L282.7 41.207L318.398 0.651061L338.394 0.651061L325.063 76.9053L303.712 76.9053L310.829 36.4623ZM366.496 51.1483C356.554 51.1483 349.098 48.8513 344.128 44.2572C339.232 39.5878 337.5 33.1109 338.931 24.8265L343.224 0.651061L364.575 0.651061L360.282 24.8265C359.906 27.0859 360.546 28.7804 362.203 29.9101C363.935 30.9645 366.722 31.4917 370.563 31.4917C373.876 31.4917 377.83 31.0398 382.424 30.136L387.621 0.651061L408.972 0.651061L395.529 76.9053L374.178 76.9053L378.922 49.9056C374.554 50.7341 370.412 51.1483 366.496 51.1483ZM423.432 76.9053L402.081 76.9053L415.524 0.651061L436.876 0.651061L432.357 26.2951L456.532 0.651061L483.532 0.651061L448.511 37.8179L472.348 76.9053L445.348 76.9053L428.403 49.0019L423.432 76.9053ZM494.981 76.9053L472.613 76.9053L517.461 0.651061L535.198 0.651061L553.16 76.9053L530.792 76.9053L528.532 66.3991L500.968 66.3991L494.981 76.9053ZM524.578 47.7592L520.963 31.2657L511.587 47.7592L524.578 47.7592Z"/>
</svg>
```

(That's the wordmark path verbatim from the source, with `fill="white"` swapped to `fill="currentColor"`. Drop the `<foreignObject>`, drop the second decorative outline path, drop the `<defs>` section entirely.)

**Step 3: Verify file size + structure**

```bash
ls -la web/public/logo-himichka.svg
# Expected: ~5 KB (vs source's 19 KB)
```

Open the file in a browser via `file://` or render a quick test page to confirm visual fidelity.

**Step 4: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
git add web/public/logo-himichka.svg
git commit -m "chore(v3-s9): process Mazzard logo SVG (strip gradient + foreignObject, currentColor fills)"
```

---

## Stage 9.2 — Wire Mazzard Italic font

### Task 9.2: Add @font-face for Mazzard H Extrabold Italic

**Files:**
- Modify: `web/app/globals.css` (add `@font-face` declaration)

**Step 1: Read current Mazzard declaration**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
grep -A 8 "@font-face" web/app/globals.css | head -15
```

**Step 2: Append the italic declaration**

After the existing `@font-face` for Mazzard Extrabold (normal style), add:

```css
@font-face {
  font-family: 'Mazzard H';
  src: url('/fonts/MazzardH-ExtraBoldItalic.woff2') format('woff2');
  font-weight: 800;
  font-style: italic;
  font-display: swap;
  unicode-range: U+0000-024F, U+0400-04FF, U+1E00-1EFF, U+2000-206F;
}
```

**Step 3: Verify build still passes**

```bash
cd web && npm run build 2>&1 | tail -3
```

**Step 4: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
git add web/app/globals.css
git commit -m "feat(v3-s9): wire Mazzard H Extrabold Italic @font-face"
```

---

## Stage 9.3 — `<HeaderLogo>` component (TDD)

### Task 9.3

**Files:**
- Create: `web/components/HeaderLogo.tsx`
- Create: `web/components/HeaderLogo.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeaderLogo } from './HeaderLogo'

describe('<HeaderLogo>', () => {
  it('renders an inline SVG with the brand aria-label', () => {
    const { container } = render(<HeaderLogo />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toMatch(/химичка/i)
  })

  it('uses currentColor fill so it inherits parent text color', () => {
    const { container } = render(<HeaderLogo />)
    const path = container.querySelector('svg path')
    expect(path?.getAttribute('fill')).toBe('currentColor')
  })

  it('respects size prop (height in rem)', () => {
    const { container } = render(<HeaderLogo size={2} />)
    const svg = container.querySelector('svg') as SVGElement
    expect(svg.style.height).toBe('2rem')
  })

  it('default size renders at 1.75rem (28px)', () => {
    const { container } = render(<HeaderLogo />)
    const svg = container.querySelector('svg') as SVGElement
    expect(svg.style.height).toBe('1.75rem')
  })
})
```

**Step 2: Run — fail**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9/web
npx vitest run components/HeaderLogo.test.tsx
```

**Step 3: Implement**

Read the cleaned SVG file content first, then inline it (so `currentColor` works without needing `<img>` tag color hacks):

```tsx
interface Props {
  /** Height in rem (width auto-scales via aspect-ratio). Default 1.75 (28px). */
  size?: number
  className?: string
}

/**
 * Inline SVG of the registered "ХИМИЧКА" wordmark in Mazzard H Extrabold Italic.
 * Source: web/public/logo-himichka.svg.
 *
 * Uses currentColor fill so the wordmark inherits parent text color —
 * cream Header → ink wordmark, ink Footer → bone wordmark.
 */
export function HeaderLogo({ size = 1.75, className = '' }: Props) {
  return (
    <svg
      role="img"
      aria-label="ХИМИЧКА"
      viewBox="0 0 554 78"
      className={className}
      style={{ height: `${size}rem`, width: 'auto' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M35.3203 37.9309L16.0026 0.651061L41.4207 0.651061L51.249 19.7429L67.8555 0.651061L93.2735 0.651061L60.7384 37.9309L80.9599 76.9053L55.5418 76.9053L44.8098 56.2319L26.8477 76.9053L1.42958 76.9053L35.3203 37.9309ZM140.162 36.4623L104.351 76.9053L84.3552 76.9053L97.7985 0.651061L119.15 0.651061L112.033 41.207L147.731 0.651061L167.726 0.651061L154.396 76.9053L133.045 76.9053L140.162 36.4623ZM181.707 76.9053L160.808 76.9053L174.251 0.651061L195.151 0.651061L210.966 41.4329L240.903 0.651061L261.802 0.651061L248.472 76.9053L227.573 76.9053L234.012 39.8514L212.887 69.4493L198.766 69.4493L188.146 40.0773L181.707 76.9053ZM310.829 36.4623L275.018 76.9053L255.022 76.9053L268.466 0.651061L289.817 0.651061L282.7 41.207L318.398 0.651061L338.394 0.651061L325.063 76.9053L303.712 76.9053L310.829 36.4623ZM366.496 51.1483C356.554 51.1483 349.098 48.8513 344.128 44.2572C339.232 39.5878 337.5 33.1109 338.931 24.8265L343.224 0.651061L364.575 0.651061L360.282 24.8265C359.906 27.0859 360.546 28.7804 362.203 29.9101C363.935 30.9645 366.722 31.4917 370.563 31.4917C373.876 31.4917 377.83 31.0398 382.424 30.136L387.621 0.651061L408.972 0.651061L395.529 76.9053L374.178 76.9053L378.922 49.9056C374.554 50.7341 370.412 51.1483 366.496 51.1483ZM423.432 76.9053L402.081 76.9053L415.524 0.651061L436.876 0.651061L432.357 26.2951L456.532 0.651061L483.532 0.651061L448.511 37.8179L472.348 76.9053L445.348 76.9053L428.403 49.0019L423.432 76.9053ZM494.981 76.9053L472.613 76.9053L517.461 0.651061L535.198 0.651061L553.16 76.9053L530.792 76.9053L528.532 66.3991L500.968 66.3991L494.981 76.9053ZM524.578 47.7592L520.963 31.2657L511.587 47.7592L524.578 47.7592Z"
      />
    </svg>
  )
}
```

(The path data is the same as the cleaned `web/public/logo-himichka.svg` — duplicating it inline because import-as-component requires SVGR config which adds build complexity. The static SVG file in /public remains for direct fetch use cases like favicon-style references; the React component inlines for color inheritance.)

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/HeaderLogo.test.tsx
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
git add web/components/HeaderLogo.tsx web/components/HeaderLogo.test.tsx
git commit -m "feat(v3-s9): add HeaderLogo inline SVG component (currentColor)"
```

---

## Stage 9.4 — `--lj-prose-color` CSS variable + ParagraphBlock consume

### Task 9.4

**Files:**
- Modify: `web/components/ui/LabSection.tsx` (add CSS variable per variant)
- Modify: `web/components/ui/LabSection.test.tsx` (assert variable is set)
- Modify: `web/components/blocks/ParagraphBlock.tsx` (consume the variable)
- Modify: `web/components/blocks/ParagraphBlock.test.tsx` (update assertion)

**Step 1: Failing test on LabSection**

Add to `web/components/ui/LabSection.test.tsx`:

```tsx
it('exposes --lj-prose-color CSS variable: ink for cream variant', () => {
  render(<LabSection variant="cream" data-testid="lab-section">x</LabSection>)
  const el = screen.getByTestId('lab-section')
  expect(el.style.getPropertyValue('--lj-prose-color')).toBe('var(--color-lj-ink)')
})

it('exposes --lj-prose-color CSS variable: bone for ink variant', () => {
  render(<LabSection variant="ink" data-testid="lab-section">x</LabSection>)
  const el = screen.getByTestId('lab-section')
  expect(el.style.getPropertyValue('--lj-prose-color')).toBe('var(--color-lj-bone)')
})
```

**Step 2: Run — fail**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9/web
npx vitest run components/ui/LabSection.test.tsx
```

**Step 3: Update LabSection to set the variable**

In `web/components/ui/LabSection.tsx`, add inline style:

```tsx
export function LabSection({ variant, className = '', children, ...rest }: Props) {
  const palette =
    variant === 'cream'
      ? 'bg-[var(--color-lj-cream)] text-[var(--color-lj-ink)]'
      : 'bg-[var(--color-lj-ink)] text-[var(--color-lj-bone)]'

  // Set --lj-prose-color so child ParagraphBlocks (and any other prose)
  // inherit the surface-appropriate text color.
  const proseColor =
    variant === 'cream' ? 'var(--color-lj-ink)' : 'var(--color-lj-bone)'

  return (
    <section
      className={`relative overflow-hidden ${palette} ${className}`.trim()}
      style={{ '--lj-prose-color': proseColor } as React.CSSProperties}
      {...rest}
    >
      {children}
    </section>
  )
}
```

(Note: if the consumer passes their own `style` prop, this will override it — that's an existing limitation. If issues, use a `Record<string, string>` merge.)

**Step 4: Update ParagraphBlock to consume the variable**

In `web/components/blocks/ParagraphBlock.tsx`, replace `text-[var(--color-lj-ink)]` with `text-[var(--lj-prose-color,var(--color-lj-ink))]` (the fallback to ink is for cases where ParagraphBlock renders outside any LabSection).

**Step 5: Update ParagraphBlock test**

Replace the test assertion `text-[var(--color-lj-ink)]` → `text-[var(--lj-prose-color,var(--color-lj-ink))]` in `ParagraphBlock.test.tsx`.

**Step 6: Verify all pass**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9/web
npx vitest run components/ui/LabSection.test.tsx components/blocks/ParagraphBlock.test.tsx
```

**Step 7: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
git add web/components/ui/LabSection.tsx web/components/ui/LabSection.test.tsx web/components/blocks/ParagraphBlock.tsx web/components/blocks/ParagraphBlock.test.tsx
git commit -m "feat(v3-s9): make ParagraphBlock surface-aware via --lj-prose-color CSS variable"
```

---

## Stage 9.5 — `<MobileMenuOverlay>` component (TDD)

### Task 9.5

**Files:**
- Create: `web/components/MobileMenuOverlay.tsx`
- Create: `web/components/MobileMenuOverlay.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileMenuOverlay } from './MobileMenuOverlay'

const NAV = [
  { href: '/categories', label: 'Каталог', desc: 'найти набор' },
  { href: '/o-nas', label: 'О нас', desc: 'наша лаборатория' },
]

describe('<MobileMenuOverlay>', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <MobileMenuOverlay open={false} onClose={() => {}} pathname="/" navItems={NAV} cartCount={0} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders all nav items with mono index, label, and description when open', () => {
    render(
      <MobileMenuOverlay open={true} onClose={() => {}} pathname="/" navItems={NAV} cartCount={0} />
    )
    expect(screen.getByText('Каталог')).toBeInTheDocument()
    expect(screen.getByText('найти набор')).toBeInTheDocument()
    expect(screen.getByText(/01\s*\//)).toBeInTheDocument()
    expect(screen.getByText(/02\s*\//)).toBeInTheDocument()
  })

  it('calls onClose when × close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <MobileMenuOverlay open={true} onClose={onClose} pathname="/" navItems={NAV} cartCount={0} />
    )
    fireEvent.click(screen.getByRole('button', { name: /закрыть/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows cart count when > 0', () => {
    render(
      <MobileMenuOverlay open={true} onClose={() => {}} pathname="/" navItems={NAV} cartCount={3} />
    )
    expect(screen.getByText(/корзина.*3/i)).toBeInTheDocument()
  })

  it('shows (0) when cart empty', () => {
    render(
      <MobileMenuOverlay open={true} onClose={() => {}} pathname="/" navItems={NAV} cartCount={0} />
    )
    expect(screen.getByText(/корзина.*0/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { LabSection } from '@/components/ui/LabSection'
import { GridOverlay } from '@/components/ui/GridOverlay'
import { NotebookHeader } from '@/components/ui/NotebookHeader'

interface NavItem {
  href: string
  label: string
  desc?: string
}

interface Props {
  open: boolean
  onClose: () => void
  pathname: string
  navItems: NavItem[]
  cartCount: number
}

export function MobileMenuOverlay({ open, onClose, pathname, navItems, cartCount }: Props) {
  // Esc key closes; body scroll-lock while open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div role="dialog" aria-modal="true" aria-label="Меню" className="fixed inset-0 z-[60]">
      <LabSection variant="cream" className="h-full overflow-y-auto px-6 pt-6 pb-12">
        <GridOverlay />
        <div className="relative z-[2]">
          {/* NotebookHeader inline (we override the <NotebookHeader> spacing) */}
          <div className="flex items-center justify-between font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em] mb-12">
            <span className="inline-flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-lj-brand)]" />
              № MENU — Меню
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть меню"
              className="font-[var(--font-lj-mono)] hover:text-[var(--color-lj-brand-deep)]"
            >
              × закрыть
            </button>
          </div>

          {/* Nav stack */}
          <ul className="list-none p-0 m-0 flex flex-col gap-0">
            {navItems.map((item, i) => {
              const active = isActive(item.href)
              return (
                <li key={item.href} className="border-b border-[var(--color-lj-rule)] py-6">
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className="grid grid-cols-[3rem_1fr_auto] items-baseline gap-3"
                  >
                    <span className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] opacity-65">
                      {pad(i + 1)} /
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className={`font-[var(--font-lj-display)] font-[700] text-[2rem] leading-none tracking-[-0.035em] ${active ? 'text-[var(--color-lj-brand)]' : ''}`}>
                        {item.label}
                      </span>
                      {item.desc && (
                        <span className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] opacity-65">
                          {item.desc}
                        </span>
                      )}
                    </div>
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-lj-brand)] mt-3" aria-hidden="true" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Cart link */}
          <Link
            href="/cart"
            onClick={onClose}
            className="block mt-12 mb-6 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em]"
          >
            КОРЗИНА {cartCount > 0 ? <span className="text-[var(--color-lj-brand)]">· {cartCount}</span> : '(0)'} →
          </Link>

          {/* Contact strip */}
          <div className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] opacity-65 flex flex-wrap gap-x-3 gap-y-1">
            <span>telegram</span>
            <span className="text-[var(--color-lj-brand)]">·</span>
            <span>whatsapp</span>
            <span className="text-[var(--color-lj-brand)]">·</span>
            <span>phone</span>
          </div>
        </div>
      </LabSection>
    </div>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/MobileMenuOverlay.test.tsx
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
git add web/components/MobileMenuOverlay.tsx web/components/MobileMenuOverlay.test.tsx
git commit -m "feat(v3-s9): add MobileMenuOverlay full-screen takeover"
```

---

## Stage 9.6 — Header rebuild

### Task 9.6

**Files:**
- Modify: `web/components/Header.tsx` (full rewrite)
- Modify: `web/components/Header.test.tsx` (update assertions)

The Header rebuild:
- Logo: `<HeaderLogo size={1.75} />` instead of "Ximi4ka" text
- Desktop nav: mono uppercase `<a>` links with brand-purple active state (already migrated for color, just restyle typography)
- Cart label: mono `КОРЗИНА · N` with brand-purple count, or `КОРЗИНА (0)` when empty
- Mobile: `МЕНЮ` button replaces hamburger icon
- Mobile menu: `<MobileMenuOverlay>` (state lifted from current `mobileOpen` state)
- Header height exposure: `useEffect` measures rendered height and sets `document.documentElement.style.setProperty('--lj-header-height', `${h}px`)`. ResizeObserver re-runs on changes (e.g. promo strip toggle).

**Step 1: Read current Header**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
cat web/components/Header.tsx
cat web/components/Header.test.tsx
```

Note: existing pattern uses `LayoutGroup` + `motion.span` (framer-motion) for the active route underline. Preserve that interaction OR replace with simpler CSS — implementer judgment based on what reads cleanest.

**Step 2: Update tests for v3 expectations**

Replace assertions about "Ximi4ka" text with `getByLabelText(/химичка/i)` or `getByRole('img', { name: /химичка/i })` (HeaderLogo provides aria-label). Update active-route assertion to expect the brand-purple class (already there from Stage 5 migration).

Add a test for cart label:
```tsx
it('shows cart count format when items > 0', () => {
  // Mock useCart to return 3 items, then assert КОРЗИНА · 3 appears
})

it('shows (0) format when cart empty', () => {
  // Mock useCart to return 0 items, assert КОРЗИНА (0)
})
```

(If `useCart` shape requires research, consult `web/lib/cart.ts`.)

**Step 3: Implement Header rebuild**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HeaderLogo } from './HeaderLogo'
import { MobileMenuOverlay } from './MobileMenuOverlay'
import { useCart } from '@/lib/cart'
// Optionally keep Ticker for promo bar (Stage 5 already migrated to brand-purple dots)
import { Ticker } from '@/components/ui'

interface NavItem {
  href: string
  label: string
  desc: string  // mono description for mobile menu
}

const NAV: NavItem[] = [
  { href: '/categories', label: 'Каталог',  desc: 'найти набор' },
  { href: '/o-nas',      label: 'О нас',    desc: 'наша лаборатория' },
  { href: '/dostavka',   label: 'Доставка', desc: 'сроки и тарифы' },
  { href: '/kontakty',   label: 'Контакты', desc: 'связь с нами' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface Props {
  headerPromoText?: string
}

export function Header({ headerPromoText }: Props = {}) {
  const pathname = usePathname() ?? '/'
  const [mobileOpen, setMobileOpen] = useState(false)
  const cartItems = useCart()
  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0)

  const headerRef = useRef<HTMLElement>(null)
  // Expose Header height as CSS variable
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty('--lj-header-height', `${h}px`)
    }
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const showPromo = !!headerPromoText
  const promoItems = showPromo ? headerPromoText.split(',').map(s => s.trim()).filter(Boolean) : []

  return (
    <>
      {showPromo && (
        <div role="region" aria-label="Промо">
          <Ticker items={promoItems} surface="dark" />
        </div>
      )}

      <header
        ref={headerRef}
        className="sticky top-0 z-[50] w-full border-b border-[var(--color-lj-rule)] bg-[var(--color-lj-cream)]/95 backdrop-blur"
      >
        <div className="max-w-[var(--max-lj-content)] mx-auto flex items-center justify-between gap-4 px-6 py-4">
          {/* Logo */}
          <Link
            href="/"
            aria-label="ХИМИЧКА — на главную"
            className="text-[var(--color-lj-ink)] hover:text-[var(--color-lj-brand-deep)] transition-colors"
          >
            <HeaderLogo size={1.75} />
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Основная навигация" className="hidden md:flex items-center gap-8">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em] transition-colors ${
                    active
                      ? 'text-[var(--color-lj-brand)]'
                      : 'text-[var(--color-lj-ink)] opacity-70 hover:opacity-100'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--color-lj-brand)]"
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-4">
            <Link
              href="/cart"
              className="hidden md:inline-flex font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em] text-[var(--color-lj-ink)] hover:text-[var(--color-lj-brand-deep)]"
            >
              КОРЗИНА {cartCount > 0 ? <span className="ml-1.5 text-[var(--color-lj-brand)]">· {cartCount}</span> : <span className="ml-1.5 opacity-60">(0)</span>}
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em]"
              aria-label="Открыть меню"
            >
              МЕНЮ
            </button>
          </div>
        </div>
      </header>

      <MobileMenuOverlay
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        pathname={pathname}
        navItems={NAV}
        cartCount={cartCount}
      />
    </>
  )
}
```

**Step 4: Add CSS fallback for `--lj-header-height`**

In `web/app/globals.css` `:root` or `@theme inline` block, add:

```css
--lj-header-height: 80px;  /* SSR fallback, JS overrides on hydration */
```

**Step 5: Verify + commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9/web
npm run typecheck
npm run test 2>&1 | tail -5
npm run build 2>&1 | tail -5
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
git add web/components/Header.tsx web/components/Header.test.tsx web/app/globals.css
git commit -m "feat(v3-s9): rebuild Header with Mazzard SVG logo + mono nav + mobile menu + --lj-header-height CSS var"
```

---

## Stage 9.7 — CategoryFilterBar uses `--lj-header-height`

### Task 9.7

**Files:**
- Modify: `web/components/marketing/CategoryFilterBar.tsx`

Single-line fix per Stage 8 review (Important #2).

```tsx
// Find:
className="sticky top-20 z-20 ..."
// Replace top-20 with top-[var(--lj-header-height)]:
className="sticky top-[var(--lj-header-height)] z-20 ..."
```

**Verify + commit:**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9/web
npx vitest run components/marketing/CategoryFilterBar.test.tsx
git add web/components/marketing/CategoryFilterBar.tsx
git commit -m "fix(v3-s9): CategoryFilterBar uses --lj-header-height CSS variable"
```

---

## Stage 9.8 — Footer colophon rebuild

### Task 9.8

**Files:**
- Modify: `web/components/Footer.tsx` (full rewrite)
- Modify: `web/components/Footer.test.tsx` (update assertions)

**Step 1: Read current Footer**

**Step 2: Update tests for v3 expectations**

Drop column-based assertions. Add:
- Renders 3 colophon rows (ОТ, СВЯЗЬ, СТРАНИЦЫ)
- Renders large `<HeaderLogo>` at bottom
- Renders edition tag `Ред. 2026.04 · v3`
- Renders methane molecule (preserve from Stage 5)

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from './Footer'

describe('<Footer> v3 colophon', () => {
  it('renders three colophon rows: ОТ, СВЯЗЬ, СТРАНИЦЫ', () => {
    render(<Footer />)
    expect(screen.getByText('ОТ')).toBeInTheDocument()
    expect(screen.getByText('СВЯЗЬ')).toBeInTheDocument()
    expect(screen.getByText('СТРАНИЦЫ')).toBeInTheDocument()
  })

  it('renders the HeaderLogo wordmark large', () => {
    const { container } = render(<Footer />)
    expect(container.querySelector('svg[role="img"]')).not.toBeNull()
  })

  it('renders the edition tag', () => {
    render(<Footer />)
    expect(screen.getByText(/ред\..*2026/i)).toBeInTheDocument()
  })

  it('renders the methane molecule accent (preserved from Stage 5)', () => {
    // The methane motif is the small 4-line tetrahedral SVG.
    const { container } = render(<Footer />)
    const svgs = container.querySelectorAll('svg')
    const methane = Array.from(svgs).find((s) => s.querySelectorAll('line').length === 4)
    expect(methane).toBeDefined()
  })
})
```

**Step 3: Implement**

```tsx
import { HeaderLogo } from './HeaderLogo'
import { MoleculeMotifLJ } from '@/components/decor/MoleculeMotif.lj'

const ROW_OT = ['Химичка', 'с 2023', 'Москва', '161 опыт', '⌀ 4.9/5']
const ROW_SVYAZ = ['telegram', 'whatsapp', 'phone', 'email']
const ROW_STRANITSY = ['каталог', 'о нас', 'доставка', 'оплата', 'возврат']

export function Footer() {
  return (
    <footer className="relative bg-[var(--color-lj-cream)] border-t border-[var(--color-lj-rule)] px-6 py-16 overflow-hidden">
      {/* Methane molecule accent (from Stage 5) */}
      <MoleculeMotifLJ
        variant="methane"
        className="absolute right-8 bottom-8 w-12 h-12 text-[var(--color-lj-ink)] opacity-40"
      />

      <div className="max-w-[var(--max-lj-content)] mx-auto relative z-[2]">
        {/* NotebookHeader strip */}
        <div className="flex items-center justify-between font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] mb-12 pb-4 border-b border-[var(--color-lj-rule)]">
          <span className="inline-flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-lj-brand)]" />
            СТР. ZZ / END · ЛАБОРАТОРНЫЙ ЖУРНАЛ
          </span>
          <span className="opacity-70">Ред. 2026.04 · v3</span>
        </div>

        {/* Three colophon rows */}
        <ColophonRow label="ОТ" items={ROW_OT} className="mb-8" />
        <ColophonRow label="СВЯЗЬ" items={ROW_SVYAZ} className="mb-8" />
        <ColophonRow label="СТРАНИЦЫ" items={ROW_STRANITSY} className="mb-16" />

        {/* Bottom: large wordmark + copyright */}
        <div className="border-t border-[var(--color-lj-rule)] pt-12 flex items-end justify-between gap-8 flex-wrap">
          <HeaderLogo size={4} className="text-[var(--color-lj-ink)]" />
          <span className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] opacity-70">
            © 2023–2026 · все права защищены
          </span>
        </div>
      </div>
    </footer>
  )
}

interface ColophonRowProps {
  label: string
  items: string[]
  className?: string
}

function ColophonRow({ label, items, className = '' }: ColophonRowProps) {
  return (
    <div className={`grid grid-cols-[5rem_1fr] gap-6 items-baseline ${className}`}>
      <span className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] text-[var(--color-lj-brand)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] tracking-[0.04em] text-[var(--color-lj-ink)] opacity-80">
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className="inline-flex items-center gap-3">
            {item}
            {i < items.length - 1 && <span className="text-[var(--color-lj-brand)]">·</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
```

(Adapt items if the existing v2 Footer has CMS-driven contact info — preserve any hookups by replacing the static `ROW_SVYAZ` array with the corresponding props.)

**Step 4: Verify + commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9/web
npx vitest run components/Footer.test.tsx
npm run build 2>&1 | tail -5
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
git add web/components/Footer.tsx web/components/Footer.test.tsx
git commit -m "feat(v3-s9): rebuild Footer as lab notebook colophon"
```

---

## Stage 9.9 — Cart page calm v3

### Task 9.9

**Files:**
- Modify: `web/app/[locale]/(public)/cart/page.tsx` (full rewrite)
- Modify: `web/app/[locale]/(public)/cart/page.test.tsx` (update assertions)

**Step 1: Read current**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
cat 'web/app/[locale]/(public)/cart/page.tsx'
cat 'web/app/[locale]/(public)/cart/page.test.tsx'
```

**Step 2: Replace with calm v3**

Replace section composition while preserving cart state hooks (`useCart`, `setQty`, `removeItem`, `clearCart`).

```tsx
// pseudo-shape (adapt to actual hook signatures)
'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart'
import { ProductPriceBlockLJ } from '@/components/product/ProductPriceBlockLJ'
import { QuantityStepperLJ } from '@/components/product/QuantityStepperLJ'

function formatRub(n: number): string {
  return n.toLocaleString('ru-RU').replace(/,/g, ' ')
}

export default function CartPage() {
  const items = useCart()
  const setQty = ... // existing hook
  const remove = ... // existing hook

  const subtotal = items.reduce((acc, i) => acc + i.priceRub * i.quantity, 0)
  const shippingRub = 400  // placeholder; real number comes from pricing logic
  const totalRub = subtotal + (items.length > 0 ? shippingRub : 0)

  return (
    <section className="bg-[var(--color-lj-cream)] px-6 py-16 min-h-[80vh]">
      <div className="max-w-[var(--max-lj-narrow)] mx-auto">
        {/* Mono page label */}
        <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] mb-6 opacity-70">
          КОРЗИНА · {items.length} {pluralizeRu(items.length, ['НАБОР', 'НАБОРА', 'НАБОРОВ'])}
        </p>

        {/* Display heading (no off-grid) */}
        <h1 className="font-[var(--font-lj-display)] font-[900] text-[clamp(2.5rem,5vw,4rem)] leading-[0.95] tracking-[-0.045em] mb-12">
          Корзина
        </h1>

        {items.length === 0 ? (
          <div className="flex flex-col items-start gap-6">
            <p className="text-xl opacity-70">Корзина пуста</p>
            <Link
              href="/categories"
              className="inline-flex items-center gap-3 px-7 py-4 font-[var(--font-lj-mono)] text-[0.8125rem] font-medium uppercase tracking-[0.08em] border border-[var(--color-lj-ink)] rounded-full bg-[var(--color-lj-ink)] text-[var(--color-lj-bone)] transition-all duration-400 hover:bg-[var(--color-lj-brand-deep)] hover:border-[var(--color-lj-brand-deep)]"
            >
              Открыть каталог →
            </Link>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <ul className="list-none p-0 m-0 flex flex-col gap-6 mb-12">
              {items.map((item) => (
                <li key={item.productId} className="grid grid-cols-[1fr_auto] gap-6 pb-6 border-b border-[var(--color-lj-rule)] items-center">
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/product/${item.slug}`}
                      className="font-[var(--font-lj-display)] font-[700] text-xl tracking-[-0.025em] hover:text-[var(--color-lj-brand-deep)]"
                    >
                      {item.name}
                    </Link>
                    <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] opacity-60">
                      {formatRub(item.priceRub)} ₽ за шт.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <QuantityStepperLJ value={item.quantity} onChange={(q) => setQty(item.productId, q)} />
                    <span className="font-[var(--font-lj-display)] font-[900] text-2xl tracking-[-0.04em] min-w-[6rem] text-right">
                      {formatRub(item.priceRub * item.quantity)} <span className="font-[var(--font-lj-mono)] font-normal text-sm opacity-70">₽</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item.productId)}
                      aria-label={`Удалить ${item.name}`}
                      className="font-[var(--font-lj-mono)] text-[var(--color-lj-ink)] opacity-60 hover:opacity-100 hover:text-[var(--color-stock-danger)] text-xl"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Order summary */}
            <div className="flex flex-col gap-3 mb-8 max-w-md ml-auto">
              <div className="flex justify-between font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em] opacity-70">
                <span>Подытог</span>
                <span>{formatRub(subtotal)} ₽</span>
              </div>
              <div className="flex justify-between font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em] opacity-70">
                <span>Доставка</span>
                <span>{formatRub(shippingRub)} ₽</span>
              </div>
              <div className="flex justify-between border-t border-[var(--color-lj-rule)] pt-4 font-[var(--font-lj-display)] font-[900] text-2xl tracking-[-0.04em]">
                <span>Итого</span>
                <span>{formatRub(totalRub)} <span className="font-[var(--font-lj-mono)] font-normal text-base opacity-70">₽</span></span>
              </div>
            </div>

            {/* CTA */}
            <div className="flex justify-end">
              <Link
                href="/checkout"
                className="inline-flex items-center gap-3 px-8 py-4 font-[var(--font-lj-mono)] text-[0.8125rem] font-medium uppercase tracking-[0.08em] border border-[var(--color-lj-ink)] rounded-full bg-[var(--color-lj-ink)] text-[var(--color-lj-bone)] transition-all duration-400 hover:bg-[var(--color-lj-brand-deep)] hover:border-[var(--color-lj-brand-deep)]"
              >
                Оформить заказ →
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
```

Add `pluralizeRu` import from `@/lib/i18n`.

**Step 3: Update tests**

The existing cart test already asserts the QuantityStepperLJ with English aria-labels (per Task 7.12 cleanup). Verify it still passes after the rewrite. Adapt any v2-class assertions to v3.

**Step 4: Verify + commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9/web
npx vitest run app/[locale]/\(public\)/cart/page.test.tsx
npm run build 2>&1 | tail -5
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
git add 'web/app/[locale]/(public)/cart'
git commit -m "feat(v3-s9): cart page calm v3 (tokens only, no decorative chrome)"
```

---

## Stage 9.10 — CartDrawer calm v3

### Task 9.10

**Files:**
- Modify: `web/components/CartDrawer.tsx` (full rewrite)
- Modify: `web/components/CartDrawer.test.tsx` (update assertions)

Same calm v3 vocabulary as cart page, compressed for slide-in drawer.

**Step 1: Read current state + test**

**Step 2: Rewrite preserving open/close + scrim behavior**

```tsx
// 'use client'
// useState for open
// useEffect for body scroll-lock + Esc key
// Slide-in animation via translate-x

return (
  <>
    {open && (
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[var(--color-lj-ink)]/40 z-[55]"
        aria-hidden="true"
      />
    )}
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Корзина"
      className={`fixed top-0 right-0 bottom-0 z-[56] w-full max-w-md bg-[var(--color-lj-cream)] border-l border-[var(--color-lj-rule)] transition-transform duration-400 flex flex-col ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Mono header strip */}
      <div className="flex items-center justify-between font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em] px-6 py-4 border-b border-[var(--color-lj-rule)]">
        <span>
          КОРЗИНА {items.length > 0 ? <span className="text-[var(--color-lj-brand)]">· {items.length}</span> : '(0)'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть корзину"
          className="hover:text-[var(--color-lj-brand-deep)]"
        >
          × ЗАКРЫТЬ
        </button>
      </div>

      {/* Items (scrollable) */}
      <div className="flex-1 overflow-y-auto p-6">
        {items.length === 0 ? (
          <p className="text-center opacity-60 mt-8">Корзина пуста</p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-4">
            {items.map((item) => (
              // compressed row similar to cart page
              ...
            ))}
          </ul>
        )}
      </div>

      {/* Footer total + CTA */}
      {items.length > 0 && (
        <div className="border-t border-[var(--color-lj-rule)] p-6 flex flex-col gap-3">
          <div className="flex justify-between font-[var(--font-lj-display)] font-[900] text-xl tracking-[-0.04em]">
            <span>Итого</span>
            <span>{formatRub(total)} ₽</span>
          </div>
          <Link
            href="/cart"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-3 px-7 py-4 font-[var(--font-lj-mono)] text-[0.8125rem] font-medium uppercase tracking-[0.08em] border border-[var(--color-lj-ink)] rounded-full bg-[var(--color-lj-ink)] text-[var(--color-lj-bone)] hover:bg-[var(--color-lj-brand-deep)]"
          >
            К оформлению →
          </Link>
        </div>
      )}
    </aside>
  </>
)
```

Adapt to actual existing CartDrawer hook + open-state shape.

**Step 3: Update tests**

Drop v2-class assertions, add v3 surface checks.

**Step 4: Verify + commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9/web
npx vitest run components/CartDrawer.test.tsx
git add web/components/CartDrawer.tsx web/components/CartDrawer.test.tsx
git commit -m "feat(v3-s9): CartDrawer calm v3 slide-in"
```

---

## Stage 9.11 — Playwright visual regression baselines

### Task 9.11

**Files:**
- Create: `web/tests/visual/v3-stage-9.spec.ts`

```ts
import { test, expect } from '@playwright/test'

test.describe('v3 Lab Journal — Stage 9 surfaces', () => {
  test.skip(({ project }) => project.name !== 'desktop', 'desktop only this round')

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('Header on cream surface', async ({ page }) => {
    await page.goto('/ru')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    const header = page.locator('header').first()
    await expect(header).toHaveScreenshot('header.png', { maxDiffPixelRatio: 0.02 })
  })

  test('Footer colophon', async ({ page }) => {
    await page.goto('/ru')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    const footer = page.locator('footer').first()
    await footer.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await expect(footer).toHaveScreenshot('footer.png', { maxDiffPixelRatio: 0.02 })
  })

  test('Cart page empty state', async ({ page }) => {
    // Clear cart via localStorage if applicable
    await page.goto('/ru/cart')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => {
      localStorage.removeItem('cart')  // adjust key to match actual cart storage
    })
    await page.reload()
    await page.waitForTimeout(500)
    await expect(page.locator('section').first()).toHaveScreenshot('cart-empty.png', { maxDiffPixelRatio: 0.02 })
  })

  test('Mobile menu open', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })  // mobile viewport
    await page.goto('/ru')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.click('button:has-text("МЕНЮ")')
    await page.waitForTimeout(500)
    await expect(page.locator('[role="dialog"]')).toHaveScreenshot('mobile-menu.png', { maxDiffPixelRatio: 0.02 })
  })
})
```

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9/web
npx playwright test tests/visual/v3-stage-9.spec.ts --project=desktop --update-snapshots
npx playwright test tests/visual/v3-stage-9.spec.ts --project=desktop  # sanity re-run
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9
git add web/tests/visual/v3-stage-9.spec.ts web/tests/visual/__screenshots__/v3-stage-9.spec.ts-snapshots/
git commit -m "test(v3-s9): playwright visual regression baselines for Header/Footer/cart/mobile menu"
```

---

## Stage 9.12 — Final verification

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s9/web
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:visual
```

Walk the design doc's [Acceptance criteria](2026-04-29-shop-v3-stage-9-design.md#acceptance-criteria). All 12 items should be true.

Then handoff via `superpowers:finishing-a-development-branch`.

---

## Plan complete and saved to `docs/plans/2026-04-29-shop-v3-stage-9-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** — fresh subagent per task with hybrid review (full ceremony on Header rebuild + Footer rebuild + Cart page; direct on small primitives + cleanups)

**2. Parallel Session (separate)** — open new session with `superpowers:executing-plans`, batch execution with checkpoints

Which approach?
