# Shop v3 — Stage 10 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the v3 `<PaginationLJ>` component and wire it into `/categories/[slug]`; extend Playwright visual regression baselines from desktop-only to mobile + tablet across all existing v3 spec files.

**Architecture:** 1 net-new server component (PaginationLJ — pure `<Link>` rendering, no client state) consumed by the existing categories detail page. Backend `listProductsByCategory` already returns `Paginated<T>` shape with `{data, pagination: {limit, offset, total}}`, so no lib signature change is needed — just pass `limit: 12 + offset: (page-1)*12`. Mobile/tablet baselines are pure config drops on 4 existing Playwright specs.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2, TypeScript, Tailwind 4, Vitest + Testing Library, Playwright.

**Source artifacts:**
- Design doc: `ximi4ka/docs/plans/2026-05-02-shop-v3-stage-10-design.md`

**Critical pre-existing context:**
- `web/lib/api.ts` exports `Paginated<T>` interface and `listProductsByCategory(slug, opts: { limit?, offset? })` returns it.
- Playwright config (`web/playwright.config.ts`) already has 3 projects: `mobile` (375×812), `tablet` (768×1024), `desktop` (1440×900).
- 4 existing spec files all `test.skip(({ project }) => project.name !== 'desktop', ...)` and explicitly `setViewportSize(1440, 900)` in beforeEach.

**Stage map (~6 task-commits):**
- Stage 10.0 — Worktree + baseline (verification)
- Stage 10.1 — `<PaginationLJ>` component (TDD)
- Stage 10.2 — Wire into `/categories/[slug]` page
- Stage 10.3 — Drop desktop-only skip on 4 Playwright specs
- Stage 10.4 — Generate mobile + tablet baselines (eyeball + commit)
- Stage 10.5 — PaginationLJ visual baseline via mock-data spec
- Stage 10.6 — Final verification (no commit)

---

## Pre-Stage Setup

### Task 10.0: Worktree + baseline

**Files:** none

**Step 1: Worktree**

From `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop`:
```bash
git worktree add -b feat/v3-stage-10 /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10 main
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10
npm install
```

**Step 2: Baseline**

```bash
cd web
npm run typecheck
npm run test 2>&1 | tail -5
npm run build 2>&1 | tail -5
```

Expected: clean. (Test count ~647 from end-of-Stage-9.)

**Step 3: Confirm Playwright projects + Paginated type**

```bash
grep -A 5 "name: 'mobile'\|name: 'tablet'\|name: 'desktop'" web/playwright.config.ts
grep -B 1 -A 4 "interface Paginated" web/lib/api.ts
```

Confirm 3 viewports + Paginated shape.

No commit.

---

## Stage 10.1 — `<PaginationLJ>` component (TDD)

### Task 10.1

**Files:**
- Create: `web/components/ui/PaginationLJ.tsx`
- Create: `web/components/ui/PaginationLJ.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaginationLJ } from './PaginationLJ'

describe('<PaginationLJ>', () => {
  const baseProps = {
    basePath: '/categories/reaktivy',
    totalResults: 100,
    resultsPerPage: 12,
  }

  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(
      <PaginationLJ {...baseProps} currentPage={1} totalPages={1} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders all page numbers without ellipsis when totalPages <= 7', () => {
    render(<PaginationLJ {...baseProps} currentPage={3} totalPages={5} />)
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByText(String(n))).toBeInTheDocument()
    }
    expect(screen.queryByText('...')).toBeNull()
  })

  it('compresses to first + last + 3-around-current with two ellipses for many pages', () => {
    const { container } = render(
      <PaginationLJ {...baseProps} currentPage={6} totalPages={12} />
    )
    // Expect: 1, 2 ... 5, 6, 7 ... 11, 12 + 2 ellipses
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-pagination-ellipsis]').length).toBe(2)
  })

  it('wraps the current page in [ ] brackets', () => {
    render(<PaginationLJ {...baseProps} currentPage={3} totalPages={5} />)
    expect(screen.getByText('[ 3 ]')).toBeInTheDocument()
  })

  it('renders НАЗАД as a span (disabled) on page 1', () => {
    const { container } = render(
      <PaginationLJ {...baseProps} currentPage={1} totalPages={5} />
    )
    const back = container.querySelector('[data-pagination-back]')
    expect(back?.tagName.toLowerCase()).toBe('span')
  })

  it('renders ВПЕРЁД as a span (disabled) on last page', () => {
    const { container } = render(
      <PaginationLJ {...baseProps} currentPage={5} totalPages={5} />
    )
    const next = container.querySelector('[data-pagination-next]')
    expect(next?.tagName.toLowerCase()).toBe('span')
  })

  it('renders НАЗАД as a Link with prev page href when not on page 1', () => {
    const { container } = render(
      <PaginationLJ {...baseProps} currentPage={3} totalPages={5} />
    )
    const back = container.querySelector('[data-pagination-back]') as HTMLAnchorElement
    expect(back.tagName.toLowerCase()).toBe('a')
    expect(back.getAttribute('href')).toBe('/categories/reaktivy?page=2')
  })

  it('omits ?page= for page 1 hrefs (canonical)', () => {
    const { container } = render(
      <PaginationLJ {...baseProps} currentPage={3} totalPages={5} />
    )
    const links = container.querySelectorAll('a')
    const page1Link = Array.from(links).find((a) => a.textContent?.trim() === '1')
    expect(page1Link?.getAttribute('href')).toBe('/categories/reaktivy')
  })

  it('preserves named search params on all hrefs', () => {
    const { container } = render(
      <PaginationLJ
        {...baseProps}
        currentPage={3}
        totalPages={5}
        currentParams={{ sort: 'price-asc' }}
        preserveParams={['sort']}
      />
    )
    const links = container.querySelectorAll('a')
    const page2Link = Array.from(links).find((a) => a.textContent?.trim() === '2')
    expect(page2Link?.getAttribute('href')).toBe('/categories/reaktivy?sort=price-asc&page=2')
    const page1Link = Array.from(links).find((a) => a.textContent?.trim() === '1')
    expect(page1Link?.getAttribute('href')).toBe('/categories/reaktivy?sort=price-asc')
  })

  it('renders the mono caption with correct range', () => {
    render(
      <PaginationLJ {...baseProps} currentPage={3} totalPages={9} totalResults={100} resultsPerPage={12} />
    )
    // Page 3, pageSize 12 → range 25–36 of 100
    expect(screen.getByText(/стр\. 03 из 09 · показано 25–36 из 100/i)).toBeInTheDocument()
  })

  it('caption clamps to totalResults on the last page', () => {
    render(
      <PaginationLJ {...baseProps} currentPage={5} totalPages={5} totalResults={50} resultsPerPage={12} />
    )
    // Page 5, pageSize 12 → range 49–50 of 50 (clamped)
    expect(screen.getByText(/стр\. 05 из 05 · показано 49–50 из 50/i)).toBeInTheDocument()
  })

  it('marks current page with aria-current="page"', () => {
    const { container } = render(
      <PaginationLJ {...baseProps} currentPage={3} totalPages={5} />
    )
    const current = container.querySelector('[aria-current="page"]')
    expect(current?.textContent).toContain('3')
  })

  it('has nav landmark with label', () => {
    const { container } = render(
      <PaginationLJ {...baseProps} currentPage={3} totalPages={5} />
    )
    const nav = container.querySelector('nav[aria-label]')
    expect(nav?.getAttribute('aria-label')).toMatch(/пагинация/i)
  })
})
```

**Step 2: Run — fail**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10/web
npx vitest run components/ui/PaginationLJ.test.tsx
```

**Step 3: Implement**

```tsx
import Link from 'next/link'

interface Props {
  currentPage: number      // 1-indexed
  totalPages: number
  totalResults: number
  resultsPerPage: number
  basePath: string         // e.g. '/categories/reaktivy'
  /** Named query params to preserve when changing page (besides 'page' itself). */
  preserveParams?: string[]
  /** Current values of those params, read from the page's searchParams. */
  currentParams?: Record<string, string | undefined>
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Compute the visible page numbers per design doc §3:
 * - totalPages <= 7: render all
 * - else: first + last + 3 around current, ellipsis between
 *
 * Returns array where each element is either a page number OR null (ellipsis).
 */
function buildRange(currentPage: number, totalPages: number): Array<number | null> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  // Always show first 2 + last 2 + 3 around current (current-1, current, current+1)
  const around = new Set<number>([
    1, 2,
    currentPage - 1, currentPage, currentPage + 1,
    totalPages - 1, totalPages,
  ])
  const sorted = Array.from(around)
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b)
  // Insert null (ellipsis) where there's a gap > 1
  const out: Array<number | null> = []
  for (let i = 0; i < sorted.length; i++) {
    out.push(sorted[i])
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) out.push(null)
  }
  return out
}

function buildHref(
  basePath: string,
  page: number,
  preserveParams: string[],
  currentParams: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams()
  for (const key of preserveParams) {
    const v = currentParams[key]
    if (v) params.set(key, v)
  }
  // Page 1 omits ?page= for canonical cleanliness
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export function PaginationLJ({
  currentPage,
  totalPages,
  totalResults,
  resultsPerPage,
  basePath,
  preserveParams = [],
  currentParams = {},
}: Props) {
  if (totalPages <= 1) return null

  const range = buildRange(currentPage, totalPages)
  const isFirst = currentPage <= 1
  const isLast = currentPage >= totalPages

  const startResult = (currentPage - 1) * resultsPerPage + 1
  const endResult = Math.min(currentPage * resultsPerPage, totalResults)

  const linkClass =
    'inline-flex items-center font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em] text-[var(--color-lj-ink)] opacity-70 hover:opacity-100 hover:text-[var(--color-lj-brand-deep)] transition-colors'
  const disabledClass =
    'inline-flex items-center font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em] text-[var(--color-lj-ink)] opacity-40 cursor-not-allowed'
  const currentClass =
    'inline-flex items-center font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em] text-[var(--color-lj-brand)]'
  const sepClass = 'text-[var(--color-lj-brand)] mx-2'

  return (
    <nav
      aria-label="Пагинация"
      className="flex flex-col items-center gap-3 my-8"
    >
      <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] opacity-65">
        стр. {pad(currentPage)} из {pad(totalPages)} · показано {startResult}–{endResult} из {totalResults}
      </p>

      <div className="flex items-center flex-wrap justify-center gap-y-2">
        {/* Назад */}
        {isFirst ? (
          <span data-pagination-back className={disabledClass}>← НАЗАД</span>
        ) : (
          <Link
            data-pagination-back
            href={buildHref(basePath, currentPage - 1, preserveParams, currentParams)}
            className={linkClass}
          >
            ← НАЗАД
          </Link>
        )}
        <span className={sepClass}>·</span>

        {/* Numbered range */}
        {range.map((page, i) => {
          if (page === null) {
            return (
              <span key={`ellipsis-${i}`} data-pagination-ellipsis className="opacity-40 mx-1">
                ...
              </span>
            )
          }
          if (page === currentPage) {
            return (
              <span key={page} aria-current="page" className={currentClass}>
                [ {page} ]
              </span>
            )
          }
          return (
            <span key={page} className="inline-flex items-center">
              <Link
                href={buildHref(basePath, page, preserveParams, currentParams)}
                className={linkClass}
              >
                {page}
              </Link>
              {i < range.length - 1 && range[i + 1] !== null && <span className={sepClass}>·</span>}
            </span>
          )
        })}

        <span className={sepClass}>·</span>

        {/* Вперёд */}
        {isLast ? (
          <span data-pagination-next className={disabledClass}>ВПЕРЁД →</span>
        ) : (
          <Link
            data-pagination-next
            href={buildHref(basePath, currentPage + 1, preserveParams, currentParams)}
            className={linkClass}
          >
            ВПЕРЁД →
          </Link>
        )}
      </div>
    </nav>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/ui/PaginationLJ.test.tsx  # green
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10
git add web/components/ui/PaginationLJ.tsx web/components/ui/PaginationLJ.test.tsx
git commit -m "feat(v3-s10): add PaginationLJ component with ellipsis range compression"
```

---

## Stage 10.2 — Wire into `/categories/[slug]`

### Task 10.2

**Files:**
- Modify: `web/app/[locale]/(public)/categories/[slug]/page.tsx`

**Step 1: Read current state**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10
sed -n '120,200p' 'web/app/[locale]/(public)/categories/[slug]/page.tsx'
```

Note where it calls `listProductsByCategory` and how it consumes the result. Currently uses `limit: 50` per the Stage 8 implementer note.

**Step 2: Update fetch + render**

Find the fetch call (likely something like):
```tsx
const products = await listProductsByCategory(slug, { limit: 50 })
```

Replace with:
```tsx
const PAGE_SIZE = 12
const sp = (await searchParams) ?? {}
const page = Math.max(1, parseInt(String(sp.page ?? '1'), 10) || 1)
const result = await listProductsByCategory(slug, {
  limit: PAGE_SIZE,
  offset: (page - 1) * PAGE_SIZE,
})
const products = result.data
const totalCount = result.pagination.total
const totalPages = Math.ceil(totalCount / PAGE_SIZE)
```

(Adjust variable names to match existing patterns. If a `currentSort` already gets parsed from `searchParams`, reuse the same parsing pattern.)

**Step 3: Render `<PaginationLJ>` below the product grid**

After the existing `<div className="grid …">{products.map(...)}</div>`, add:

```tsx
import { PaginationLJ } from '@/components/ui/PaginationLJ'

// ... in JSX, after the product grid:
<PaginationLJ
  currentPage={page}
  totalPages={totalPages}
  totalResults={totalCount}
  resultsPerPage={PAGE_SIZE}
  basePath={`/categories/${slug}`}
  preserveParams={['sort']}
  currentParams={{ sort: typeof sp.sort === 'string' ? sp.sort : undefined }}
/>
```

`<PaginationLJ>` returns `null` when `totalPages <= 1`, so no conditional gate needed at the call site.

**Step 4: Update homepage product cap clarity**

Confirm the categories homepage section ISN'T using this same `listProductsByCategory` with `limit: 50` — if it is, that section needs no change (just a featured-3 slice).

**Step 5: Verify**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10/web
npm run typecheck
npm run test 2>&1 | tail -5
npm run build 2>&1 | tail -5
```

If existing categories/[slug]/page.test.tsx asserts the old `result` shape (bare array), update assertion.

**Step 6: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10
git add 'web/app/[locale]/(public)/categories/[slug]/page.tsx'
git commit -m "feat(v3-s10): wire PaginationLJ into /categories/[slug] (12 per page)"
```

---

## Stage 10.3 — Drop desktop-only skip from 4 Playwright specs

### Task 10.3

**Files:**
- Modify: `web/tests/visual/v3-homepage.spec.ts`
- Modify: `web/tests/visual/v3-product-detail.spec.ts`
- Modify: `web/tests/visual/v3-stage-8.spec.ts`
- Modify: `web/tests/visual/v3-stage-9.spec.ts`

**Step 1: Find the skip line in each spec**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10
grep -n 'desktop only this round\|setViewportSize' web/tests/visual/v3-*.spec.ts
```

**Step 2: Edit each spec** — drop these two patterns from each file:

a) The skip line:
```ts
test.skip(({ project }) => project.name !== 'desktop', 'desktop only this round')
```
or
```ts
test.skip(({ project }, testInfo) => testInfo.project.name !== 'desktop', '...')
```

b) The hardcoded viewport in `beforeEach`:
```ts
await page.setViewportSize({ width: 1440, height: 900 })
```
(Playwright's project config already drives the viewport — this line was overriding it. Remove.)

Leave everything else (waitForLoadState, fonts.ready, scrollIntoView, screenshot calls) unchanged.

**Step 3: Verify spec syntax**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10/web
npx playwright test tests/visual --list 2>&1 | head -20
```

Expected: each test now lists 3× (desktop + tablet + mobile) instead of 1× (desktop only).

**Step 4: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10
git add web/tests/visual/v3-homepage.spec.ts web/tests/visual/v3-product-detail.spec.ts web/tests/visual/v3-stage-8.spec.ts web/tests/visual/v3-stage-9.spec.ts
git commit -m "test(v3-s10): enable mobile + tablet visual regression coverage"
```

(Baselines come in Task 10.4 — separate commit because the new .png files are large and worth isolating from the spec changes.)

---

## Stage 10.4 — Generate mobile + tablet baselines

### Task 10.4

**Files:**
- Create: many `web/tests/visual/__screenshots__/**/-mobile-darwin.png` files
- Create: many `web/tests/visual/__screenshots__/**/-tablet-darwin.png` files
- Possibly modify: source files if real layout bugs surface

**Step 1: Run baseline generation**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10/web
npx playwright test tests/visual --update-snapshots
```

Playwright runs each existing test 3× (one per project), generating 3 baseline files per scene. Initial pass takes ~3-5 minutes.

If any test fails to RUN (not just diff — e.g. selector timeout because layout changes hide a target element at mobile), fix the test selector first OR fix the layout, then re-run.

**Step 2: Eyeball each new baseline**

```bash
ls web/tests/visual/__screenshots__/**/*-mobile-darwin.png
ls web/tests/visual/__screenshots__/**/*-tablet-darwin.png
```

For each new baseline, open in an image viewer (or use `open` on macOS):

```bash
open web/tests/visual/__screenshots__/v3-homepage.spec.ts-snapshots/hero-mobile-darwin.png
```

Look for:
- **Hero at mobile:** mega headline doesn't clip horribly, benzene molecule positioned reasonably
- **Manifesto cells:** stack vertically (`grid-cols-1`), each cell readable
- **Products row:** asymmetric stagger collapses to single column, no overflow
- **PDP hero:** image + info column stack, gallery thumbnails visible
- **Categories drawer cards:** stack to 1-column, molecule decoration visible
- **Header on mobile:** logo + МЕНЮ button only, nav hidden, fits viewport
- **Mobile menu (Stage 9):** full-screen takeover renders correctly
- **CartDrawer at mobile:** slides from right, fits within viewport

**If a real bug is found** (e.g. text clips off-screen, element overlaps): fix in source files, regenerate just that baseline (`npx playwright test tests/visual/v3-X.spec.ts --update-snapshots`), commit fix + baseline together.

**Step 3: Sanity re-run**

```bash
npx playwright test tests/visual
```

All tests should pass against baselines just generated.

**Step 4: Commit baselines**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10
git add web/tests/visual/__screenshots__/
git status --short  # confirm only PNG files staged
git commit -m "test(v3-s10): mobile + tablet baselines for v3 surfaces"
```

If any layout fixes were needed, commit those FIRST as a separate commit before the baselines:
```bash
git add web/components/<fixed-file> web/tests/visual/__screenshots__/<related-baseline>
git commit -m "fix(v3-s10): <specific layout fix> at mobile/tablet"
```

---

## Stage 10.5 — PaginationLJ visual baseline via mock-data spec

### Task 10.5

**Why:** the production catalog likely has ≤12 products per category right now, so `<PaginationLJ>` won't render in any baseline scene. This task adds a small Playwright spec that visits a route serving mock data, capturing the component's visual baseline at all viewports.

**Files:**
- Create: `web/app/[locale]/_pagination-fixture/page.tsx` (fixture route — gated to dev/test only)
- Create: `web/tests/visual/v3-pagination.spec.ts`

**Step 1: Create the fixture route**

```tsx
// web/app/[locale]/_pagination-fixture/page.tsx
import { notFound } from 'next/navigation'
import { PaginationLJ } from '@/components/ui/PaginationLJ'

// Dev-only route. Fail closed in production.
export default function PaginationFixture({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="bg-[var(--color-lj-cream)] min-h-screen p-12 flex flex-col gap-12">
      <div data-fixture-scene="middle-of-many">
        <h2 className="font-[var(--font-lj-mono)] uppercase mb-4">middle of many pages</h2>
        <PaginationLJ
          currentPage={6}
          totalPages={12}
          totalResults={144}
          resultsPerPage={12}
          basePath="/x"
        />
      </div>

      <div data-fixture-scene="few-pages">
        <h2 className="font-[var(--font-lj-mono)] uppercase mb-4">few pages (no ellipsis)</h2>
        <PaginationLJ
          currentPage={3}
          totalPages={5}
          totalResults={50}
          resultsPerPage={12}
          basePath="/x"
        />
      </div>

      <div data-fixture-scene="first-page">
        <h2 className="font-[var(--font-lj-mono)] uppercase mb-4">first page (back disabled)</h2>
        <PaginationLJ
          currentPage={1}
          totalPages={12}
          totalResults={144}
          resultsPerPage={12}
          basePath="/x"
        />
      </div>

      <div data-fixture-scene="last-page">
        <h2 className="font-[var(--font-lj-mono)] uppercase mb-4">last page (forward disabled, partial range)</h2>
        <PaginationLJ
          currentPage={12}
          totalPages={12}
          totalResults={140}
          resultsPerPage={12}
          basePath="/x"
        />
      </div>
    </div>
  )
}
```

**Step 2: Create the spec**

```ts
// web/tests/visual/v3-pagination.spec.ts
import { test, expect } from '@playwright/test'

test.describe('v3 Lab Journal — pagination component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ru/_pagination-fixture')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
  })

  test('middle of many pages', async ({ page }) => {
    const scene = page.locator('[data-fixture-scene="middle-of-many"]')
    await expect(scene).toHaveScreenshot('pagination-middle.png', { maxDiffPixelRatio: 0.02 })
  })

  test('few pages no ellipsis', async ({ page }) => {
    const scene = page.locator('[data-fixture-scene="few-pages"]')
    await expect(scene).toHaveScreenshot('pagination-few.png', { maxDiffPixelRatio: 0.02 })
  })

  test('first page disabled back', async ({ page }) => {
    const scene = page.locator('[data-fixture-scene="first-page"]')
    await expect(scene).toHaveScreenshot('pagination-first.png', { maxDiffPixelRatio: 0.02 })
  })

  test('last page disabled forward', async ({ page }) => {
    const scene = page.locator('[data-fixture-scene="last-page"]')
    await expect(scene).toHaveScreenshot('pagination-last.png', { maxDiffPixelRatio: 0.02 })
  })
})
```

**Step 3: Generate baselines**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10/web
npx playwright test tests/visual/v3-pagination.spec.ts --update-snapshots
```

This runs 4 scenes × 3 viewports = 12 screenshots.

**Step 4: Sanity re-run**

```bash
npx playwright test tests/visual/v3-pagination.spec.ts
```

All pass.

**Step 5: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10
git add 'web/app/[locale]/_pagination-fixture/' web/tests/visual/v3-pagination.spec.ts web/tests/visual/__screenshots__/v3-pagination.spec.ts-snapshots/
git commit -m "test(v3-s10): pagination visual baselines via dev-only fixture route"
```

---

## Stage 10.6 — Final verification

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s10/web
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:visual
```

All pass. Walk design doc's [Acceptance criteria](2026-05-02-shop-v3-stage-10-design.md#acceptance-criteria) — all 12 items should be true.

Then handoff via `superpowers:finishing-a-development-branch`.

---

## Plan complete and saved to `docs/plans/2026-05-02-shop-v3-stage-10-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** — fresh subagent per task, hybrid mode (full ceremony on PaginationLJ + categories rewire, direct on the spec edits + baseline regen)

**2. Parallel Session (separate)** — open new session with `superpowers:executing-plans`

Which approach?
