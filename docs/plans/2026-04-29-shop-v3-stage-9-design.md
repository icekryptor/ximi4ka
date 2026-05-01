# Shop v3 — Stage 9: Cart + Header/Footer chrome + 3 cleanups

**Date:** 2026-04-29
**Status:** Design approved, ready for implementation plan
**Repo:** `ximi4ka-shop`
**Builds on:** [Stage 8 — Homepage v2 sweep + CMS blocks + Categories](2026-04-28-shop-v3-stage-8-design.md)
**Scope:** Cart full v3 (calm aesthetic) + Header/Footer chrome rebuild + 3 documented technical-debt cleanups.

## Goal

Eliminate the last meaningful v2 islands on the public storefront and resolve compounding tech debt flagged across multiple stage reviews. After Stage 9, every public surface (homepage, product detail, categories, cart, drawer, header, footer, all CMS blocks) reads as one design language. Admin remains v2 per design intent.

## Decisions Locked In (from brainstorming)

1. **Scope:** **C — full Stage 9 push**: cart full v3 + Header/Footer chrome rebuild + 3 cleanups (ParagraphBlock surface-aware, Header `--lj-header-height` CSS variable, TrustStrip status). Single comprehensive design + plan. No sub-stage split.

2. **Cart aesthetic:** **A — calm v3.** Honor the original Stage 0-6 design intent ("Cart and checkout keep calm surfaces — Inter only, no decorative chrome"). Cart is a task surface, not a marketing surface. v3 tokens (cream surface, Inter body, Unbounded for prices/totals, mono for labels, ink-pill CTA, Stage 7's already-migrated brand-purple discount chip on price) — but **no NotebookHeader, no Mendeleev cells, no molecules, no off-grid headings**. Single mono page label `КОРЗИНА · N НАБОРОВ` for orientation.

3. **Logo:** **SVG primary + Mazzard Italic font wired.** Customer provided both. SVG (`/public/logo-himichka.svg`) is the primary logo render — paths exported from registered "ХИМИЧКА" wordmark in Mazzard H Extrabold Italic. Source SVG processed: foreignObject + decorative gradient stripped, fills converted to `currentColor` so the wordmark inherits parent text color (ink on cream Header, bone on any future ink Header). Mazzard H Extrabold Italic woff2 also wired as `@font-face` for future "brand emphasis" moments — but the logo specifically renders as SVG, not text.

4. **Header nav typography:** **A — mono uppercase.** JetBrains Mono, 0.06em tracking, uppercase nav labels. Active route: brand-purple text + brand-purple underline (already migrated in Stage 5). Cohesive with NotebookHeader and eyebrow vocabulary used everywhere else.

5. **Mobile menu:** **B — full-screen takeover.** New `<MobileMenuOverlay>` component renders as full-viewport `<dialog>`. Cream surface, faint blueprint grid background, NotebookHeader at top (`№ MENU — Меню` left, `× закрыть` right), each nav item rendered as a row with mono index + Unbounded display label + mono description below + brand-purple bullet on active route. Body scroll-lock when open, Esc closes. Reinforces lab-journal vocabulary on the surface that gets the most traffic.

6. **Footer:** **B — lab notebook colophon.** Full-width "back of the book" treatment with NotebookHeader strip, three horizontal mono rows (`ОТ`, `СВЯЗЬ`, `СТРАНИЦЫ`) separated by asymmetric thin rules, large Mazzard SVG wordmark + edition tag at bottom. Methane molecule already placed in Stage 5 stays. Reads as the "publication imprint" of the lab journal.

7. **Mobile menu nav item descriptions:** owner approved using sensible defaults (`Каталог → найти набор`, `О нас → наша лаборатория`, `Доставка → сроки и тарифы`, etc). Implementer writes the defaults; can be overridden later via CMS or a config file.

8. **Footer ОТ row content:** confirmed `Химичка · с 2023 · Москва · 161 опыт · ⌀ 4.9/5`. Pulls from the same locked manifesto data set as Stage 0-6 (`/design-system/ximi4ka-v3/LABORATORY_JOURNAL.md` §8).

9. **Cart count when empty:** show `КОРЗИНА (0)` with parenthesized zero. Non-empty: `КОРЗИНА · 3` with brand-purple count after a mono `·` divider.

10. **ParagraphBlock surface-aware mechanism:** add `--lj-prose-color` CSS variable to `<LabSection>`. Set to `var(--color-lj-ink)` on cream variant, `var(--color-lj-bone)` on ink variant. ParagraphBlock changes hardcoded `text-[var(--color-lj-ink)]` → `text-[var(--lj-prose-color)]`. Prose-specific naming (vs generic `--lj-text-on-surface`) leaves room for chip/button/CTA color management to use other variables without conflict.

11. **Header `--lj-header-height` CSS variable:** Header exposes its rendered height via inline style on `<html>` (set via `useEffect` measuring + ResizeObserver to react to promo strip changes). Sticky surfaces (CategoryFilterBar from Stage 8.C, future ones) use `top-[var(--lj-header-height)]` instead of hardcoded `top-20`. Eliminates the brittle Header-height assumption flagged in Stage 8 review.

12. **TrustStrip status:** **keep as-is.** Only consumed by admin `SettingsForm.tsx`; admin is v2-locked per design intent. No deletion, no v3 rebuild this stage.

## Architecture

### Page chrome — what users see on every page

```
─ Header (cream, sticky)
   [Mazzard SVG logo]    [mono nav]    [КОРЗИНА · N]    [МЕНЮ on mobile]
   ↑ exposes --lj-header-height CSS variable

─ [Page content: hero / sections / blocks per stage 0-8]

─ Footer (cream, full-width colophon)
   ─ NotebookHeader (СТР. ZZ / END)
   ─ ОТ      Химичка · с 2023 · Москва · 161 опыт · ⌀ 4.9/5
   ─ СВЯЗЬ   phone · email · telegram · whatsapp
   ─ СТРАНИЦЫ каталог · о нас · доставка · оплата · возврат
   ─ [large Mazzard SVG wordmark]    [© 2023–2026 · Ред. 2026.04 · v3]
   ─ [methane molecule corner accent]
```

### Mobile menu (full-screen)

```
─ NotebookHeader (№ MENU — Меню) [× закрыть]

01 / Каталог
    найти набор
─ asymmetric thin rule
02 / О нас
    наша лаборатория
─ asymmetric thin rule
03 / Доставка
    сроки и тарифы
─ asymmetric thin rule
04 / Оплата
    способы расчёта
─ asymmetric thin rule
05 / Возврат
    гарантия 30 дней

─ thick rule

КОРЗИНА · 3 →

─ contact strip
telegram · whatsapp · phone
```

Active route gets brand-purple bullet + display label color.

### Cart page (calm)

```
─ [Header sticky]

─ КОРЗИНА · 2 НАБОРА                    (mono uppercase, top page label)

─ Корзина                                (Unbounded Black, no off-grid)

─ ┌──────────────────────────────────────┐
   │ № X-30 / Cu                Хит      │
   │ Химичка 3.0                          │   <- ProductPriceBlockLJ
   │ Стартовый набор...                   │      (mega Unbounded price
   │ 3 399 ₽   [-] 1 [+]   3 399 ₽       │       + Stage 7 discount chip)
   │                                  ×   │   <- × glyph, mono
   └──────────────────────────────────────┘

─ ┌──────────────────────────────────────┐
   │ № X-MINI / NaCl              Старт  │
   │ Мини-Химичка                         │
   │ Те же реакции, компактнее...        │
   │ 1 799 ₽   [-] 1 [+]   1 799 ₽       │
   │                                  ×   │
   └──────────────────────────────────────┘

─ ─────────────────────────────────────── (thin rule)

─                Подытог:        5 198 ₽
                 Доставка:          400 ₽
─                ───────────────────────  (asymmetric rule)
                 Итого:           5 598 ₽   (Unbounded Black, ink color)

─ [Оформить заказ →]                     (ink-pill CTA)

─ [Footer colophon]
```

Empty state: cream surface, Inter `Корзина пуста`, single ink-pill `Открыть каталог →` CTA.

### CartDrawer (calm slide-in)

Same vocabulary as cart page but compressed. Slide from right, scrim overlay on rest of page.

### Net-new components

| Component | Used by | Notes |
|---|---|---|
| `<HeaderLogo>` | Header + Footer | Inline SVG, currentColor fill, size prop. |
| `<MobileMenuOverlay>` | Header | Full-screen `<dialog>` with NotebookHeader pattern. Client component. |

### Modified

| File | Change |
|---|---|
| `web/components/Header.tsx` | Full rewrite — Mazzard logo + mono nav + cart label + `МЕНЮ` button + `--lj-header-height` CSS variable export |
| `web/components/Footer.tsx` | Full rewrite — colophon layout |
| `web/app/[locale]/(public)/cart/page.tsx` | Full rewrite — calm v3 |
| `web/components/CartDrawer.tsx` | Full rewrite — calm v3 |
| `web/components/ui/LabSection.tsx` | Add `--lj-prose-color` CSS variable in inline style per variant |
| `web/components/blocks/ParagraphBlock.tsx` | Replace `text-[var(--color-lj-ink)]` with `text-[var(--lj-prose-color)]` |
| `web/components/marketing/CategoryFilterBar.tsx` | Replace `top-20` with `top-[var(--lj-header-height)]` |
| `web/app/globals.css` | Add Mazzard H Italic `@font-face` declaration |
| `web/public/logo-himichka.svg` | Cleaned SVG (gradient + foreignObject stripped, currentColor fills) — generated at build-time of this stage |

### Data model impact

**None.** Pure presentation refactor + CSS variable plumbing.

## Risks

- **Mazzard italic font weight:** registered logo uses Extrabold Italic (weight 800). The font file we have is `MazzardH-ExtraBoldItalic.woff2`. Need to verify the font's actual italic angle matches the SVG paths so any future text use matches the SVG (the woff2 should be the same font that the SVG was exported from — typically the case but worth a visual diff before shipping).
- **Mobile menu accessibility:** native `<dialog>` element has good a11y but inconsistent focus-trap behavior across browsers. May need a polyfill or manual focus management. Test with VoiceOver + TalkBack.
- **Header height measurement timing:** `--lj-header-height` set via `useEffect` will be 0px during SSR + initial paint. Sticky surfaces will jump on hydration. Mitigate with a sensible CSS fallback value `--lj-header-height: 80px` set in globals.css that gets overridden by JS measurement.
- **Cart drawer state collision with mobile menu:** Both are overlay surfaces. If both open simultaneously (unlikely but possible via deep-link tricks), z-index needs to settle deterministically. CartDrawer at z-50, MobileMenuOverlay at z-60 — menu wins.
- **SVG logo color inheritance:** the cleaned SVG uses `currentColor` everywhere, but original has nested groups + clipPaths. Need to verify all fill references are caught (sometimes Figma exports per-path fills that survive CSS variable inheritance). Visual check on cream background mandatory.

## Acceptance criteria

A storefront build passes Stage 9 when:

1. Header renders the Mazzard SVG wordmark (registered logo) on cream Header, ink color via currentColor inheritance
2. Header nav links render in JetBrains Mono uppercase with brand-purple active state
3. Cart label shows `КОРЗИНА · N` with brand-purple count when items present, `КОРЗИНА (0)` when empty
4. Mobile menu opens as a full-screen takeover with NotebookHeader pattern, body scroll-lock active, Esc key closes
5. Footer renders the lab notebook colophon: 3 horizontal mono rows + large Mazzard wordmark + edition tag
6. Cart page renders calm v3: mono page label, Unbounded "Корзина" heading (no off-grid), ProductPriceBlockLJ rows, ink-pill CTA. No NotebookHeader, no molecules, no Mendeleev cells.
7. CartDrawer slides from right with same calm vocabulary as cart page
8. CategoryFilterBar (from Stage 8) uses `top-[var(--lj-header-height)]` and remains correctly tucked under Header on scroll across all viewport sizes (no overlap, no gap)
9. ParagraphBlock rendered inside `<LabSection variant="ink">` shows bone text (currently shows ink/invisible due to hardcoded color)
10. Mazzard H Italic `@font-face` is declared and available as `font-family: 'Mazzard H'; font-weight: 800; font-style: italic` for future text use
11. Lighthouse: no CLS regression vs Stage 8 (Header height measurement should not cause layout shift on hydration)
12. Playwright visual regression baselines added for: Header (cream surface), Footer colophon, cart page (populated + empty), mobile menu open state

## Out of scope (deferred)

- **Header / Footer dark variants** — when does the Header / Footer go on ink surface? Not yet a use case. Add later when needed.
- **Checkout** — not built yet.
- **CMS-editable nav** — admin form to manage nav items + descriptions. Future enhancement.
- **CMS-editable footer** — phone, email, telegram URLs are likely already in some admin settings; verify they're connected to the colophon, otherwise this stage hardcodes them.
- **Pagination component for `/categories/[slug]`** — still deferred.
- **API: productCount on public categories** — backend change, separate ticket.

## Next Step

Invoke `superpowers:writing-plans` to produce the implementation plan: stage breakdown, commit-by-commit plan, test coverage plan.
