# UI/UX Marketing-Ready Refactor — Design

**Date:** 2026-04-26
**Status:** Design approved, ready for implementation plan
**Repo:** `ximi4ka-shop` (sibling to this ERP repo)
**Scope:** Public storefront only (admin UI untouched)

## Goal

Take the current functional-but-utilitarian public storefront and make it marketing-ready: visually polished, conversion-oriented, and aligned with the brand language Ximi4ka uses on its current Tilda site, but elevated to 2026 standards.

## Decisions Locked In (from brainstorming)

1. **Aesthetic direction:** Modernize the Tilda look — keep brand palette and personality, raise it to current production standards. Not a fresh direction; not literal parity.
2. **Priority order:** Visual rebuild first, conversion-path improvements second. Story/hook (A), social proof (B), and catalog UX (D) follow.
3. **Imagery situation:** Clean product cutouts available; no lifestyle photography yet. Design must work today with cutouts only and gracefully accept lifestyle imagery later without redesigning.
4. **Page scope:** All public pages — homepage, product detail, category list/detail, cart, CMS pages, header, footer, 404. New marketing-only pages and a copy rewrite are deferred to a follow-up phase.
5. **Typography:** Mazzard H Extrabold for display (h1–h3) + IBM Plex Sans for body and UI. Mazzard H WOFF2 already provided by owner; IBM Plex Sans via `next/font/google`.
6. **Motion appetite:** Confidently animated — fades + scroll-triggered reveals + springy easing + parallax on the hero, but no cursor-following effects, no view-transition-API page transitions, no 3D galleries.

## Approach

**Approach 3 — minimal foundation tokens + flagship pages first, then extract patterns, then apply.** Avoids both failure modes: building a design system in a vacuum (Approach 1) and accumulating styling drift you have to clean up later (Approach 2). Roughly:

1. Build the minimum-viable foundational layer (tokens + primitives + motion + decor SVGs).
2. Redesign homepage and product detail concretely as the two flagship pages.
3. Extract repeating patterns into reusable components.
4. Apply patterns to the remaining pages.
5. Harmonize header + footer.
6. Final pass: visual regression baselines + Lighthouse audit.

Total estimated commits: 12–14.

## Foundation Layer

### Typography

- **Mazzard H Extrabold** loaded via self-hosted WOFF2 from `/Users/vasilijaistov/Desktop/несгораемые шрифты))/mazzard/MazzardH-ExtraBold.woff2`. Single weight, 800. Used only for `h1`/`h2`/`h3`, hero numerals, eyebrow display moments.
- **IBM Plex Sans** via `next/font/google` at weights 400 / 500 / 600 / 700. Used for everything else.
- Fluid responsive scale via `clamp()`:
  - `--text-display: clamp(2.5rem, 5vw + 1rem, 5.5rem)` — hero display H1
  - `--text-h1: clamp(2rem, 3vw + 1rem, 3.5rem)`
  - `--text-h2: clamp(1.5rem, 2vw + 0.75rem, 2.25rem)`
  - `--text-h3: clamp(1.25rem, 1.5vw + 0.5rem, 1.625rem)`
  - body / lead / small as discrete steps
- Tracking and line-height tuned: tight (`-0.02em`, `1.05`) on Mazzard display; normal (`0`, `1.5`) on IBM Plex body.

### Color tokens (additions on top of existing)

Existing brand tokens stay (`--color-brand: #836efe`, `--color-brand-dark: #6703ff`, `--color-brand-text`, `--color-brand-text-secondary`, `--color-brand-border`, `--color-brand-bg-soft: #eeebf3`).

New additions:

- `--gradient-brand: linear-gradient(135deg, rgba(141,103,255,1) 0%, rgba(200,86,255,1) 100%)`
- Surface tokens: `--surface-base` (white), `--surface-soft` (existing `#eeebf3`), `--surface-elevated` (white + shadow), `--surface-glass` (`rgba(255,255,255,0.7)` + backdrop-blur).
- Text variants: `--text-muted` (~60% opacity of secondary), `--text-on-brand` (white).
- `--border-strong`, `--border-subtle`.

### Spacing, shadows, radii

- Spacing scale `--space-1` through `--space-24` (0.25rem step rhythm).
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, plus `--shadow-glow-brand` (soft purple glow for primary CTAs and hero focal points).
- Border-radius: `--radius-sm: 12px`, `--radius-md: 24px`, `--radius-lg: 36px`, `--radius-xl: 48px`, `--radius-full: 9999px`. Cards lean `--radius-lg`; pills/buttons lean `--radius-full`.

### Motion primitives (`web/lib/motion.ts`)

- `framer-motion` added as a dep (small, tree-shakeable).
- Easing constants exported: `EASE_OUT_QUART`, `EASE_SPRING_SOFT`, `EASE_SPRING_PUNCHY`.
- Pre-built primitive components: `<Reveal>` (fade + 16px translate-up on viewport-enter, runs once), `<Fade>` (fade only), `<Stagger>` (stagger child reveals).
- Respects `prefers-reduced-motion` — collapses to instant fades or no-ops.

### Layout primitives

- `<Container>` — max-width 1200px, fluid horizontal padding 16 → 32 → 48px.
- `<Section>` — vertical padding tokens (`sm`/`md`/`lg`), optional `surface` prop (`base`/`soft`/`glass`/`gradient`).
- `<Bleed>` — child breaks out of parent's max-width to full-bleed (used inside long-form content).

### Tailwind v4 wiring

All tokens expressed via `@theme inline` block in `globals.css`. Utility classes like `bg-surface-soft`, `text-display`, `rounded-lg`, `shadow-glow-brand` work out of the box.

## Page-by-page Designs

### Homepage

Section stack from top to bottom:

1. **Hero** — full-width, ~85vh desktop / ~70vh mobile. `--surface-soft` base + off-canvas gradient blob clipped to right side. Left column (60%): eyebrow tag + Mazzard H Extrabold H1 + IBM Plex lead + two buttons (gradient primary + ghost secondary). Right column (40%): 2–3 product cutouts at varied z-depths and rotations with subtle scroll parallax. Decorative SVG molecule motif behind the stack.
2. **Trust strip** — 4-item band on `--surface-soft`, IBM Plex 500 / 14px with icon glyphs. Driven by an admin-editable JSON in SiteSettings (falls back to placeholder defaults if empty). `<Stagger>` on viewport-enter.
3. **Featured products** — H2 «Бестселлеры» + responsive 1/2/3/4-column grid. Pulls top 8 published products. Uses `<ProductCard>`.
4. **Category showcase** — H2 «Каталог по интересам» + 3-tile grid. Each tile: large category name in Mazzard H, descriptor, 2–3 product cutouts on tinted background, hover lift.
5. **How it works** — H2 + 3 numbered steps, each with huge Mazzard numeral + icon glyph + body. Replaces missing lifestyle photography with typographic confidence.
6. **Testimonials** — H2 + 3 quote cards in `--surface-glass` (white at 70% + backdrop-blur). Driven by an admin-editable JSON in SiteSettings.
7. **FAQ teaser** — uses existing `<FaqBlock>` from the home page's seeded FAQ blocks. Styled section wrapper + CTA «Все вопросы и ответы».
8. **Pre-footer CTA** — full-width gradient band, white H2, single pill button.

Motion: hero text `<Fade>` on mount; hero product stack subtle parallax; all sections below the fold `<Reveal>` on viewport-enter.

### Product detail

Two-column grid on desktop (60/40 — gallery left, info right), single column stacked on mobile.

1. **Breadcrumbs** — IBM Plex 500 / 13px / muted, dot separators, current item in main text color.
2. **Gallery (left)** — sticky on desktop. Primary square image with cutout on `--surface-soft` tinted by subtle `--gradient-brand` radial. 4-thumbnail row below with brand-ring active state. Falls back to gradient placeholder + Mazzard H product name overlay when no images.
3. **Info column (right)** — eyebrow (category link), H1 in Mazzard H, sub-line lead, stock pill, price block (Mazzard H + compare-at strikethrough + discount pill), trust micro-row (3 inline items), add-to-cart row with quantity stepper.
4. **Long description blocks** — full-width below the two-column area. Existing `<BlockRenderer>` constrained to max-width 768px; image/gallery blocks break out via `<Bleed>`.
5. **Related products** — H2 «С этим набором покупают» + 4-card grid. Uses existing `listProductsByCategory`, filters out the current product client-side. No new endpoint needed.
6. **FAQ for this product** — only renders if `longDescriptionBlocks` contains a faq block. Existing block renderer handles it.
7. **Pre-footer CTA** — gradient band with copy specific to product context.

Mobile-only: **Sticky `<MobileBuyBar>`** slides up from bottom when user scrolls past primary add-to-cart. Truncated name + price + mini add-to-cart. IntersectionObserver-driven.

Deferred to a follow-up: «Что внутри набора» structured contents list (requires new `contents` JSONB field on products + admin form). Logged in carry-forwards.

### Category list (`/categories`)

- Hero band ~30vh: H1 «Каталог», 1-line lead, `--surface-soft` + subtle gradient accent.
- Tile grid — same composition as homepage's category showcase, full collection.
- No filters/search yet (priority D from clarifying questions, deferred).
- Empty state: «Каталог скоро появится» + link to homepage.

### Category detail (`/categories/[slug]`)

- Hero band: breadcrumb + H1 (category name in Mazzard H) + lead (`metaDescription` if present) on gradient backdrop tinted toward category's tile color.
- Optional «О категории» blocks section if/when categories gain `description_blocks` field — out of scope, leave room.
- Product grid: same `<ProductCard>` grid used on homepage.
- Empty state: existing «В этой категории пока нет товаров», restyled.

### Cart (`/cart`)

- Two-column on desktop (60/40 — items left, summary right), single column mobile.
- Items list: each line = product cutout thumbnail + name (links to product) + quantity stepper + line total + remove icon. Soft `border-bottom` between lines.
- Summary card: `--surface-glass`, sticky on desktop. Subtotal in Mazzard H, delivery placeholder, total in Mazzard H Extrabold. Big primary gradient CTA.
- Empty state: hero-sized «Корзина пуста» + lead + secondary CTA «В каталог». Centered, generous whitespace.
- Trust micro-row below summary.

### CMS pages (`/o-nas`, `/dostavka`, `/kontakty`, generic `/[slug]`)

- Hero band: H1 in Mazzard H from page title, lead from `metaDescription`.
- Body: `<BlockRenderer>` constrained to max-width 768px. `<Bleed>` for image/gallery breakouts.
- Pre-footer CTA band — generic copy (admin-editable later).
- `/dostavka` leans heavily on the FAQ block.

### Header (refactor)

- 64px tall, sticky, existing behavior preserved.
- Logo wordmark in Mazzard H Extrabold.
- Nav links IBM Plex 500 / 14px / muted; active route gets brand color + animated underline.
- Cart button restyled: pill, soft surface, brand-colored badge with item count, subtle bounce on add.
- Mobile burger sheet uses `--surface-glass` + backdrop blur, full-height slide-in, item rows with right-arrow chevrons.
- **Promo bar above header** — opt-in via `headerPromoText` field on SiteSettings, hidden when blank. Adds value without forcing copy.

### Footer (refactor)

- Same 4-column layout as today, restyled:
  - Wordmark column: Mazzard H wordmark + tagline + brand gradient accent line.
  - Link column headings in IBM Plex 600 small-caps; rows in IBM Plex 400.
  - Copyright bar: muted, IBM Plex 400 / 12px.
- Background `--surface-soft` with thin top border in `--border-subtle`.
- Language switcher placeholder hidden until EN content exists (per Q3 of Section 4).

### 404 page

- Hero-sized 404 numeral in Mazzard H Extrabold (`--text-display`), gradient text fill.
- Lead «Страница не найдена» + 1-line subcopy.
- Two buttons: primary «На главную», secondary «В каталог».
- Subtle decorative `<MoleculeMotif>` SVG behind the numeral (visual continuity with homepage hero).

## Extracted Reusable Components

After homepage and product detail land, the following extracts to `web/components/`:

**Layout primitives** (`web/components/ui/`): `<Container>`, `<Section>`, `<Bleed>`.
**Typography primitives** (`ui/`): `<Eyebrow>`, `<DisplayHeading>`, `<SectionHeading>`.
**Surface / interactive primitives** (`ui/`): `<Pill>`, `<Button>`, `<GlassCard>`, `<MicroTrustRow>`.
**Marketing components** (`web/components/marketing/`): `<Hero>`, `<TrustStrip>`, `<CategoryTile>`, `<HowItWorksStep>`, `<TestimonialCard>`, `<PreFooterCta>`.
**Product-domain components** (`web/components/product/`): `<ProductCard>` (refactored), `<PriceBlock>`, `<StockPill>`, `<QuantityStepper>`, `<MobileBuyBar>`.
**Decorative SVGs** (`web/components/decor/`): `<MoleculeMotif>`, `<GradientBlob>`.
**Motion primitives** (`web/components/motion/`): `<Reveal>`, `<Fade>`, `<Stagger>` + easing constants.

Existing `web/components/blocks/` stays untouched.

Total: ~22 new or refactored components. `<Hero>`, `<ProductCard>`, `<MobileBuyBar>` are the largest (~150 lines each). Most are <60 lines.

## SiteSettings additions

A small migration adds three fields to `site_settings`:

- `header_promo_text` — `text`, nullable. Header promo bar copy; hidden when blank.
- `trust_strip_items` — `jsonb`, default `'[]'`. Array of `{icon, label}` for the homepage trust strip.
- `testimonials` — `jsonb`, default `'[]'`. Array of `{quote, author, location, rating}` for the homepage testimonials section.

Admin settings form gains corresponding inputs. Public settings endpoint exposes these fields (they're public-safe). Falls back to placeholder defaults in code if any are empty.

## Empty / Error / Loading States

- **Loading skeletons:** product card skeleton with shimmer animation. Used on `/cart` (client-rendered) and any future client-side fetch boundary.
- **Empty list states:** centered card with `<Eyebrow>` + small heading + 1-line subcopy + secondary action. Consistent shape across "no products in category", "cart empty", future "no search results".
- **API down:** existing graceful fallback (try/catch + empty data) carries over. Visual: static content still renders; product grids show small inline notice «Контент загружается...» if both calls failed.
- **404:** designed above.
- **Out-of-stock products:** `<StockPill>` shows variant; `<AddToCartButton>` disabled (already done); `<MobileBuyBar>` hidden.
- **Cart save failure:** Add-to-cart button shows red error «Не удалось добавить» for 2 seconds.

## Reduced Motion

All Framer Motion animations respect `prefers-reduced-motion` via the centralized `<Reveal>`/`<Fade>`/`<Stagger>` primitives. No per-component handling needed.

## Accessibility

- Color contrast ≥4.5:1 for body, ≥3:1 for large text. Brand purple `#836efe` on white passes for headings only; body text stays on `--color-brand-text: #1c1528`.
- Focus-visible ring in `--color-brand` with 2px offset on every interactive element.
- Keyboard navigation: motion components don't trap focus; gallery thumbnails arrow-navigable.
- Semantic HTML throughout.

## Testing Strategy

- **Unit tests (Vitest + RTL):** every new primitive and marketing component gets a small behavior-focused test (renders right text, props pass through, variant classes apply, accessibility attributes present). ~40–60 new tests expected.
- **Playwright visual regression:** `@playwright/test` added as a dev dep with browser binaries installed in CI. Snapshots committed under `web/tests/visual/__screenshots__/`. Every public route screenshotted at three viewport widths (375, 768, 1440) — 8 routes × 3 viewports = 24 baseline snapshots minimum. CI fails on diff > tolerance. Baselines refreshed via `npm run test:visual:update`.
- **Existing test suite must stay green** through every commit. Currently 552 tests; the refactor will add ~40–60 unit + 24 visual.
- **Lighthouse audit** at end of refactor. Targets: Performance ≥90 mobile, Accessibility 100, Best Practices ≥95, SEO 100. Logged as a follow-up gate before Phase 9 cutover (overlaps with deferred 6.8 CWV item).

## Rollout Sequence (Commit Plan)

1. **Foundation** (1–2 commits): Mazzard H + IBM Plex Sans + framer-motion installed; tokens + primitives + motion + decor SVGs landed; tests added; pages still render via old chrome (no visual change yet).
2. **Homepage redesign** (2–3 commits): full section-stack rebuild; SiteSettings migration for `header_promo_text`/`trust_strip_items`/`testimonials`; admin form additions; browser smoke test.
3. **Product detail redesign** (2–3 commits): full layout rebuild; new product-domain components; related-products via existing API; mobile sticky buy bar.
4. **Pattern extraction** (1 commit): move newly-created components from inline page files to `web/components/marketing/` and `web/components/product/`. Folder restructure committed atomically.
5. **Apply to remaining pages** (3–4 commits): category list, category detail, cart, CMS pages, 404. Each uses the now-stabilized component set.
6. **Header + Footer harmonization** (1 commit): Mazzard H wordmark, refined nav, animated active route, glass mobile sheet, footer column restyling.
7. **Final pass** (1 commit): Playwright visual regression baselines committed; Lighthouse audit; fix anything below threshold; update screenshots in docs.

Total: 12–14 commits. Each is reviewable in isolation; user can pause / hand back / change direction at every commit boundary.

## External Assets Owner Provides

- ✅ Mazzard H Extrabold WOFF2 (provided at `/Users/vasilijaistov/Desktop/несгораемые шрифты))/mazzard/MazzardH-ExtraBold.woff2`).
- Webfont license confirmation for Mazzard H (commercial font).
- Real product cutouts (the implementer can wire `<ProductCard>` to use real photo URLs as soon as products in admin have images).
- Real trust-strip copy (delivery method, certifications, return policy specifics).
- Real testimonials (3+ quotes with author + city; star ratings optional).

## Non-Goals (this refactor)

- Admin UI redesign — out of scope.
- New marketing-only pages (Как это работает full-page, comparison page, etc.) — deferred.
- Copy rewrite of homepage / CMS pages — deferred (placeholder copy stays where present).
- Catalog filtering / search UI (priority D) — deferred.
- Reviews backend / UGC — testimonials are admin-curated text only for now.
- Product variants, gift cards, discount codes — not blocked by this refactor; orthogonal future work.
- Newsletter signup — deferred.
- «Что внутри набора» structured contents list — deferred (logged in carry-forwards).

## Carry-Forwards Created or Reinforced by This Design

- Webfont license documentation for Mazzard H (do this before Phase 9 cutover).
- `contents` JSONB field on products + admin form for "what's inside" lists.
- Real trust strip copy + real testimonials before launch.
- Lighthouse / Core Web Vitals audit gate (overlaps with deferred 6.8 item).
- Lifestyle photography commission once budget allows (design accepts it without rework).

## Next Step

Transition to the `writing-plans` skill to produce a phased, bite-sized implementation plan (`2026-04-26-ui-ux-marketing-refactor-plan.md`) with concrete commits and TDD-style steps the executor can follow.
