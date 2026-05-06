# Shop v3 Stage 11 — Real product photos + specimen-card empty state — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task.

**Goal:** End the v3 rollout's "no real photos" eyesore by wiring imported Tilda photos into homepage flagship cards + category listings + PDP, designing a deliberate lab-journal "specimen card" empty state, and shipping a CLI audit script.

**Architecture:** New `<SpecimenCard>` primitive replaces the gimmicky "ARR. NN" placeholder slot with a dashed-box + mono-caption + hand-drawn-arrow composition (two size variants for ProductCard 4:5 vs PDP 1:1). `<ProductCard>` is refactored to accept `images: ProductImage[]` data instead of `imageArt: ReactNode` JSX — when ≥2 images exist, two stacked `<Image>` layers cross-fade on hover; with 1 image the existing scale-1.04 zoom stays; with 0 images the SpecimenCard takes the slot. Homepage `SITE_CATALOG` keeps marketing decoration but now resolves each flagship slug to a DB product at request time, picking up the imported `images[]` array as a side benefit.

**Tech Stack:** Next.js 16 (App Router) + React 19 server components, TypeScript strict, Tailwind 4, TypeORM, Vitest + Testing Library, Playwright (mobile/tablet/desktop projects).

**Design doc:** [`2026-05-07-shop-v3-stage-11-design.md`](2026-05-07-shop-v3-stage-11-design.md)

---

## Stage 11.0 — Worktree + baseline

### Task 11.0: Set up isolated worktree and confirm baseline

**Files:**
- Create: worktree at `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11` on branch `feat/v3-stage-11`

**Step 1: Set up worktree from `ximi4ka-shop` main**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop
git fetch
git worktree add ../ximi4ka-shop-v3-s11 -b feat/v3-stage-11 main
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11
```

Expected: worktree created, branch `feat/v3-stage-11` checked out, HEAD at the latest Stage 10 commit (`df7010a`).

**Step 2: Install dependencies (worktrees inherit `node_modules` from main worktree if symlinked, otherwise install fresh)**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11
npm install
```

**Step 3: Confirm baseline tests pass before starting**

```bash
cd web
npm run typecheck
npm run test
```

Expected: typecheck clean, 670/670 unit tests pass.

**Step 4: Commit nothing — branch starts at the same SHA as main**

No commit needed. The `git worktree add -b ... main` already created the branch.

---

## Stage 11.1 — SpecimenCard component

### Task 11.1: Build `<SpecimenCard>` with both size variants

**Files:**
- Create: `web/components/ui/SpecimenCard.tsx`
- Create: `web/components/ui/SpecimenCard.test.tsx`
- Create: `web/components/ui/illustrations/DashedRectMark.tsx`
- Create: `web/components/ui/illustrations/HandDrawnArrow.tsx` (only if not already present — check `web/components/ui/Callout.tsx` and `web/components/ui/illustrations/` first)

**Step 1: Check if `HandDrawnArrow` already exists**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11/web
grep -rln "HandDrawnArrow\|hand-drawn-arrow\|drawn.*arrow" components/ui/ components/marketing/ 2>/dev/null
```

If a reusable hand-drawn arrow SVG component exists, import it. Otherwise extract one from `Callout.tsx` (it has hand-drawn arrow paths).

**Step 2: Write failing test for `SpecimenCard`**

`web/components/ui/SpecimenCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SpecimenCard } from './SpecimenCard'

describe('SpecimenCard', () => {
  it('renders eyebrow with sku', () => {
    render(<SpecimenCard sku="X-30" size="card" />)
    expect(screen.getByText('ОБРАЗЕЦ № X-30')).toBeInTheDocument()
  })

  it('renders the "ФОТО ГОТОВИТСЯ" caption', () => {
    render(<SpecimenCard sku="K-12" size="card" />)
    expect(screen.getByText('ФОТО ГОТОВИТСЯ')).toBeInTheDocument()
  })

  it('renders dashed-rect SVG', () => {
    const { container } = render(<SpecimenCard sku="X-30" size="card" />)
    expect(container.querySelector('svg[data-mark="dashed-rect"]')).not.toBeNull()
  })

  it('renders hand-drawn arrow SVG', () => {
    const { container } = render(<SpecimenCard sku="X-30" size="card" />)
    expect(container.querySelector('svg[data-mark="hand-drawn-arrow"]')).not.toBeNull()
  })

  it('uses card aspect ratio classes for size="card"', () => {
    const { container } = render(<SpecimenCard sku="X-30" size="card" />)
    expect(container.firstChild).toHaveClass('aspect-[4/5]')
  })

  it('uses pdp aspect ratio classes for size="pdp"', () => {
    const { container } = render(<SpecimenCard sku="X-30" size="pdp" />)
    expect(container.firstChild).toHaveClass('aspect-square')
  })

  it('uses larger type for pdp size', () => {
    render(<SpecimenCard sku="X-30" size="pdp" />)
    const eyebrow = screen.getByText('ОБРАЗЕЦ № X-30')
    expect(eyebrow.className).toMatch(/text-lj-mono-sm|tracking-\[0\.1em\]/)
  })
})
```

**Step 3: Run tests to verify they fail**

```bash
cd web
npx vitest run components/ui/SpecimenCard.test.tsx
```

Expected: FAIL — "Cannot find module './SpecimenCard'".

**Step 4: Implement `DashedRectMark`**

`web/components/ui/illustrations/DashedRectMark.tsx`:

```tsx
interface Props {
  ratio: '4-5' | '1-1'
  className?: string
}

export function DashedRectMark({ ratio, className = '' }: Props) {
  // viewBox sized so stroke widths render identically across both ratios
  const [vw, vh] = ratio === '4-5' ? [80, 100] : [100, 100]
  return (
    <svg
      data-mark="dashed-rect"
      viewBox={`0 0 ${vw} ${vh}`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeDasharray="4 6"
      aria-hidden
    >
      <rect x="6" y="6" width={vw - 12} height={vh - 12} />
      <line x1="6" y1="6" x2={vw - 6} y2={vh - 6} strokeWidth="0.5" />
    </svg>
  )
}
```

**Step 5: Implement `HandDrawnArrow` (if needed; otherwise import existing)**

`web/components/ui/illustrations/HandDrawnArrow.tsx`:

```tsx
interface Props {
  className?: string
}

// Curve-up-right arrow, hand-drawn feel via slight wobble in the path.
// Origin near caption baseline, head pointing toward dashed rect center.
export function HandDrawnArrow({ className = '' }: Props) {
  return (
    <svg
      data-mark="hand-drawn-arrow"
      viewBox="0 0 60 40"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 35 C 18 32, 30 22, 42 12 C 44 11, 46 10, 48 10" />
      <path d="M48 10 L 43 8 M 48 10 L 46 14" />
    </svg>
  )
}
```

**Step 6: Implement `SpecimenCard`**

`web/components/ui/SpecimenCard.tsx`:

```tsx
import { DashedRectMark } from './illustrations/DashedRectMark'
import { HandDrawnArrow } from './illustrations/HandDrawnArrow'

interface Props {
  sku: string
  size: 'card' | 'pdp'
  className?: string
}

export function SpecimenCard({ sku, size, className = '' }: Props) {
  const aspectClass = size === 'card' ? 'aspect-[4/5]' : 'aspect-square'
  const eyebrowClass =
    size === 'card'
      ? 'text-[length:var(--text-lj-mono-xs)] tracking-[0.08em]'
      : 'text-[length:var(--text-lj-mono-sm)] tracking-[0.1em]'
  const captionClass =
    size === 'card'
      ? 'text-[length:var(--text-lj-mono-sm)] tracking-[0.04em]'
      : 'text-base tracking-[0.06em]'
  const dashedRectRatio = size === 'card' ? '4-5' : '1-1'

  return (
    <div
      className={`relative ${aspectClass} bg-[var(--color-lj-cream-shade)] border border-[var(--color-lj-rule)] overflow-hidden ${className}`}
      role="img"
      aria-label={`Specimen ${sku} — photo coming soon`}
    >
      <span
        className={`absolute top-3.5 left-3.5 font-[var(--font-lj-mono)] uppercase text-[var(--color-lj-ink)] opacity-55 ${eyebrowClass}`}
      >
        ОБРАЗЕЦ № {sku}
      </span>

      <div className="absolute inset-[18%] text-[var(--color-lj-ink)] opacity-30">
        <DashedRectMark ratio={dashedRectRatio} className="w-full h-full" />
      </div>

      <span
        className={`absolute bottom-3.5 left-1/2 -translate-x-1/2 font-[var(--font-lj-mono)] uppercase text-[var(--color-lj-ink)] opacity-70 whitespace-nowrap ${captionClass}`}
      >
        ФОТО ГОТОВИТСЯ
      </span>

      <div
        className="absolute bottom-12 left-[58%] w-[28%] text-[var(--color-lj-brand)] opacity-40"
        aria-hidden
      >
        <HandDrawnArrow className="w-full h-auto" />
      </div>
    </div>
  )
}
```

**Step 7: Run tests to verify they pass**

```bash
cd web
npx vitest run components/ui/SpecimenCard.test.tsx
```

Expected: PASS — all 7 tests green.

**Step 8: Run typecheck**

```bash
npm run typecheck
```

Expected: clean.

**Step 9: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11
git add web/components/ui/SpecimenCard.tsx web/components/ui/SpecimenCard.test.tsx web/components/ui/illustrations/DashedRectMark.tsx web/components/ui/illustrations/HandDrawnArrow.tsx
git commit -m "feat(v3-s11): SpecimenCard empty-state composition with two size variants"
```

---

## Stage 11.2 — ProductCard refactor: images prop + crossfade + SpecimenCard fallback

### Task 11.2: Replace `imageArt` indirection with data-shaped `images` prop

**Files:**
- Modify: `web/components/ProductCard.tsx`
- Modify: `web/components/ProductCard.test.tsx`
- Find + modify all callers — they pass `imageArt={...}` today; new signature is `images={[...]}`

**Step 1: Find all `<ProductCard>` callers**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11/web
grep -rln "ProductCard\b" app/ components/ --include="*.tsx" | grep -v "\.test\."
```

Document the list. Each caller will need to pass `images` instead of `imageArt`.

**Step 2: Write failing tests for new behavior**

Append to `web/components/ProductCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProductCard } from './ProductCard'

const baseProduct = {
  id: 'p1',
  slug: 'test-product',
  sku: 'X-30',
  name: 'Тестовый набор',
  shortDescription: 'desc',
  longDescriptionBlocks: [],
  priceRub: 1999,
  compareAtPriceRub: null,
  stockStatus: 'in_stock' as const,
  isPublished: true,
  sortOrder: 0,
  metaTitle: null,
  metaDescription: null,
  ogImage: null,
  canonicalUrl: null,
  noindex: false,
  translations: {},
  images: [],
  createdAt: '',
  updatedAt: '',
}

const stats = { reagents: 10, instruments: 5, reactions: 50 }
const statMaxes = { reagents: 20, instruments: 10, reactions: 100 }

describe('ProductCard images behavior', () => {
  it('renders SpecimenCard when images is empty', () => {
    render(<ProductCard product={baseProduct} stats={stats} statMaxes={statMaxes} images={[]} />)
    expect(screen.getByText('ОБРАЗЕЦ № X-30')).toBeInTheDocument()
    expect(screen.getByText('ФОТО ГОТОВИТСЯ')).toBeInTheDocument()
  })

  it('renders single Image when one image provided', () => {
    const images = [{ id: 'i1', productId: 'p1', url: '/test.png', alt: 'alt', sortOrder: 0 }]
    const { container } = render(
      <ProductCard product={baseProduct} stats={stats} statMaxes={statMaxes} images={images} />
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBe(1)
    expect(screen.queryByText('ФОТО ГОТОВИТСЯ')).not.toBeInTheDocument()
  })

  it('renders two stacked Images when ≥2 images provided (crossfade-ready)', () => {
    const images = [
      { id: 'i1', productId: 'p1', url: '/a.png', alt: 'a', sortOrder: 0 },
      { id: 'i2', productId: 'p1', url: '/b.png', alt: 'b', sortOrder: 1 },
    ]
    const { container } = render(
      <ProductCard product={baseProduct} stats={stats} statMaxes={statMaxes} images={images} />
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBe(2)
  })

  it('suppresses cornerMark when images is empty', () => {
    render(
      <ProductCard
        product={baseProduct}
        stats={stats}
        statMaxes={statMaxes}
        images={[]}
        cornerMark="ARR. 01"
      />
    )
    expect(screen.queryByText('ARR. 01')).not.toBeInTheDocument()
  })

  it('renders cornerMark when images present', () => {
    const images = [{ id: 'i1', productId: 'p1', url: '/a.png', alt: 'a', sortOrder: 0 }]
    render(
      <ProductCard
        product={baseProduct}
        stats={stats}
        statMaxes={statMaxes}
        images={images}
        cornerMark="ARR. 01"
      />
    )
    expect(screen.getByText('ARR. 01')).toBeInTheDocument()
  })
})
```

**Step 3: Run tests to verify they fail**

```bash
npx vitest run components/ProductCard.test.tsx
```

Expected: FAIL — `images` prop doesn't exist yet, falls through `imageArt` path.

**Step 4: Refactor `ProductCard.tsx` — replace `imageArt` with `images`**

Edit `web/components/ProductCard.tsx`:
- Remove `imageArt?: React.ReactNode` from the `Props` interface
- Add `images: ProductImage[]` (required) — import the type from `@ximi4ka-shop/shared`
- Replace the inner image slot rendering. New structure:

```tsx
{images.length === 0 ? (
  <SpecimenCard sku={product.sku ?? product.slug} size="card" className="border-0" />
) : (
  <Link href={`/product/${product.slug}`} className="block">
    <div className="relative aspect-[4/5] bg-[var(--color-lj-cream-shade)] border border-[var(--color-lj-rule)] overflow-hidden transition-[border-color] duration-500 group-hover/pcard:border-[var(--color-lj-ink)]">
      {cornerMark && (
        <span className="absolute top-3.5 left-3.5 z-10 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] text-[var(--color-lj-ink)] opacity-55">
          {cornerMark}
        </span>
      )}
      <Image
        src={images[0].url}
        alt={images[0].alt}
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover transition-[opacity,transform] duration-500 group-hover/pcard:scale-[1.04] group-hover/pcard:opacity-0"
      />
      {images[1] && (
        <Image
          src={images[1].url}
          alt={images[1].alt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="absolute inset-0 object-cover opacity-0 transition-[opacity,transform] duration-500 group-hover/pcard:opacity-100 group-hover/pcard:scale-[1.04]"
        />
      )}
      {hoverFormula && (
        <div className="absolute bottom-3.5 left-3.5 z-10 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] tracking-[0.04em] text-[var(--color-lj-ink)] bg-[var(--color-lj-cream)] px-2.5 py-1.5 border border-[var(--color-lj-ink)] opacity-0 translate-y-2 transition-[opacity,transform] duration-500 group-hover/pcard:opacity-100 group-hover/pcard:translate-y-0">
          {hoverFormula}
        </div>
      )}
    </div>
  </Link>
)}
```

When `images.length === 0`, the SpecimenCard takes the slot but should NOT be wrapped in a `<Link>` (no photo to click on, link semantics still attach via the title/CTA below). The `cornerMark` and `hoverFormula` are suppressed via the `images.length > 0` branch.

Also import `Image` from `next/image` and `SpecimenCard` from `./ui/SpecimenCard`.

**Step 5: Run ProductCard tests to verify they pass**

```bash
npx vitest run components/ProductCard.test.tsx
```

Expected: all new tests pass; existing tests still pass (the Sticker-era test that uses `any` type will still warn about lint, that's pre-existing).

**Step 6: Update homepage callers**

Find `web/app/[locale]/(public)/page.tsx`. The flagship cards rendering `<ProductCard ... />` — they currently pass `imageArt` (or don't pass it). Update each call site to pass `images={dbProductMap.get(entry.slug)?.images ?? []}` once the homepage hybrid resolution is wired (Task 11.5 — for now, pass `images={[]}` to satisfy the required prop).

**Step 7: Update categories listing callers**

`web/app/[locale]/(public)/categories/[slug]/page.tsx` already iterates `products`. Find the `<ProductCard>` call and add `images={product.images}`.

**Step 8: Run typecheck**

```bash
npm run typecheck
```

Expected: clean.

**Step 9: Run all unit tests**

```bash
npm run test
```

Expected: all pass.

**Step 10: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11
git add web/components/ProductCard.tsx web/components/ProductCard.test.tsx web/app/[locale]/\(public\)/page.tsx web/app/[locale]/\(public\)/categories/[slug]/page.tsx
git commit -m "feat(v3-s11): ProductCard accepts images[] data, crossfade gallery, SpecimenCard fallback"
```

---

## Stage 11.3 — ProductHeroImage empty-state fallback

### Task 11.3: Wire SpecimenCard into PDP hero gallery for empty image case

**Files:**
- Modify: `web/components/product/ProductHeroImage.tsx`
- Modify (or create): `web/components/product/ProductHeroImage.test.tsx`

**Step 1: Write failing test**

`web/components/product/ProductHeroImage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProductHeroImage } from './ProductHeroImage'

const baseProduct = {
  id: 'p1', slug: 's', sku: 'X-30', name: 'X', shortDescription: null,
  longDescriptionBlocks: [], priceRub: 100, compareAtPriceRub: null,
  stockStatus: 'in_stock' as const, isPublished: true, sortOrder: 0,
  metaTitle: null, metaDescription: null, ogImage: null, canonicalUrl: null,
  noindex: false, translations: {}, images: [], createdAt: '', updatedAt: '',
}

describe('ProductHeroImage', () => {
  it('renders SpecimenCard at pdp size when images is empty', () => {
    render(<ProductHeroImage product={baseProduct} />)
    expect(screen.getByText('ОБРАЗЕЦ № X-30')).toBeInTheDocument()
    expect(screen.getByText('ФОТО ГОТОВИТСЯ')).toBeInTheDocument()
  })

  it('renders gallery (no SpecimenCard) when images is populated', () => {
    const product = {
      ...baseProduct,
      images: [{ id: 'i1', productId: 'p1', url: '/a.png', alt: 'a', sortOrder: 0 }],
    }
    render(<ProductHeroImage product={product} />)
    expect(screen.queryByText('ФОТО ГОТОВИТСЯ')).not.toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run components/product/ProductHeroImage.test.tsx
```

Expected: FAIL — empty `images` doesn't currently render SpecimenCard.

**Step 3: Add early-return to `ProductHeroImage.tsx`**

At the top of the component body:

```tsx
import { SpecimenCard } from '@/components/ui/SpecimenCard'

export function ProductHeroImage({ product }: Props) {
  if (product.images.length === 0) {
    return <SpecimenCard size="pdp" sku={product.sku ?? product.slug} />
  }
  // ...rest of existing populated-gallery code unchanged
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run components/product/ProductHeroImage.test.tsx
```

Expected: PASS.

**Step 5: Run all tests**

```bash
npm run test
```

Expected: all pass.

**Step 6: Commit**

```bash
git add web/components/product/ProductHeroImage.tsx web/components/product/ProductHeroImage.test.tsx
git commit -m "feat(v3-s11): PDP hero falls back to SpecimenCard when no images"
```

---

## Stage 11.4 — Audit CLI script (run before SITE_CATALOG fix to confirm slug truth)

### Task 11.4: Build `audit:images` script in `api` workspace

**Files:**
- Create: `api/src/scripts/audit-images.ts`
- Create: `api/src/scripts/audit-images.test.ts`
- Modify: `api/package.json` (add `audit:images` script)

**Step 1: Check if `tsx` is already available in api workspace**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11/api
grep -E '"tsx"|"ts-node"' package.json
```

If neither, add `tsx` as devDependency: `npm install -D tsx -w api`.

**Step 2: Write failing test**

`api/src/scripts/audit-images.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupByPrimaryCategory, formatBacklogTable } from './audit-images'

describe('audit-images helpers', () => {
  it('groups products by primary (first) category name', () => {
    const products = [
      { id: 'p1', sku: 'A', slug: 'a', name: 'A', categories: [{ name: 'Реактивы' }] },
      { id: 'p2', sku: 'B', slug: 'b', name: 'B', categories: [{ name: 'Посуда' }] },
      { id: 'p3', sku: 'C', slug: 'c', name: 'C', categories: [{ name: 'Реактивы' }] },
      { id: 'p4', sku: null, slug: 'd', name: 'D', categories: [] },
    ] as any
    const grouped = groupByPrimaryCategory(products)
    expect(grouped.get('Реактивы')).toHaveLength(2)
    expect(grouped.get('Посуда')).toHaveLength(1)
    expect(grouped.get('Без категории')).toHaveLength(1)
  })

  it('formats markdown table with admin URLs', () => {
    const products = [
      { id: 'p1', sku: 'X-30', slug: 'himichka-30', name: 'Химичка 3.0' },
    ] as any
    const md = formatBacklogTable(products)
    expect(md).toContain('| X-30 |')
    expect(md).toContain('`himichka-30`')
    expect(md).toContain('Химичка 3.0')
    expect(md).toContain('/admin/products/p1')
  })
})
```

**Step 3: Run test to verify it fails**

```bash
cd api
npx vitest run src/scripts/audit-images.test.ts
```

Expected: FAIL — module not found.

**Step 4: Implement `audit-images.ts`**

`api/src/scripts/audit-images.ts`:

```ts
import { AppDataSource } from '../config/database'
import { Product } from '../entities/Product'

interface ProductLite {
  id: string
  sku: string | null
  slug: string
  name: string
  categories?: Array<{ name: string }>
}

export function groupByPrimaryCategory(products: ProductLite[]): Map<string, ProductLite[]> {
  const map = new Map<string, ProductLite[]>()
  for (const p of products) {
    const key = p.categories?.[0]?.name ?? 'Без категории'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  return map
}

export function formatBacklogTable(products: ProductLite[]): string {
  const lines = ['| SKU | Slug | Name | Admin |', '|---|---|---|---|']
  for (const p of products) {
    lines.push(
      `| ${p.sku ?? '—'} | \`${p.slug}\` | ${p.name} | http://localhost:3000/admin/products/${p.id} |`
    )
  }
  return lines.join('\n')
}

async function main() {
  await AppDataSource.initialize()
  try {
    const repo = AppDataSource.getRepository(Product)
    const products = await repo.find({
      where: { isPublished: true },
      relations: { images: true, categories: true },
      order: { sortOrder: 'ASC' },
    })
    const missing = products.filter((p) => p.images.length === 0)

    if (missing.length === 0) {
      console.log('✓ All published products have at least one image.')
      process.exit(0)
    }

    const byCategory = groupByPrimaryCategory(missing as ProductLite[])
    console.log(`\n# Photography backlog — ${missing.length} products missing images\n`)
    for (const [categoryName, items] of byCategory) {
      console.log(`## ${categoryName} (${items.length})\n`)
      console.log(formatBacklogTable(items))
      console.log('')
    }
    process.exit(0)
  } finally {
    await AppDataSource.destroy()
  }
}

// Only run main when invoked directly (not when imported by tests)
if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
```

**Step 5: Add npm script**

`api/package.json` — add to `"scripts"`:

```json
"audit:images": "tsx src/scripts/audit-images.ts"
```

**Step 6: Run unit test to verify it passes**

```bash
cd api
npx vitest run src/scripts/audit-images.test.ts
```

Expected: PASS — both helper tests green.

**Step 7: Run the script against the live DB to capture slug truth**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11
npm run audit:images -w api > /tmp/audit-images-stage-11.md
cat /tmp/audit-images-stage-11.md
```

Expected: either "✓ All published products have at least one image." OR a markdown table. Save the output — we'll reference it in Task 11.5 when fixing SITE_CATALOG slugs.

Also confirm the 3 flagship slugs exist in the DB:

```bash
cd api
node -e "
const { AppDataSource } = require('./dist/config/database');
const { Product } = require('./dist/entities/Product');
(async () => {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Product);
  for (const slug of ['himichka-3', 'himichka-30', 'mini-himichka', 'elektrohimichka']) {
    const p = await repo.findOne({ where: { slug }, relations: { images: true } });
    console.log(slug, p ? \`found, \${p.images.length} images\` : 'NOT FOUND');
  }
  await AppDataSource.destroy();
})();
" 2>/dev/null || echo "(needs a build first; or just inspect with: psql or supabase MCP)"
```

If `node -e` doesn't work without a fresh build, use the supabase MCP query tool or inspect `psql` directly. The exact output here drives the SITE_CATALOG slug update in Task 11.5.

**Step 8: Commit**

```bash
git add api/src/scripts/audit-images.ts api/src/scripts/audit-images.test.ts api/package.json
git commit -m "feat(v3-s11): audit:images CLI for photography backlog"
```

---

## Stage 11.5 — Homepage SITE_CATALOG hybrid resolution + slug fix + drift test

### Task 11.5: Resolve flagship slugs to DB products at request time

**Files:**
- Modify: `web/app/[locale]/(public)/page.tsx`
- Modify: `web/app/[locale]/(public)/page.test.tsx`

**Step 1: Update SITE_CATALOG slugs based on Task 11.4's audit output**

Open `web/app/[locale]/(public)/page.tsx`. Update the `slug` field of each `SITE_CATALOG` entry to match the actual DB slug. Per the original imports we know:
- `himichka-3` → likely `himichka-30` (confirmed in api/uploads/imported/)
- `mini-himichka` → confirm against audit output
- `elektrohimichka` → confirmed in api/uploads/imported/

Update the array literals.

**Step 2: Write failing drift-detection test**

Append to `web/app/[locale]/(public)/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { SITE_CATALOG } from './page'  // export it from page.tsx

// Mock getProduct to return null — this should trigger the test failure
// signaling that one or more SITE_CATALOG slugs don't resolve.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    getProduct: vi.fn().mockImplementation((slug: string) => {
      // Test fixture — mirror what the DB should have. Update when SITE_CATALOG changes.
      const known = new Set(['himichka-30', 'mini-himichka', 'elektrohimichka'])
      if (known.has(slug)) {
        return Promise.resolve({
          id: 'mock', slug, sku: 'X', name: 'X', shortDescription: null,
          longDescriptionBlocks: [], priceRub: 0, compareAtPriceRub: null,
          stockStatus: 'in_stock', isPublished: true, sortOrder: 0,
          metaTitle: null, metaDescription: null, ogImage: null, canonicalUrl: null,
          noindex: false, translations: {}, images: [],
          createdAt: '', updatedAt: '',
        })
      }
      return Promise.resolve(null)
    }),
  }
})

describe('SITE_CATALOG drift', () => {
  it('every flagship slug resolves to a published mock product', async () => {
    const { getProduct } = await import('@/lib/api')
    for (const entry of SITE_CATALOG) {
      const product = await getProduct(entry.slug, 'ru')
      expect(product, `Slug "${entry.slug}" did not resolve`).not.toBeNull()
    }
  })
})
```

**Step 3: Export `SITE_CATALOG` from page.tsx so the test can import it**

In `web/app/[locale]/(public)/page.tsx`, change `const SITE_CATALOG = [...]` to `export const SITE_CATALOG = [...] as const`.

**Step 4: Run test to verify it fails (or passes if all slugs already correct)**

```bash
cd web
npx vitest run "app/\[locale\]/\(public\)/page.test.tsx"
```

If FAIL → fix the SITE_CATALOG slug. If PASS → proceed.

**Step 5: Add hybrid server resolution in page.tsx**

In the page component body, before `return`:

```tsx
import { getProduct } from '@/lib/api'

// ...inside default export async function:
const flagships = await Promise.all(
  SITE_CATALOG.map(async (entry) => {
    const dbProduct = await getProduct(entry.slug, locale).catch(() => null)
    if (!dbProduct) {
      console.warn(`[SITE_CATALOG] Slug not found in DB: ${entry.slug}`)
    }
    return { ...entry, dbProduct }
  })
)
```

**Step 6: Update the JSX that maps `SITE_CATALOG.map(...)` to use `flagships` and pass `images`**

Find the existing render loop (around line 270 in page.tsx). Change it to iterate `flagships` and pass `images={entry.dbProduct?.images ?? []}`. The synthetic Product fallback is needed because `<ProductCard>` requires a Product; build a minimal one from SITE_CATALOG metadata when `dbProduct` is null:

```tsx
{flagships.map((entry) => {
  const product = entry.dbProduct ?? {
    id: `synthetic-${entry.slug}`,
    slug: entry.slug,
    sku: entry.sku,
    name: entry.name,
    shortDescription: entry.shortDescription,
    longDescriptionBlocks: [],
    priceRub: entry.priceRub,
    compareAtPriceRub: null,
    stockStatus: 'in_stock' as const,
    isPublished: true,
    sortOrder: 0,
    metaTitle: null, metaDescription: null, ogImage: null, canonicalUrl: null,
    noindex: false, translations: {}, images: [],
    createdAt: '', updatedAt: '',
  }
  return (
    <ProductCard
      key={entry.slug}
      product={product}
      images={entry.dbProduct?.images ?? []}
      emphasisWord={entry.emphasisWord}
      elementSymbol={entry.elementSymbol}
      badge={entry.badge}
      badgeVariant={entry.badgeVariant}
      stats={entry.stats}
      statMaxes={statMaxes}
      chips={entry.chips}
      callout={entry.callout}
      hoverFormula={entry.hoverFormula}
      cornerMark={entry.cornerMark}
    />
  )
})}
```

**Step 7: Run all tests**

```bash
cd web
npm run test
```

Expected: all pass, including the new drift test.

**Step 8: Run typecheck**

```bash
npm run typecheck
```

Expected: clean.

**Step 9: Commit**

```bash
git add web/app/[locale]/\(public\)/page.tsx web/app/[locale]/\(public\)/page.test.tsx
git commit -m "feat(v3-s11): SITE_CATALOG resolves flagship images from DB at request time"
```

---

## Stage 11.6 — SpecimenCard fixture route + visual baselines

### Task 11.6: Add fixture route + Playwright spec for SpecimenCard

**Files:**
- Create: `web/app/[locale]/specimen-fixture/page.tsx`
- Create: `web/tests/visual/v3-specimen.spec.ts`

**Step 1: Create the fixture route (mirrors Stage 10's pagination-fixture pattern)**

`web/app/[locale]/specimen-fixture/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { SpecimenCard } from '@/components/ui/SpecimenCard'

export const dynamic = 'force-dynamic'

export default function SpecimenFixturePage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="bg-[var(--color-lj-cream)] min-h-screen p-12 flex flex-col gap-12">
      <div data-fixture-scene="card-size">
        <h2 className="font-[var(--font-lj-mono)] uppercase mb-4 text-[var(--color-lj-ink)] text-sm tracking-[0.08em]">
          card size (4:5)
        </h2>
        <div className="w-[320px]">
          <SpecimenCard sku="X-30" size="card" />
        </div>
      </div>

      <div data-fixture-scene="pdp-size">
        <h2 className="font-[var(--font-lj-mono)] uppercase mb-4 text-[var(--color-lj-ink)] text-sm tracking-[0.08em]">
          pdp size (1:1)
        </h2>
        <div className="w-[600px]">
          <SpecimenCard sku="K-12" size="pdp" />
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Create the visual spec**

`web/tests/visual/v3-specimen.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

// v3 Lab Journal — SpecimenCard empty-state component visual baselines.
//
// Mounted via dev-only fixture at /ru/specimen-fixture (gated to NODE_ENV !==
// production via notFound()). Two scenes — `card` size (4:5 ProductCard slot)
// and `pdp` size (1:1 hero canvas) — each captured across mobile / tablet /
// desktop projects (2 × 3 = 6 baselines).
test.describe('v3 Lab Journal — SpecimenCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ru/specimen-fixture')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
  })

  test('card size', async ({ page }) => {
    const scene = page.locator('[data-fixture-scene="card-size"]')
    await expect(scene).toHaveScreenshot('specimen-card.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('pdp size', async ({ page }) => {
    const scene = page.locator('[data-fixture-scene="pdp-size"]')
    await expect(scene).toHaveScreenshot('specimen-pdp.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})
```

**Step 3: Generate baselines**

```bash
cd web
npx playwright test tests/visual/v3-specimen.spec.ts --update-snapshots
```

Expected: 6 baselines created (2 scenes × 3 viewports). Open at least one to eyeball:

```bash
open tests/visual/__screenshots__/v3-specimen.spec.ts-snapshots/specimen-card-desktop-darwin.png
open tests/visual/__screenshots__/v3-specimen.spec.ts-snapshots/specimen-pdp-mobile-darwin.png
```

Look for: dashed rectangle visible, mono eyebrow + caption legible, hand-drawn arrow visible. If any element looks wrong, fix the SpecimenCard component, regenerate, then continue.

**Step 4: Sanity re-run**

```bash
npx playwright test tests/visual/v3-specimen.spec.ts
```

Expected: 6 passed.

**Step 5: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11
git add 'web/app/[locale]/specimen-fixture/' web/tests/visual/v3-specimen.spec.ts web/tests/visual/__screenshots__/v3-specimen.spec.ts-snapshots/
git commit -m "test(v3-s11): SpecimenCard visual baselines via dev-only fixture route"
```

---

## Stage 11.7 — Refresh visual baselines for surfaces affected by ProductCard refactor

### Task 11.7: Regenerate baselines for homepage products + categories

**Files:**
- Update: `web/tests/visual/__screenshots__/v3-homepage.spec.ts-snapshots/products-{mobile,tablet,desktop}-darwin.png`
- Update: `web/tests/visual/__screenshots__/v3-stage-8.spec.ts-snapshots/category-detail-{mobile,tablet,desktop}-darwin.png` (if the cropped section now contains a different ProductCard rendering)
- Update: any storefront.spec.ts baselines that touch ProductCard

**Step 1: Run all visual tests to see what diffs**

```bash
cd web
npx playwright test tests/visual 2>&1 | tee /tmp/playwright-stage-11-diff.log | tail -40
```

Expected: failures on the slabs that now render real photos instead of placeholders. Each failure points at a specific baseline to refresh.

**Step 2: Regenerate failing baselines**

```bash
npx playwright test tests/visual --update-snapshots 2>&1 | tail -30
```

**Step 3: Eyeball the new homepage products baseline**

```bash
open tests/visual/__screenshots__/v3-homepage.spec.ts-snapshots/products-desktop-darwin.png
open tests/visual/__screenshots__/v3-homepage.spec.ts-snapshots/products-mobile-darwin.png
```

Confirm: real Tilda photos render in the 3 flagship cards. No more gray "ARR. NN" boxes. Two-image flagships (himichka-30) show the first image — hover swap is design-time behavior, not captured in static screenshots.

**Step 4: Sanity re-run**

```bash
npx playwright test tests/visual
```

Expected: all pass (baselines just generated).

**Step 5: Inspect git status to confirm only PNG files changed**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11
git status --short web/tests/visual/__screenshots__/
```

Expected: a list of modified `.png` files. No source files staged (those should already be in earlier commits).

**Step 6: Commit**

```bash
git add web/tests/visual/__screenshots__/
git commit -m "test(v3-s11): refresh visual baselines for surfaces with real photos"
```

---

## Stage 11.8 — Final verification + handoff

### Task 11.8: Run full verification suite, walk acceptance criteria, hand off to merge

**Step 1: Full verification suite**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s11/web
npm run typecheck
npm run test
npm run build
npx playwright test tests/visual 2>&1 | tail -10
```

Expected: typecheck clean, all unit tests pass, build clean, all visual tests pass (Mobile menu skips on tablet/desktop are intentional from Stage 10).

**Step 2: Walk the design doc's acceptance criteria**

Open [`2026-05-07-shop-v3-stage-11-design.md`](2026-05-07-shop-v3-stage-11-design.md) §"Acceptance criteria" and verify each of the 11 items is true. Confirm by:
- Reading the relevant test in this worktree
- Visually checking the relevant baseline PNG
- Running the relevant CLI

**Step 3: Hand off via `superpowers:finishing-a-development-branch`**

Invoke that skill to present merge/PR/keep/discard options.

---

## Plan complete and saved to `docs/plans/2026-05-07-shop-v3-stage-11-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** — fresh subagent per task, hybrid mode (full ceremony on SpecimenCard + ProductCard refactor + SITE_CATALOG hybrid; direct on the smaller wiring + visual baseline regen)

**2. Parallel Session (separate)** — open new session with `superpowers:executing-plans`

Which approach?
