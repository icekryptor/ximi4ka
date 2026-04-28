# UI/UX v2 Neo-Russian Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Push the public storefront from "competent minimalism" (v1) to "rich and cool" (v2) — Neo-Russian visual vocabulary with orange accent + dark cinematic sections + sticker badges + tickers + mega-display typography on top of the existing brand purple system.

**Architecture:** Layered overhaul, not a rebuild. v1's 21 commits stay in history. v2 *adds* new color/typography/spacing/motion tokens, *adds* four new UI primitives (DarkSection / Sticker / Ticker / BigNumber), *adds* three new product-detail components (KeyFactsList / CharacteristicsTable / ContentsSection), *adds* the Manifesto marketing component, and *modifies* every existing public-page surface to consume the new vocabulary. Hybrid Approach-3 (foundation → flagship pages → extract → apply → finalize) — same shape that worked for v1.

**Tech Stack:** Same as v1 — Next.js 16 App Router + React 19 + Tailwind v4 + Mazzard H Extrabold + IBM Plex Sans + framer-motion. No new deps expected.

**Design doc:** [2026-04-28-ui-ux-v2-neo-russian-design.md](2026-04-28-ui-ux-v2-neo-russian-design.md)

---

## Stage Overview — ALL 7 STAGES COMPLETE ✅

Shipped across **17 commits** (range `61a6b50..a2b1410`). Tests: web 625 / api 181 / shared 6 = **812 vitest** + **27 refreshed Playwright baselines**, all green.

| Stage | Title | Status | Commits |
|---|---|---|---|
| 1 | Foundation extensions | ✅ | 6 — `05047f5`, `3798407`, `3a3386b`, `8554039`, `53330e8`, `60aaa0b` |
| 2 | Homepage v2 | ✅ | 4 — `f7bcb13`, `40f1f9b`, `7571f5f`, `eff908e` |
| 3 | Product detail v2 | ✅ | 2 — `c03fcb1`, `e166301` |
| 4 | Pattern extraction | ✅ | 0 — components correctly placed at authoring time |
| 5 | Catalog/category/cart/CMS/404 | ✅ | 3 — `a11b447`, `4bf1c63`, `9dac3af` |
| 6 | Header + Footer touches | ✅ | 1 — `b06470a` |
| 7 | Playwright baseline refresh | ✅ | 1 — `a2b1410` |

## v2 Carry-Forwards

- **`MoleculeMotif` accent variant** — `vivid` currently uses brand purple. The ContentsSection/404/Hero on dark surfaces would benefit from a true orange variant (`stroke: var(--color-accent)`). Small follow-up; current rendering is acceptable.
- **api integration tests wipe dev DB** — every `npm test -w api` truncates products/categories/images. Re-import via `npm run import:tilda -w api -- /path/to/csv` after running tests. Real fix: separate test schema or test DB.
- **Lighthouse audit** — gated as Phase 9 (cutover) prep work; needs hosted staging environment for accurate scores. `npm run test:lighthouse` is a no-op echo pointing at the cutover plan.
- **Cross-platform Playwright baselines** — current snapshots are macOS-rendered; CI on Linux will diff on Cyrillic font hinting. Need Docker-based Chromium or parallel `*-linux.png` baselines.
- **Reveal hydration mismatch** — framer-motion `Reveal`/`Fade`/`Stagger` log a hydration warning in Next 16 dev. Doesn't affect snapshots (animations disabled during capture).
- **Next 16 middleware → proxy** rename due before Phase 9 cutover.

## Execution Posture

- TDD throughout. Behavior tests on every new component.
- Frequent commits — one per task or small group.
- **683 existing vitest tests stay green** through every commit. New tests target ~30 across all v2 components.
- Russian UI text. Brand convention.
- Working dir: `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop/`.
- Browser smoke at 3 viewports (375 / 768 / 1440) per visible-page change.
- Reduced-motion check at end of stage 7.
- Visual regression baselines refreshed in stage 7 (intentional diffs accepted; one big snapshot update).

---

## Stage 1 — Foundation Extensions

**Goal:** Add color/typography/spacing/motion tokens + the four new UI primitives. No visual changes to existing pages. Stages 2+ consume what lands here.

### Task 1.1: Token additions to `globals.css`

**Files:**
- Modify: `web/app/globals.css` — append new tokens to `@theme inline` block

**Step 1:** Append after the existing v1 tokens, inside `@theme inline`:

```css
/* === v2 additions === */

/* Accent layer */
--color-accent: #FF6B35;
--color-accent-soft: #FFE4D6;
--color-accent-deep: #C9491E;

/* Dark surface family */
--color-dark-base: #0F0A1F;
--color-dark-elevated: #1A1430;
--color-dark-border: #2A2347;
--color-text-on-dark: #F4F1FF;
--color-text-muted-on-dark: rgba(244, 241, 255, 0.55);

/* Gradient extensions */
--gradient-brand-deep: linear-gradient(135deg, #6703ff 0%, #c856ff 100%);
--gradient-accent: linear-gradient(135deg, #FF6B35 0%, #FF9558 100%);
--gradient-dark-glow: radial-gradient(circle at 30% 20%, rgba(141,103,255,0.3) 0%, transparent 60%);

/* Mega typography */
--text-mega: clamp(3.5rem, 8vw + 1rem, 9rem);
--text-display-tight: clamp(2.5rem, 5vw + 1rem, 5.5rem);
--tracking-mega: -0.04em;

/* Density tokens */
--space-card-tight: 0.75rem;
--space-card-relaxed: 1.5rem;
--space-section-cinematic: 8rem;
```

**Step 2:** Verify typecheck still passes:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
npm run typecheck -w web
```
Expected: clean.

**Step 3:** Verify visually — no page should look different yet (tokens declared, not consumed). Open DevTools on `:root`, confirm new variables are present.

**Step 4:** Commit:
```bash
git add web/app/globals.css
git commit -m "feat(web): add v2 design tokens (accent + dark + mega + density)"
```

### Task 1.2: Motion constants extension

**Files:**
- Modify: `web/lib/motion.ts` — append v2 easing/spring constants

**Step 1:** Append:

```ts
// === v2 additions ===

/** Springy overshoot — used for sticker entrances + button springs. */
export const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as const

/** Editorial smooth — used for count-up animations + page transitions. */
export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const

/** Heavy spring for cinematic hero text punch-in. */
export const SPRING_HEAVY = {
  type: 'spring' as const,
  stiffness: 180,
  damping: 24,
}

/** Full-cycle duration of the infinite-scroll Ticker marquee. */
export const TICKER_DURATION_S = 30
```

**Step 2:** Verify typecheck.

**Step 3:** Commit:
```bash
git add web/lib/motion.ts
git commit -m "feat(web): add v2 motion constants (EASE_BOUNCE/SMOOTH, SPRING_HEAVY, TICKER_DURATION_S)"
```

### Task 1.3: `<DarkSection>` primitive

**Files:**
- Create: `web/components/ui/DarkSection.tsx` + `.test.tsx`
- Modify: `web/components/ui/index.ts` — export

**Step 1:** Test (`DarkSection.test.tsx`):

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DarkSection } from './DarkSection'

describe('DarkSection', () => {
  it('renders children', () => {
    render(<DarkSection><span>x</span></DarkSection>)
    expect(screen.getByText('x')).toBeInTheDocument()
  })

  it('applies dark base background', () => {
    const { container } = render(<DarkSection>x</DarkSection>)
    expect(container.firstChild).toHaveClass('bg-[var(--color-dark-base)]')
  })

  it('applies on-dark text color', () => {
    const { container } = render(<DarkSection>x</DarkSection>)
    expect(container.firstChild).toHaveClass('text-[var(--color-text-on-dark)]')
  })

  it('renders glow overlay when glow prop set', () => {
    const { container } = render(<DarkSection glow>x</DarkSection>)
    const glow = container.querySelector('[data-dark-glow]')
    expect(glow).not.toBeNull()
  })

  it('omits glow overlay by default', () => {
    const { container } = render(<DarkSection>x</DarkSection>)
    expect(container.querySelector('[data-dark-glow]')).toBeNull()
  })

  it('applies cinematic vertical padding by default', () => {
    const { container } = render(<DarkSection>x</DarkSection>)
    expect(container.firstChild).toHaveClass('py-24')
  })

  it('respects size=lg with cinematic padding', () => {
    const { container } = render(<DarkSection size="lg">x</DarkSection>)
    expect(container.firstChild).toHaveClass('py-32')
  })
})
```

**Step 2:** Run, expect FAIL.

**Step 3:** Implementation:

```tsx
// web/components/ui/DarkSection.tsx
import type { ReactNode } from 'react'

type DarkSize = 'md' | 'lg'

interface Props {
  children: ReactNode
  size?: DarkSize
  glow?: boolean
  className?: string
  as?: 'section' | 'div' | 'header' | 'footer'
}

const sizeClass: Record<DarkSize, string> = {
  md: 'py-24',
  lg: 'py-32',
}

export function DarkSection({
  children,
  size = 'md',
  glow = false,
  className = '',
  as: Tag = 'section',
}: Props) {
  return (
    <Tag
      className={`relative overflow-hidden bg-[var(--color-dark-base)] text-[var(--color-text-on-dark)] ${sizeClass[size]} ${className}`}
    >
      {glow && (
        <div
          aria-hidden="true"
          data-dark-glow
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--gradient-dark-glow)' }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </Tag>
  )
}
```

**Step 4:** Run tests — expect PASS.

**Step 5:** Update `web/components/ui/index.ts` — add `export { DarkSection } from './DarkSection'`.

**Step 6:** Commit:
```bash
git add web/components/ui/DarkSection.tsx web/components/ui/DarkSection.test.tsx web/components/ui/index.ts
git commit -m "feat(web): add DarkSection primitive"
```

### Task 1.4: `<Sticker>` primitive

**Files:**
- Create: `web/components/ui/Sticker.tsx` + `.test.tsx`
- Modify: `web/components/ui/index.ts`

**Step 1:** Test:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sticker } from './Sticker'

describe('Sticker', () => {
  it('renders text', () => {
    render(<Sticker>Хит</Sticker>)
    expect(screen.getByText('Хит')).toBeInTheDocument()
  })

  it('uses accent variant by default', () => {
    const { container } = render(<Sticker>x</Sticker>)
    expect(container.firstChild).toHaveClass('bg-[var(--color-accent)]')
  })

  it('uses brand variant', () => {
    const { container } = render(<Sticker variant="brand">x</Sticker>)
    expect(container.firstChild).toHaveClass('bg-[var(--gradient-brand-deep)]')
  })

  it('uses dark variant', () => {
    const { container } = render(<Sticker variant="dark">x</Sticker>)
    expect(container.firstChild).toHaveClass('bg-[var(--color-dark-base)]')
  })

  it('uses success variant', () => {
    const { container } = render(<Sticker variant="success">x</Sticker>)
    expect(container.firstChild).toHaveClass('bg-[var(--color-stock-success)]')
  })

  it('applies wobble class when wobble prop set', () => {
    const { container } = render(<Sticker wobble>x</Sticker>)
    expect(container.firstChild).toHaveClass('animate-sticker-wobble')
  })
})
```

**Step 2:** Run, expect FAIL.

**Step 3:** Implementation:

```tsx
// web/components/ui/Sticker.tsx
import type { ReactNode } from 'react'

type StickerVariant = 'accent' | 'brand' | 'dark' | 'success'

interface Props {
  children: ReactNode
  variant?: StickerVariant
  wobble?: boolean
  className?: string
}

const variantClass: Record<StickerVariant, string> = {
  accent: 'bg-[var(--color-accent)] text-white',
  brand: 'bg-[var(--gradient-brand-deep)] text-[var(--color-text-on-brand)]',
  dark: 'bg-[var(--color-dark-base)] text-[var(--color-text-on-dark)]',
  success: 'bg-[var(--color-stock-success)] text-white',
}

export function Sticker({
  children,
  variant = 'accent',
  wobble = false,
  className = '',
}: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[length:var(--text-micro)] font-bold uppercase tracking-wider shadow-[var(--shadow-md)] -rotate-3 ${variantClass[variant]} ${wobble ? 'animate-sticker-wobble' : ''} ${className}`}
    >
      {children}
    </span>
  )
}
```

**Step 4:** Add wobble keyframe to `globals.css`:

```css
@keyframes sticker-wobble {
  0%, 100% { transform: rotate(-3deg); }
  50%      { transform: rotate(-1deg); }
}
.animate-sticker-wobble {
  animation: sticker-wobble 4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .animate-sticker-wobble { animation: none; }
}
```

**Step 5:** Run tests — expect PASS.

**Step 6:** Update barrel; commit:
```bash
git add web/components/ui/Sticker.tsx web/components/ui/Sticker.test.tsx web/components/ui/index.ts web/app/globals.css
git commit -m "feat(web): add Sticker primitive with accent/brand/dark/success variants + wobble"
```

### Task 1.5: `<Ticker>` primitive

**Files:**
- Create: `web/components/ui/Ticker.tsx` + `.test.tsx`
- Modify: `web/components/ui/index.ts`
- Modify: `web/app/globals.css` — add `ticker-scroll` keyframe

**Step 1:** Test:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Ticker } from './Ticker'

describe('Ticker', () => {
  const items = ['Доставка по России', 'Безопасные реактивы', '17+ опытов']

  it('renders all items at least once (visible track)', () => {
    render(<Ticker items={items} />)
    items.forEach((item) => {
      // Items are duplicated in the DOM for the marquee illusion;
      // assert each appears at least once.
      expect(screen.getAllByText(item).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('duplicates items in the DOM for seamless loop', () => {
    render(<Ticker items={items} />)
    // Each item should be rendered twice (original + clone for seamless loop)
    expect(screen.getAllByText('Доставка по России').length).toBe(2)
  })

  it('renders nothing when items empty', () => {
    const { container } = render(<Ticker items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('applies accent surface by default', () => {
    const { container } = render(<Ticker items={items} />)
    expect(container.firstChild).toHaveClass('bg-[var(--color-accent)]')
  })

  it('applies dark surface when surface=dark', () => {
    const { container } = render(<Ticker items={items} surface="dark" />)
    expect(container.firstChild).toHaveClass('bg-[var(--color-dark-base)]')
  })
})
```

**Step 2:** Run, expect FAIL.

**Step 3:** Implementation:

```tsx
// web/components/ui/Ticker.tsx
type TickerSurface = 'accent' | 'dark' | 'soft'

interface Props {
  items: string[]
  surface?: TickerSurface
  className?: string
}

const surfaceClass: Record<TickerSurface, string> = {
  accent: 'bg-[var(--color-accent)] text-white',
  dark: 'bg-[var(--color-dark-base)] text-[var(--color-text-on-dark)]',
  soft: 'bg-[var(--color-surface-soft)] text-[var(--color-brand-text)]',
}

export function Ticker({ items, surface = 'accent', className = '' }: Props) {
  if (items.length === 0) return null
  // Duplicate the items so the marquee can loop seamlessly.
  const doubled = [...items, ...items]
  return (
    <div
      className={`relative overflow-hidden ${surfaceClass[surface]} ${className}`}
    >
      <div className="animate-ticker-scroll flex whitespace-nowrap py-2 hover:[animation-play-state:paused]">
        {doubled.map((item, i) => (
          <span
            key={i}
            className="mx-8 inline-flex items-center text-[length:var(--text-small)] font-medium"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
```

**Step 4:** Add CSS keyframe:

```css
@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.animate-ticker-scroll {
  animation: ticker-scroll 30s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .animate-ticker-scroll { animation: none; }
}
```

**Step 5:** Run, expect PASS. Update barrel.

**Step 6:** Commit:
```bash
git add web/components/ui/Ticker.tsx web/components/ui/Ticker.test.tsx web/components/ui/index.ts web/app/globals.css
git commit -m "feat(web): add Ticker primitive (infinite-scroll marquee)"
```

### Task 1.6: `<BigNumber>` primitive

**Files:**
- Create: `web/components/ui/BigNumber.tsx` + `.test.tsx`
- Modify: `web/components/ui/index.ts`

**Step 1:** Test:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BigNumber } from './BigNumber'

describe('BigNumber', () => {
  it('renders value and label', () => {
    render(<BigNumber value={48} label="наборов" />)
    expect(screen.getByText('48')).toBeInTheDocument()
    expect(screen.getByText('наборов')).toBeInTheDocument()
  })

  it('renders custom prefix/suffix', () => {
    render(<BigNumber value={15000} suffix="+" label="семей" />)
    expect(screen.getByText('15000+')).toBeInTheDocument()
  })

  it('renders mega-display value class', () => {
    const { container } = render(<BigNumber value={1} label="x" />)
    const v = container.querySelector('[data-bignumber-value]')
    expect(v?.className).toContain('text-[length:var(--text-mega)]')
  })

  it('renders accent underline beneath value', () => {
    const { container } = render(<BigNumber value={1} label="x" />)
    const u = container.querySelector('[data-bignumber-underline]')
    expect(u).not.toBeNull()
  })
})
```

**Step 2:** Run, expect FAIL.

**Step 3:** Implementation. Note the count-up is a separate concern handled via a small client wrapper later — `<BigNumber>` itself is server-safe.

```tsx
// web/components/ui/BigNumber.tsx
interface Props {
  value: number | string
  label: string
  suffix?: string
  prefix?: string
  className?: string
}

export function BigNumber({
  value,
  label,
  suffix = '',
  prefix = '',
  className = '',
}: Props) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span
        data-bignumber-value
        className="font-[var(--font-display)] tracking-[var(--tracking-mega)] leading-[0.9] text-[length:var(--text-mega)] text-[var(--color-text-on-dark)]"
      >
        {prefix}
        {value}
        {suffix}
      </span>
      <span
        data-bignumber-underline
        aria-hidden="true"
        className="h-[3px] w-12 rounded-full bg-[var(--color-accent)]"
      />
      <span className="text-[length:var(--text-small)] font-medium uppercase tracking-wider text-[var(--color-text-muted-on-dark)]">
        {label}
      </span>
    </div>
  )
}
```

**Step 4:** Run, expect PASS. Update barrel.

**Step 5:** Commit:
```bash
git add web/components/ui/BigNumber.tsx web/components/ui/BigNumber.test.tsx web/components/ui/index.ts
git commit -m "feat(web): add BigNumber primitive (mega numeric stat callout)"
```

### Task 1.7 (optional): `<BigNumber count-up>` client wrapper

If we want viewport-triggered count-up animation, build a thin client wrapper (`<AnimatedBigNumber>`) that wraps `<BigNumber>` and animates `value` from 0 → target on viewport-enter. Otherwise skip this task; static `<BigNumber>` is fine for v1 of the manifesto.

Defer until Stage 2 needs it. If skipped, the manifesto numbers are static — still impactful.

---

## Stage 2 — Homepage v2

**Goal:** Replace homepage hero with dark cinematic version, add Manifesto section, push catalog grid density, dark «Как это работает», dark pre-footer. Visual zebra-striping locked in.

### Task 2.1: ProductCard sticker upgrade

**Files:**
- Modify: `web/components/ProductCard.tsx`
- Modify: `web/components/ProductCard.test.tsx`

**Spec:** Add sticker badges to the card. Three rules:
- If `compareAtPriceRub > priceRub` → render `<Sticker variant="accent">−N%</Sticker>` in top-right of image area.
- If product is one of the top 3 by `sortOrder` (or has a `mark === 'HIT'` if you decide to surface that) → render `<Sticker variant="brand">Хит</Sticker>` in top-left.
- Tighten card padding: from `p-4` to `p-3` on the card wrapper, image area gets `p-3` not `p-4`.

**Tests to add:**
- Discount sticker rendered when compare-at higher.
- No sticker when compare-at null.
- Brand sticker positioning class verified.

Existing 14 tests stay green. Add ~3 new ones → 17 total.

Commit: `feat(web): ProductCard with sticker badges + tighter density`.

### Task 2.2: Hero v2 — DarkSection rebuild

**Files:**
- Modify: `web/components/marketing/Hero.tsx`
- Modify: `web/components/marketing/Hero.test.tsx`
- Modify: `web/app/[locale]/(public)/page.tsx` — Hero call site (props may change)

**Spec:**
- Hero is now intrinsically a `<DarkSection size="lg" glow>`.
- Two-column 60/40, mega H1 with one orange-emphasis word (parse via `emphasisWord` prop or accept JSX), eyebrow above, lead muted-on-dark, two CTAs (primary purple-deep gradient, secondary orange-outlined).
- Hero product card area: single big product photo on dark elevated card with brand-purple gradient halo, 3-4 floating sticker badges with rotation, subtle scroll parallax (existing `<HeroProductStack>` extended).
- `<Ticker surface="accent">` strip pinned to bottom of hero.
- Replace existing light Hero entirely.

Tests update to assert dark surface + ticker presence + sticker count.

Commit: `feat(web): Hero v2 — dark cinematic with mega-display + ticker strip`.

### Task 2.3: Manifesto section

**Files:**
- Create: `web/components/marketing/Manifesto.tsx` + `.test.tsx`
- Modify: `web/components/marketing/index.ts`

**Spec:** A `<DarkSection size="lg" glow>` containing a 4-column BigNumber grid + a centered manifesto paragraph above the grid. Default values: `[{value: 9, label: 'лет на рынке'}, {value: '15000+', label: 'счастливых семей'}, {value: 48, label: 'наборов и реактивов'}, {value: 161, label: 'опыт в одном наборе'}]`. Props accept overrides.

Tests: renders 4 BigNumbers, paragraph, dark surface.

Commit: `feat(web): add Manifesto marketing component`.

### Task 2.4: Homepage section flow rebuild

**Files:**
- Modify: `web/app/[locale]/(public)/page.tsx` — restructure section order + types

**Spec:** New section order:
1. `<Hero ...>` (dark, owns its own section)
2. `<Section size="lg">` Бестселлеры — denser grid 2/3/4/5 cols
3. `<Manifesto />` (dark)
4. `<Section size="lg">` Каталог по интересам — asymmetric tile masonry
5. `<DarkSection size="lg" glow>` Как это работает — 3 mega-numeral steps
6. `<Section size="lg">` Отзывы — denser grid (3 → up to 6)
7. `<Section size="lg">` FAQ
8. `<PreFooterCta />` (already DarkSection per Task 2.5)

Existing CategoryTile gets `span={1|2}` support; HowItWorksStep renders mega numerals in orange when inside DarkSection.

Existing test on the page (async + revalidate=60) stays green. No new test additions on the page itself.

Commit: `feat(web): homepage v2 section flow — zebra-stripe + Manifesto + dense grids`.

### Task 2.5: PreFooterCta v2 — DarkSection

**Files:**
- Modify: `web/components/marketing/PreFooterCta.tsx` + `.test.tsx`

**Spec:** Wrap in `<DarkSection size="lg" glow>`. Mega claim. Single confident orange-gradient pill button with shadow-glow.

Test: renders title + cta + dark surface.

Commit: `feat(web): PreFooterCta v2 with DarkSection + orange CTA`.

### Task 2.6: CategoryTile asymmetric span + product count

**Files:**
- Modify: `web/components/marketing/CategoryTile.tsx` + `.test.tsx`

**Spec:** New prop `span?: 1 | 2`. When `span === 2`, tile takes `md:col-span-2`. Add product-count sticker rendered in top-right of tile (e.g. «29 товаров»). Pulled from a new `productCount` prop.

Tests: span class applied, sticker rendered when count provided.

Commit: `feat(web): CategoryTile asymmetric span + product-count sticker`.

### Task 2.7: HowItWorksStep mega-numeral variant

**Files:**
- Modify: `web/components/marketing/HowItWorksStep.tsx` + `.test.tsx`

**Spec:** Mega numeral renders in orange (`var(--color-accent)`) when inside DarkSection. Add prop `theme?: 'light' | 'dark'`. Default light keeps current behavior.

Tests: theme=dark renders orange numeral.

Commit: `feat(web): HowItWorksStep dark theme variant with orange numerals`.

---

## Stage 3 — Product Detail v2 (Outline)

**Will be expanded into bite-sized tasks before execution.**

3.1 — `<KeyFactsList>` + `extractKeyFacts(product)` helper.
3.2 — `<CharacteristicsTable>` (renders when ≥4 characteristics filled).
3.3 — `<ContentsSection>` (DarkSection «Что внутри», renders when long-description has structured Состав content).
3.4 — Product detail page rebuild — sticky gallery with corner sticker badges, info column with characteristic pills + KeyFactsList, dark «Что внутри» when applicable, restyled related products grid (4 cols), dark pre-footer.
3.5 — `<MobileBuyBar>` orange-gradient button update.
3.6 — Polish + browser smoke at 3 viewports.

Estimated 2 commits.

---

## Stage 4 — Pattern Extraction (Outline, may collapse to 0 commits)

If new components were authored at the right paths during Stages 2–3, no extraction needed. If anything was inlined inside route folders (e.g. inside `(public)/_components/`), move to `web/components/marketing/` or `web/components/product/`.

Estimated 0–1 commits.

---

## Stage 5 — Catalog/Category/Cart/CMS/404 (Outline)

5.1 — Category list — orange marker H1, asymmetric tile masonry, DarkSection pre-footer.
5.2 — Category detail — breadcrumbs + product-count sticker, optional Ticker band, 4–5 col ProductCard grid, DarkSection pre-footer.
5.3 — Cart — orange CTA button, sticker on subtotal, mega Mazzard «Корзина пуста» empty state.
5.4 — CMS pages — orange marker H1s, inline back-to-top sticker on long pages, DarkSection pre-footer.
5.5 — 404 — DarkSection with orange-gradient 404 numeral, MoleculeMotif vivid orange, two CTAs.

Estimated 2–3 commits.

---

## Stage 6 — Header + Footer Touches (Outline)

6.1 — Header promo bar swapped from static text to `<Ticker>`.
6.2 — Active-route underline color flips to `--color-accent` orange.
6.3 — Footer wordmark column gets a decorative orange `<MoleculeMotif>`.

Estimated 1 commit.

---

## Stage 7 — Final Pass (Outline)

7.1 — Re-run Playwright with `--update-snapshots` to refresh all 27 baselines (intentional diffs accepted).
7.2 — Commit new baselines.
7.3 — Manual reduced-motion regression — toggle `prefers-reduced-motion: reduce` and walk through homepage + product detail. Verify no animations run.
7.4 — Lighthouse audit on `/`, `/product/himichka-30`, `/categories`. Targets: Perf ≥90 mobile, A11y 100, BP ≥95, SEO 100. Fix any below-threshold issues (count-up animation, font-loading, dark-section CLS most likely).
7.5 — Update screenshots in any docs.

Estimated 1 commit.

---

## Notes on Plan Granularity

Stages 1 and 2 are bite-sized because they're what we'll execute first and they're highest-risk (foundational + flagship). Stages 3–7 are outlined; each gets expanded into bite-sized tasks immediately before its execution. Avoids stale plan content; lets early-stage learnings shape later tasks.

## Completion Criteria

- All 683 existing vitest tests + ~30 new = ~713 passing.
- 27 Playwright visual baselines refreshed and committed.
- `npm run typecheck`, `npm run lint`, `npm run build` all green.
- Manual browser smoke at 3 viewports on every public route — no broken layouts.
- Reduced-motion regression: no animations running when `prefers-reduced-motion: reduce` set.
- Lighthouse mobile scores hit targets.
- Owner has reviewed homepage + product detail screenshots and approved the v2 vibe.
