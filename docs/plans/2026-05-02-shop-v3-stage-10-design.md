# Shop v3 — Stage 10: Pagination + Mobile/tablet visual baselines

**Date:** 2026-05-02
**Status:** Design approved, ready for implementation plan
**Repo:** `ximi4ka-shop`
**Builds on:** [Stage 9 — Cart + Header/Footer chrome](2026-04-29-shop-v3-stage-9-design.md)
**Scope:** Two visible-polish items from Track A — net-new pagination component + extending Playwright visual regression baselines to mobile + tablet viewports.

## Goal

Add the only missing list-navigation primitive (pagination) and lock visual regression coverage at mobile + tablet viewports — the two surface qualities flagged across multiple stage reviews as "deferred." Stage 11 (real product photos) requires asset hand-off; Stage 10 unblocks both that future stage AND any future paginated list view (search results, admin, etc.) from needing to re-invent pagination.

## Decisions Locked In

1. **Scope:** **C — pagination + mobile/tablet baselines bundled** (without real product photos, which become Stage 11 once asset files land). Pagination has no asset dependency; mobile baselines are mechanical Playwright extension.

2. **Pagination layout pattern:** **A — numbered range with ellipsis.** Mono uppercase links separated by brand-purple `·`, current page wrapped in `[ ]` brackets and brand-purple text. Example: `← НАЗАД · 1 · 2 · [3] · 4 · 5 ... 12 · ВПЕРЁД →`. Above it, a small mono caption: `стр. 03 из 12 · показано 25–36 из 240`. Conventional pattern users expect, but rendered in v3 lab-journal vocabulary so it doesn't feel like a stock e-commerce control.

3. **Range compression rule:** total ≤ 7 pages → render all. Total > 7 → always show first + last + 3 around current, ellipsis between. Edge cases (current page near start/end) collapse the closer ellipsis to keep at most 9 visible elements (7 pages + 2 ellipses).

4. **Items per page:** **12.** Smaller than typical e-commerce defaults; fits the current catalog size (most categories have ≤12 products today, so pagination may not even render initially — but the slot is wired for future growth). Trade-off: more page hits later when catalog grows, but better above-the-fold density and faster mobile rendering.

5. **Where pagination wires:** **only `/categories/[slug]`** in Stage 10. Other list views are static (homepage product row at fixed 3) or don't exist (search). Future paginated surfaces consume the same `<PaginationLJ>` component.

6. **API change:** `listProductsByCategory` (in `web/lib/api.ts`) extended to accept optional `page` + `pageSize` params and return `{ products, totalCount }` instead of bare `Product[]`. Backward compatibility considered: any other consumer of `listProductsByCategory` (need to grep) updates to read `result.products` instead of `result`.

7. **Component shape:** server component, all `<Link>` tags (no client state). Reads existing `searchParams` from caller via props, builds `href` strings preserving named params (`sort`, etc.) via a `preserveParams` prop. **No client wrapper needed** (unlike CategoryFilterBarMount).

8. **Disabled states:** `← НАЗАД` on page 1 and `ВПЕРЁД →` on last page render as `<span>` (not `<Link>`), with `opacity-40` and no hover state. Brackets/separators stay in place — only the link semantics change.

9. **Mobile/tablet visual regression baselines:** drop the `desktop`-only skip on the 4 existing Playwright spec files (`v3-homepage.spec.ts`, `v3-product-detail.spec.ts`, `v3-stage-8.spec.ts`, `v3-stage-9.spec.ts`), generate baselines for `tablet` and `mobile` projects (already defined in `playwright.config.ts`), eyeball each new baseline for surprises (real layout bugs that were never caught at desktop), fix any genuine layout regressions before committing baselines.

10. **Tablet/mobile viewport sizes:** trust existing `playwright.config.ts` configuration (likely 768×1024 tablet / 375×812 mobile). No bespoke breakpoint sweeping in this stage.

11. **Mobile menu / mobile buy bar in baselines:** mobile-viewport baselines on PDP will capture the sticky `<MobileBuyBarLJ>` from Stage 7. Expected behavior, baselined as-is.

## Architecture

### `<PaginationLJ>` props + behavior

```tsx
<PaginationLJ
  currentPage={3}        // 1-indexed
  totalPages={12}
  totalResults={240}
  resultsPerPage={12}
  basePath="/categories/reaktivy"
  preserveParams={['sort']}  // named query params to keep on page navigation
/>
```

- Renders nothing if `totalPages <= 1`
- Range compression rule per §3
- All hrefs computed as `${basePath}?page=${n}${&otherParams}` — page 1 omits `?page=` to keep canonical clean
- A11y: `<nav aria-label="Пагинация">` wrapper, `aria-current="page"` on current

### Server-side pagination changes

`listProductsByCategory(slug, opts)` in `web/lib/api.ts`:
- Old: returns `Promise<Product[]>` with `opts: { limit?, sort? }`
- New: returns `Promise<{ products: Product[]; totalCount: number }>` with `opts: { page?, pageSize?, sort? }`
- Default `pageSize = 12`. Default `page = 1`.
- Backend API endpoint may need a count query — verify whether `/api/public/categories/[slug]/products` already returns total or needs extending.

Other consumers of `listProductsByCategory` (most likely just `[slug]/page.tsx`) updated to destructure `{ products, totalCount }`.

### Categories detail page changes

```tsx
const sp = (await searchParams) ?? {}
const page = Math.max(1, parseInt(String(sp.page ?? '1'), 10) || 1)
const sort = parseSort(sp.sort)
const { products, totalCount } = await listProductsByCategory(slug, { page, pageSize: 12, sort })
const totalPages = Math.ceil(totalCount / 12)

// ... existing JSX ...

{products.length > 0 && (
  <PaginationLJ
    currentPage={page}
    totalPages={totalPages}
    totalResults={totalCount}
    resultsPerPage={12}
    basePath={`/categories/${slug}`}
    preserveParams={['sort']}
  />
)}
```

Renders nothing when `totalCount ≤ 12` (single page).

### Mobile/tablet baseline strategy

Each spec file currently looks like:
```ts
test.describe('v3 Lab Journal — homepage', () => {
  test.skip(({ project }) => project.name !== 'desktop', '...')

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    // ...
  })
  // ...
})
```

Stage 10 changes:
- Drop the `test.skip` line
- Drop the explicit `setViewportSize` call (let Playwright's `project.use.viewport` from config drive it)
- Confirm config has `desktop`/`tablet`/`mobile` projects with appropriate viewports

Then `npx playwright test --update-snapshots` generates per-spec, per-project baselines. Each existing test produces 3 baseline files (one per project) instead of 1.

**Filename pattern after change:** `homepage-how-it-works-mobile-darwin.png`, `homepage-how-it-works-tablet-darwin.png`, `homepage-how-it-works-desktop-darwin.png`.

**Eyeball pass before commit:** Open each new baseline (mobile + tablet across all specs ≈ 14 new files). Look for:
- Hand-drawn callout SVGs visible/hidden correctly per existing CSS
- Asymmetric staggered grids: do they collapse to single column cleanly at mobile?
- Off-grid headlines: do they wrap reasonably or clip?
- Mobile menu trigger visible on Header
- Sticky filter bar offset correct under Header
- Mendeleev cells stack vertically on mobile (per existing `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` pattern)

If a real layout bug surfaces, fix in a small commit before snapshotting (don't bake bugs into baselines).

### Net-new components

| Component | Used by |
|---|---|
| `<PaginationLJ>` | `/categories/[slug]` (Stage 10), future search/list views |

### Modified

| File | Change |
|---|---|
| `web/components/ui/PaginationLJ.tsx` (new) | TDD'd component with range compression |
| `web/components/ui/PaginationLJ.test.tsx` (new) | Tests for layout, compression, disabled states, href building |
| `web/lib/api.ts` | `listProductsByCategory` signature: optional page/pageSize, returns `{products, totalCount}` |
| `web/lib/api.test.ts` (if exists) | Update assertions for new return shape |
| `web/app/[locale]/(public)/categories/[slug]/page.tsx` | Read `?page=`, pass to API, render `<PaginationLJ>` |
| `web/app/[locale]/(public)/categories/[slug]/page.test.tsx` | Test pagination renders |
| `web/tests/visual/v3-homepage.spec.ts` | Drop `desktop`-only skip + viewport hardcode |
| `web/tests/visual/v3-product-detail.spec.ts` | Same |
| `web/tests/visual/v3-stage-8.spec.ts` | Same |
| `web/tests/visual/v3-stage-9.spec.ts` | Same |
| `web/tests/visual/__screenshots__/**/-mobile-darwin.png`, `-tablet-darwin.png` | New baselines |

### Data model impact

**None.** Pure presentation + signature change in lib layer. No DB migrations.

## Risks

- **Backend total-count query.** If `/api/public/categories/[slug]/products` doesn't return `totalCount`, the API needs extending. Either: (a) add a `count` field server-side (small backend change), or (b) make a second request to count, or (c) use an in-memory `.length` check on a larger fetch (limits real pagination). Implementer should verify with one curl on the dev API before designing the fetch.
- **Real layout bugs surfacing in mobile baselines.** Some v3 patterns (asymmetric stagger, off-grid headlines) were designed at desktop and might look poor at mobile despite responsive defaults. Worst case: a few small layout fixes need to land before mobile baselines can be committed. Estimate 0–3 fixes; each is a small commit.
- **Pagination "may never render" in current catalog state.** The user noted catalog has few positions. If no category currently exceeds 12 products, the component renders zero pages and there's no Playwright baseline of the pagination component itself. Mitigate: add a separate Playwright test that mocks pagination data to capture the visual baseline regardless of dev catalog state.
- **`resultsPerPage` mismatch in count caption.** "показано 25–36 из 240" needs to compute `(currentPage - 1) * pageSize + 1` to `Math.min(currentPage * pageSize, totalCount)`. Off-by-one bugs likely; test coverage required.
- **`?page=1` URL canonicalization.** Page 1 should NOT include `?page=` in the URL (canonical cleanliness, per Stage 8 CategoryFilterBarMount precedent which dropped `?sort=newest` for the same reason). The `<Link>` href builder needs to omit `page=1` while still honoring `preserveParams`.

## Acceptance criteria

A storefront build passes Stage 10 when:

1. `<PaginationLJ>` renders nothing when `totalPages <= 1`
2. With ≤7 pages, all page numbers render without ellipsis
3. With >7 pages and current page in middle, output matches: `← НАЗАД · 1 · 2 ... 5 · [6] · 7 ... 11 · 12 · ВПЕРЁД →`
4. Current page wrapped in `[ ]` brackets and rendered in brand-purple
5. `← НАЗАД` on page 1 renders as disabled `<span>`, not `<Link>` (similarly `ВПЕРЁД →` on last)
6. Page 1 hrefs omit `?page=` (canonical), other pages include `?page=N`
7. Named params from `preserveParams` survive page navigation (e.g. clicking `→ ВПЕРЁД` from `/categories/x?sort=price-asc` lands on `/categories/x?sort=price-asc&page=2`)
8. `/categories/[slug]` reads `?page=N` from `searchParams`, fetches the right slice, renders `<PaginationLJ>` below the product grid
9. Mono caption above pagination shows correct range: "стр. N из M · показано A–B из C"
10. Mobile baselines exist for all 4 specs across all currently-snapshotted scenes (homepage sections, PDP, categories, Stage 9 chrome)
11. Tablet baselines exist for the same scenes
12. No layout regression at mobile/tablet that wasn't already in v3 (eyeball pass + any layout fixes committed before baseline commit)

## Out of scope

- **Real product photos** — Stage 11 once you have asset files
- **Search results pagination** — search doesn't exist yet
- **Admin pagination** — admin is v2-locked
- **Server-side count caching** — if backend total-count query becomes a perf hotspot, Redis/edge cache later
- **Lighthouse / a11y audits** — Track D, separate stage

## Next Step

Invoke `superpowers:writing-plans` to produce the implementation plan: per-task TDD breakdown, commit-by-commit sequence, baseline regeneration recipe.
