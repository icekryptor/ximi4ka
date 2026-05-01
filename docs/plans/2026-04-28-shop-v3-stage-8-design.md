# Shop v3 — Stage 8: Homepage v2 sweep + CMS blocks + Categories pages

**Date:** 2026-04-28
**Status:** Design approved, ready for implementation plan
**Repo:** `ximi4ka-shop`
**Builds on:** [Stage 7 — Product Detail Page v3](2026-04-28-shop-v3-product-detail-design.md), [Stage 0-6 — Лабораторный Журнал foundational](2026-04-28-shop-v3-lab-journal-design.md)
**Scope:** Three surface clusters in one stage — see decisions below.

## Goal

Eliminate the remaining v2 islands on the public storefront. After Stage 6 (homepage Hero/Manifesto/Products) and Stage 7 (Product Detail Page), three surface clusters still render v2 chrome:

1. **Homepage v2 sections** sandwiched between v3-migrated sections (CategoryTile grid, HowItWorksStep row, TestimonialCard row)
2. **CMS block library** (8 blocks rendered by `BlockRenderer` — used on homepage FAQ, content pages, product description, and any CMS-driven content)
3. **Categories pages** (`/categories` index + `/categories/[slug]` listing pages — only Sticker→Chip migrated so far)

This stage brings all three to v3 vocabulary so the entire public storefront reads as one design language.

## Decisions Locked In (from brainstorming)

1. **Scope:** **C — all three clusters in one stage** (homepage v2 sections + CMS block library + categories pages). Single comprehensive design + plan. No sub-stage split.

2. **HowItWorksStep aesthetic:** **A — Mendeleev cells.** Each step composed as a `<NumberCell>` reusing the existing v3 primitive. Index `01/02/03`, big verb (`ВЫБРАТЬ / СОБРАТЬ / ВЕСТИ`), atomic-mass-style decimal in bottom row. The verbal distinction (verbs vs manifesto's stats) carries the visual repetition.

3. **CategoryTile aesthetic:** **A — Drawer cards** matching ProductCard image-shell chrome. Cream-shade backdrop + thin ink border, mono corner mark, Unbounded display name, mono `N товаров`, faded per-category `<MoleculeMotifLJ>` decoration. Asymmetric grid `1.3fr / 1fr / 1.1fr`. Hover: border darkens, hand-drawn callout arrow draws toward name.

4. **Per-category molecule mapping:** **Semantic, not round-robin.** Each category gets a molecule that semantically reflects its content (Реактивы → H₂O the universal reactant, Лабораторное оборудование → tetrahedral methane echoing instrument geometry, etc.). Where the 4 existing variants don't yield 6 distinct mappings, allow repetition rather than introduce new molecule variants.

5. **TestimonialCard aesthetic:** **Lab citation pattern.** Brand-purple opening «» quotation mark in display, body text in italic Inter, mono attribution row below as a paper citation (`— А. ИВАНОВА · МОСКВА · 2024-03-15 · 12 опытов`). No card backgrounds — typography on cream with thin top rule per item. Asymmetric 3-up grid.

6. **CMS block library pattern:** **Section-driven inheritance.** Blocks define structure + typography hierarchy; the wrapping `<LabSection variant="cream"|"ink">` defines surface colors. Most blocks are surface-aware via Tailwind utilities reading inherited tokens. Heavy media blocks (Image / Gallery / Video) share a new `<MediaFrame>` primitive for consistent corner mark + cream-shade backdrop + thin ink border + mono caption.

7. **FAQ accordion:** **Native `<details>/<summary>`** for zero-JS, accessible, SSR-friendly expand/collapse. Mono uppercase question label, brand-purple `[+]/[−]` mono character indicator. Brand-purple top-stroke on hover (matches NumberCell hover pattern). Body in italic Inter inside.

8. **CTA in CtaBlock:** Matches Hero CTAs — ink-pill on cream, bone-pill on ink. No second visual style.

9. **Categories filter UX:** **Minimal — sort + reset only** for this stage. Future stage may add price/age/badge filters once category traffic justifies the complexity.

10. **No new icon library, no emoji.** Mono character glyphs (`+`, `−`, `→`, `←`, `·`) inline. Carries forward from Stage 0-6 design discipline.

## Architecture

### Section flow (final homepage after Stage 8)

```
[cream]  HERO                  (Stage 0-6, done)
[ink]    MANIFESTO              (Stage 0-6, done)
[cream]  ПРОДУКТЫ — каталог     (Stage 0-6, done)
[cream]  Каталог по интересам   (Stage 8 — CategoryTile drawers, NEW)
[ink]    Как это работает        (Stage 8 — Mendeleev cells, NEW)
[cream]  Что говорят родители   (Stage 8 — Lab citations, NEW)
[cream]  FAQ                    (Stage 8 — FaqBlock redesign, NEW)
[cream]  Прочий CMS контент     (Stage 8 — generic CMS blocks, NEW)
[ink]    PRE-FOOTER CTA         (Stage 0-6, done)
```

The homepage rhythm now alternates cream/ink/cream meaningfully throughout the page, with the only ink section in the lower half being PreFooter — that's the cinematic crescendo. Other sections settle on cream because dense data sections (cells/quotes/FAQ) on ink-on-ink would create visual fatigue.

### CMS block library treatments

| Block | Surface-aware | Notes |
|---|---|---|
| **CtaBlock** | yes | Heading + body + ink/bone-pill CTA. Brand-purple italic on one heading word. |
| **FaqBlock** | cream preferred | List of `<details>` items. Mono Q label, brand-purple `[+]/[−]`, italic Inter A body. Top-stroke draws on hover. |
| **GalleryBlock** | yes | 2/3/4-up grid of `<MediaFrame>`s. Asymmetric option (first wider) when 3-up. |
| **ImageBlock** | yes | Single `<MediaFrame>` constrained to max-w-content. |
| **VideoBlock** | yes | `<MediaFrame>` containing `<iframe>` (YouTube/VK/Rutube). 16:9 aspect ratio. |
| **LayoutBlock** | yes | Composite. `<MediaFrame>` left/right + text column. Variants `media-left | media-right | media-top | media-bottom` preserved. |
| **ParagraphBlock** | yes | Rich text. v3 prose styles: Inter body, brand-purple italic on `<strong>`, mono for `<code>`. Surface-aware via `[data-surface="ink"]` selector. |
| **ProductGridBlock** | mostly done | Already uses ProductCard. Needs placeholder-stat removal once admin field exists; for now zero-stats remains the calm default. |

### Categories pages

**`/categories` index:**
- Hero (cream): NotebookHeader + eyebrow `№ КАТАЛОГ` + display heading "Категории" + lead description (about exploration)
- Same drawer-card grid as homepage CategoryTile, but ALL categories (not just 6 featured)
- PreFooterCta (already migrated)

**`/categories/[slug]`:**
- Hero (cream): NotebookHeader + breadcrumbs + display heading (category name with brand-purple italic on one word) + lead description
- Filter bar (sticky on scroll under hero): mono Chip-style filters. **Stage 8 = sort + reset only.** Sort options: ціна ↑/↓, name A-Z, новизна.
- Product grid (cream): same asymmetric 3-card row pattern as homepage, paginated (20 per page)
- PreFooterCta (already migrated)

### New components

| Component | Used by | Notes |
|---|---|---|
| `<CategoryTileLJ>` | Homepage 8.A.1 + categories index | Replaces v2 `<CategoryTile>`. Asymmetric tile with corner mark + display name + per-category molecule decoration. |
| `<MediaFrame>` | ImageBlock + GalleryBlock + VideoBlock | Cream-shade backdrop + ink border + corner mark + mono caption. Single surface-aware primitive. |
| `<HowItWorksStepLJ>` | Homepage 8.A.2 | Composes `<NumberCell>` with verb-as-big-text. Replaces v2 `<HowItWorksStep>`. |
| `<TestimonialQuoteLJ>` | Homepage 8.A.3 | Lab citation pattern. Replaces v2 `<TestimonialCard>`. |
| `<FaqAccordion>` | FaqBlock + any future FAQ surfaces | Native `<details>` styled v3. |
| `<CategoryFilterBar>` | `/categories/[slug]` | Sticky mono Chip-style sort + reset. |

### Modified

- All 8 CMS block components rewritten with v3 vocabulary
- Homepage `app/[locale]/(public)/page.tsx` — section composition for 5 redone sections
- `app/[locale]/(public)/categories/page.tsx` — full rewrite
- `app/[locale]/(public)/categories/[slug]/page.tsx` — full rewrite (preserve SEO, JsonLd, breadcrumbs unchanged)

### Per-category molecule mapping (default)

For the 6 featured categories the current homepage shows. The implementer threads this through `<CategoryTileLJ>` via a `moleculeVariant` prop derived from the category slug:

| Category (RU) | Slug | Molecule | Rationale |
|---|---|---|---|
| Наборы для опытов | `nabory-dlya-opytov` | benzene | Iconic chemistry "everything" symbol |
| Реактивы | `reaktivy` | water | Universal reactant / solvent |
| Лабораторное оборудование | `laboratornoe-oborudovanie` | methane | Tetrahedral structure echoes lab tripod |
| Комбо | `kombo` | anthracene | Multi-ring composition = "combined" |
| Печатная продукция | `pechatnaya-produktsiya` | water | Simple, knowledge fundamentals — repeats reactant since they share "elementary" feel |
| Новинки | `novinki` | benzene | Classic chemistry, newly framed |

Repetition (water 2×, benzene 2×) is acceptable per the molecule-decoration rule from §4 above. If categories grow, the implementer extends the mapping.

### Data model impact

**None.** Pure presentation refactor. No DB migrations, no API changes.

## Risks

- **Scope.** Stage 8 spans homepage / CMS blocks / categories. Largest single stage so far (~25 tasks, comparable to Stage 7). Estimate ~2.5 hours subagent execution end-to-end.
- **CMS prose styling regression.** ParagraphBlock currently relies on existing `prose-on-dark` CSS class for HTML content rendering. Switching to v3 prose styles must preserve admin-authored content shape (no `<strong>`/`<em>`/`<a>` regressions).
- **Native `<details>` element styling.** Browser default `▶` marker must be hidden and replaced with our mono character — Safari and Firefox have slightly different shadow DOM. Requires `summary::-webkit-details-marker { display: none }` + `summary { list-style: none }` shotgun.
- **Categories pagination.** Current categories/[slug] page may already have pagination. Preserve URL contract (`?page=N` query param) so external/SEO links don't break.
- **Filter bar placement.** Sticky-on-scroll filter must not collide with the global Header on scroll. Test with the Header's existing scroll-shrink behavior.

## Acceptance criteria

A homepage build passes Stage 8 when:

1. Homepage section flow renders cream → ink → cream → cream → ink → cream → cream → cream → ink consistently
2. Zero v2 component imports remain in `app/[locale]/(public)/page.tsx` (`Container`, `Section`, `SectionHeading` from `@/components/ui` are gone or only used within `BlockRenderer`-rendered legacy paths)
3. `BlockRenderer` consuming any CMS block produces v3 typography on the surface its parent LabSection declares (cream → ink colors when wrapped in `<LabSection variant="ink">`, vice versa)
4. Categories index renders the drawer-card grid consistent with the homepage CategoryTile section
5. Categories/[slug] renders v3 hero + sticky filter (sort + reset only) + asymmetric product grid + preserves existing pagination URL contract
6. FAQ accordion expand/collapse works without JavaScript (test by disabling JS in DevTools)
7. Per-category molecule decoration renders correctly on each of the 6 featured categories
8. Lighthouse: no CLS regression vs Stage 7
9. Playwright visual regression baselines added for: homepage how-it-works section, homepage categories section, categories index, categories/[slug] (one selected category)
10. All v2 product/* and homepage-block components deleted after migration; barrel exports cleaned up

## Open Questions / Future stages

- **Cart full migration** (deferred from Stage 7 review). Current state: cart uses LJ stepper inside v2 chrome — incoherent. Should be its own Stage 9. Out of scope for Stage 8.
- **Header / Footer full v3 pass.** Currently only color-swapped active route + Footer molecule accent. Logo treatment, mono nav, footer columns all still v2. Stage 10.
- **Reviews section on product detail.** Not on the page yet. Future product enrichment stage.
- **Per-category molecule mapping admin-editable.** Currently hardcoded by slug. Future enrichment if more than 6 categories exist.

## Next Step

Invoke `superpowers:writing-plans` to produce the implementation plan: stage breakdown, commit-by-commit plan, test coverage plan, deploy checkpoints.
