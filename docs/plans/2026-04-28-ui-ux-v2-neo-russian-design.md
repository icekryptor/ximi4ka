# UI/UX v2 — Neo-Russian Design Overhaul

**Date:** 2026-04-28
**Status:** Design approved, ready for implementation plan
**Repo:** `ximi4ka-shop` (sibling to this ERP repo)
**Builds on:** [2026-04-26 marketing-ready refactor](2026-04-26-ui-ux-marketing-refactor-design.md) (21 commits, all 7 stages shipped)
**Scope:** Public storefront only

## Goal

Take the marketing-ready v1 from "competent minimalism" to "rich and cool." Add **strong opinions**: a distinct visual personality, denser information hierarchy, more confident motion, visual moments worth screenshotting. Translate the brand to a **Neo-Russian / маркетплейс-с-душой** vocabulary inspired by Самокат + Яндекс Go + Ozon Travel — confident Cyrillic typography, saturated brand color blocks, dense product cards, sticker badges, infinite-scroll tickers, motion that feels Yandex-Pay-fast.

## Decisions Locked In (from brainstorming)

1. **Aesthetic:** **Hybrid Neo-Russian** — Самокат-grade density on catalog/product cards, Яндекс-confident hero + scroll storytelling on the homepage, Ozon-Travel-style playful badges/tickers as accents.
2. **Color palette:** **B + D combined**:
   - Primary brand: `#836efe` → `#c856ff` gradient (existing, unchanged).
   - **Accent: orange `#FF6B35`** + soft `#FFE4D6` + deep `#C9491E` for badges, urgency tickers, big metric numerics, primary attention spikes.
   - **Dark surface family:** `#0F0A1F` base / `#1A1430` elevated / `#2A2347` border / `#F4F1FF` text-on-dark — for hero, product-detail storytelling, pre-footer CTAs.
3. **Visual rhythm:** Light → dark → light → dark zebra-striping prevents fatigue and creates cinematic feel.
4. **Density:** Push higher than v1. Catalog grids go from 1/2/3/4 to 2/3/4/5 columns. Card padding tightens. Russian-marketplace-comfortable.
5. **Typography:** Mazzard H Extrabold + IBM Plex Sans stay. Push Mazzard harder via new `--text-mega: clamp(3.5rem, 8vw + 1rem, 9rem)` for hero numerics + manifesto BigNumbers.
6. **Motion ambition:** Tiered system (always / premium / hover-only). Adds count-up BigNumbers, sticker wobble, scroll-driven hero parallax, tighter `EASE_OUT_QUART` reveals.
7. **Manifesto numbers:** Placeholder defaults (9 / 15000+ / 48 / 161) baked in until owner confirms real ones.
8. **Cart + CMS pages stay calm** — token-level orange touches only; not promotional surfaces.
9. **Active-route underline switches to orange** — high-contrast active state on every page.
10. **No new icon library** — keep emoji + lucide-react.

## Foundation Layer Extensions

### New color tokens (`web/app/globals.css`)

```css
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
```

### New typography tokens

```css
--text-mega: clamp(3.5rem, 8vw + 1rem, 9rem);
--text-display-tight: clamp(2.5rem, 5vw + 1rem, 5.5rem);
--tracking-mega: -0.04em;
```

### New spacing tokens

```css
--space-card-tight: 0.75rem;
--space-card-relaxed: 1.5rem;
--space-section-cinematic: 8rem;
```

### New motion constants (`web/lib/motion.ts`)

```ts
export const EASE_BOUNCE = [0.34, 1.56, 0.64, 1]
export const EASE_SMOOTH = [0.22, 1, 0.36, 1]
export const SPRING_HEAVY = { type: 'spring', stiffness: 180, damping: 24 }
export const TICKER_DURATION_S = 30
```

## Net-New Components

| File | Purpose |
|---|---|
| `web/components/ui/DarkSection.tsx` | Dark cinematic section wrapper. Auto-switches text colors. Optional `glow` prop. |
| `web/components/ui/Sticker.tsx` | Diamond/rotated badge label. Variants: `accent` (orange), `brand` (purple), `dark`, `success`. Optional `wobble` prop. |
| `web/components/ui/Ticker.tsx` | Horizontal infinite-scroll marquee. CSS-keyframe based. Pauses on hover. |
| `web/components/ui/BigNumber.tsx` | Mega-numeric stat callout. Optional `countUp` prop. |
| `web/components/ui/GlassCard.tsx` (variant) | Add dark variant via prop, alongside existing light. |
| `web/components/marketing/Manifesto.tsx` | "What is Химичка" — DarkSection + 4-column BigNumber grid + manifesto paragraph. |
| `web/components/product/KeyFactsList.tsx` | 4-row spec sheet pulled from Characteristics. |
| `web/components/product/CharacteristicsTable.tsx` | Comprehensive characteristics table for reagents (when ≥4 chars filled). |
| `web/components/product/ContentsSection.tsx` | DarkSection «Что внутри» — renders when long-description has structured Состав content. |

## Modified Components

| File | Change |
|---|---|
| `web/components/Header.tsx` | Promo bar → `<Ticker>`. Active-route underline → orange. |
| `web/components/Footer.tsx` | Decorative `<MoleculeMotif>` accent in wordmark column. |
| `web/components/marketing/Hero.tsx` | Major rebuild — DarkSection wrapper, mega-display H1, hero ticker strip, sticker badges on hero product. |
| `web/components/marketing/PreFooterCta.tsx` | DarkSection. Mega claim. Orange-gradient pill button. |
| `web/components/marketing/CategoryTile.tsx` | Asymmetric `span={1\|2}` support, product-count sticker, denser layout. |
| `web/components/marketing/HowItWorksStep.tsx` | Mega numeral in orange. Renders inside DarkSection. |
| `web/components/marketing/TestimonialCard.tsx` | Sticker accent for rating/location, photo placeholder spot. |
| `web/components/ProductCard.tsx` | Sticker badges, tighter padding, orange accents on price. |
| `web/components/blocks/CtaBlock.tsx` | Updated button styling matches new vocabulary. |
| `web/components/blocks/FaqBlock.tsx` | Section heading orange marker glyph. |

## Page-by-Page Plan

### Homepage

Section flow: light → dark → light → dark → light → dark.

1. **Hero** — DarkSection, ~90vh. Mega-display H1 with one orange-emphasis word, eyebrow, lead, two CTAs (purple + orange-outlined), hero product card with floating sticker badges (Хит, −N%, От 10 лет, 161 опыт), `<Ticker>` strip across the bottom in orange.
2. **Бестселлеры** — light, dense 2/3/4/5 grid with new ProductCard stickers.
3. **Manifesto** — DarkSection. 4 BigNumbers with count-up animation: 9 лет / 15000+ покупателей / 48 наборов / 161 опыт. Manifesto paragraph.
4. **Каталог** — light. Asymmetric masonry of 6 category tiles with product-count stickers.
5. **Как это работает** — DarkSection. 3 steps with mega orange numerals.
6. **Отзывы родителей** — light. 3–6 testimonial cards (admin-driven). Sticker accents.
7. **FAQ** — light. Restyled FaqBlock from CMS home page.
8. **Pre-footer** — DarkSection. Mega «Готовы начать эксперимент?» + single orange-gradient pill button.

### Product detail

- Hero zone: light, two-column. Sticky gallery left with floating sticker badges on the corner. Info column right with eyebrow link, mega H1, characteristic pills, KeyFactsList (4-row spec sheet), AddToCartWithQuantity (orange button), MicroTrustRow.
- **«Что внутри» — DarkSection** when long-description has structured Состав. Two-column grid with orange checkmarks + decorative orange MoleculeMotif.
- Long description blocks — light, constrained reading column. Optional CharacteristicsTable for reagents.
- Related products — light, dense 4-column grid.
- Pre-footer — DarkSection.

### Category list (`/categories`)

Hero band light + orange marker glyph H1. Asymmetric tile masonry. DarkSection pre-footer.

### Category detail (`/categories/[slug]`)

Hero with breadcrumbs + product-count sticker + optional Ticker band. 4–5 column ProductCard grid. DarkSection pre-footer.

### Cart (`/cart`)

Stays calm. Token-level orange touches (CTA button, summary subtotal sticker). Empty state gets confidence (mega Mazzard «Корзина пуста» + single orange pill).

### CMS pages (`/o-nas`, `/dostavka`, `/kontakty`, `/[slug]`)

Hero band light + mega H1 + optional eyebrow. Body in constrained reading column. DarkSection pre-footer.

### 404 page

DarkSection. 404 numeral at `--text-mega` with orange gradient fill. Decorative orange MoleculeMotif. Two CTAs (orange + white-outlined).

### Header + Footer

- Header: promo bar → Ticker. Active-route underline → orange.
- Footer: decorative orange MoleculeMotif in wordmark column.

## Motion Philosophy (replaces v1's "B confidently animated")

**Tier 1 — always animated:**
- `<Reveal>` snappier (`EASE_OUT_QUART`, 0.45s).
- `<Stagger>` 80ms increment, capped at 8 children.
- `<Sticker>` entrance: rotate-from-12° + scale-from-0.6 with `EASE_BOUNCE`.
- `<Ticker>` continuous CSS keyframe, 30s/cycle, pause-on-hover.
- Buttons: hover scale 1.04 + shadow-glow shift.

**Tier 2 — premium moments (sparingly):**
- Hero text first-paint: 4-row stagger with `SPRING_HEAVY`.
- `<BigNumber count-up>` animation on viewport-enter, 1.2s.
- Hero product card parallax: tied to scroll, ±60px range.
- `<Sticker wobble>`: ±2° continuous rotation 4s loop. Disabled under reduced-motion.
- Page-level `view-transition-name` on hero H1 + primary product card (Next 16 SPA transitions).

**Tier 3 — hover/click only:**
- Card hover: lift 1.02 + image scale 1.08 + sticker rotate to 0°.
- Add-to-cart click: scale-down 0.97 → 1.0 spring.
- Cart-button badge: spring-bounce on item-count change.

**Reduced motion:** every Tier 1 + 2 animation collapses to instant fade or no-op when `prefers-reduced-motion: reduce`. Tier 3 keeps minimal scale.

## Rollout Sequence

| Stage | Title | Commits |
|---|---|---|
| 1 | Token + primitive extensions | 1–2 |
| 2 | Homepage v2 | 2–3 |
| 3 | Product detail v2 | 2 |
| 4 | Pattern extraction (if needed) | 0–1 |
| 5 | Catalog/category/cart/CMS/404 | 2–3 |
| 6 | Header + Footer touches | 1 |
| 7 | Final pass — Playwright baselines refresh + Lighthouse | 1 |

**Total: 9–12 commits.**

## Testing Strategy

- 683 vitest tests stay green; ~30 new unit tests added (5–8 per new component).
- Playwright visual baselines refreshed in Stage 7 (intentional diffs accepted).
- Browser smoke at 3 viewports (375 / 768 / 1440) per stage.
- Reduced-motion regression: walk through homepage + product detail with `prefers-reduced-motion: reduce`.
- Lighthouse audit at end. Targets: Perf ≥90 mobile, A11y 100, BP ≥95, SEO 100.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Dark sections cause fatigue on long scroll | Strict zebra-striping prevents two dark back-to-back. |
| Ticker distracting on first impression | 30s slow cycle. Pause-on-hover. ≤1 ticker above fold. |
| Sticker wobble + count-up could feel busy | Reduced-motion compliance. ≤1 wobbling sticker visible at any time. Count-up only on Manifesto. |
| Asymmetric tile spans break on odd category counts | Fallback to symmetric grid when odd count detected. |
| 4-color palette to maintain | Codified in tokens. Stickers/dark choices isolated. |
| Tilda visitors might find v2 too aggressive | Visually compare against current Tilda; dial back stickers/density in polish pass if needed. |

## Out of Scope (deferred)

- Catalog filters/search UI.
- Reviews backend (testimonials stay admin-curated).
- Lifestyle photography (design accommodates).
- Custom icon library.
- Cart-to-checkout flow (Phase 4).

## External Assets Owner Provides

- **Confirm real Manifesto numbers** — years, customers, kits, experiments.
- **Optional: confirm orange shade** — `#FF6B35` default; swap if Tilda Mark badges use a different one.

## Next Step

Transition to the `writing-plans` skill to produce a phased, bite-sized implementation plan with concrete commits + TDD-style steps.
