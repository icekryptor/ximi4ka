# Shop v3 — Stage 11: Real product photos + specimen-card empty state

**Date:** 2026-05-07
**Builds on:** [Stage 10 — PaginationLJ + cross-viewport baselines](2026-05-02-shop-v3-stage-10-design.md)
**Scope:** Track A (visible polish) — third and final visible item: replace the gimmicky "ARR. NN" gray-slot placeholders with real product photography where it exists, design a deliberate lab-journal "specimen card" treatment for the gaps, and ship a CLI script that surfaces the photography backlog.

## Goal

End the v3 design rollout's "no real photos" eyesore. By the end of Stage 11:

- The 3 homepage flagship cards (Химичка 3.0 / Мини-Химичка / Электрохимичка) render the real photos already sitting in `api/uploads/imported/<slug>/`.
- Every `<ProductCard>` instance across `/ru` and `/categories/<slug>` listings reads from `product.images[]` and renders a hover-crossfade gallery (image 0 → image 1 on hover) when ≥2 images exist; falls back to single-image with the existing scale-1.04 zoom; falls back to the new `<SpecimenCard>` when 0 images.
- The PDP gallery (`<ProductHeroImage>`) inherits the same `<SpecimenCard>` fallback at PDP scale.
- A new `npm run audit:images -w api` CLI surfaces every published product missing images, grouped by category, with a clickable admin URL per row — a self-serve photography backlog.

## Decisions Locked In

1. **Scope:** Full audit + treatment — wire homepage flagships, sweep ProductCard usages, design empty state, ship audit CLI.
2. **Homepage flagships sourcing:** Hybrid — `SITE_CATALOG` keeps marketing decoration (callouts, stats, hover formulas, chips, badge), but slugs are updated to match DB (`himichka-3` → `himichka-30`, etc.) and the server fetches each flagship's `images[]` from the DB at request time.
3. **Empty-state treatment:** Full lab-journal "specimen card" composition — mono eyebrow `ОБРАЗЕЦ № {sku}`, dashed sketch box with diagonal stroke, mono caption `ФОТО ГОТОВИТСЯ`, faint hand-drawn arrow.
4. **Photo rendering inside ProductCard slot:** Hover crossfade `images[0]` → `images[1]` via two stacked `<Image>` layers + CSS opacity transition. Object-cover. Existing scale-1.04 zoom stays (applies to whichever layer is visible).
5. **Audit reporting:** CLI script only (`npm run audit:images -w api`). Markdown table to stdout, grouped by primary category, admin URL per row. Exits 0 even when products are flagged (informational, not blocking).
6. **PDP empty-state coverage:** Same `<SpecimenCard>` composition with two size variants (`size="card"` for 4:5 product slots, `size="pdp"` for the 1:1 hero canvas).
7. **CategoryTileLJ:** Untouched. Tiles use molecule SVG decoration by design — they don't show product photos.
8. **`ProductCard.imageArt: ReactNode` prop:** Removed. Replaced by data-shaped `images: ProductImage[]`. `cornerMark` prop kept (decorative metadata for cards that DO have images).
9. **SITE_CATALOG drift guard:** Unit test on `/ru` page asserts each flagship slug resolves to a published DB product. Catches future drift without coupling Next.js build to the live DB.
10. **Visual regression:** Refresh existing homepage `products` baselines (real photos render now) + add a new fixture spec for `<SpecimenCard>` (2 scenes × 3 viewports = 6 baselines). Pattern mirrors Stage 10's `pagination-fixture` route.

## Architecture

### `<SpecimenCard>` props + composition

```tsx
interface SpecimenCardProps {
  sku: string                  // e.g. "X-30"; falls back to slug if SKU missing
  size: 'card' | 'pdp'        // 4:5 vs 1:1 canvas
  className?: string
}
```

Composition (both size variants share the same DOM, scale via Tailwind size variants):

- **Background:** `bg-[var(--color-lj-cream-shade)] border border-[var(--color-lj-rule)]` — same surface + border as the populated photo slot, so the empty state looks like a natural "this slot exists, it just isn't filled yet" rather than a different element.
- **Top-left (mono eyebrow):** `font-mono text-[length:var(--text-lj-mono-xs)] uppercase tracking-[0.08em] opacity-55` — copy `ОБРАЗЕЦ № {sku}`. Replaces the current `cornerMark` ARR.NN slot exactly.
- **Center (dashed-rect SVG):** inline SVG, `stroke-[var(--color-lj-ink)] opacity-30 stroke-dasharray-[4 6]`, single thin diagonal from top-left → bottom-right corner.
- **Bottom-center (mono caption):** `font-mono text-[length:var(--text-lj-mono-sm)] tracking-[0.04em] opacity-70` — copy `ФОТО ГОТОВИТСЯ`.
- **Hand-drawn arrow:** brand-purple stroke `var(--color-lj-brand)` opacity 40, originates near the caption and curves up-and-right to the dashed rectangle. Reuses `web/components/ui/illustrations/HandDrawnArrow.tsx` if it exists, else extracted from `Callout` family.

### Photo rendering inside `<ProductCard>`

Replace current `imageArt: ReactNode` indirection with data-shaped `images: ProductImage[]`:

```tsx
// Inside the existing `<Link href={...}><div className="aspect-[4/5] ...">` slot:
{images.length === 0 ? (
  <SpecimenCard sku={product.sku ?? product.slug} size="card" />
) : (
  <>
    <Image src={images[0].url} alt={images[0].alt} fill
           sizes="(max-width: 768px) 100vw, 33vw"
           className="object-cover transition-opacity duration-500
                      group-hover/pcard:opacity-0
                      group-hover/pcard:scale-[1.04]" />
    {images[1] && (
      <Image src={images[1].url} alt={images[1].alt} fill
             sizes="(max-width: 768px) 100vw, 33vw"
             className="absolute inset-0 object-cover opacity-0
                        transition-opacity duration-500
                        group-hover/pcard:opacity-100" />
    )}
  </>
)}
{cornerMark && images.length > 0 && <span className="...">{cornerMark}</span>}
{hoverFormula && images.length > 0 && <div className="...">{hoverFormula}</div>}
```

When 1 image exists: single layer, existing zoom-on-hover works as before. When ≥2 images: top layer fades out + zooms, bottom layer fades in (cross-fade reveal). When 0: SpecimenCard takes over the whole slot, decorative props (`cornerMark`, `hoverFormula`) are suppressed.

### `<ProductHeroImage>` empty state

```tsx
export function ProductHeroImage({ product }: Props) {
  if (product.images.length === 0) {
    return <SpecimenCard size="pdp" sku={product.sku ?? product.slug} />
  }
  // ...existing populated gallery code unchanged
}
```

### Homepage hybrid SITE_CATALOG resolution

```tsx
// /ru page.tsx (Server Component)
const flagships = await Promise.all(
  SITE_CATALOG.map(async (entry) => {
    const dbProduct = await getProduct(entry.slug, locale).catch(() => null)
    if (!dbProduct) {
      console.warn(`[SITE_CATALOG] Slug not found in DB: ${entry.slug}`)
    }
    return { ...entry, dbProduct }
  })
)

// In render:
{flagships.map(({ dbProduct, ...meta }) => (
  <ProductCard
    product={dbProduct ?? syntheticFallback(meta)}
    images={dbProduct?.images ?? []}
    {...meta}  // emphasisWord, elementSymbol, badge, callout, etc.
  />
))}
```

`syntheticFallback` returns a minimal `Product`-shaped object when the slug doesn't resolve, so the card still renders (with SpecimenCard as image) instead of crashing. The unit test catches the bad slug at CI time so prod never sees this branch.

### Slug audit (one-time)

Before implementation begins, run the audit script against the live DB to confirm what flagship slugs actually resolve. Likely findings: `himichka-30` ✓, `mini-himichka` ?, `elektrohimichka` ✓ — the Tilda import slugs are the source of truth.

### `audit:images` CLI script

```ts
// api/src/scripts/audit-images.ts
import { AppDataSource } from '../config/database'
import { Product } from '../entities/Product'

async function main() {
  await AppDataSource.initialize()
  const repo = AppDataSource.getRepository(Product)
  const products = await repo.find({
    where: { isPublished: true },
    relations: { images: true, categories: true },
    order: { sortOrder: 'ASC' },
  })
  const missing = products.filter(p => p.images.length === 0)

  if (missing.length === 0) {
    console.log('✓ All published products have at least one image.')
    process.exit(0)
  }

  // Group by primary category, print markdown table per group
  const byCategory = groupByPrimaryCategory(missing)
  console.log(`\n# Photography backlog — ${missing.length} products missing images\n`)
  for (const [categoryName, items] of byCategory) {
    console.log(`## ${categoryName} (${items.length})\n`)
    console.log('| SKU | Slug | Name | Admin |')
    console.log('|---|---|---|---|')
    for (const p of items) {
      console.log(`| ${p.sku ?? '—'} | \`${p.slug}\` | ${p.name} | http://localhost:3000/admin/products/${p.id} |`)
    }
    console.log('')
  }
  process.exit(0)
}
main().catch(err => { console.error(err); process.exit(1) })
```

`package.json` (api): `"audit:images": "tsx src/scripts/audit-images.ts"`. Workspace runner: `npm run audit:images -w api`.

## Components

### Net-new

- `web/components/ui/SpecimenCard.tsx` — the empty-state composition
- `web/components/ui/illustrations/DashedRectMark.tsx` — inline SVG (4:5 + 1:1 variants), one component with size prop
- `web/components/ui/illustrations/HandDrawnArrow.tsx` — extract or reuse if existing
- `api/src/scripts/audit-images.ts` — CLI script
- `web/tests/visual/v3-specimen.spec.ts` — fixture-driven visual baseline
- `web/app/[locale]/specimen-fixture/page.tsx` — dev-only fixture route (mirrors Stage 10's `pagination-fixture` pattern)

### Modified

- `web/components/ProductCard.tsx` — drop `imageArt: ReactNode`, add `images: ProductImage[]`. Render crossfade gallery or SpecimenCard.
- `web/components/product/ProductHeroImage.tsx` — early-return SpecimenCard when no images.
- `web/app/[locale]/(public)/page.tsx` — update SITE_CATALOG flagship slugs; add server fetch of `dbProduct` per flagship; pass `images` to ProductCard. Update unit tests.
- `web/app/[locale]/(public)/page.test.tsx` — assert each SITE_CATALOG slug resolves to a published mock product.
- `web/app/[locale]/(public)/categories/[slug]/page.tsx` — pass `product.images` to ProductCard (one-line wiring).
- All visual baselines for surfaces where ProductCard renders (`v3-homepage.spec.ts` `products`, plus any `categories` snapshots that crop into a card).
- `api/package.json` — add `audit:images` script + `tsx` devDependency if not already present.

### Unchanged

- `<CategoryTileLJ>` — molecule decoration by design.
- Image storage layer (`api/uploads/imported/*`).
- TypeORM `Product`/`ProductImage` entities.

## Data model impact

None. `Product.images: ProductImage[]` already exists; we're just reading it on more surfaces.

## Risks

1. **Some imported photos may be poor quality** — Tilda CSV imports were likely web-resolution PNGs. Low-res photos rendered at desktop might look soft. Mitigation: Stage 11 ships what exists; future photography upgrades happen organically via the audit script + admin upload.
2. **Slug mismatch beyond the 3 flagships** — `mini-himichka` may not exist in DB under that slug. The unit test will fail on first run; we update SITE_CATALOG to whatever the DB actually has (the audit script's output is the source of truth).
3. **Hover crossfade jank on slow devices** — two `<Image>` layers double the bytes-on-page for ProductCard slots. Mitigation: `next/image` lazy-loads below the fold by default; add `loading="lazy"` explicitly. The first image is `priority` only on the homepage flagships row.
4. **PDP visual regression** — the Stage 7 PDP baseline currently captures the populated `himichka-30` hero. Adding the SpecimenCard branch changes the image gallery component but not the populated baseline. Re-run visual tests; only baselines that actually rendered SpecimenCard would shift (none, given current seed data).

## Acceptance criteria

A storefront build passes Stage 11 when:

1. `<SpecimenCard size="card" />` renders eyebrow `ОБРАЗЕЦ № {sku}`, dashed-rect SVG, caption `ФОТО ГОТОВИТСЯ`, hand-drawn arrow — all visible
2. `<SpecimenCard size="pdp" />` scales the same composition to a 1:1 canvas with PDP-scale type
3. `<ProductCard images={[]}>` renders `<SpecimenCard />` in place of the photo slot; `cornerMark` and `hoverFormula` props are suppressed
4. `<ProductCard images={[a, b]}>` renders two stacked `<Image>` layers; on `:hover` the second layer's opacity transitions from 0 → 1 (CSS only, no JS state)
5. `<ProductCard images={[a]}>` renders a single `<Image>` with the existing `scale-[1.04]` hover zoom; no second layer in the DOM
6. `<ProductHeroImage>` renders `<SpecimenCard size="pdp" />` when `product.images.length === 0`
7. The 3 homepage flagship cards render real photos from `api/uploads/imported/<slug>/0.png` — no SpecimenCard, no gray ARR.NN slot
8. Unit test fails if any SITE_CATALOG slug doesn't resolve to a published mock product
9. `npm run audit:images -w api` prints `✓ All published products have at least one image.` OR a markdown table grouped by category with per-row admin URLs
10. Visual regression baselines updated for homepage `products` slab; new `v3-specimen.spec.ts` ships baselines for both card + pdp sizes across all 3 viewports (6 baselines total)
11. `ProductCard`'s former `imageArt: ReactNode` prop is removed and no caller still passes it

## Out of scope

- **New photography sessions** — Stage 11 ships only what's already in `api/uploads/imported/`; new photos are a content task, not engineering.
- **Image optimization pipeline** — AVIF/WebP transcoding, srcset breakpoints beyond what `next/image` does automatically. Track D performance work.
- **Admin bulk-upload UI** — admin already supports per-product upload; bulk would be Stage 12+.
- **CategoryTileLJ photo treatment** — tiles use molecule decoration by design.
- **PDP gallery upgrades** — pinch-zoom, lightbox, thumbnail keyboard nav. Separate stage.
- **Lighthouse / a11y audit** — Track D.

## Next Step

Invoke `superpowers:writing-plans` to produce the bite-sized implementation plan, then offer execution mode (subagent-driven vs parallel session).
