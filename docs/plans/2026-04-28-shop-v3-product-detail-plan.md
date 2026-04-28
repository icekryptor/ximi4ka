# Shop v3 — Product Detail Page (Stage 7) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Translate the Лабораторный Журнал v3 vocabulary onto the product detail page (`/product/[slug]`) — the highest-impact conversion surface — replacing 7 v2 product/* components with v3-native equivalents while keeping the existing data flow intact.

**Architecture:** Net-new components in `web/components/product/` with `*LJ.tsx` suffix to coexist with v2 until cutover. Reuse the established v3 primitive set (LabSection, NotebookHeader, GridOverlay, MoleculeMotifLJ, NumberCell, Chip) — no new primitives needed. Section rhythm: cream→ink→ink→cream→cream→ink. Mendeleev cells reappear as a brand signal in the new "characteristics" section. Multi-image gallery wires through the existing `Product.images: ProductImage[]` field.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2, TypeScript, Tailwind 4 (`@theme inline` tokens), Vitest + Testing Library, Playwright (visual regression).

**Source artifacts:**
- Design doc: `ximi4ka/docs/plans/2026-04-28-shop-v3-product-detail-design.md`
- Design system spec: `ximi4ka-shop/design-system/ximi4ka-v3/LABORATORY_JOURNAL.md`
- Stage 0-6 plan (referenced for v3 patterns): `ximi4ka/docs/plans/2026-04-28-shop-v3-lab-journal-plan.md`

**Critical rule (from `web/AGENTS.md`):** Next.js 16.2 has breaking changes vs older versions. Before writing any Next-specific code (route handlers, image, Link, dynamic, server components), check `node_modules/next/dist/docs/` first.

**Stage map (~21 task-commits):**
- Stage 7.0 — Worktree + baseline (1 verification, no commit)
- Stage 7.1 — `extractUseFacts` + `extractGalleryImages` helpers (1 task)
- Stage 7.2–7.9 — 8 net-new LJ components, TDD each (8 tasks)
- Stage 7.10 — Page rewrite + ContentsSection inner pass + MicroTrustRow (3 tasks)
- Stage 7.11 — Playwright visual regression baseline (1 task)
- Stage 7.12 — Delete dead v2 product/* components (1 task)

Each task = 1 commit. At every stage boundary the storefront must build (`npm run build`) and tests must pass (`npm run test`).

---

## Pre-Stage Setup

### Task 7.0: Worktree + baseline

**Files:** none (verification + worktree setup)

**Step 1: Create the Stage 7 worktree from current main**

From repo `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop`:
```bash
git worktree add -b feat/v3-pdp /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp main
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp
npm install   # ~2 min, npm workspaces install
```

**Step 2: Verify baseline passes**

From `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp/web`:
```bash
npm run typecheck   # clean
npm run test 2>&1 | tail -5   # 622 tests pass
npm run build 2>&1 | tail -5   # clean
```

**Step 3: Inspect current state of components we'll touch**

```bash
ls web/components/product/
cat web/components/product/extractKeyFacts.ts
grep -rn 'PriceBlock\|StockPill\|QuantityStepper\|KeyFactsList\|CharacteristicsTable\|MobileBuyBar' web/{app,components}/ 2>/dev/null | grep -v '.test.' | head -20
```

Note which v2 components have non-page consumers (e.g. CartDrawer might use PriceBlock). The rewrite task (7.10) handles the page; if any other consumer uses a v2 product component, surface it in 7.12 cleanup.

**No commit** — verification only.

---

## Stage 7.1 — Data extraction helpers

### Task 7.1: Add `extractUseFacts` + `extractGalleryImages` helpers (TDD)

**Files:**
- Modify: `web/components/product/extractKeyFacts.ts` (add new exports — keep existing `extractKeyFacts` untouched)
- Modify: `web/components/product/extractKeyFacts.test.ts` (add new test cases)

**Step 1: Failing test**

Append to `web/components/product/extractKeyFacts.test.ts`:
```ts
import { extractUseFacts, extractGalleryImages } from './extractKeyFacts'
import type { Product, ProductImage } from '@ximi4ka-shop/shared'

describe('extractUseFacts', () => {
  it('returns up to 4 use-facts in priority order', () => {
    const chars = {
      'Возраст': '10+',
      'Время опыта': '5–20 минут',
      'Срок изготовления': '1 день',
      'Гарантия': '12 месяцев',
      'Кол-во гнезд': '12',  // not a use-fact, ignored
    }
    const result = extractUseFacts(chars)
    expect(result).toEqual([
      { key: 'age',     label: 'возраст',  big: '10+',         bottomLeft: 'от 10 лет',     bottomRight: 'рекомендуется' },
      { key: 'time',    label: 'время',    big: '5–20',        bottomLeft: 'минут',          bottomRight: 'на один опыт' },
      { key: 'lead',    label: 'срок',     big: '1 день',      bottomLeft: 'готовность',     bottomRight: 'к отправке' },
      { key: 'warranty',label: 'гарантия', big: '12 мес',      bottomLeft: 'на компоненты',  bottomRight: 'возврат 30 дней' },
    ])
  })

  it('hides individual cells when characteristic is missing', () => {
    const chars = { 'Возраст': '8+', 'Гарантия': '6 месяцев' }
    const result = extractUseFacts(chars)
    expect(result).toHaveLength(2)
    expect(result.map(f => f.key)).toEqual(['age', 'warranty'])
  })

  it('returns empty array when no use-facts present', () => {
    expect(extractUseFacts({ 'Кол-во гнезд': '12' })).toEqual([])
  })
})

describe('extractGalleryImages', () => {
  const mkImg = (sortOrder: number, url: string): ProductImage => ({
    id: `img-${sortOrder}`, productId: 'p', url, alt: '', sortOrder,
  })

  it('returns images sorted by sortOrder ascending', () => {
    const product = {
      images: [mkImg(2, 'b.jpg'), mkImg(0, 'a.jpg'), mkImg(1, 'mid.jpg')],
    } as unknown as Product
    expect(extractGalleryImages(product).map(i => i.url)).toEqual(['a.jpg', 'mid.jpg', 'b.jpg'])
  })

  it('returns empty array when product has no images', () => {
    expect(extractGalleryImages({ images: [] } as unknown as Product)).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp/web
npx vitest run components/product/extractKeyFacts.test.ts
```
Expected: FAIL — exports don't exist.

**Step 3: Add the helpers to `extractKeyFacts.ts`**

Append (preserve existing `extractKeyFacts` and `PRIORITY_KEYS`):
```ts
import type { Product } from '@ximi4ka-shop/shared'

export interface UseFact {
  key: 'age' | 'time' | 'lead' | 'warranty'
  label: string
  big: string
  bottomLeft: string
  bottomRight: string
}

const USE_FACT_DEFINITIONS: ReadonlyArray<{
  key: UseFact['key']
  label: string
  bottomLeft: string
  bottomRight: string
  charKeys: readonly string[]
}> = [
  { key: 'age',      label: 'возраст',  bottomLeft: 'от 10 лет',    bottomRight: 'рекомендуется',     charKeys: ['Возраст', 'Age'] },
  { key: 'time',     label: 'время',    bottomLeft: 'минут',         bottomRight: 'на один опыт',     charKeys: ['Время опыта', 'Время'] },
  { key: 'lead',     label: 'срок',     bottomLeft: 'готовность',    bottomRight: 'к отправке',       charKeys: ['Срок изготовления', 'Срок'] },
  { key: 'warranty', label: 'гарантия', bottomLeft: 'на компоненты', bottomRight: 'возврат 30 дней',  charKeys: ['Гарантия'] },
]

/**
 * Extracts up to 4 "use-facts" (age, time, lead, warranty) for the v3
 * Characteristics section's NumberCell row. Each cell hides individually
 * when its characteristic is missing — the row auto-collapses.
 */
export function extractUseFacts(
  characteristics: Record<string, string>,
): UseFact[] {
  const out: UseFact[] = []
  for (const def of USE_FACT_DEFINITIONS) {
    const value = def.charKeys.map((k) => characteristics[k]).find(Boolean)
    if (value) {
      out.push({
        key: def.key,
        label: def.label,
        big: value,
        bottomLeft: def.bottomLeft,
        bottomRight: def.bottomRight,
      })
    }
  }
  return out
}

/**
 * Returns product images sorted by sortOrder ascending. Empty array when
 * the product has no images — caller is responsible for fallback rendering.
 */
export function extractGalleryImages(product: Product): Product['images'] {
  return [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)
}
```

**Step 4: Run test to verify pass**

```bash
npx vitest run components/product/extractKeyFacts.test.ts
```
Expected: PASS (all tests, including original `extractKeyFacts` ones)

**Step 5: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp
git add web/components/product/extractKeyFacts.ts web/components/product/extractKeyFacts.test.ts
git commit -m "feat(v3-pdp): add extractUseFacts + extractGalleryImages helpers"
```

---

## Stage 7.2 — `<ProductPriceBlockLJ>` (TDD)

### Task 7.2

**Files:**
- Create: `web/components/product/ProductPriceBlockLJ.tsx`
- Create: `web/components/product/ProductPriceBlockLJ.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductPriceBlockLJ } from './ProductPriceBlockLJ'

describe('<ProductPriceBlockLJ>', () => {
  it('renders price formatted ru-RU with mono ₽ postfix', () => {
    render(<ProductPriceBlockLJ priceRub={3399} />)
    // ru-RU formatting: "3 399"
    expect(screen.getByText(/3.{0,3}399/)).toBeInTheDocument()
    expect(screen.getByText('₽')).toBeInTheDocument()
  })

  it('renders compare-at strikethrough when higher than price', () => {
    render(<ProductPriceBlockLJ priceRub={3399} compareAtPriceRub={5000} />)
    const compare = screen.getByText(/5.{0,3}000/)
    expect(compare.className).toContain('line-through')
  })

  it('renders brand-purple discount chip when discount > 0', () => {
    render(<ProductPriceBlockLJ priceRub={3399} compareAtPriceRub={5000} />)
    // 1 - 3399/5000 = 0.32 → 32%
    const chip = screen.getByText(/−32%/)
    expect(chip).toBeInTheDocument()
    expect(chip.className).toContain('var(--color-lj-brand)')
  })

  it('omits compare-at and chip when no discount', () => {
    render(<ProductPriceBlockLJ priceRub={3399} compareAtPriceRub={null} />)
    expect(screen.queryByText(/line-through/)).toBeNull()
    expect(screen.queryByText(/−.*%/)).toBeNull()
  })
})
```

**Step 2: Run — fail**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp/web
npx vitest run components/product/ProductPriceBlockLJ.test.tsx
```

**Step 3: Implement**

```tsx
interface Props {
  priceRub: number
  compareAtPriceRub?: number | null
}

function discountPercent(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null
  return Math.round((1 - price / compareAt) * 100)
}

function formatRub(rub: number): string {
  return rub.toLocaleString('ru-RU').replace(/,/g, ' ')
}

export function ProductPriceBlockLJ({ priceRub, compareAtPriceRub }: Props) {
  const showCompare = compareAtPriceRub != null && compareAtPriceRub > priceRub
  const discount = discountPercent(priceRub, compareAtPriceRub)
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <span className="font-[var(--font-lj-display)] font-[900] text-[clamp(2.5rem,4vw,3.5rem)] leading-none tracking-[-0.04em] text-[var(--color-lj-ink)]">
        {formatRub(priceRub)}
        <span className="font-[var(--font-lj-mono)] font-normal text-base ml-1.5 opacity-70">₽</span>
      </span>
      {showCompare && (
        <span className="font-[var(--font-lj-mono)] text-sm text-[var(--color-lj-ink)] opacity-60 line-through">
          {formatRub(compareAtPriceRub!)}
        </span>
      )}
      {discount != null && (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full font-[var(--font-lj-mono)] text-[0.6875rem] uppercase tracking-[0.08em] bg-[var(--color-lj-brand)] text-[var(--color-lj-bone)]">
          −{discount}%
        </span>
      )}
    </div>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/product/ProductPriceBlockLJ.test.tsx  # green
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp
git add web/components/product/ProductPriceBlockLJ.tsx web/components/product/ProductPriceBlockLJ.test.tsx
git commit -m "feat(v3-pdp): add ProductPriceBlockLJ"
```

---

## Stage 7.3 — `<StockChip>` (TDD)

### Task 7.3

**Files:**
- Create: `web/components/product/StockChip.tsx`
- Create: `web/components/product/StockChip.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StockChip } from './StockChip'

describe('<StockChip>', () => {
  it('renders in-stock with green dot + "В наличии" label', () => {
    const { container } = render(<StockChip status="in_stock" />)
    expect(screen.getByText('В наличии')).toBeInTheDocument()
    const dot = container.querySelector('span > span')  // first inner span = dot
    expect(dot?.className).toMatch(/bg-(green|emerald|\[var\(--color-stock-success\))/)
  })

  it('renders preorder with amber dot + "Под заказ" label', () => {
    render(<StockChip status="preorder" />)
    expect(screen.getByText('Под заказ')).toBeInTheDocument()
  })

  it('renders out-of-stock with red dot + "Нет в наличии" label', () => {
    render(<StockChip status="out_of_stock" />)
    expect(screen.getByText('Нет в наличии')).toBeInTheDocument()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
import type { StockStatus } from '@ximi4ka-shop/shared'

interface Props { status: StockStatus }

const CONFIG: Record<StockStatus, { label: string; dotClass: string }> = {
  in_stock: {
    label: 'В наличии',
    dotClass: 'bg-[var(--color-stock-success)]',
  },
  preorder: {
    label: 'Под заказ',
    dotClass: 'bg-[var(--color-stock-warning)]',
  },
  out_of_stock: {
    label: 'Нет в наличии',
    dotClass: 'bg-[var(--color-stock-danger)]',
  },
}

export function StockChip({ status }: Props) {
  const cfg = CONFIG[status]
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 border border-[var(--color-lj-ink)] rounded-full font-[var(--font-lj-mono)] text-[0.6875rem] lowercase tracking-[0.04em] text-[var(--color-lj-ink)] bg-transparent">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/product/StockChip.test.tsx  # green
git add web/components/product/StockChip.tsx web/components/product/StockChip.test.tsx
git commit -m "feat(v3-pdp): add StockChip with status-colored dot"
```

---

## Stage 7.4 — `<QuantityStepperLJ>` (TDD)

### Task 7.4

**Files:**
- Create: `web/components/product/QuantityStepperLJ.tsx`
- Create: `web/components/product/QuantityStepperLJ.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuantityStepperLJ } from './QuantityStepperLJ'

describe('<QuantityStepperLJ>', () => {
  it('renders current quantity', () => {
    render(<QuantityStepperLJ value={3} onChange={() => {}} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('+ button calls onChange with value + 1', () => {
    const onChange = vi.fn()
    render(<QuantityStepperLJ value={2} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /increase/i }))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('− button calls onChange with value − 1, clamped at min=1', () => {
    const onChange = vi.fn()
    render(<QuantityStepperLJ value={1} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /decrease/i }))
    expect(onChange).toHaveBeenCalledWith(1)  // clamped, not 0
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
'use client'

interface Props {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function QuantityStepperLJ({ value, onChange, min = 1, max = 99 }: Props) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  return (
    <div className="inline-flex items-center border border-[var(--color-lj-ink)] rounded-full overflow-hidden">
      <button
        type="button"
        onClick={dec}
        aria-label="decrease quantity"
        className="px-4 py-2 font-[var(--font-lj-mono)] text-base hover:bg-[var(--color-lj-ink)] hover:text-[var(--color-lj-bone)] transition-colors"
      >
        −
      </button>
      <span className="px-4 py-2 font-[var(--font-lj-display)] font-[700] min-w-[3ch] text-center">
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        aria-label="increase quantity"
        className="px-4 py-2 font-[var(--font-lj-mono)] text-base hover:bg-[var(--color-lj-ink)] hover:text-[var(--color-lj-bone)] transition-colors"
      >
        +
      </button>
    </div>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/product/QuantityStepperLJ.test.tsx  # green
git add web/components/product/QuantityStepperLJ.tsx web/components/product/QuantityStepperLJ.test.tsx
git commit -m "feat(v3-pdp): add QuantityStepperLJ"
```

---

## Stage 7.5 — `<KeyFactsListLJ>` (TDD)

### Task 7.5

**Files:**
- Create: `web/components/product/KeyFactsListLJ.tsx`
- Create: `web/components/product/KeyFactsListLJ.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KeyFactsListLJ } from './KeyFactsListLJ'

describe('<KeyFactsListLJ>', () => {
  it('renders 4 mono rows with index/label/value', () => {
    const facts = [
      { label: 'Возраст', value: '10+' },
      { label: 'Кол-во гнезд', value: '12' },
    ]
    render(<KeyFactsListLJ facts={facts} />)
    expect(screen.getByText(/01\s*\/\s*Возраст/)).toBeInTheDocument()
    expect(screen.getByText(/02\s*\/\s*Кол-во гнезд/)).toBeInTheDocument()
    expect(screen.getByText('10+')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders nothing when facts array is empty', () => {
    const { container } = render(<KeyFactsListLJ facts={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
interface Fact { label: string; value: string }
interface Props { facts: Fact[] }

export function KeyFactsListLJ({ facts }: Props) {
  if (facts.length === 0) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <ul className="list-none p-0 m-0 flex flex-col gap-2 border-t border-[var(--color-lj-rule)] pt-4">
      {facts.map((f, i) => (
        <li
          key={f.label}
          className="grid grid-cols-[minmax(8rem,auto)_1fr] items-baseline gap-3 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em]"
        >
          <span className="text-[var(--color-lj-ink)] opacity-70 whitespace-nowrap">
            {pad(i + 1)} / {f.label}
          </span>
          <span className="font-[var(--font-lj-display)] font-[700] text-[0.95rem] text-[var(--color-lj-ink)] tracking-[-0.02em] normal-case">
            {f.value}
          </span>
        </li>
      ))}
    </ul>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/product/KeyFactsListLJ.test.tsx  # green
git add web/components/product/KeyFactsListLJ.tsx web/components/product/KeyFactsListLJ.test.tsx
git commit -m "feat(v3-pdp): add KeyFactsListLJ mono spec rows"
```

---

## Stage 7.6 — `<CharacteristicsCellRow>` (TDD)

### Task 7.6

**Files:**
- Create: `web/components/product/CharacteristicsCellRow.tsx`
- Create: `web/components/product/CharacteristicsCellRow.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CharacteristicsCellRow } from './CharacteristicsCellRow'

describe('<CharacteristicsCellRow>', () => {
  it('renders one NumberCell per use-fact', () => {
    const facts = [
      { key: 'age' as const, label: 'возраст', big: '10+', bottomLeft: 'от 10 лет', bottomRight: 'рекомендуется' },
      { key: 'time' as const, label: 'время', big: '5–20', bottomLeft: 'минут', bottomRight: 'на один опыт' },
    ]
    const { container } = render(<CharacteristicsCellRow facts={facts} />)
    expect(container.querySelectorAll('.lj-num-cell').length).toBe(2)
  })

  it('renders nothing when facts array is empty', () => {
    const { container } = render(<CharacteristicsCellRow facts={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
import { NumberCell } from '@/components/ui/NumberCell'
import type { UseFact } from './extractKeyFacts'

interface Props { facts: UseFact[] }

export function CharacteristicsCellRow({ facts }: Props) {
  if (facts.length === 0) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {facts.map((f, i) => (
        <NumberCell
          key={f.key}
          index={pad(i + 1)}
          topLabel={f.label}
          big={f.big}
          bottomLeft={f.bottomLeft}
          bottomRight={f.bottomRight}
        />
      ))}
    </div>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/product/CharacteristicsCellRow.test.tsx  # green
git add web/components/product/CharacteristicsCellRow.tsx web/components/product/CharacteristicsCellRow.test.tsx
git commit -m "feat(v3-pdp): add CharacteristicsCellRow composing NumberCells from use-facts"
```

---

## Stage 7.7 — `<CharacteristicsTableLJ>` (TDD)

### Task 7.7

**Files:**
- Create: `web/components/product/CharacteristicsTableLJ.tsx`
- Create: `web/components/product/CharacteristicsTableLJ.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CharacteristicsTableLJ } from './CharacteristicsTableLJ'

describe('<CharacteristicsTableLJ>', () => {
  it('renders one row per characteristic', () => {
    const chars = { 'Возраст': '10+', 'Кол-во гнезд': '12', 'Объем': '50 мл' }
    const { container } = render(<CharacteristicsTableLJ characteristics={chars} />)
    expect(container.querySelectorAll('[data-char-row]').length).toBe(3)
  })

  it('renders label left + value right', () => {
    render(<CharacteristicsTableLJ characteristics={{ 'Возраст': '10+' }} />)
    expect(screen.getByText('Возраст')).toBeInTheDocument()
    expect(screen.getByText('10+')).toBeInTheDocument()
  })

  it('renders nothing when characteristics object is empty', () => {
    const { container } = render(<CharacteristicsTableLJ characteristics={{}} />)
    expect(container.firstChild).toBeNull()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
interface Props {
  characteristics: Record<string, string>
}

export function CharacteristicsTableLJ({ characteristics }: Props) {
  const entries = Object.entries(characteristics)
  if (entries.length === 0) return null
  return (
    <dl className="flex flex-col">
      {entries.map(([label, value], i) => (
        <div
          key={label}
          data-char-row
          className={`grid grid-cols-[minmax(10rem,1fr)_2fr] items-baseline gap-6 py-3 ${
            i < entries.length - 1 ? 'border-b border-[var(--color-lj-rule-on-ink)]' : ''
          }`}
        >
          <dt className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] text-[var(--color-lj-bone-mute)]">
            {label}
          </dt>
          <dd className="font-[var(--font-lj-body)] text-[1.0625rem] text-[var(--color-lj-bone)]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/product/CharacteristicsTableLJ.test.tsx  # green
git add web/components/product/CharacteristicsTableLJ.tsx web/components/product/CharacteristicsTableLJ.test.tsx
git commit -m "feat(v3-pdp): add CharacteristicsTableLJ spec sheet on ink"
```

---

## Stage 7.8 — `<ProductHeroImage>` with multi-image gallery (TDD, client component)

### Task 7.8

**Files:**
- Create: `web/components/product/ProductHeroImage.tsx`
- Create: `web/components/product/ProductHeroImage.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProductHeroImage } from './ProductHeroImage'
import type { ProductImage } from '@ximi4ka-shop/shared'

const mkImg = (i: number, url: string): ProductImage => ({
  id: `img-${i}`, productId: 'p', url, alt: `Image ${i}`, sortOrder: i,
})

describe('<ProductHeroImage>', () => {
  it('renders single image without thumbnails when 1 image', () => {
    const { container } = render(
      <ProductHeroImage images={[mkImg(0, 'a.jpg')]} cornerMark="arr. 01" alt="x" />
    )
    expect(container.querySelectorAll('img').length).toBe(1)
    expect(container.querySelector('[data-thumbnails]')).toBeNull()
  })

  it('renders thumbnails when 2+ images', () => {
    const images = [mkImg(0, 'a.jpg'), mkImg(1, 'b.jpg'), mkImg(2, 'c.jpg')]
    const { container } = render(
      <ProductHeroImage images={images} cornerMark="arr. 01" alt="x" />
    )
    const thumbs = container.querySelector('[data-thumbnails]')
    expect(thumbs).not.toBeNull()
    expect(thumbs?.querySelectorAll('button').length).toBe(3)
  })

  it('clicking a thumbnail swaps the main image', () => {
    const images = [mkImg(0, 'a.jpg'), mkImg(1, 'b.jpg')]
    const { container } = render(
      <ProductHeroImage images={images} cornerMark="arr. 01" alt="x" />
    )
    const main = container.querySelector('[data-main-image] img') as HTMLImageElement
    expect(main.src).toContain('a.jpg')
    const secondThumb = container.querySelectorAll('[data-thumbnails] button')[1] as HTMLButtonElement
    fireEvent.click(secondThumb)
    const updatedMain = container.querySelector('[data-main-image] img') as HTMLImageElement
    expect(updatedMain.src).toContain('b.jpg')
  })

  it('renders the corner mark', () => {
    render(<ProductHeroImage images={[mkImg(0, 'a.jpg')]} cornerMark="arr. P-01" alt="x" />)
    expect(screen.getByText('arr. P-01')).toBeInTheDocument()
  })

  it('renders nothing when images array is empty', () => {
    const { container } = render(<ProductHeroImage images={[]} cornerMark="x" alt="x" />)
    expect(container.firstChild).toBeNull()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

Read Next.js 16 image docs first if unsure:
```bash
find web/node_modules/next/dist/docs -iname '*image*' -type f | head
```

Then:
```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { ProductImage } from '@ximi4ka-shop/shared'

interface Props {
  images: ProductImage[]
  cornerMark: string
  alt: string
  hoverFormula?: string
}

export function ProductHeroImage({ images, cornerMark, alt, hoverFormula }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  if (images.length === 0) return null
  const active = images[activeIdx]
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="callout-host group/img flex flex-col gap-4">
      <div
        data-main-image
        className="relative aspect-[4/5] bg-[var(--color-lj-cream-shade)] border border-[var(--color-lj-rule)] overflow-hidden transition-[border-color] duration-500 hover:border-[var(--color-lj-ink)]"
      >
        <span className="absolute top-3.5 left-3.5 z-[2] font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] text-[var(--color-lj-ink)] opacity-55">
          {cornerMark}
        </span>
        <Image
          src={active.url}
          alt={active.alt || alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          priority={activeIdx === 0}
        />
        {hoverFormula && (
          <div className="absolute bottom-3.5 left-3.5 z-[2] font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] tracking-[0.04em] text-[var(--color-lj-ink)] bg-[var(--color-lj-cream)] px-2.5 py-1.5 border border-[var(--color-lj-ink)] opacity-0 translate-y-2 transition-[opacity,transform] duration-500 group-hover/img:opacity-100 group-hover/img:translate-y-0">
            {hoverFormula}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div data-thumbnails className="flex gap-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-label={`Show image ${i + 1}`}
              className={`relative aspect-square w-20 bg-[var(--color-lj-cream-shade)] border overflow-hidden transition-[border-color] duration-300 ${
                i === activeIdx ? 'border-[var(--color-lj-ink)]' : 'border-[var(--color-lj-rule)]'
              }`}
            >
              <span className="absolute top-1 left-1 z-[2] font-[var(--font-lj-mono)] text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--color-lj-ink)] opacity-70">
                arr. {pad(i + 1)}
              </span>
              <Image src={img.url} alt={img.alt || alt} fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/product/ProductHeroImage.test.tsx  # green
git add web/components/product/ProductHeroImage.tsx web/components/product/ProductHeroImage.test.tsx
git commit -m "feat(v3-pdp): add ProductHeroImage with multi-image gallery"
```

---

## Stage 7.9 — `<MobileBuyBarLJ>` (TDD)

### Task 7.9

**Files:**
- Create: `web/components/product/MobileBuyBarLJ.tsx`
- Create: `web/components/product/MobileBuyBarLJ.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileBuyBarLJ } from './MobileBuyBarLJ'

describe('<MobileBuyBarLJ>', () => {
  it('renders price + В корзину CTA', () => {
    render(<MobileBuyBarLJ priceRub={3399} onAddToCart={() => {}} disabled={false} />)
    expect(screen.getByText(/3.{0,3}399/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /в корзину/i })).toBeInTheDocument()
  })

  it('disables CTA when disabled prop is true', () => {
    render(<MobileBuyBarLJ priceRub={3399} onAddToCart={() => {}} disabled={true} />)
    expect(screen.getByRole('button', { name: /в корзину/i })).toBeDisabled()
  })

  it('calls onAddToCart when CTA clicked', () => {
    const onAdd = vi.fn()
    render(<MobileBuyBarLJ priceRub={3399} onAddToCart={onAdd} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: /в корзину/i }))
    expect(onAdd).toHaveBeenCalled()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
'use client'

interface Props {
  priceRub: number
  onAddToCart: () => void
  disabled: boolean
}

function formatRub(rub: number): string {
  return rub.toLocaleString('ru-RU').replace(/,/g, ' ')
}

export function MobileBuyBarLJ({ priceRub, onAddToCart, disabled }: Props) {
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--color-lj-ink)] border-t border-[var(--color-lj-rule-on-ink)] px-4 py-3 flex items-center justify-between gap-3">
      <span className="font-[var(--font-lj-display)] font-[900] text-2xl tracking-[-0.04em] text-[var(--color-lj-bone)]">
        {formatRub(priceRub)}
        <span className="font-[var(--font-lj-mono)] font-normal text-sm ml-1 opacity-70">₽</span>
      </span>
      <button
        type="button"
        onClick={onAddToCart}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-5 py-3 font-[var(--font-lj-mono)] text-[0.75rem] font-medium uppercase tracking-[0.08em] border border-[var(--color-lj-bone)] rounded-full bg-transparent text-[var(--color-lj-bone)] transition-all duration-400 hover:bg-[var(--color-lj-bone)] hover:text-[var(--color-lj-ink)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        В корзину →
      </button>
    </div>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/product/MobileBuyBarLJ.test.tsx  # green
git add web/components/product/MobileBuyBarLJ.tsx web/components/product/MobileBuyBarLJ.test.tsx
git commit -m "feat(v3-pdp): add MobileBuyBarLJ sticky bottom bar"
```

---

## Stage 7.10 — Page rewrite + ContentsSection inner v3 + MicroTrustRow

### Task 7.10a: ContentsSection inner content v3 pass

**Files:**
- Modify: `web/components/product/ContentsSection.tsx` (wrapper already LabSection — restyle inner content)
- Modify: `web/components/product/ContentsSection.test.tsx` if any v2 class is asserted

Read the current file first. Then update inner content to use:
- NotebookHeader at top: `<NotebookHeader section="01" label="Что внутри" page={2} total={6} />`
- Eyebrow above heading: mono `01 / Состав набора`
- H2: Unbounded display, brand-purple italic on one word (e.g. "Что **внутри** набора")
- Body: Inter on bone, brand-purple italic emphasis on key phrases
- Background: `<MoleculeMotifLJ variant="anthracene" className="…opacity-[0.05]…" />`

Check ContentsSection.test.tsx — if it asserts `bg-[var(--color-dark-base)]` or similar v2 class, update to `bg-[var(--color-lj-ink)]`.

**Verify + commit:**
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp/web
npm run typecheck
npx vitest run components/product/ContentsSection.test.tsx
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp
git add web/components/product/ContentsSection.tsx web/components/product/ContentsSection.test.tsx
git commit -m "feat(v3-pdp): ContentsSection inner content v3 typography pass"
```

### Task 7.10b: MicroTrustRow v3 restyle

**Files:**
- Find: `grep -rn 'MicroTrustRow' web/{app,components}/ | head` — might be in `components/` or `components/product/`
- Modify: that file to mono-row, no icons

Replace the existing v2 styling with:
```tsx
<ul className="flex flex-wrap gap-x-6 gap-y-2 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] text-[var(--color-lj-ink)] opacity-70">
  {items.map((item) => (
    <li key={item} className="inline-flex items-center gap-2 before:content-['•'] before:text-[var(--color-lj-brand)]">
      {item}
    </li>
  ))}
</ul>
```

Keep the same Props interface so the page consumer doesn't change.

Update the test to drop any v2-class assertions, replace with checks on the lj font + brand-purple bullet.

**Commit:**
```bash
git add web/components/MicroTrustRow.tsx web/components/MicroTrustRow.test.tsx 2>/dev/null || git add web/components/product/MicroTrustRow.tsx web/components/product/MicroTrustRow.test.tsx
git commit -m "feat(v3-pdp): MicroTrustRow restyle to mono row with brand-purple bullets"
```

### Task 7.10c: Product detail page rewrite

**Files:**
- Modify: `web/app/[locale]/(public)/product/[slug]/page.tsx` (major rewrite of section composition)

This is the biggest task in the stage. Read the current file end-to-end first:
```bash
cat /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp/web/app/[locale]/\(public\)/product/[slug]/page.tsx
```

Replace the section composition (preserve metadata generation, JSON-LD, breadcrumb logic — those are SEO-critical):

**New section flow:**
1. Breadcrumbs (existing, unchanged)
2. `<LabSection variant="cream">` — HERO row (image + info), `<NotebookHeader />` at top
3. `<ContentsSection blocks={…} />` (already migrated wrapper, now with v3 inner content from 7.10a)
4. `<LabSection variant="ink">` — Characteristics: `<NotebookHeader />`, eyebrow, `<CharacteristicsCellRow facts={extractUseFacts(characteristics)} />`, `<CharacteristicsTableLJ characteristics={characteristics} />`
5. `<LabSection variant="cream">` — Description: `<NotebookHeader />`, eyebrow, `<BlockRenderer blocks={longDescriptionBlocks} />`
6. `<LabSection variant="cream">` — Related products: `<NotebookHeader />`, asymmetric 3-card grid using existing `<ProductCard />`
7. `<PreFooterCta />` (already migrated)
8. `<MobileBuyBarLJ />` mounted client-side

**Hero info column composition:**
- Mono SKU header: `<p>№ {product.sku} / {elementSymbol}</p>`
- H1 in Unbounded with off-grid rows (split product.name on whitespace; render each word as a `<span class="block ${i === offsetIdx ? 'pl-[6vw]' : ''}">…</span>`; mark first word as brand-purple italic via `<em>`)
- Trail line in mono (small, opacity-55)
- `product.shortDescription` paragraph
- `<ProductPriceBlockLJ priceRub={…} compareAtPriceRub={…} />`
- `<StockChip status={product.stockStatus} />`
- Existing `<AddToCartWithQuantity>` wrapper, BUT update its inner stepper to use `<QuantityStepperLJ>` and the button to ink-pill style — see note below
- `<MicroTrustRow />` (now restyled)
- `<KeyFactsListLJ facts={extractKeyFacts(characteristics)} />`

**For `AddToCartWithQuantity`:** if it's a small component (in `_components/`), restyle it inline. If complex, leave its data flow untouched but swap its stepper child to `<QuantityStepperLJ>` and button class to the ink-pill match.

**Imports to update:**
- Remove: `PriceBlock`, `StockPill`, `KeyFactsList`, `CharacteristicsTable`, `MobileBuyBar` (v2)
- Remove: `Container`, `Section`, `Eyebrow`, `DisplayHeading`, `Pill`, `SectionHeading` from `@/components/ui` if they're no longer used in this file
- Add: `LabSection`, `NotebookHeader` from `@/components/ui/*`
- Add: `ProductPriceBlockLJ`, `StockChip`, `QuantityStepperLJ`, `KeyFactsListLJ`, `CharacteristicsCellRow`, `CharacteristicsTableLJ`, `ProductHeroImage`, `MobileBuyBarLJ` from `@/components/product/*`
- Add: `extractUseFacts`, `extractGalleryImages` from `@/components/product/extractKeyFacts`

**Verify + commit:**
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp/web
npm run typecheck
npm run test 2>&1 | tail -5
npm run build 2>&1 | tail -5
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp
git add -A web/app/[locale]/(public)/product/[slug]
git commit -m "feat(v3-pdp): rewrite product detail page section composition"
```

If the homepage smoke check shows any unexpected layout drift on the homepage (e.g. ProductCard related products row changed shape), fix in this commit.

---

## Stage 7.11 — Playwright visual regression baseline

### Task 7.11

**Files:**
- Create: `web/tests/visual/v3-product-detail.spec.ts`

Pattern follows `v3-homepage.spec.ts` from Stage 6.2. Pick a real product slug from the seed data (e.g. `himichka-3` if seeded; otherwise inspect `npm run seed` output or pick the first published product).

```ts
import { test, expect } from '@playwright/test'

test.describe('v3 Lab Journal — product detail', () => {
  test.skip(({ project }) => project.name !== 'desktop', 'desktop only this round')

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    // Pick a known-published product slug — adjust if the seed differs
    await page.goto('/ru/product/himichka-3')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
  })

  test('hero section visual', async ({ page }) => {
    await expect(page.locator('section').first()).toHaveScreenshot('pdp-hero.png', { maxDiffPixelRatio: 0.02 })
  })

  test('characteristics section visual', async ({ page }) => {
    const cells = page.locator('.lj-num-cell').first()
    await cells.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    const characteristics = page.locator('section').filter({ hasText: 'Полный список характеристик' }).first()
    await expect(characteristics).toHaveScreenshot('pdp-characteristics.png', { maxDiffPixelRatio: 0.03 })
  })
})
```

**Generate baselines + verify:**
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp/web
npx playwright test tests/visual/v3-product-detail.spec.ts --project=desktop --update-snapshots
npx playwright test tests/visual/v3-product-detail.spec.ts --project=desktop  # sanity re-run
```

**Commit:**
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp
git add web/tests/visual/v3-product-detail.spec.ts web/tests/visual/__screenshots__/v3-product-detail.spec.ts-snapshots/
git commit -m "test(v3-pdp): playwright visual regression baseline for hero + characteristics"
```

If the chosen product slug doesn't exist in dev DB, surface and pick a different one.

---

## Stage 7.12 — Delete dead v2 product/* components

### Task 7.12

**Files:**
- Delete: `web/components/product/PriceBlock.tsx` + `.test.tsx`
- Delete: `web/components/product/StockPill.tsx` + `.test.tsx`
- Delete: `web/components/product/QuantityStepper.tsx` + `.test.tsx`
- Delete: `web/components/product/KeyFactsList.tsx` + `.test.tsx`
- Delete: `web/components/product/CharacteristicsTable.tsx` + `.test.tsx`
- Delete: `web/components/product/MobileBuyBar.tsx` + `.test.tsx`
- Modify: `web/components/product/index.ts` if it re-exports any of the above

**Step 1: Final consumer check**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp
grep -rn 'PriceBlock\|StockPill\|QuantityStepper\|KeyFactsList\|CharacteristicsTable\|MobileBuyBar' web/{app,components}/ 2>/dev/null | grep -v '.test.\|LJ\.\|.lj.' | head
```

Should return empty (or only the files about to be deleted). If any consumer still references the v2 component, fix it before deleting (most likely candidate: CartDrawer might use PriceBlock — if so, swap to ProductPriceBlockLJ).

**Step 2: Delete + verify**

```bash
rm web/components/product/{PriceBlock,StockPill,QuantityStepper,KeyFactsList,CharacteristicsTable,MobileBuyBar}.tsx
rm web/components/product/{PriceBlock,StockPill,QuantityStepper,KeyFactsList,CharacteristicsTable,MobileBuyBar}.test.tsx
# Edit index.ts if needed to remove exports
cd web
npm run typecheck
npm run test 2>&1 | tail -5
npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp
git add -A
git rm web/components/product/PriceBlock.tsx web/components/product/PriceBlock.test.tsx web/components/product/StockPill.tsx web/components/product/StockPill.test.tsx web/components/product/QuantityStepper.tsx web/components/product/QuantityStepper.test.tsx web/components/product/KeyFactsList.tsx web/components/product/KeyFactsList.test.tsx web/components/product/CharacteristicsTable.tsx web/components/product/CharacteristicsTable.test.tsx web/components/product/MobileBuyBar.tsx web/components/product/MobileBuyBar.test.tsx 2>/dev/null
git commit -m "chore(v3-pdp): delete v2 product/* components (zero remaining consumers)"
```

---

## Acceptance — final checks before merge

After Task 7.12:

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-pdp/web
npm run typecheck     # pass
npm run lint          # pass
npm run test          # all pass
npm run build         # successful build
npm run test:visual   # baselines hold (homepage + product-detail)
```

Spot-check homepage (still loads cleanly, ProductCards in related-products row haven't broken). Visit any product page in dev:
```bash
PORT=3030 npm run dev &
sleep 6
curl -s http://localhost:3030/ru/product/himichka-3 | grep -oE 'lj-num-cell|var\(--color-lj-cream\)|var\(--color-lj-ink\)' | head
```

Expected: at least 4 `lj-num-cell` matches (or fewer if the chosen product is missing some use-facts), both color tokens present.

Check the design doc's [Acceptance criteria](2026-04-28-shop-v3-product-detail-design.md#acceptance-criteria) — all 12 items should be true.

Then handoff via `superpowers:finishing-a-development-branch`.

---

## Plan complete and saved to `docs/plans/2026-04-28-shop-v3-product-detail-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** — fresh subagent per task, review between, hybrid mode (full ceremony on the page rewrite + ContentsSection + Hero gallery; direct on small primitives)

**2. Parallel Session (separate)** — open new session with `superpowers:executing-plans`, batch execution with checkpoints

Which approach?
