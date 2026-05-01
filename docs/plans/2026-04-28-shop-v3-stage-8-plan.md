# Shop v3 — Stage 8 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the remaining v2 islands on the public storefront — homepage v2 sections (CategoryTile / HowItWorksStep / TestimonialCard), the 8-block CMS library, and the `/categories` index + `[slug]` pages — bringing the entire public storefront to the Лабораторный Журнал v3 vocabulary.

**Architecture:** 6 net-new components (2 shared primitives + 3 homepage-section rewrites + 1 categories filter), 8 CMS block rewrites in place, 3 page rewrites. Per-category molecule decoration mapped semantically. FAQ uses native `<details>/<summary>` (zero JS). Section-driven inheritance — blocks adapt colors to wrapping `<LabSection>` surface.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2, TypeScript, Tailwind 4 (`@theme inline` tokens), Vitest + Testing Library, Playwright.

**Source artifacts:**
- Design doc: `ximi4ka/docs/plans/2026-04-28-shop-v3-stage-8-design.md`
- Design system spec: `ximi4ka-shop/design-system/ximi4ka-v3/LABORATORY_JOURNAL.md`
- Stage 7 plan (referenced for v3 patterns): `ximi4ka/docs/plans/2026-04-28-shop-v3-product-detail-plan.md`

**Critical rule (from `web/AGENTS.md`):** Next.js 16.2 has breaking changes vs older versions. **Image API uses `preload`, not `priority`.** Before writing any Next-specific code, check `node_modules/next/dist/docs/`.

**Stage map (~24 task-commits):**
- Stage 8.0 — Worktree setup + baseline (1 verification)
- Stage 8.1–8.2 — Shared primitives: MediaFrame + FaqAccordion (2 tasks)
- Stage 8.A — Homepage v2 sections (4 tasks)
- Stage 8.B — CMS block library (8 tasks, one per block)
- Stage 8.C — Categories pages (3 tasks)
- Stage 8.D — Polish + cleanup (3 tasks: Playwright baselines + v2 deletion + token cleanup)

Each task = 1 commit. At every stage boundary the storefront must build (`npm run build`) and tests pass (`npm run test`).

---

## Pre-Stage Setup

### Task 8.0: Worktree + baseline

**Files:** none (verification + worktree setup)

**Step 1: Create the Stage 8 worktree from current main**

From `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop`:
```bash
git worktree add -b feat/v3-stage-8 /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8 main
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8
npm install   # ~2 min, npm workspaces
```

**Step 2: Baseline**

From `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8/web`:
```bash
npm run typecheck   # clean
npm run test 2>&1 | tail -5   # 620 tests pass (post-Stage 7)
npm run build 2>&1 | tail -5   # clean
```

**Step 3: Skim what we're touching**

```bash
ls web/components/marketing/    # CategoryTile, HowItWorksStep, TestimonialCard, TrustStrip
ls web/components/blocks/       # 8 CMS blocks + BlockRenderer
cat web/components/blocks/BlockRenderer.tsx  # the dispatch switch
```

No commit — verification only.

---

## Stage 8.1 — Shared primitive: `<MediaFrame>`

### Task 8.1

**Files:**
- Create: `web/components/ui/MediaFrame.tsx`
- Create: `web/components/ui/MediaFrame.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MediaFrame } from './MediaFrame'

describe('<MediaFrame>', () => {
  it('renders children inside cream-shade backdrop with ink border', () => {
    const { container } = render(<MediaFrame cornerMark="arr. 01"><div>x</div></MediaFrame>)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('bg-[var(--color-lj-cream-shade)]')
    expect(wrapper.className).toContain('border-[var(--color-lj-rule)]')
  })

  it('renders the corner mark', () => {
    render(<MediaFrame cornerMark="arr. P-02"><div>x</div></MediaFrame>)
    expect(screen.getByText('arr. P-02')).toBeInTheDocument()
  })

  it('renders caption underneath when provided', () => {
    render(<MediaFrame cornerMark="x" caption="Подпись"><div>x</div></MediaFrame>)
    expect(screen.getByText('Подпись')).toBeInTheDocument()
  })

  it('omits caption block when not provided', () => {
    const { container } = render(<MediaFrame cornerMark="x"><div>x</div></MediaFrame>)
    expect(container.querySelector('[data-caption]')).toBeNull()
  })

  it('respects aspect ratio prop', () => {
    const { container } = render(<MediaFrame cornerMark="x" aspectRatio="16/9"><div>x</div></MediaFrame>)
    const frame = container.querySelector('[data-frame]') as HTMLElement
    expect(frame.style.aspectRatio).toBe('16 / 9')
  })
})
```

**Step 2: Run — fail**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8/web
npx vitest run components/ui/MediaFrame.test.tsx
```

**Step 3: Implement**

```tsx
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  cornerMark: string
  caption?: string
  /** CSS aspect-ratio value, e.g. '4/5', '16/9', '1/1' */
  aspectRatio?: string
  className?: string
}

/**
 * Cream-shade backdrop + ink border + mono corner mark + optional caption.
 * Shared by ImageBlock / GalleryBlock / VideoBlock and PDP product images.
 */
export function MediaFrame({
  children, cornerMark, caption, aspectRatio = '4/5', className = '',
}: Props) {
  return (
    <figure className={`flex flex-col gap-3 ${className}`.trim()}>
      <div
        data-frame
        className="relative bg-[var(--color-lj-cream-shade)] border border-[var(--color-lj-rule)] overflow-hidden transition-[border-color] duration-500 hover:border-[var(--color-lj-ink)]"
        style={{ aspectRatio: aspectRatio.replace('/', ' / ') }}
      >
        <span className="absolute top-3.5 left-3.5 z-[2] font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] text-[var(--color-lj-ink)] opacity-55">
          {cornerMark}
        </span>
        {children}
      </div>
      {caption && (
        <figcaption
          data-caption
          className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] text-[var(--color-lj-ink)] opacity-70"
        >
          — {caption}
        </figcaption>
      )}
    </figure>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/ui/MediaFrame.test.tsx  # green
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8
git add web/components/ui/MediaFrame.tsx web/components/ui/MediaFrame.test.tsx
git commit -m "feat(v3-s8): add MediaFrame primitive (shared image/gallery/video chrome)"
```

---

## Stage 8.2 — Shared primitive: `<FaqAccordion>`

### Task 8.2

**Files:**
- Create: `web/components/ui/FaqAccordion.tsx`
- Create: `web/components/ui/FaqAccordion.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FaqAccordion } from './FaqAccordion'

describe('<FaqAccordion>', () => {
  it('renders one item per question', () => {
    const items = [
      { q: 'Как заказать?', a: 'На сайте.' },
      { q: 'Срок доставки?', a: 'От 2 дней.' },
    ]
    const { container } = render(<FaqAccordion items={items} />)
    expect(container.querySelectorAll('details').length).toBe(2)
  })

  it('renders question label in mono uppercase', () => {
    render(<FaqAccordion items={[{ q: 'Test?', a: 'Yes.' }]} />)
    const summary = screen.getByText('Test?')
    expect(summary.className).toContain('font-[var(--font-lj-mono)]')
    expect(summary.className).toContain('uppercase')
  })

  it('renders answer in italic Inter', () => {
    render(<FaqAccordion items={[{ q: 'Q', a: 'Italic answer.' }]} />)
    const answer = screen.getByText('Italic answer.')
    expect(answer.className).toContain('italic')
  })

  it('expands when summary is clicked (native details)', () => {
    render(<FaqAccordion items={[{ q: 'Q', a: 'A' }]} />)
    const details = document.querySelector('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    fireEvent.click(details.querySelector('summary')!)
    expect(details.open).toBe(true)
  })
})
```

**Step 2: Run — fail**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8/web
npx vitest run components/ui/FaqAccordion.test.tsx
```

**Step 3: Implement**

```tsx
interface FaqItem { q: string; a: string }
interface Props { items: FaqItem[] }

/**
 * Native <details>/<summary> accordion styled v3. Zero JS.
 * Mono uppercase question, italic Inter answer, brand-purple +/- indicator.
 */
export function FaqAccordion({ items }: Props) {
  return (
    <ul className="list-none p-0 m-0 flex flex-col gap-0 border-t border-[var(--color-lj-rule)]">
      {items.map((item, i) => (
        <li key={i} className="border-b border-[var(--color-lj-rule)]">
          <details className="group/faq relative">
            <summary className="cursor-pointer font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.06em] py-5 pr-12 list-none [&::-webkit-details-marker]:hidden flex items-start justify-between gap-4 hover:text-[var(--color-lj-brand-deep)] transition-colors">
              <span>{item.q}</span>
              <span aria-hidden="true" className="font-[var(--font-lj-mono)] text-[var(--color-lj-brand)] text-base group-open/faq:hidden">+</span>
              <span aria-hidden="true" className="font-[var(--font-lj-mono)] text-[var(--color-lj-brand)] text-base hidden group-open/faq:inline">−</span>
            </summary>
            <p className="italic text-[1.0625rem] leading-[1.55] text-[var(--color-lj-ink)] opacity-80 pb-6 pr-12 max-w-[60ch]">
              {item.a}
            </p>
          </details>
        </li>
      ))}
    </ul>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/ui/FaqAccordion.test.tsx  # green
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8
git add web/components/ui/FaqAccordion.tsx web/components/ui/FaqAccordion.test.tsx
git commit -m "feat(v3-s8): add FaqAccordion native details primitive"
```

---

## Stage 8.A — Homepage v2 sections rebuild

### Task 8.A.1: `<CategoryTileLJ>` (TDD)

**Files:**
- Create: `web/components/marketing/CategoryTileLJ.tsx`
- Create: `web/components/marketing/CategoryTileLJ.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryTileLJ } from './CategoryTileLJ'
import type { ProductCategory } from '@ximi4ka-shop/shared'

const cat: ProductCategory = {
  id: 'c1', slug: 'reaktivy', name: 'Реактивы', metaDescription: 'Описание',
  parentId: null, sortOrder: 0,
} as ProductCategory

describe('<CategoryTileLJ>', () => {
  it('renders corner mark with index', () => {
    render(<CategoryTileLJ category={cat} index={0} productCount={42} />)
    expect(screen.getByText(/arr.*C-01/i)).toBeInTheDocument()
  })

  it('renders Unbounded display name', () => {
    render(<CategoryTileLJ category={cat} index={0} productCount={42} />)
    const name = screen.getByText('Реактивы')
    expect(name.className).toContain('font-[var(--font-lj-display)]')
  })

  it('renders mono product count', () => {
    render(<CategoryTileLJ category={cat} index={0} productCount={42} />)
    expect(screen.getByText(/42 товаров/i)).toBeInTheDocument()
  })

  it('renders an SVG molecule decoration', () => {
    const { container } = render(<CategoryTileLJ category={cat} index={0} productCount={42} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('links to the category page', () => {
    const { container } = render(<CategoryTileLJ category={cat} index={0} productCount={42} />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/categories/reaktivy')
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
import Link from 'next/link'
import type { ProductCategory } from '@ximi4ka-shop/shared'
import { MoleculeMotifLJ } from '@/components/decor/MoleculeMotif.lj'

type MoleculeVariant = 'benzene' | 'anthracene' | 'water' | 'methane'

// Semantic mapping per design doc §4. Falls back to benzene if slug not in map.
const MOLECULE_BY_SLUG: Record<string, MoleculeVariant> = {
  'nabory-dlya-opytov': 'benzene',
  'reaktivy': 'water',
  'laboratornoe-oborudovanie': 'methane',
  'kombo': 'anthracene',
  'pechatnaya-produktsiya': 'water',
  'novinki': 'benzene',
}

interface Props {
  category: ProductCategory
  index: number
  productCount: number
}

export function CategoryTileLJ({ category, index, productCount }: Props) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const variant = MOLECULE_BY_SLUG[category.slug] ?? 'benzene'
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="callout-host group/cat relative block aspect-[5/4] bg-[var(--color-lj-cream-shade)] border border-[var(--color-lj-rule)] overflow-hidden transition-[border-color] duration-500 hover:border-[var(--color-lj-ink)]"
    >
      <span className="absolute top-3.5 left-3.5 z-[3] font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] text-[var(--color-lj-ink)] opacity-55">
        arr. C-{pad(index + 1)}
      </span>
      <MoleculeMotifLJ
        variant={variant}
        className="absolute right-[-15%] top-[10%] w-[60%] text-[var(--color-lj-ink)] opacity-15 pointer-events-none"
      />
      <div className="absolute bottom-3.5 left-3.5 right-3.5 z-[2] flex flex-col gap-2">
        <h3 className="font-[var(--font-lj-display)] font-[700] text-[clamp(1.5rem,2.2vw,2rem)] leading-[0.95] tracking-[-0.035em] text-[var(--color-lj-ink)]">
          {category.name}
        </h3>
        <span className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] text-[var(--color-lj-ink)] opacity-65">
          {productCount} товаров →
        </span>
      </div>
    </Link>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/marketing/CategoryTileLJ.test.tsx
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8
git add web/components/marketing/CategoryTileLJ.tsx web/components/marketing/CategoryTileLJ.test.tsx
git commit -m "feat(v3-s8): add CategoryTileLJ drawer with per-category molecule"
```

---

### Task 8.A.2: `<HowItWorksStepLJ>` (TDD)

**Files:**
- Create: `web/components/marketing/HowItWorksStepLJ.tsx`
- Create: `web/components/marketing/HowItWorksStepLJ.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HowItWorksStepLJ } from './HowItWorksStepLJ'

describe('<HowItWorksStepLJ>', () => {
  it('renders index, big verb, title, body, and decimal', () => {
    render(
      <HowItWorksStepLJ
        index={1}
        verb="ВЫБРАТЬ"
        title="Выберите набор"
        body="Подберите эксперимент по возрасту."
      />
    )
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('ВЫБРАТЬ')).toBeInTheDocument()
    expect(screen.getByText('Выберите набор')).toBeInTheDocument()
    expect(screen.getByText(/Подберите эксперимент/)).toBeInTheDocument()
    expect(screen.getByText('1.0')).toBeInTheDocument()
  })

  it('renders the title and body inside the cell', () => {
    const { container } = render(
      <HowItWorksStepLJ index={2} verb="X" title="T" body="B" />
    )
    expect(container.querySelector('.lj-num-cell')).not.toBeNull()
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
import { NumberCell } from '@/components/ui/NumberCell'

interface Props {
  index: number  // 1-based
  verb: string   // big upper-case verb (e.g. "ВЫБРАТЬ")
  title: string  // step title (e.g. "Выберите набор")
  body: string   // description
}

export function HowItWorksStepLJ({ index, verb, title, body }: Props) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <NumberCell
      index={pad(index)}
      topLabel="шаг"
      big={verb}
      bottomLeft={`${index}.0`}
      bottomRight="процесс"
    >
      <div className="flex flex-col gap-2">
        <h3 className="font-[var(--font-lj-display)] font-[700] text-[1.125rem] leading-[1.15] tracking-[-0.02em] text-[var(--color-lj-bone)]">
          {title}
        </h3>
        <p className="font-[var(--font-lj-body)] text-[0.9375rem] leading-[1.5] text-[var(--color-lj-bone-mute)]">
          {body}
        </p>
      </div>
    </NumberCell>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/marketing/HowItWorksStepLJ.test.tsx
git add web/components/marketing/HowItWorksStepLJ.tsx web/components/marketing/HowItWorksStepLJ.test.tsx
git commit -m "feat(v3-s8): add HowItWorksStepLJ composing NumberCell"
```

---

### Task 8.A.3: `<TestimonialQuoteLJ>` (TDD)

**Files:**
- Create: `web/components/marketing/TestimonialQuoteLJ.tsx`
- Create: `web/components/marketing/TestimonialQuoteLJ.test.tsx`

**Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TestimonialQuoteLJ } from './TestimonialQuoteLJ'

describe('<TestimonialQuoteLJ>', () => {
  it('renders body in italic and attribution as mono citation', () => {
    render(
      <TestimonialQuoteLJ
        body="Дети в восторге, всё работает с первого раза."
        author="А. ИВАНОВА"
        meta={['МОСКВА', '2024-03-15', '12 опытов']}
      />
    )
    const body = screen.getByText(/Дети в восторге/)
    expect(body.className).toContain('italic')
    expect(screen.getByText(/А\. ИВАНОВА/)).toBeInTheDocument()
    expect(screen.getByText(/МОСКВА.*2024-03-15.*12 опытов/i)).toBeInTheDocument()
  })

  it('renders brand-purple opening quotation mark', () => {
    const { container } = render(
      <TestimonialQuoteLJ body="x" author="X" meta={[]} />
    )
    const quote = container.querySelector('.lj-quote-mark')
    expect(quote?.textContent).toContain('«')
    expect(quote?.className).toContain('text-[var(--color-lj-brand)]')
  })
})
```

**Step 2: Run — fail**

**Step 3: Implement**

```tsx
interface Props {
  body: string
  author: string
  meta: string[]  // e.g. ['МОСКВА', '2024-03-15', '12 опытов']
}

export function TestimonialQuoteLJ({ body, author, meta }: Props) {
  const citationLine = ['—', author, ...meta].join(' · ')
  return (
    <article className="border-t border-[var(--color-lj-rule)] pt-6 flex flex-col gap-4">
      <span className="lj-quote-mark font-[var(--font-lj-display)] font-[900] text-5xl leading-none text-[var(--color-lj-brand)]">
        «
      </span>
      <p className="italic text-[1.125rem] leading-[1.5] text-[var(--color-lj-ink)] opacity-90 max-w-[36ch]">
        {body}
      </p>
      <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] text-[var(--color-lj-ink)] opacity-65 mt-2">
        {citationLine}
      </p>
    </article>
  )
}
```

**Step 4: Pass + Step 5: Commit**

```bash
npx vitest run components/marketing/TestimonialQuoteLJ.test.tsx
git add web/components/marketing/TestimonialQuoteLJ.tsx web/components/marketing/TestimonialQuoteLJ.test.tsx
git commit -m "feat(v3-s8): add TestimonialQuoteLJ lab citation pattern"
```

---

### Task 8.A.4: Wire homepage sections

**Files:**
- Modify: `web/app/[locale]/(public)/page.tsx`

**Step 1: Inspect current homepage section composition**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8
grep -n 'CategoryTile\|HowItWorksStep\|TestimonialCard\|<Section\|<SectionHeading' web/app/[locale]/\(public\)/page.tsx
```

Note: there are likely 3-4 v2 `<Section>` blocks wrapping `CategoryTile`/`HowItWorksStep`/`TestimonialCard` between the v3-migrated sections.

**Step 2: Replace the three v2 sections**

For each:

(a) **«Каталог по интересам»** — replace v2 `<Section>` + `CategoryTile` map with:
```tsx
<LabSection variant="cream" className="px-6 py-32">
  <NotebookHeader section="04" label="Каталог" page={4} total={9} />
  <div className="max-w-[var(--max-lj-content)] mx-auto">
    <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] mb-5 inline-flex items-center gap-3 before:content-[''] before:w-2 before:h-2 before:bg-[var(--color-lj-brand)] before:rounded-full">
      04.0 / Каталог
    </p>
    <h2 className="font-[var(--font-lj-display)] font-[900] text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.92] tracking-[-0.045em] mb-16">
      Каталог по<br /><em className="italic text-[var(--color-lj-brand)] font-[900]">интересам</em>
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {featuredCategories.map((cat, i) => (
        <CategoryTileLJ
          key={cat.id}
          category={cat}
          index={i}
          productCount={cat.productCount ?? 0}
        />
      ))}
    </div>
  </div>
</LabSection>
```

(b) **«Как это работает»** — replace the existing LabSection + HowItWorksStep map. The wrapping LabSection variant="ink" might already be there from Stage 5 — keep it; replace only the inner content:

```tsx
<LabSection variant="ink" id="how-it-works" className="px-6 py-32 relative">
  <NotebookHeader section="05" label="Процесс" page={5} total={9} />
  <div className="max-w-[var(--max-lj-narrow)] mx-auto relative z-[2]">
    <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] text-[var(--color-lj-bone-mute)] mb-12 inline-flex items-center gap-3 before:content-[''] before:w-2 before:h-2 before:bg-[var(--color-lj-brand)] before:rounded-full">
      05.0 / Процесс
    </p>
    <h2 className="font-[var(--font-lj-display)] font-[700] text-[clamp(2rem,4vw,3.5rem)] leading-[1.0] tracking-[-0.04em] mb-16 max-w-[20ch]">
      От заказа до <em className="italic text-[var(--color-lj-brand)] font-[700]">опыта</em> — три шага
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <HowItWorksStepLJ index={1} verb="ВЫБРАТЬ" title="Выберите набор" body="Подберите эксперимент по возрасту и интересам ребёнка. Все наборы безопасны и продуманы." />
      <HowItWorksStepLJ index={2} verb="СОБРАТЬ" title="Распакуйте и проведите" body="Внутри — все необходимые реактивы и понятная инструкция. Можно проводить дома вместе с детьми." />
      <HowItWorksStepLJ index={3} verb="ВЕСТИ" title="Получите знания" body="Каждый набор сопровождается методическими материалами — научите детей думать как учёные." />
    </div>
  </div>
</LabSection>
```

(c) **«Что говорят родители»** — replace the existing v2 `<Section>` + `TestimonialCard` map with:

```tsx
<LabSection variant="cream" className="px-6 py-32">
  <NotebookHeader section="06" label="Отзывы" page={6} total={9} />
  <div className="max-w-[var(--max-lj-content)] mx-auto">
    <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] mb-5 inline-flex items-center gap-3 before:content-[''] before:w-2 before:h-2 before:bg-[var(--color-lj-brand)] before:rounded-full">
      06.0 / Отзывы
    </p>
    <h2 className="font-[var(--font-lj-display)] font-[900] text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.92] tracking-[-0.045em] mb-16">
      Что говорят<br /><em className="italic text-[var(--color-lj-brand)] font-[900]">родители</em>
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
      {testimonials.map((t) => (
        <TestimonialQuoteLJ
          key={t.id}
          body={t.body}
          author={(t.author ?? '').toUpperCase()}
          meta={[t.city, t.date, t.context].filter(Boolean) as string[]}
        />
      ))}
    </div>
  </div>
</LabSection>
```

If the existing testimonial data shape differs, adapt the prop mapping. If `productCount` isn't currently fetched per-category, add the fetch (likely a count query against the `products` table).

**Step 3: Update imports**

```tsx
// remove:
import { CategoryTile } from '@/components/marketing/CategoryTile'  // → CategoryTileLJ
import { HowItWorksStep } from '@/components/marketing/HowItWorksStep'  // → HowItWorksStepLJ
import { TestimonialCard } from '@/components/marketing/TestimonialCard'  // → TestimonialQuoteLJ

// possibly remove if no other consumer:
import { Section, SectionHeading } from '@/components/ui'

// add:
import { CategoryTileLJ } from '@/components/marketing/CategoryTileLJ'
import { HowItWorksStepLJ } from '@/components/marketing/HowItWorksStepLJ'
import { TestimonialQuoteLJ } from '@/components/marketing/TestimonialQuoteLJ'
```

**Step 4: Verify + commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8/web
npm run typecheck
npm run test 2>&1 | tail -5
npm run build 2>&1 | tail -5
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8
git add web/app/[locale]/(public)/page.tsx
git commit -m "feat(v3-s8): wire homepage v3 categories + how-it-works + testimonials"
```

---

## Stage 8.B — CMS block library rewrites

Each block follows the same TDD pattern. Where existing tests assert v2 classes, update assertions to v3.

### Task 8.B.1: ParagraphBlock v3

**Files:**
- Modify: `web/components/blocks/ParagraphBlock.tsx`
- Modify: `web/components/blocks/ParagraphBlock.test.tsx`

**Step 1: Read current**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8
cat web/components/blocks/ParagraphBlock.tsx
cat web/components/blocks/ParagraphBlock.test.tsx
```

**Step 2: Update test assertion**

If test asserts `prose-on-dark` or `--color-brand-text`, change to v3 expectations: assert that the rendered prose container uses `font-[var(--font-lj-body)]` and that `<strong>` text gets `text-[var(--color-lj-brand)] italic` styling.

```tsx
// Add this case
it('renders <strong> as brand-purple italic', () => {
  const { container } = render(
    <ParagraphBlock block={{ type: 'paragraph', html: '<p>Hello <strong>world</strong></p>' }} />
  )
  const strong = container.querySelector('strong')
  expect(strong?.className || '').toMatch(/italic|text-\[var\(--color-lj-brand\)/)
})
```

**Step 3: Implement**

```tsx
import type { ParagraphBlock as ParagraphBlockType } from '@ximi4ka-shop/shared'

interface Props { block: ParagraphBlockType }

export function ParagraphBlock({ block }: Props) {
  return (
    <div
      className="lj-prose font-[var(--font-lj-body)] text-[1.0625rem] leading-[1.6] text-[var(--color-lj-ink)] [&_strong]:italic [&_strong]:text-[var(--color-lj-brand)] [&_strong]:font-[700] [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-[var(--color-lj-brand-deep)] [&_code]:font-[var(--font-lj-mono)] [&_code]:text-[var(--color-lj-brand-deep)] [&_p]:mb-4 [&_p:last-child]:mb-0 max-w-[60ch]"
      dangerouslySetInnerHTML={{ __html: block.html }}
    />
  )
}
```

The class composition uses Tailwind 4 child selectors `[&_strong]:...` to style sanitized HTML. The HTML still goes through `isomorphic-dompurify` upstream (verify via existing sanitizer call site) so XSS is contained.

**Step 4: Pass + Step 5: Commit**

```bash
cd web && npx vitest run components/blocks/ParagraphBlock.test.tsx && cd ..
git add web/components/blocks/ParagraphBlock.tsx web/components/blocks/ParagraphBlock.test.tsx
git commit -m "feat(v3-s8): ParagraphBlock v3 prose"
```

---

### Task 8.B.2: ImageBlock v3 (uses MediaFrame)

**Files:**
- Modify: `web/components/blocks/ImageBlock.tsx`
- Modify: `web/components/blocks/ImageBlock.test.tsx`

**Step 1: Read current + test**

**Step 2: Replace implementation**

```tsx
import Image from 'next/image'
import type { ImageBlock as ImageBlockType } from '@ximi4ka-shop/shared'
import { MediaFrame } from '@/components/ui/MediaFrame'

interface Props { block: ImageBlockType }

export function ImageBlock({ block }: Props) {
  return (
    <MediaFrame
      cornerMark={block.altCornerMark ?? 'arr. img'}
      caption={block.caption}
      aspectRatio={block.aspectRatio ?? '4/5'}
      className="max-w-[var(--max-lj-narrow)] mx-auto"
    >
      <Image
        src={block.src}
        alt={block.alt}
        fill
        sizes="(max-width: 768px) 100vw, 800px"
        className="object-cover"
      />
    </MediaFrame>
  )
}
```

If the `ImageBlock` shared type doesn't have `altCornerMark` / `aspectRatio`, default them. If `caption` doesn't exist, drop the prop.

**Step 3: Update test assertions** to expect MediaFrame structure (look for `[data-frame]` data attribute, `<figcaption>`, etc.)

**Step 4: Pass + Step 5: Commit**

```bash
git add web/components/blocks/ImageBlock.tsx web/components/blocks/ImageBlock.test.tsx
git commit -m "feat(v3-s8): ImageBlock v3 via MediaFrame"
```

---

### Task 8.B.3: GalleryBlock v3 (uses MediaFrame)

**Files:**
- Modify: `web/components/blocks/GalleryBlock.tsx`
- Modify: `web/components/blocks/GalleryBlock.test.tsx`

**Step 1-3: Implement**

```tsx
import Image from 'next/image'
import type { GalleryBlock as GalleryBlockType } from '@ximi4ka-shop/shared'
import { MediaFrame } from '@/components/ui/MediaFrame'

interface Props { block: GalleryBlockType }

export function GalleryBlock({ block }: Props) {
  const cols = block.images.length === 2 ? 'md:grid-cols-2' : block.images.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <div className={`grid grid-cols-1 ${cols} gap-5 max-w-[var(--max-lj-content)] mx-auto`}>
      {block.images.map((img, i) => (
        <MediaFrame
          key={img.src}
          cornerMark={`arr. ${pad(i + 1)}`}
          caption={img.caption}
          aspectRatio="1/1"
        >
          <Image src={img.src} alt={img.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
        </MediaFrame>
      ))}
    </div>
  )
}
```

**Step 4-5: Test pass + commit**

```bash
git commit -m "feat(v3-s8): GalleryBlock v3 via MediaFrame grid"
```

---

### Task 8.B.4: VideoBlock v3 (uses MediaFrame)

**Files:**
- Modify: `web/components/blocks/VideoBlock.tsx`
- Modify: `web/components/blocks/VideoBlock.test.tsx`

```tsx
import type { VideoBlock as VideoBlockType } from '@ximi4ka-shop/shared'
import { MediaFrame } from '@/components/ui/MediaFrame'

interface Props { block: VideoBlockType }

export function VideoBlock({ block }: Props) {
  return (
    <MediaFrame
      cornerMark="arr. vid"
      caption={block.caption}
      aspectRatio="16/9"
      className="max-w-[var(--max-lj-narrow)] mx-auto"
    >
      <iframe
        src={block.embedUrl}
        title={block.title ?? 'Video'}
        className="absolute inset-0 w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </MediaFrame>
  )
}
```

Adapt to the actual `VideoBlock` shape — it likely already has `embedUrl` or similar. Update tests to assert the iframe + MediaFrame structure.

```bash
git commit -m "feat(v3-s8): VideoBlock v3 via MediaFrame"
```

---

### Task 8.B.5: LayoutBlock v3

**Files:**
- Modify: `web/components/blocks/LayoutBlock.tsx`
- Modify: `web/components/blocks/LayoutBlock.test.tsx`

LayoutBlock is the largest — composite of MediaFrame + text column with display heading + body. Variants `media-left | media-right | media-top | media-bottom` preserved.

```tsx
import Image from 'next/image'
import type { LayoutBlock as LayoutBlockType } from '@ximi4ka-shop/shared'
import { MediaFrame } from '@/components/ui/MediaFrame'

interface Props { block: LayoutBlockType }

export function LayoutBlock({ block }: Props) {
  const isHorizontal = block.variant === 'media-left' || block.variant === 'media-right'
  const mediaFirst = block.variant === 'media-left' || block.variant === 'media-top'
  const layoutClass = isHorizontal ? 'md:grid-cols-2 items-center' : 'grid-cols-1'

  const media = (
    <MediaFrame cornerMark="arr. layout" aspectRatio={isHorizontal ? '4/5' : '16/9'}>
      <Image src={block.image.src} alt={block.image.alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
    </MediaFrame>
  )

  const text = (
    <div className="flex flex-col gap-4">
      {block.eyebrow && (
        <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] inline-flex items-center gap-3 before:content-[''] before:w-2 before:h-2 before:bg-[var(--color-lj-brand)] before:rounded-full">
          {block.eyebrow}
        </p>
      )}
      <h3 className="font-[var(--font-lj-display)] font-[700] text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.05] tracking-[-0.035em]">
        {block.heading}
      </h3>
      <div className="lj-prose font-[var(--font-lj-body)] text-[1.0625rem] leading-[1.6] [&_strong]:italic [&_strong]:text-[var(--color-lj-brand)]" dangerouslySetInnerHTML={{ __html: block.bodyHtml }} />
    </div>
  )

  return (
    <div className={`grid gap-12 ${layoutClass} max-w-[var(--max-lj-content)] mx-auto`}>
      {mediaFirst ? media : text}
      {mediaFirst ? text : media}
    </div>
  )
}
```

Adapt to the actual `LayoutBlock` shape. Variants might be different — preserve them.

```bash
git commit -m "feat(v3-s8): LayoutBlock v3 composite"
```

---

### Task 8.B.6: CtaBlock v3

**Files:**
- Modify: `web/components/blocks/CtaBlock.tsx`
- Modify: `web/components/blocks/CtaBlock.test.tsx`

```tsx
import Link from 'next/link'
import type { CtaBlock as CtaBlockType } from '@ximi4ka-shop/shared'

interface Props { block: CtaBlockType }

export function CtaBlock({ block }: Props) {
  return (
    <div className="max-w-[var(--max-lj-narrow)] mx-auto text-center flex flex-col items-center gap-6">
      {block.eyebrow && (
        <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em]">
          {block.eyebrow}
        </p>
      )}
      <h3 className="font-[var(--font-lj-display)] font-[700] text-[clamp(2rem,4vw,3rem)] leading-[1.0] tracking-[-0.04em] max-w-[20ch]">
        {block.heading}
      </h3>
      {block.body && (
        <p className="text-[1.0625rem] leading-[1.5] opacity-78 max-w-[48ch]">
          {block.body}
        </p>
      )}
      <Link
        href={block.cta.href}
        className="inline-flex items-center gap-3 px-7 py-4 font-[var(--font-lj-mono)] text-[0.8125rem] font-medium uppercase tracking-[0.08em] border border-[var(--color-lj-ink)] rounded-full bg-[var(--color-lj-ink)] text-[var(--color-lj-bone)] transition-all duration-400 hover:bg-[var(--color-lj-brand-deep)] hover:border-[var(--color-lj-brand-deep)]"
      >
        {block.cta.label} →
      </Link>
    </div>
  )
}
```

```bash
git commit -m "feat(v3-s8): CtaBlock v3"
```

---

### Task 8.B.7: FaqBlock v3 (uses FaqAccordion)

**Files:**
- Modify: `web/components/blocks/FaqBlock.tsx`
- Modify: `web/components/blocks/FaqBlock.test.tsx`

```tsx
import type { FaqBlock as FaqBlockType } from '@ximi4ka-shop/shared'
import { FaqAccordion } from '@/components/ui/FaqAccordion'

interface Props { block: FaqBlockType }

export function FaqBlock({ block }: Props) {
  return (
    <div className="max-w-[var(--max-lj-narrow)] mx-auto">
      {block.eyebrow && (
        <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] mb-5 inline-flex items-center gap-3 before:content-[''] before:w-2 before:h-2 before:bg-[var(--color-lj-brand)] before:rounded-full">
          {block.eyebrow}
        </p>
      )}
      {block.heading && (
        <h3 className="font-[var(--font-lj-display)] font-[700] text-[clamp(2rem,3.5vw,3rem)] leading-[1.05] tracking-[-0.035em] mb-12 max-w-[20ch]">
          {block.heading}
        </h3>
      )}
      <FaqAccordion items={block.items} />
    </div>
  )
}
```

```bash
git commit -m "feat(v3-s8): FaqBlock v3 via FaqAccordion"
```

---

### Task 8.B.8: ProductGridBlock cleanup

**Files:**
- Modify: `web/components/blocks/ProductGridBlock.tsx` (already mostly v3)

This block already uses ProductCard. Just needs to:
- Remove the placeholder zero-stat from when ProductCard required `stats`/`statMaxes`
- Verify it works with current ProductCard signature

If ProductCard's stats are now optional (let me check)... actually they're required per Task 4.3. So ProductGridBlock still needs to pass placeholder stats until kit_stats admin field exists. Leave as-is, commit if no change.

If a real change is needed (e.g. v3 typography wrapping the grid), apply minimal v3 wrapper:

```tsx
// Wrap the grid with v3 eyebrow/heading if not already
```

```bash
git commit --allow-empty -m "feat(v3-s8): ProductGridBlock — verified, no change required"
```

---

## Stage 8.C — Categories pages rebuild

### Task 8.C.1: `<CategoryFilterBar>` (TDD)

**Files:**
- Create: `web/components/marketing/CategoryFilterBar.tsx`
- Create: `web/components/marketing/CategoryFilterBar.test.tsx`

Minimal sort + reset only (per design doc §9).

**Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryFilterBar } from './CategoryFilterBar'

describe('<CategoryFilterBar>', () => {
  it('renders sort options', () => {
    render(<CategoryFilterBar sort="newest" onSortChange={() => {}} onReset={() => {}} />)
    expect(screen.getByRole('button', { name: /сортировка/i })).toBeInTheDocument()
  })

  it('calls onReset when reset button is clicked', () => {
    const onReset = vi.fn()
    render(<CategoryFilterBar sort="newest" onSortChange={() => {}} onReset={onReset} />)
    fireEvent.click(screen.getByRole('button', { name: /сбросить/i }))
    expect(onReset).toHaveBeenCalled()
  })
})
```

**Step 2-5: Implement + commit**

```tsx
'use client'

import type { ReactNode } from 'react'

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'name-asc'

const SORT_LABELS: Record<SortKey, string> = {
  'newest': 'Новинки',
  'price-asc': 'Цена ↑',
  'price-desc': 'Цена ↓',
  'name-asc': 'А–Я',
}

interface Props {
  sort: SortKey
  onSortChange: (s: SortKey) => void
  onReset: () => void
}

export function CategoryFilterBar({ sort, onSortChange, onReset }: Props) {
  return (
    <div className="sticky top-16 z-30 bg-[var(--color-lj-cream)]/95 backdrop-blur-sm border-y border-[var(--color-lj-rule)] py-3 px-6">
      <div className="max-w-[var(--max-lj-content)] mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] opacity-70 mr-2">
            сортировка:
          </span>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onSortChange(key)}
              className={`px-3 py-1.5 border rounded-full font-[var(--font-lj-mono)] text-[0.6875rem] uppercase tracking-[0.04em] transition-colors duration-300 ${
                sort === key
                  ? 'bg-[var(--color-lj-ink)] border-[var(--color-lj-ink)] text-[var(--color-lj-bone)]'
                  : 'border-[var(--color-lj-ink)] bg-transparent text-[var(--color-lj-ink)] hover:bg-[var(--color-lj-ink)] hover:text-[var(--color-lj-bone)]'
              }`}
              aria-label={`Сортировка: ${SORT_LABELS[key]}`}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] underline underline-offset-4 hover:text-[var(--color-lj-brand-deep)]"
          aria-label="Сбросить сортировку"
        >
          Сбросить ×
        </button>
      </div>
    </div>
  )
}
```

```bash
git add web/components/marketing/CategoryFilterBar.tsx web/components/marketing/CategoryFilterBar.test.tsx
git commit -m "feat(v3-s8): add CategoryFilterBar (sort + reset only)"
```

---

### Task 8.C.2: `/categories` index rewrite

**Files:**
- Modify: `web/app/[locale]/(public)/categories/page.tsx` (full rewrite)

Replace v2 chrome with v3:

```tsx
// (keep existing imports for getCategories, JsonLd, generateMetadata)
import { LabSection } from '@/components/ui/LabSection'
import { NotebookHeader } from '@/components/ui/NotebookHeader'
import { CategoryTileLJ } from '@/components/marketing/CategoryTileLJ'
import { PreFooterCta } from '@/components/marketing/PreFooterCta'

// Remove imports of v2 components no longer used.

export default async function CategoriesIndex({ params }: { params: Promise<{ locale: string }> }) {
  // ... preserved data-fetching logic ...

  return (
    <>
      {/* preserved JsonLd */}

      <LabSection variant="cream" className="px-6 pt-32 pb-24">
        <NotebookHeader section="X" label="Каталог" page={1} total={1} />
        <div className="max-w-[var(--max-lj-content)] mx-auto">
          <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] mb-5 inline-flex items-center gap-3 before:content-[''] before:w-2 before:h-2 before:bg-[var(--color-lj-brand)] before:rounded-full">
            X.0 / Все категории
          </p>
          <h1 className="font-[var(--font-lj-display)] font-[900] text-[clamp(3rem,7vw,6rem)] leading-[0.92] tracking-[-0.045em] mb-8">
            Категории
          </h1>
          <p className="text-xl leading-[1.45] opacity-78 max-w-[48ch] mb-16">
            Выберите тематику набора. От базовых наборов до электрохимии.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat, i) => (
              <CategoryTileLJ
                key={cat.id}
                category={cat}
                index={i}
                productCount={cat.productCount ?? 0}
              />
            ))}
          </div>
        </div>
      </LabSection>

      {/* preserved PreFooterCta */}
    </>
  )
}
```

Preserve `generateMetadata` + JsonLd untouched.

```bash
git add web/app/[locale]/(public)/categories/page.tsx
git commit -m "feat(v3-s8): rewrite /categories index with v3 drawer-card grid"
```

---

### Task 8.C.3: `/categories/[slug]` rewrite

**Files:**
- Modify: `web/app/[locale]/(public)/categories/[slug]/page.tsx` (full rewrite)

This is the most substantial Stage 8.C task. Preserve SEO + breadcrumbs + pagination URL contract. Add v3 hero + sticky filter bar + asymmetric product grid.

```tsx
// (preserve all data-fetching, pagination, SEO)
import { LabSection } from '@/components/ui/LabSection'
import { NotebookHeader } from '@/components/ui/NotebookHeader'
import { CategoryFilterBar } from '@/components/marketing/CategoryFilterBar'
import { ProductCard } from '@/components/ProductCard'
import { PreFooterCta } from '@/components/marketing/PreFooterCta'

export default async function CategoryDetail({ params, searchParams }: ...) {
  // preserved: const category = await getCategoryBySlug(...)
  // preserved: const products = await listProductsByCategory(...)
  // preserved: pagination logic, sort=... query handling

  return (
    <>
      {/* preserved JsonLd + breadcrumb JsonLd */}

      {/* Breadcrumbs (mono row) */}
      <nav className="max-w-[var(--max-lj-content)] mx-auto px-6 pt-6 font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.06em] opacity-70">
        {/* preserved breadcrumb links */}
      </nav>

      {/* HERO */}
      <LabSection variant="cream" className="px-6 pt-12 pb-16">
        <NotebookHeader section="C" label={category.name} page={1} total={3} />
        <div className="max-w-[var(--max-lj-content)] mx-auto">
          <p className="font-[var(--font-lj-mono)] text-[length:var(--text-lj-mono-sm)] uppercase tracking-[0.08em] mb-5 inline-flex items-center gap-3 before:content-[''] before:w-2 before:h-2 before:bg-[var(--color-lj-brand)] before:rounded-full">
            C.0 / Категория
          </p>
          <h1 className="font-[var(--font-lj-display)] font-[900] text-[clamp(2.5rem,6vw,5rem)] leading-[0.92] tracking-[-0.045em] mb-6">
            {/* Split category.name on whitespace; first word brand-purple italic */}
            {(() => {
              const words = category.name.split(/\s+/)
              return words.map((w, i) => (
                <span key={i} className="block">
                  {i === 0 ? <em className="not-italic-fix italic text-[var(--color-lj-brand)] font-[900]">{w}</em> : w}
                </span>
              ))
            })()}
          </h1>
          {category.metaDescription && (
            <p className="text-xl leading-[1.45] opacity-78 max-w-[48ch]">
              {category.metaDescription}
            </p>
          )}
        </div>
      </LabSection>

      {/* Filter bar (sticky) */}
      <CategoryFilterBar
        sort={currentSort}
        onSortChange={(s) => router.push(`?sort=${s}`)}
        onReset={() => router.push(`?`)}
      />

      {/* Product grid */}
      <LabSection variant="cream" className="px-6 py-16">
        <div className="max-w-[var(--max-lj-content)] mx-auto">
          {products.length === 0 ? (
            <p className="text-center opacity-60 py-32 font-[var(--font-lj-mono)] uppercase tracking-[0.06em]">Ничего не найдено</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  stats={{ reagents: 0, instruments: 0, reactions: 0 }}
                  statMaxes={{ reagents: 1, instruments: 1, reactions: 1 }}
                />
              ))}
            </div>
          )}
          {/* preserved pagination */}
        </div>
      </LabSection>

      <PreFooterCta {...preFooterProps} />
    </>
  )
}
```

The CategoryFilterBar's `onSortChange` / `onReset` need to bridge to Next router (client component) — wrap in a `'use client'` boundary or use a small client wrapper. Easiest: extract `<CategoryFilterBarMount sort={currentSort} />` that internally uses `useRouter` from `next/navigation`.

If the existing page already had server-side sort logic, preserve it; only swap the visual chrome.

```bash
git add web/app/[locale]/(public)/categories/[slug]/page.tsx
git commit -m "feat(v3-s8): rewrite /categories/[slug] with v3 hero + sticky filter + grid"
```

---

## Stage 8.D — Polish + cleanup

### Task 8.D.1: Playwright visual regression baselines

**Files:**
- Create: `web/tests/visual/v3-stage-8.spec.ts`

```ts
import { test, expect } from '@playwright/test'

test.describe('v3 Lab Journal — Stage 8 surfaces', () => {
  test.skip(({ project }) => project.name !== 'desktop', 'desktop only this round')

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('homepage how-it-works', async ({ page }) => {
    await page.goto('/ru')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    const section = page.locator('#how-it-works')
    await section.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await expect(section).toHaveScreenshot('homepage-how-it-works.png', { maxDiffPixelRatio: 0.02 })
  })

  test('homepage categories', async ({ page }) => {
    await page.goto('/ru')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    const section = page.locator('section').filter({ hasText: 'Каталог по' }).first()
    await section.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await expect(section).toHaveScreenshot('homepage-categories.png', { maxDiffPixelRatio: 0.02 })
  })

  test('categories index', async ({ page }) => {
    await page.goto('/ru/categories')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    await expect(page.locator('section').first()).toHaveScreenshot('categories-index.png', { maxDiffPixelRatio: 0.02 })
  })

  test('category detail', async ({ page }) => {
    // Adapt slug to a real published category
    await page.goto('/ru/categories/reaktivy')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    await expect(page.locator('section').first()).toHaveScreenshot('category-detail.png', { maxDiffPixelRatio: 0.02 })
  })
})
```

```bash
cd web
npx playwright test tests/visual/v3-stage-8.spec.ts --project=desktop --update-snapshots
npx playwright test tests/visual/v3-stage-8.spec.ts --project=desktop  # sanity re-run
cd ..
git add web/tests/visual/v3-stage-8.spec.ts web/tests/visual/__screenshots__/v3-stage-8.spec.ts-snapshots/
git commit -m "test(v3-s8): playwright visual regression baselines for Stage 8 surfaces"
```

If the chosen category slug doesn't exist or has no published products, swap to a real one (check the dev DB).

---

### Task 8.D.2: Delete v2 components

**Files:**
- Delete: `web/components/marketing/CategoryTile.tsx` + test
- Delete: `web/components/marketing/HowItWorksStep.tsx` + test
- Delete: `web/components/marketing/TestimonialCard.tsx` + test
- Possibly delete: `web/components/marketing/TrustStrip.tsx` if no consumers (check first)
- Modify: `web/components/marketing/index.ts` (remove deleted exports)

**Step 1: Final consumer check**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8
for cmp in CategoryTile HowItWorksStep TestimonialCard TrustStrip; do
  echo "--- $cmp ---"
  grep -rln "[^L]${cmp}[^L]" web/{app,components}/ 2>/dev/null | grep -v "${cmp}\.\(test\.\)\?tsx\?\$\|${cmp}LJ\|TestimonialQuoteLJ"
done
```

**Step 2: Delete + verify**

```bash
rm web/components/marketing/{CategoryTile,HowItWorksStep,TestimonialCard}.tsx
rm web/components/marketing/{CategoryTile,HowItWorksStep,TestimonialCard}.test.tsx
# TrustStrip — only delete if no consumers
# Update index.ts to remove exports

cd web
npm run typecheck
npm run test 2>&1 | tail -5
npm run build 2>&1 | tail -5
```

If anything fails, surface and fix before deletion.

**Step 3: Commit**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8
git add -A
git commit -m "chore(v3-s8): delete v2 marketing components (zero remaining consumers)"
```

---

### Task 8.D.3: Final review handoff

**No commit.** Run final acceptance checks:

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka-shop-v3-s8/web
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:visual
```

Walk the design doc's [Acceptance criteria](2026-04-28-shop-v3-stage-8-design.md#acceptance-criteria). All 10 items should be true.

Then handoff via `superpowers:finishing-a-development-branch`.

---

## Plan complete and saved to `docs/plans/2026-04-28-shop-v3-stage-8-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** — fresh subagent per task, review between, hybrid mode (full ceremony on the page rewrites + LayoutBlock + categories/[slug]; direct on small primitives + simple block restyles)

**2. Parallel Session (separate)** — open new session with `superpowers:executing-plans`, batch execution with checkpoints

Which approach?
