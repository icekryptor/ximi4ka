# Content-Bank + Content-Engine Merge — Design

**Date:** 2026-05-10
**Status:** Approved (user delegated all decisions, proceed)
**Author:** Claude (decisions explained inline)

---

## Goal

Объединить `/content-bank` и `/content-engine` в одну страницу. Pipeline (9 стадий) становится главной шапкой контент-банка и заменяет существующий status-фильтр. Убрать рубричный chip-bar (юзер: «не несут необходимости»). Уменьшить визуальный шум.

## Non-goals

- Изменение редактора юнита (Edit modal остаётся как есть).
- Изменение функций контент-банка: триаж, импорт/экспорт, purge-rejected, rubrics CRUD — всё остаётся.
- Изменение Edge Function (она остаётся источником истины для дашборд-снэпшота).

---

## Decisions

| # | Решение | Обоснование |
|---|---|---|
| 1 | Слияние в `/content-bank` (Pipeline как главная шапка) | Stage эвристики уже соответствуют тому, как юзеры фильтруют по status |
| 2 | Удалить рубричный filter chip-bar | По запросу юзера, рубрики ещё видны в строках таблицы + CRUD-модалка |
| 3 | Удалить status filter chip-bar | Pipeline заменяет |
| 4 | Сохранить type/network/review filter chip-bars | Ортогональны pipeline (e.g. «scripting + YouTube») |
| 5 | Удалить `/content-engine` страницу и пункт сайдбара | Слияние, нет дубликата |
| 6 | Удалить `StageDrawer` компонент | Таблица заменяет drawer-list |
| 7 | Удалить `RubricDistribution` | Та же логика, что с рубричным фильтром |
| 8 | Сохранить `MetricsRow`, `PipelineRow`, `Bottlenecks`, `TodayQueue`, `RecentPublished` | Полезная контекстная инфа |
| 9 | Polling 30s на новой странице, **pause when modal open or document.hidden** | Не мешаем редактированию |
| 10 | Новый backend filter `?stage=<key>` | Эвристики Edge Function переезжают на наш бэк, frontend шлёт `?stage=scripting` |

---

## Architecture

```
┌─ /content-bank (single page) ───────────────────────────┐
│  Header: «Контент-банк» + last updated + Refresh        │
│  MetricsRow (4 cards)                                    │
│  Bottlenecks (conditional)                               │
│  TodayQueue (conditional, compact)                       │
│  ─────────────────────────────────────                   │
│  PipelineRow (9 stages, clickable, primary filter)       │
│  ─────────────────────────────────────                   │
│  Toolbar: Search + Sort + Triage + ... + Новая идея      │
│  Filter chips: Type / Network / Review                   │
│    (rubric и status — УДАЛЕНЫ)                           │
│  Table (filtered by pipeline + other filters)            │
│  Pagination                                              │
│  ─────────────────────────────────────                   │
│  RecentPublished (compact, conditional)                  │
│  ─────────────────────────────────────                   │
│  Edit Modal (unchanged)                                  │
└──────────────────────────────────────────────────────────┘

GET /api/content-engine/stats   — polled every 30s for dashboard
GET /api/content-units?stage=X  — table data when stage selected
GET /api/content-units?...      — table data otherwise (existing)
```

---

## Backend changes

### New query param: `?stage=<StageKey>`

**File:** `backend/src/controllers/content-unit.controller.ts` (MODIFY `getAll`)

Adds a new filter branch parallel to the existing ones. When `stage` is provided, applies the appropriate WHERE clause:

```ts
// Filter by stage (mirrors Edge Function heuristics in content-engine-stats)
if (stage) {
  switch (stage) {
    case 'ideas':
      qb.andWhere("u.status = 'idea'").andWhere('u.review_grade IS NULL')
      break
    case 'triage_needs_work':
      qb.andWhere("u.review_grade = 'needs_work'")
      break
    case 'excellent':
      qb.andWhere("u.review_grade = 'excellent'").andWhere('u.script_text IS NULL')
      break
    case 'planning':
      qb.andWhere('u.script_text IS NULL')
        .andWhere(
          'EXISTS (SELECT 1 FROM content_publications cp WHERE cp.content_unit_id = u.id AND cp.scheduled_at IS NOT NULL)',
        )
      break
    case 'scripting':
      qb.andWhere('u.script_text IS NOT NULL').andWhere('u.voiceover_text IS NULL')
      break
    case 'voiceover_prep':
      qb.andWhere('u.voiceover_text IS NOT NULL').andWhere('u.video_url IS NULL')
      break
    case 'production':
      qb.andWhere('u.video_url IS NOT NULL')
        .andWhere(
          'NOT EXISTS (SELECT 1 FROM content_publications cp WHERE cp.content_unit_id = u.id AND cp.published_at IS NOT NULL)',
        )
      break
    case 'published':
      qb.andWhere(
        'EXISTS (SELECT 1 FROM content_publications cp WHERE cp.content_unit_id = u.id AND cp.published_at IS NOT NULL)',
      )
      break
    case 'rejected':
      qb.andWhere("(u.status = 'rejected' OR u.review_grade = 'rejected')")
      break
  }
}
```

Insertion point: after the existing `review_grade` filter, before sorting.

**No new endpoint.** Same `/api/content-units` route, just one more optional query param.

---

## Frontend changes

### Files removed (3)

- `frontend/src/pages/ContentEngine.tsx` — DELETE
- `frontend/src/components/content-engine/StageDrawer.tsx` — DELETE
- `frontend/src/components/content-engine/RubricDistribution.tsx` — DELETE

### Files modified (3)

- `frontend/src/pages/ContentBank.tsx` — major refactor
- `frontend/src/App.tsx` — remove `/content-engine` route
- `frontend/src/components/Layout.tsx` — remove `Контент-движок` sidebar item

### API types

`frontend/src/api/contentBank.ts` — extend `UnitsListParams.stage?: StageKey`. Import `StageKey` type from `./contentEngine`.

### ContentBank.tsx layout

Top to bottom:

1. **Header** (existing, augmented)
   - Title «Контент-банк» (existing)
   - Last updated time + Refresh button + pulsing dot (NEW, from ContentEngine)

2. **MetricsRow** (NEW — imported from `components/content-engine/`)
   - 4 cards from dashboard stats

3. **Bottlenecks** (NEW — imported)
   - Conditional warning block

4. **TodayQueue** (NEW — imported)
   - Click on item navigates to edit modal directly (no longer `/content-bank?search=` since we're already on /content-bank). Add `onUnitClick(unit)` callback prop.

5. **PipelineRow** (NEW — imported)
   - 9 stage cards. Click → `setSearchParams({ stage: key, page: '1' })` and clear `status`/`review_grade` URL params (mutual exclusion).

6. **Toolbar** (existing, simplified)
   - Search input (kept)
   - Sort dropdown (kept)
   - Triage / Отказы / Импорт / Экспорт / Управление рубриками / + Новая идея (kept)

7. **Filter chips** (simplified)
   - Type chip-bar (kept)
   - Network chip-bar (kept)
   - Review grade chip-bar (kept)
   - **Status chip-bar — REMOVED**
   - **Rubric chip-bar — REMOVED**

8. **Table** (existing — kept verbatim)

9. **Pagination** (existing)

10. **RecentPublished** (NEW — imported)
    - Compact section at bottom. Click on item opens publication URL (existing behavior).

11. **Edit Modal** (existing — unchanged)

### Behavior changes

#### URL state

New URL param: `?stage=<StageKey>`. When set, the table query includes it. Pipeline highlights the active stage.

Existing params (`status`, `review_grade`, `page`, etc.) co-exist but get cleared when `stage` changes (mutual exclusion semantics — stage IS the status+review filter).

#### Polling

```tsx
// In ContentBank.tsx
useEffect(() => {
  const tick = () => {
    if (document.hidden) return
    if (editingUnit !== null) return  // don't refresh while editing
    refreshDashboard()  // refresh stats only — table refreshes on its own when filters change
  }
  const timer = setInterval(tick, 30000)
  document.addEventListener('visibilitychange', tick)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', tick)
  }
}, [editingUnit, refreshDashboard])
```

Polling refreshes ONLY the dashboard data (`/api/content-engine/stats`). Table data refreshes naturally when filters/sort/page change. No table auto-refresh — avoids interrupting browse-and-click flow.

#### Click on TodayQueue or pipeline drawer

Before merge: `navigate('/content-bank?search=<title>')` (cross-page redirect).
After merge: directly open edit modal — `setEditingUnit(unit)`.

For TodayQueue and RecentPublished, we need to translate `unit_id` from dashboard data → fetch full unit → open modal. Simpler: pass `unit_id` as a prop callback, parent does `unitsApi.getOne(id)` then `setEditingUnit(unit)`.

OR even simpler: keep the URL approach (`?search=<title>`) since it works without a fetch. Trade-off: search-by-title is approximate. Title-search has been working for users navigating from drawer — keep it.

**Decision: keep `navigate('/content-bank?search=<title>')` approach but rewrite to use `setSearchParams` (since we're already on /content-bank, no navigate needed)**. The search field gets populated, table filters to matching units, user clicks the row to open edit modal. Same UX as today, just one less page-load redirect.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `?stage=<key>` filter is slow due to subqueries | Existing DB has 185 units. Filter is one EXISTS subquery (already used for `network` filter). Add index later if needed. |
| Dashboard polling interrupts table view (causes re-render) | Polling refreshes only dashboard state, table renders independently. React's `setData(newDashboard)` doesn't re-render table. |
| Old `/content-engine` URLs broken | SPA fallback to 404 page (not implemented currently → goes to default route). Manual fix later if anyone has bookmarks. |
| Pipeline stage + existing status filter conflict | URL param cleared on stage select (mutual exclusion). Status chip-bar removed, so user can't manually set conflicting filter. |
| Loading state during initial mount looks weird with new sections | Show single page-level spinner until BOTH `/content-engine/stats` AND `/content-units` complete. |

---

## Out of scope

- Indexing for `?stage` filter (DB has 185 rows, no need yet).
- Migration of `/content-engine` URL to redirect (404 fallback is fine).
- Server-Sent Events / WebSocket replacing polling.
- Stage drag-n-drop (move unit between stages by dragging).
- Auto-clear other filters when stage selected (only status and review_grade are mutually exclusive — others stay).

---

## Rollback

1. Frontend: redeploy previous `vercel-deploy` commit (would restore `/content-engine` page and original `/content-bank`).
2. Backend: `git revert` the controller change. The `?stage` query param becomes harmless (ignored).
3. No DB changes to revert.
4. Sidebar item «Контент-движок» comes back via the same revert.

---

## Files changed (summary)

### Backend (1 modification)
- `controllers/content-unit.controller.ts` — add `?stage` filter branch

### Frontend (3 modifications + 3 deletions)
- `pages/ContentBank.tsx` — major refactor (import 5 components, add polling, remove status/rubric chip-bars)
- `App.tsx` — remove `/content-engine` route
- `components/Layout.tsx` — remove `Контент-движок` sidebar item
- `pages/ContentEngine.tsx` — DELETE
- `components/content-engine/StageDrawer.tsx` — DELETE
- `components/content-engine/RubricDistribution.tsx` — DELETE

**Itого:** 4 modifications + 3 deletions. No migrations. No new dependencies.
