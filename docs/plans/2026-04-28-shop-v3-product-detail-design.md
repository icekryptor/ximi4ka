# Shop v3 — Product Detail Page (Stage 7)

**Date:** 2026-04-28
**Status:** Design approved, ready for implementation plan
**Repo:** `ximi4ka-shop`
**Builds on:** [Stage 0–6 Лабораторный Журнал v3 design overhaul](2026-04-28-shop-v3-lab-journal-design.md) (29 commits, merged to main)
**Scope:** Public storefront `web/app/[locale]/(public)/product/[slug]/page.tsx` and the 7 components in `web/components/product/`. Cart/checkout/admin remain v2.

## Goal

Translate the v3 Лабораторный Журнал vocabulary onto the highest-impact conversion surface — the product detail page. Match the homepage's cream→ink rhythm, repeat the Mendeleev cell as a brand signal, and make the buy module feel like part of the same lab notebook rather than a stock e-commerce template.

## Decisions Locked In (from brainstorming)

1. **Section rhythm — dramatic, two-ink-in-a-row middle:**
   ```
   cream — HERO (image + info)
   ink   — ЧТО ВНУТРИ (existing LabSection wrapper, inner content gets v3 pass)
   ink   — ХАРАКТЕРИСТИКИ (NEW — Mendeleev row + full spec table)
   cream — ОПИСАНИЕ (prose breathing space)
   cream — Связанные наборы (related)
   ink   — PRE-FOOTER CTA (already migrated)
   ```
   The two ink-sections-in-a-row are justified semantically — both answer "what am I getting?". The cream description gives breathing room before related products.

2. **Hero info column — off-grid H1 + reserved info module:**
   - Mono `№ X-30 / Cu` SKU header above title
   - **Off-grid Unbounded H1** broken across rows with one word in brand-purple italic (the homepage hero pattern, smaller scale)
   - Mono trail line below H1 (short)
   - Inter description (1.0625rem)
   - Price + CTA module (calm, conversion-focused — no Mendeleev cells here)
   - 4 mono key-fact rows below the buy module (the same 3 stats from the card row + age, so the customer recognizes the product they clicked)

3. **Price + CTA module:**
   - Mega Unbounded price (`3 399 ₽`) with mono `₽` postfix
   - Compare-at strikethrough beside (when applicable)
   - Brand-purple `<Chip>` for discount % when discount > 0
   - Stock as `<Chip>` with status-colored dot (in_stock / preorder / out_of_stock)
   - Mono `[−] N [+]` ink-bordered quantity stepper
   - Ink-pill `В корзину →` CTA matching homepage Hero CTAs (background ink → brand-deep on hover)
   - MicroTrustRow simplified to 3 mono items (Доставка / Возврат 30 дней / Сертифицировано) — no icons, mono text only

4. **Characteristics section — Mendeleev row + full spec table on ink:**
   - 4 NumberCells with **use-facts** (different from card stats which were *contents* facts):
     - `01 / возраст` → `10+` → `от X лет / рекомендуется`
     - `02 / время` → `5–20` → `минут / на один опыт`
     - `03 / срок` → `1 день` → `готовность / к отправке`
     - `04 / гарантия` → `12 мес` → `на компоненты / возврат 30 дней`
   - Cells with no data **hide individually** (so a product missing «гарантия» renders 3 cells, not a placeholder). Grid auto-collapses.
   - Below cells: full `<CharacteristicsTableLJ>` — bone text on ink, mono labels left, display values right, asymmetric thin rule between rows. Heading: "Полный список характеристик".

5. **Image gallery — multi-image support added in this stage:**
   - Main image area: cream-shade backdrop, thin ink border, corner mark `arr. P-XX` top-left
   - Hover formula popup at bottom-left (when `hoverFormula` data present on product)
   - When product has > 1 image: thumbnail row below main image (mono `arr. 01 / 02 / 03` labels), click swaps main image
   - When 1 image: no thumbnail row
   - No lightbox/zoom in Stage 7 (deferred — out of scope)

6. **ContentsSection inner content gets v3 pass:**
   - Wrapper already migrated. Inner content currently uses v2 typography.
   - v3 pass: mono eyebrow `01 / Состав набора`, manifesto-style statement heading, Inter body with brand-purple italic emphasis (matches Manifesto's pattern), background ghost anthracene molecule at 5% opacity.
   - The CMS-rendered prose blocks inside (BlockRenderer with `surface="ink"` context if available) inherit prose-on-ink styles (already exists in globals.css from v2, preserved per Task 6.4).

7. **Description section — cream prose:**
   - Existing CMS BlockRenderer continues to handle long-description blocks
   - Wrapper restyled: `<LabSection variant="cream">` + NotebookHeader + small mono eyebrow + display heading "Описание"
   - No structural changes to BlockRenderer; just the section wrapper

8. **Related products — cream, asymmetric grid (reuse from homepage):**
   - Same `lg:grid-cols-[1.25fr_1fr_1.1fr]` + `lg:mt-0 / lg:mt-16 / lg:mt-32` stagger as Stage 4.4
   - Reuses existing `<ProductCard>` (v3) with the same `statMaxes` derived from the visible related set
   - 3 cards max (more cards lose the asymmetric rhythm — overflow goes to `/catalog`)

9. **MobileBuyBar restyle:**
   - Sticky bottom on mobile only
   - Ink surface (matches the homepage pre-footer CTA visually, so users see "this is part of the same surface")
   - Layout: Unbounded price left, ink-pill `В корзину →` CTA right, mono quantity stepper between
   - Stock chip inline above price when relevant

## Architecture

### New components (8)

| Component | Purpose | Replaces |
|---|---|---|
| `<ProductPriceBlockLJ>` | Mega Unbounded price + mono compare-at + brand-purple discount chip | v2 `PriceBlock` |
| `<StockChip>` | Stock state as `<Chip>` with status-colored dot | v2 `StockPill` |
| `<QuantityStepperLJ>` | Mono `[−] N [+]` ink-bordered | v2 `QuantityStepper` |
| `<KeyFactsListLJ>` | 4 mono key-fact rows on cream | v2 `KeyFactsList` |
| `<CharacteristicsCellRow>` | 4 NumberCells composing use-facts (with hide-when-missing) | net-new |
| `<CharacteristicsTableLJ>` | Spec table on ink, mono labels | v2 `CharacteristicsTable` |
| `<ProductHeroImage>` | Cream-shade image shell + corner mark + hover formula + multi-image gallery thumbnails | net-new |
| `<MobileBuyBarLJ>` | Sticky bottom bar, ink, Unbounded price + ink-pill CTA | v2 `MobileBuyBar` |

### Modified

- `web/app/[locale]/(public)/product/[slug]/page.tsx` — major section rewrite (cream→ink→ink→cream→cream→ink rhythm, swap component imports)
- `web/components/product/ContentsSection.tsx` — inner content v3 pass (wrapper already LabSection)
- `web/components/product/extractKeyFacts.ts` — extend to also surface use-facts for `<CharacteristicsCellRow>`
- `web/components/product/MicroTrustRow.tsx` — restyle to mono row, no icons (if it lives in `product/`; else in `components/`)

### Reused (no new code)

`<LabSection>`, `<NotebookHeader>`, `<GridOverlay>`, `<MoleculeMotifLJ>`, `<NumberCell>`, `<Chip>`, `<ProductCard>` (related products grid)

### Deleted at end of Stage 7

The 7 v2 product/* components (PriceBlock, StockPill, QuantityStepper, KeyFactsList, CharacteristicsTable, MobileBuyBar) once their LJ counterparts are wired and consumers migrated.

### Data extraction

`extractKeyFacts.ts` currently surfaces a priority-ordered list of characteristic keys for the v2 `KeyFactsList`. Extend with a parallel function `extractUseFacts(product)` that pulls:
- `возраст` (or `age` / `age_min`) → string
- `время опыта` (or similar key)
- `срок изготовления`
- `гарантия`

Each returns `{ value: string; label: string }` or `null` when missing. The `<CharacteristicsCellRow>` filters out nulls and renders only present cells.

## Page-level data flow

No DB changes. Same `getPublishedProduct(slug)` call. Same `characteristics` blob. Two new helper calls in `page.tsx`:
- `extractUseFacts(product)` — produces 0-4 cells for the new section
- `extractGalleryImages(product)` — produces an array of image URLs (currently the page uses `product.imageUrl` singular; gallery may use `product.images` if that field exists, else fall back to `[product.imageUrl]`)

## Acceptance criteria

A product detail page passes when:

1. Section rhythm renders cream→ink→ink→cream→cream→ink in that order
2. Notebook header present on every section, page-count stays consistent within the page (e.g. `стр. 01 / 06`)
3. Hero H1 uses Unbounded with one brand-purple italic word and at least one off-grid row offset
4. Price renders in Unbounded mega-numeric, discount as brand-purple Chip when applicable
5. Stock renders as Chip with status-colored dot
6. Quantity stepper renders mono +/- ink-bordered
7. Characteristics section renders 0–4 NumberCells (depending on data availability), full spec table below on ink
8. Multi-image products show thumbnail row; single-image products do not
9. Related products use the same asymmetric stagger as the homepage (1.25fr/1fr/1.1fr columns, mt-0/mt-16/mt-32 stagger)
10. Mobile sticky buy bar renders on mobile viewports only, ink surface
11. Reduced-motion preference disables decorative animations on this page (inherits Task 6.1 globally)
12. All v2 product/* components have zero remaining consumers; deleted before merge

## Open questions / risks

- **CMS prose styles inside ink ContentsSection:** The existing `prose-on-ink` rules in globals.css (Task 6.4 preserved them) target a `.prose-on-dark` class. Verify ContentsSection still applies that class — if not, restore.
- **Gallery image source:** Need to confirm whether `product.images` exists on the shared Product type or if it's a single `imageUrl`. If single, gallery is a no-op (just the existing main image with v3 chrome); if array, full gallery wires up.
- **`MicroTrustRow` location:** May live in `components/` (not `components/product/`). Check before restyling.
- **Stage 8+ dependencies:** This stage doesn't touch BlockRenderer (the 7-block CMS library still v2). The ContentsSection and Description sections inherit v2 prose styling for now. Stage 8 (block library v3 pass) is a separate stage.

## Estimated scale

- 8 net-new components × (TDD test + impl + commit) = ~16 task-commits
- 4 modified files × 1 task each = 4 task-commits
- 1 page-level rewrite = 1 task-commit
- 1 Playwright baseline addition = 1 task-commit
- 1 v2 deletion + token cleanup = 1 task-commit

**Total: ~23 tasks**, similar discipline to Stages 0-6 but with faster cadence because the v3 primitive set is established.

## Next step

Invoke `superpowers:writing-plans` to produce the implementation plan with TDD task-by-task structure.
