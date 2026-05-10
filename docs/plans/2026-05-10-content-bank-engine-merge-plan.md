# Content-Bank + Content-Engine Merge — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Merge `/content-engine` into `/content-bank`. Pipeline (9 stages) becomes the primary filter; status/rubric chip-bars disappear. Old `/content-engine` page + sidebar item + 2 unused components are deleted.

**Architecture:** Backend gets a new `?stage=<key>` query param on `/api/content-units` mirroring Edge Function bucket heuristics. Frontend reuses 5 existing `components/content-engine/` components inside ContentBank.tsx (MetricsRow, PipelineRow, Bottlenecks, TodayQueue, RecentPublished); polls dashboard every 30s with pause-on-modal-open; deletes 3 unused files (page + 2 components).

**Tech Stack:** Express + TypeORM. React + TypeScript + Tailwind. No new dependencies, no DB migrations.

**Design doc:** `docs/plans/2026-05-10-content-bank-engine-merge-design.md`

**Two-remote deploy:** push to `origin` AND `vercel-deploy`.

---

## Stage 0: Pre-flight

### Task 0.1: Verify clean tree + remotes aligned

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka
git fetch origin --quiet && git fetch vercel-deploy --quiet
git status -s | grep -v "^??" | grep -v "launch.json\|^ M CLAUDE"
git log -1 --format=%H
git log -1 origin/main --format=%H
git log -1 vercel-deploy/main --format=%H
```
Expected: three SHAs match, no project-related modifications.

---

## Stage 1: Backend — `?stage` filter

### Task 1.1: Add stage filter branch to `getAll`

**Files:**
- Modify: `backend/src/controllers/content-unit.controller.ts`

**Step 1: Locate insertion point**

```bash
grep -n "review_grade\|sort === 'title'" backend/src/controllers/content-unit.controller.ts
```

The new filter goes AFTER the existing `review_grade` filter and BEFORE the search filter. Read the section first to confirm shape.

**Step 2: Add `stage` to destructured query**

Find:
```ts
      const {
        status,
        rubric_id,
        content_type,
        network,
        review_grade,
        search,
        sort = 'created_at',
      } = req.query as Record<string, string | undefined>
```

Replace with:
```ts
      const {
        status,
        rubric_id,
        content_type,
        network,
        review_grade,
        stage,
        search,
        sort = 'created_at',
      } = req.query as Record<string, string | undefined>
```

**Step 3: Add stage filter branch**

Find the closing brace of the `review_grade` filter block (just before `if (search) {`). Insert the new branch immediately after:

```ts
      // Filter by stage (mirrors Edge Function bucket heuristics from content-engine-stats)
      // Each stage maps to a unique combination of status / review_grade / has_script /
      // has_voiceover / has_video / publication state.
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
            qb.andWhere('u.script_text IS NULL').andWhere(
              'EXISTS (SELECT 1 FROM content_publications cp_stage WHERE cp_stage.content_unit_id = u.id AND cp_stage.scheduled_at IS NOT NULL)',
            )
            break
          case 'scripting':
            qb.andWhere('u.script_text IS NOT NULL').andWhere('u.voiceover_text IS NULL')
            break
          case 'voiceover_prep':
            qb.andWhere('u.voiceover_text IS NOT NULL').andWhere('u.video_url IS NULL')
            break
          case 'production':
            qb.andWhere('u.video_url IS NOT NULL').andWhere(
              'NOT EXISTS (SELECT 1 FROM content_publications cp_stage WHERE cp_stage.content_unit_id = u.id AND cp_stage.published_at IS NOT NULL)',
            )
            break
          case 'published':
            qb.andWhere(
              'EXISTS (SELECT 1 FROM content_publications cp_stage WHERE cp_stage.content_unit_id = u.id AND cp_stage.published_at IS NOT NULL)',
            )
            break
          case 'rejected':
            qb.andWhere("(u.status = 'rejected' OR u.review_grade = 'rejected')")
            break
        }
      }
```

Note the `cp_stage` alias — different from the existing `cp` alias used for `network` filter and from `cp_sort` used in `scheduled_at` sort. Three separate aliases ensure no conflict.

**Step 4: Typecheck**
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
```
Expected: empty.

**Step 5: Commit**

```bash
git add backend/src/controllers/content-unit.controller.ts
git commit -m "feat(content-bank): GET /content-units?stage=<key> filter

Mirrors Edge Function bucket heuristics from content-engine-stats —
9 stages (ideas / triage_needs_work / excellent / planning / scripting /
voiceover_prep / production / published / rejected) each map to a unique
combination of status / review_grade / has_script / has_voiceover /
has_video / publication state.

Used by the upcoming /content-bank + /content-engine merger where the
pipeline is the primary filter replacing the status chip-bar.

Subquery aliases distinct from existing 'cp' (network filter) and
'cp_sort' (scheduled_at sort) — no conflict on combined queries."
```

---

## Stage 2: Frontend API types

### Task 2.1: Add `stage` to `UnitsListParams`

**Files:**
- Modify: `frontend/src/api/contentBank.ts`

**Step 1: Find the interface**

```bash
grep -n "UnitsListParams\|sort?:\|stage" frontend/src/api/contentBank.ts
```

**Step 2: Add `stage` field**

Find:
```ts
export interface UnitsListParams {
  status?: string         // CSV
  rubric_id?: string      // CSV
  content_type?: string   // CSV
  network?: string        // CSV
  review_grade?: string   // CSV: 'excellent,needs_work' or special 'null'
  search?: string
  sort?: 'created_at' | 'title' | 'status' | 'scheduled_at' | 'ready_at'
  page?: number
  limit?: number
}
```

Replace with:
```ts
import type { StageKey } from './contentEngine'

export interface UnitsListParams {
  status?: string         // CSV
  rubric_id?: string      // CSV
  content_type?: string   // CSV
  network?: string        // CSV
  review_grade?: string   // CSV: 'excellent,needs_work' or special 'null'
  stage?: StageKey
  search?: string
  sort?: 'created_at' | 'title' | 'status' | 'scheduled_at' | 'ready_at'
  page?: number
  limit?: number
}
```

The `import type` is intentional — `StageKey` is a type-only export from `contentEngine.ts`. Place the import near the top of the file with the existing imports.

**Step 3: Typecheck**
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: empty.

**Step 4: Commit**

```bash
git add frontend/src/api/contentBank.ts
git commit -m "feat(content-bank): UnitsListParams accepts stage?: StageKey

Single optional query param mapping to the backend's new ?stage filter.
StageKey re-exported via 'import type' from contentEngine.ts (single
source of truth — same union used in dashboard pipeline)."
```

---

## Stage 3: ContentBank refactor (major)

This stage merges dashboard sections into ContentBank.tsx. The page becomes a unified ops dashboard + table.

### Task 3.1: Inspect current state

```bash
wc -l /Users/vasilijaistov/Desktop/continuum/ximi4ka/frontend/src/pages/ContentBank.tsx
grep -n "FilterChipBar\|statusFilter\|rubricFilter" /Users/vasilijaistov/Desktop/continuum/ximi4ka/frontend/src/pages/ContentBank.tsx | head -20
```

Read the file end-to-end first so the subagent has full context. Note:
- Where existing state (filters, items, pagination) is declared
- Where existing chip-bars are rendered (look for `<FilterChipBar` usage)
- Where the table renders
- Where `editingUnit` modal mounts

### Task 3.2: Add dashboard state + fetch

**File:** `frontend/src/pages/ContentBank.tsx` (MODIFY)

**Step 1: Imports**

Add to existing imports:

```ts
import { RefreshCw } from 'lucide-react'
import { contentEngineApi, DashboardData, StageKey } from '../api/contentEngine'
import { MetricsRow } from '../components/content-engine/MetricsRow'
import { PipelineRow } from '../components/content-engine/PipelineRow'
import { Bottlenecks } from '../components/content-engine/Bottlenecks'
import { TodayQueue } from '../components/content-engine/TodayQueue'
import { RecentPublished } from '../components/content-engine/RecentPublished'
```

**Step 2: Add dashboard state**

Near other `useState` calls (after `editingUnit`):

```ts
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashboardFetching, setDashboardFetching] = useState(false)
```

**Step 3: Add refresh function and read `stage` from URL**

Near other URL-derived state (after the existing `sort` line):

```ts
  const stage = (searchParams.get('stage') as StageKey | null) || null
```

Add a `refreshDashboard` useCallback near other `useCallback`s:

```ts
  const refreshDashboard = useCallback(async () => {
    setDashboardFetching(true)
    try {
      const r = await contentEngineApi.stats()
      setDashboard(r)
    } catch {
      // Silent failure — keep previous data, never disrupt the table
    } finally {
      setDashboardFetching(false)
    }
  }, [])
```

**Step 4: Initial dashboard load + polling**

Add a new useEffect:

```ts
  // Dashboard data — initial load + 30s polling, paused while modal is open or tab hidden
  useEffect(() => {
    refreshDashboard()
    const tick = () => {
      if (document.hidden) return
      if (editingUnit !== null) return
      refreshDashboard()
    }
    const timer = setInterval(tick, 30000)
    const onVisibility = () => {
      if (!document.hidden && editingUnit === null) refreshDashboard()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [editingUnit, refreshDashboard])
```

**Step 5: Include `stage` in the `unitsApi.list` params**

Find the `load` callback (where `params` is built). Add:

```ts
      if (stage) params.stage = stage
```

Put this near the other `if (xFilter)` lines.

**Step 6: Update `load` callback's dependency note**

The `load` callback's dep array should already reference `searchParams`. No changes needed since `stage` is derived from `searchParams`.

**Step 7: Typecheck**
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: empty.

**Step 8: Commit**

```bash
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): wire dashboard data + 30s polling + stage filter

- New state: dashboard (DashboardData|null), dashboardFetching
- refreshDashboard fetches /api/content-engine/stats
- 30s polling pauses when editingUnit !== null or document.hidden
- visibilitychange listener refreshes on tab focus return (if no modal)
- stage URL param passed through to unitsApi.list as ?stage=<key>

Render still uses the old chip-bar UI — that gets replaced in the next
commits. This commit alone leaves the page functionally identical from
the user's POV (extra fetches happen, but nothing visually changes)."
```

### Task 3.3: Render dashboard sections + pipeline above the toolbar

**Step 1: Add header section with refresh button**

Find the existing `<h1>` (or main page header). Wrap it with a flex container that includes the refresh button:

Find the existing header div (something like a div with the title). Replace its outer container so the right side has the refresh widget:

```tsx
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Контент-банк</h1>
          {/* existing subtitle paragraph if any — keep as-is */}
        </div>
        {dashboard && (
          <div className="flex items-center gap-2 text-xs text-brand-text-secondary">
            <span
              className={
                'inline-block w-2 h-2 rounded-full ' +
                (dashboardFetching ? 'bg-primary-500 animate-pulse' : 'bg-green-500')
              }
              aria-label={dashboardFetching ? 'Обновляется' : 'Актуально'}
            />
            <span>Обновлено: {new Date(dashboard.generated_at).toLocaleTimeString('ru-RU')}</span>
            <button
              onClick={refreshDashboard}
              disabled={dashboardFetching}
              className="ml-2 flex items-center gap-1 px-2 py-1 rounded-lg border border-brand-border hover:bg-subtle disabled:opacity-50"
            >
              <RefreshCw size={12} className={dashboardFetching ? 'animate-spin' : ''} /> Обновить
            </button>
          </div>
        )}
      </div>
```

If there's no exact match for the title — find whatever renders «Контент-банк» and integrate around it. Preserve any existing buttons (the New / Import / Triage row may already be next to the title — keep them).

**Step 2: Add MetricsRow, Bottlenecks, TodayQueue blocks**

IMMEDIATELY AFTER the header and BEFORE the existing toolbar/filter section, add:

```tsx
      {dashboard && (
        <>
          <MetricsRow stats={dashboard.stats} />
          <Bottlenecks counts={dashboard.stats.counts} />
          <TodayQueue queue={dashboard.today_queue} />
        </>
      )}
```

These render as separate stacked blocks within whatever `space-y-*` container the page uses. If the page doesn't already have vertical spacing — wrap them in `<div className="space-y-4 mb-4">…</div>`.

**Step 3: Add PipelineRow as a clickable filter**

IMMEDIATELY AFTER the dashboard blocks and BEFORE the existing toolbar, add:

```tsx
      {dashboard && (
        <div className="mb-4">
          <PipelineRow
            counts={dashboard.stats.counts}
            openStage={stage}
            onStageClick={(s) => {
              setSearchParams((prev) => {
                const sp = new URLSearchParams(prev)
                if (stage === s) {
                  // toggle off — same stage clicked, deselect
                  sp.delete('stage')
                } else {
                  sp.set('stage', s)
                  // mutual exclusion: stage replaces status + review_grade filters
                  sp.delete('status')
                  sp.delete('review_grade')
                }
                sp.delete('page')
                return sp
              })
            }}
          />
        </div>
      )}
```

**Step 4: Add RecentPublished at the bottom**

IMMEDIATELY AFTER the pagination (after the table) and BEFORE the `editingUnit` modal, add:

```tsx
      {dashboard && dashboard.recent_published.length > 0 && (
        <div className="mt-6">
          <RecentPublished items={dashboard.recent_published} />
        </div>
      )}
```

**Step 5: Typecheck**

Same command, expected empty.

**Step 6: Commit**

```bash
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): render dashboard sections + pipeline above toolbar

Adds 5 new sections from the dashboard view:
- Header gets a 'Last updated' indicator + Refresh button + pulsing dot
- MetricsRow (4 cards) above filters
- Bottlenecks (conditional warnings)
- TodayQueue (today's scheduled publications)
- PipelineRow — 9 stages, click to filter table by stage
- RecentPublished at bottom (conditional)

Pipeline click toggles ?stage URL param. Mutual exclusion with
status/review_grade — those URL params are cleared when stage is set.
Page reset to 1.

Both stage and existing chip-bar filters work side-by-side this commit;
chip-bar removal lands in the next commit."
```

### Task 3.4: Remove status filter chip-bar

**Step 1: Find the status filter usage**

```bash
grep -n "FilterChipBar\|statusFilter\|setStatusFilter" frontend/src/pages/ContentBank.tsx
```

There should be a `<FilterChipBar>` instance for status with `label="Статус"` or similar. Note its line range.

**Step 2: Remove it**

Delete the entire `<FilterChipBar … status …/>` JSX block. Keep the FilterChipBar component import in case other chip-bars (type/network/review) are still using it.

If a wrapper div around chip-bars becomes empty after removal — remove the wrapper too. Don't leave stranded `space-y-*` containers.

**Step 3: Remove status URL handling if dead**

Check if `statusFilter` is still referenced elsewhere in `ContentBank.tsx`:

```bash
grep -n "statusFilter" frontend/src/pages/ContentBank.tsx
```

It's likely also used in:
- `const statusFilter = ...` (URL state derivation) → KEEP, because the load callback still uses it (and it's still a valid orthogonal filter through URL)
- `<FilterChipBar>` for status → DELETED above

So the `const statusFilter = ...` line stays. The status URL param still works programmatically. The UI just doesn't expose it anymore (pipeline does that job).

**Step 4: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): remove status filter chip-bar (replaced by pipeline)

The pipeline row above the toolbar now handles status-like filtering
through stage selection (which composes status + review_grade +
production state). The standalone status chip-bar is redundant.

The status URL parameter (?status=…) still works for backward
compatibility — it's just no longer surfaced in the UI. Old bookmarks
keep working."
```

### Task 3.5: Remove rubric filter chip-bar

**Step 1: Find rubric filter usage**

```bash
grep -n "Рубрика\|rubricFilter\|setRubricFilter" frontend/src/pages/ContentBank.tsx
```

Same approach as Task 3.4 — find the `<FilterChipBar>` for rubric, delete it.

**Step 2: Decide whether to keep `rubricFilter` URL state**

If `rubricFilter` is still used in the `load` callback (passed as `rubric_id` to the API), keep the URL derivation but remove the UI. Same backward-compat reasoning.

If it's ONLY used by the chip-bar (no API plumbing), remove the URL state too.

**Step 3: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): remove rubric filter chip-bar (per user request)

Per user feedback: rubric chip-bar takes a large horizontal row and
isn't useful enough to justify the space. Rubric info is still visible:
- As inline chips on each table row (rubric emoji + title)
- Editable via 'Управление рубриками' modal (CRUD)
- Searchable by title via the main search input

The ?rubric_id URL param still works for backward compatibility."
```

---

## Stage 4: Cleanup — remove `/content-engine` page + sidebar + dead components

### Task 4.1: Remove `/content-engine` route

**File:** `frontend/src/App.tsx`

**Step 1: Find and remove the route**

```bash
grep -n "ContentEngine\|/content-engine" frontend/src/App.tsx
```

Delete:
- The `import ContentEngine from './pages/ContentEngine'` line
- The `<Route path="/content-engine" element={<ContentEngine />} />` line

**Step 2: Typecheck**
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: empty.

**Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "chore(content-engine): remove /content-engine route

Functionality merged into /content-bank in previous commits."
```

### Task 4.2: Remove sidebar entry

**File:** `frontend/src/components/Layout.tsx`

**Step 1: Find the entry**

```bash
grep -n "Контент-движок\|IconChart\|content-engine" frontend/src/components/Layout.tsx
```

**Step 2: Remove the nav item AND the `IconChart` component**

Delete:
- The line `{ label: 'Контент-движок', path: '/content-engine', icon: IconChart }` from the nav array
- The `IconChart` component definition (it's no longer used elsewhere)

**Step 3: Typecheck**
Same command, expected empty.

**Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "chore(content-engine): remove «Контент-движок» sidebar item + IconChart

Sidebar simplified — content lives under «Контент-банк» which now
includes the merged dashboard. IconChart SVG removed (was only used
by this nav item)."
```

### Task 4.3: Delete dead component files

**Files to delete:**
- `frontend/src/pages/ContentEngine.tsx`
- `frontend/src/components/content-engine/StageDrawer.tsx`
- `frontend/src/components/content-engine/RubricDistribution.tsx`

**Step 1: Verify no references**

```bash
grep -rn "ContentEngine\|StageDrawer\|RubricDistribution" frontend/src/ --include="*.tsx" --include="*.ts"
```

Expected: NO matches (the imports were removed in previous steps).

If anything still references them — STOP and ask. Don't delete files that are still imported.

**Step 2: Delete files**

```bash
rm frontend/src/pages/ContentEngine.tsx
rm frontend/src/components/content-engine/StageDrawer.tsx
rm frontend/src/components/content-engine/RubricDistribution.tsx
```

**Step 3: Typecheck**

Same command, expected empty.

**Step 4: Commit**

```bash
git add frontend/src/pages/ContentEngine.tsx frontend/src/components/content-engine/StageDrawer.tsx frontend/src/components/content-engine/RubricDistribution.tsx
git commit -m "chore(content-engine): delete merged-in page + 2 unused components

ContentEngine.tsx — page logic moved into ContentBank.tsx.
StageDrawer.tsx — replaced by filtered table view.
RubricDistribution.tsx — chart removed (rubric data shown inline in
table rows; backlog distribution no longer surfaced separately).

Components still used by ContentBank: MetricsRow, PipelineRow,
Bottlenecks, TodayQueue, RecentPublished. They keep their /content-engine
directory for now (rename / move could come in a separate refactor)."
```

---

## Stage 5: Push + smoke

### Task 5.1: Verify all commits

```bash
git status -s | grep -v "^??" | grep -v "launch.json\|^ M CLAUDE"
git log --oneline -10
```

Working tree clean. Top commits cover Stages 1-4.

### Task 5.2: Push to both remotes

```bash
git push origin main
git push vercel-deploy main
```

### Task 5.3: Confirm deploys

- **Backend (Railway):** dashboard → confirm latest deploy. No new env vars needed (existing `DASHBOARD_TOKEN` + `ANTHROPIC_API_KEY` are reused).
- **Frontend (Vercel):** poll `mcp__ee9ee30f-…__list_deployments` for project `prj_GFg64z7zI1Jyx5JKPop0LIiyWKQA`, wait for `state: "READY"`.

### Task 5.4: Smoke checklist

Open `https://erp.ximi4ka.ru/content-bank`:

1. **Sidebar:** «Контент-движок» entry GONE. Only «Контент-банк» remains (under planning group).
2. **Top:** title «Контент-банк» + Last-updated indicator + Refresh button on the right.
3. **MetricsRow:** 4 cards visible with current numbers (total_units, total_publications, published_total, scheduled_total).
4. **Bottlenecks:** amber warning block if any of (excellent>100, voiceover_prep>0, scripting>10). Hidden when no warnings.
5. **TodayQueue:** today's publications list with time, network, title, has_video indicator. Click → search field gets the title, table filters.
6. **PipelineRow:** 9 cards, each with emoji + label + count. Click one → URL gets `?stage=<key>`, card gets `ring-2 ring-primary-300` highlight, table updates with that stage's units.
7. **Click same stage again:** URL drops `?stage`, ring disappears, table reverts to unfiltered.
8. **Status chip-bar:** GONE. (The «Статус» label and row of chips no longer appears.)
9. **Rubric chip-bar:** GONE.
10. **Type/Network/Review chip-bars:** still present. Click on a chip filters the table independently of stage.
11. **Table:** clicking a row opens the existing edit modal. Pipeline highlight stays during modal interaction.
12. **Open modal → wait 30s → close:** when modal was open, dashboard did NOT refresh (polling paused). After close, on next 30s tick, dashboard refreshes (pulsing dot fires).
13. **Tab switch:** open another tab for 1 min → return → dashboard refreshes immediately (visibilitychange listener fires).
14. **RecentPublished:** small section at bottom showing last 5 publications. External link icon opens published URL.
15. **Old `/content-engine` URL:** typing it in the address bar → 404 / fallback (no longer rendered).
16. **Old `/content-engine` bookmarks (if any):** users have to update — there's no redirect (out of scope).
17. **API regression:** `GET /api/content-units?stage=ideas` returns only units with `status='idea' AND review_grade IS NULL`. Spot-check via DevTools Network tab.

If any step fails — Systematic-Debugging skill. Likely culprits:
- Cache TTL mismatch (10s on `/api/content-engine/stats`, 30s polling — first refresh after change is delayed up to 10s)
- Backend stage filter SQL — verify in Railway logs
- Sidebar nav item not removed (cache?) — hard refresh

---

## Out of scope / future work

- Redirect `/content-engine` → `/content-bank` (out of scope; SPA fallback fine for now).
- Drag-n-drop pipeline stages to bulk-update unit status.
- Pipeline stage indices in SQL (`(status, review_grade)` composite index) — 185 rows, no perf issue yet.
- Move `components/content-engine/` → `components/content-bank/dashboard/` (cosmetic; defer).
- Re-add `RubricDistribution` somewhere if strategic insight is needed (e.g., on a separate Analytics page).

---

## Rollback

1. **Frontend:** redeploy previous `vercel-deploy` commit (would restore `/content-engine` page, old `/content-bank` with chip-bars).
2. **Backend:** `git revert` the controller change. The `?stage` query param becomes harmless (ignored — falls through `if (stage)` since it never matches a case).
3. **No DB migrations to revert.**
4. **Env vars stay** (DASHBOARD_TOKEN, ANTHROPIC_API_KEY remain valid and useful).
