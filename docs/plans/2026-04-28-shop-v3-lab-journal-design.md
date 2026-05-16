# Shop v3 — Лабораторный Журнал Design Overhaul

**Date:** 2026-04-28
**Status:** Design approved, ready for implementation plan
**Repo:** `ximi4ka-shop` (sibling to this ERP repo)
**Replaces:** [v2 Neo-Russian](2026-04-28-ui-ux-v2-neo-russian-design.md) (17 commits, all stages shipped) — sharp pivot, not an evolution
**Concept artifact:** `ximi4ka/concept.html` (preview-only, owner-approved 2026-04-28)
**Design system spec:** `ximi4ka-shop/design-system/ximi4ka-v3/LABORATORY_JOURNAL.md`
**Scope:** Public storefront only — admin/CMS pages get token-level adoption, no structural changes

## Goal

Take the storefront from "rich Neo-Russian marketplace" to "lab-tech monograph." A distinct visual personality grounded in **education + technology** — Swiss typographic confidence, asymmetric off-grid layouts, hand-drawn warmth, molecular notation as ornament. Visual references: [sutera.ch](https://www.sutera.ch/) (warm cream restraint), [iyo.ai](https://www.iyo.ai/) (ink-clinical typography). Translation to a chemistry-kit brand for families.

## Decisions Locked In (from brainstorming)

1. **Aesthetic:** **"Лабораторный журнал"** — open laboratory notebook. Cream paper pages alternate with ink instrument readouts. Each cream→ink transition is the cinematic moment. Section flow on every long page: cream → ink → cream → (optional ink). Never `[ink][ink]` in succession.

2. **Color palette:** **Dual stage with brand as precision accent.**
   - **Cream lab:** `#F2EFE8` surface / `#E8E3D7` shade / `#0A0A0A` text. Hero, products, catalog.
   - **Ink lab:** `#0A0A0A` surface / `#EFEDE6` text / 60% bone for muted. Manifesto, "what's inside" stories, pre-footer CTAs.
   - **Brand:** `#836efe` only. **Per-page budget = 5 occurrences.** Reserved for one headline word (italic), one underlined manifesto phrase, hand-drawn callouts, eyebrow bullets, NumberCell hover top-stroke. Forbidden as background blocks or wallpaper gradients.
   - **Removed from v2:** orange family (`#FF6B35` etc.), purple-deep surface family, all gradient-brand variants.

3. **Visual vocabulary:** **Notation-as-decoration with hand-drawn warmth.**
   - Molecular wireframes (benzene, anthracene ghost, water fragment) as ambient decoration — **never with atom labels**, just clean geometry.
   - Hand-drawn SVG callout arrows pointing into product images, revealed on hover via stroke-dashoffset.
   - Mendeleev-cell stat blocks with atomic-mass-style labels.
   - Chemical formulas (`H₂O`, `2 × 10⁴`, `Cu + 2 AgNO₃ → Cu(NO₃)₂ + 2 Ag↓`) as typographic ornament throughout.

4. **Typography:** **Cyrillic-first Swiss pair, all free.**
   - Display: **Unbounded** (Russian-designed geometric, 400 / 700 / 900) — headings, big numbers, product titles
   - Body: **Inter** (400 / 500 / 700) — descriptions, lead paragraphs
   - Mono: **JetBrains Mono** (400 / 500) — SKUs, formulas, eyebrows, ticker, page-number system, stat labels
   - Italic ONLY on brand-purple words. Italic = signal.
   - Replaces v2 Mazzard H + IBM Plex Sans entirely.

5. **Asymmetric layout discipline:**
   - Headlines break across rows with deliberate offset (e.g. row 2 indented `9vw`).
   - Product card grids use `grid-template-columns: 1.25fr 1fr 1.1fr` (NOT equal width). 3-card row staggers vertically: `:nth-child(2) { margin-top: 4rem }; :nth-child(3) { margin-top: 8rem }`.
   - Manifesto body paragraphs indented with `border-left` rule, like a lab note.
   - Asymmetric thin rules (38% width left, 22% width right) replace full-width section dividers.

6. **Density:** Lower than v2. Generous whitespace is part of the lab-notebook feel. Catalog grids stay at 2/3 columns (not 4/5). Product cards ~30% taller than v2 to accommodate inline stats + chips + CTA. Manifesto cells `min-height: 18rem`.

7. **Notebook page system:** Every section gets a `nb-header` bar — top-left section index + label with brand-purple bullet, top-right page-of-pages + edition tag. Continuous "page count" across the homepage (`стр. 01 / 06` → `06 / 06`).

8. **Manifesto numbers (owner-confirmed values, locked):**
   - 01 / 2023 / год (founding) — visualized with Timeline 2023→2026, founding year as solid brand-purple dot
   - 02 / 20 000+ / купили — visualized with Scientific notation `2 × 10⁴ = ЛЮДЕЙ`, brand-purple multiplier and exponent
   - 03 / 4,9 / рейтинг — visualized with 5 circles, last filled 92% via clip-path
   - 04 / 161 / реакций — visualized with literal DotGrid of exactly 161 small dots in 23 × 7 layout, last dot brand-purple

9. **Product catalog (owner-confirmed dataset, locked):**
   - X-30 / Химичка 3.0 / 18 реактивов / 12 инструментов / 161 реакция / 3 399 ₽ / 10+
   - X-MINI / Мини-Химичка / 18 / 4 / 161 / 1 799 ₽ / 8+
   - X-EL / Электрохимичка / 14 / 20 / 74 / 3 299 ₽ / 12+
   - Each card shows the 3 stats as **dashed-mono progress bars** (Morse-like `repeating-linear-gradient`), scaled per-stat-type max across all visible cards, animated on scroll-into-view via IntersectionObserver.

10. **Motion ambition:** Calm-confident, NOT bouncy.
    - **Always:** ticker crawl (50s loop), molecule rotation (80s slow / 200s ghost reverse), `mix-blend-mode: multiply` on the cream-side benzene
    - **On scroll:** count-up on big numbers (`requestAnimationFrame`, easeOutQuart, 1.8s), stat-bar fill (1.2s `--w` width transition)
    - **On hover:** Mendeleev cell brand-purple top-stroke draw (scaleX), callout arrow stroke-dashoffset reveal, callout text fade (200ms delay), product image scale 1→1.04, chips invert ink-on-bone, formula slide-up, CTA color invert
    - **Reduced motion:** all decorative animations off, count-up snaps to final value
    - **Removed from v2:** spring physics, `EASE_BOUNCE`, sticker wobble, parallax. None.

11. **No emoji, no icon library.** Mono character glyphs (`→`, `↓`, `●`, `≠`) inline. Lucide-react can stay if already imported but should not be added to net-new components.

12. **Brand purple as italic = signal.** Italic appears nowhere in body or mono — only on brand-purple words. This means italic alone communicates "brand emphasis" without needing color in greyscale rendering or print.

## Architecture

### New design tokens

See `LABORATORY_JOURNAL.md` §2 for full spec. Highlights:

```css
--color-cream: #F2EFE8;
--color-cream-shade: #E8E3D7;
--color-ink: #0A0A0A;
--color-bone: #EFEDE6;
--color-brand: #836efe;
--color-brand-deep: #6703ff;

--font-display: 'Unbounded', system-ui, sans-serif;
--font-body: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;

--text-mega: clamp(2.75rem, 9vw, 9.5rem);
--text-display: clamp(2.25rem, 5.5vw, 5.5rem);

--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
```

### New components (net-new)

| Component                 | Role |
|---------------------------|------|
| `<Section variant>`       | Cream/ink section wrapper. Owns padding, grid overlay, nb-header slot, optional rule slot, optional decorative molecule slot. Replaces v2 `<DarkSection>`. |
| `<NotebookHeader>`        | Top section/page-of-pages bar. Mono uppercase. |
| `<GridOverlay>`           | 64×64 dotted blueprint grid. Auto-color by surface. |
| `<RuleAsym>`              | Thin asymmetric horizontal divider, 38%-left or 22%-right. |
| `<Callout>`               | Hand-drawn SVG arrow + mono brand-purple text. Reveals on parent hover via stroke-dashoffset. |
| `<MoleculeMotif>`         | Variants: `benzene`, `anthracene`, `water`, `methane`. No atom labels. |
| `<NumberCell>`            | Mendeleev cell with index, top label, big number (static or count-up), bottom labels, viz children slot. |
| `<Timeline>`              | Year axis viz for NumberCell. |
| `<Scientific>`            | `N × 10ⁿ` typographic viz for NumberCell. |
| `<Rating>`                | N circles with partial fill viz for NumberCell. |
| `<DotGrid>`               | JS-generated literal-count dot grid for NumberCell. |
| `<StatBar>`               | 3-col row: mono label / dashed-bar / display value. Animates on scroll. |
| `<Chip>`                  | Pill, mono lowercase. Inverts on parent card hover. |
| `<HeroFigtag>`            | Center-top mono `FIG. 001-A` style label. |
| `<HeroScale>`             | Bottom-left ruler SVG + mono caption. |
| `<HeroAnnotation>`        | Bottom-right `РАБОЧАЯ ОБЛАСТЬ` annotation with thin rule. |
| `<HeroDetailMolecule>`    | Top-right water/methane fragment, 55% opacity. |

### Components to delete

- `web/components/ui/Sticker.tsx` — diamond rotated badges gone
- `web/components/ui/HeroProductStack.tsx` — type-only hero now
- All v2 motion constants and keyframes (sticker wobble, spring physics, bounce easing)
- Orange-family CSS variables and any consumer

### Components to rebuild

- `web/components/marketing/Hero.tsx` — full rebuild per `LABORATORY_JOURNAL.md` §4.10. Now: cream surface, mega Unbounded headline broken across rows with brand-purple italic accent, mono trail line, hero figtag + scale + annotation + corner detail molecule, pinned rotating benzene with mix-blend-mode multiply, bottom mono ticker.
- `web/components/marketing/Manifesto.tsx` — full rebuild. Now: ink surface, eyebrow + statement (with brand underline em), indented bordered body, 4×`<NumberCell>` row with `<Timeline>` / `<Scientific>` / `<Rating>` / `<DotGrid>` data viz children, anthracene ghost background.
- `web/components/ProductCard.tsx` — full rebuild per `LABORATORY_JOURNAL.md` §4.4. Now: head bar (SKU + element + badge), image (corner mark, illustration, hover formula popup, callout), title (italic brand + bold continuation), description, 3×`<StatBar>`, chips, meta (price + outlined CTA). Hover state on whole card inverts chips + CTA + draws callout arrow.
- `web/components/Header.tsx` — keep ticker, restyle items to brand-purple-dot + mono formula format. Active-route underline switches from orange to brand-purple.
- `web/components/Footer.tsx` — calm mono links, optional small `<MoleculeMotif variant="methane">` decorative.

### Pages affected (homepage section flow)

```
[cream]  HERO            big headline + ticker
[ink]    MANIFESTO       statement + 4-cell number row with data viz
[cream]  CATALOG         category tiles, asymmetric grid
[ink]    HOW IT WORKS    3 steps with mega numerals
[cream]  TESTIMONIALS    cards
[ink]    PRE-FOOTER CTA  mega claim + single brand-deep pill
[cream]  FOOTER          calm mono links
```

Catalog page, product detail page, content pages: same component vocabulary, different section flows. Cart and checkout stay calm — token-level adoption only (cream surface, Inter body, mono labels), no decorative molecules or callouts in transactional flows.

## Data Model Impact

**None.** This is a pure presentation refactor. No DB migrations, no API changes. The only data adjustments:

- Manifesto stats migrate from v2 placeholder values (9 / 15000+ / 48 / 161) to confirmed values (2023 / 20 000+ / 4,9 / 161). These have been baked into the design — owner-confirmed.
- Product cards now display SKU prefix `X-NN` consistent with current internal naming.
- Per-stat-type max scaling for `<StatBar>` is computed per-row in the consuming component, derived from visible card data; no schema change.

## Resolved Questions (owner-confirmed 2026-04-28)

1. **Catalog count** — hero lead text uses **"3 набора"** as the factual current count. Lead copy locked to: *"3 набора. От реакций меди до электролиза — настоящие реагенты, посуда, понятные протоколы. То, что школа показывает на видео, вы делаете руками."* Update copy when catalog grows.
2. **Product card images** — keep stylized SVG illustrations in the concept; **owner will swap to real product photography post-implementation** within the same card chrome (corner mark, callout, hover formula). Implementation must support both — `<ProductCard>` accepts either an `<svg>` or `<img>` slot in `pcard__image-art`.
3. **Ticker content** — current concept ticker formulas and reagent names approved as-is. Locked list: `H₂O · вода`, `NaCl · соль`, `CuSO₄ · медь`, `pH 7.0 · нейтрально`, `C₆H₁₂O₆ · глюкоза`, `HCl · соляная`, `Fe + S → FeS`, `NH₃ · аммиак`, `2 H₂O₂ → 2 H₂O + O₂`, `K · калий`. Owner can add/swap any time post-launch via a single config file.

## Risks

- **v2 rebuild scope** — this is not an evolution, it's a replacement of the marketing surfaces. Estimate 12–16 commits across 5–6 stages. Risk: in-flight v2 features (e.g. CMS blocks, FAQ, testimonials) need v3-pass at the same time, or the homepage will be visually inconsistent mid-migration.
- **Font load weight** — Unbounded 900 + Inter 400/500/700 + JetBrains Mono 400/500 = ~280 KB woff2 total. Mitigate with `font-display: swap` and selective subsetting (Cyrillic + Latin only, no Greek/Vietnamese).
- **Russian Unbounded rendering** — Unbounded's Cyrillic at weight 900 with `letter-spacing: -0.045em` can over-tighten on certain characters (`Ы`, `Ъ`). Visual QA pass required after font tuning.
- **Hand-drawn callouts on tiny viewports** — callouts are absolute-positioned outside card bounds. On <720px we hide them entirely (already in concept CSS). Confirm that mobile readers don't lose information — current callouts are "feature highlight" sugar, not load-bearing.

## Acceptance criteria

A homepage build passes when:

1. Section rhythm renders cream → ink → cream → ink → cream → ink → cream without exception
2. Brand-purple budget ≤ 5 occurrences per page (visual audit)
3. Notebook header present on every section, page-count consistent
4. All headlines use Unbounded 900 with `letter-spacing: -0.045em`, italic only on brand-purple words
5. Hero benzene rotates without atom labels, mix-blend-mode multiply over headline
6. Manifesto numbers count up on scroll, each cell has unique data viz, brand-purple top-stroke draws on hover
7. Product cards stagger asymmetrically (`margin-top: 0/4rem/8rem` on 3-card row), inline stats animate on scroll, chips/CTA invert on whole-card hover, hand-drawn callouts reveal via stroke-dashoffset
8. Reduced motion preference disables all decorative animations and snaps count-up to final value
9. Lighthouse: no CLS regression vs v2, font-load TTI within 200ms of v2

## Next Step

Invoke `superpowers:writing-plans` to produce the implementation plan: stage breakdown, commit-by-commit plan, test coverage plan, deploy checkpoints.
