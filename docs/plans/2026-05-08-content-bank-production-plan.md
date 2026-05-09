# Content-Bank Production Block — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a production block (script/brief/voiceover + planned ready date) to content-bank, compact the table to one main column with chips + script preview, enlarge the edit modal, and add a new "По дате готовности" sort option.

**Architecture:** Purely additive DB migration (4 nullable columns + 1 partial index). New sort branch in controller (no subquery — column is on `u`). Frontend gets one new chip-style table row, a wider modal with a new "🎬 Производство" section, and a 5th sort option.

**Tech Stack:** PostgreSQL/Supabase, TypeORM, Express, React + TypeScript + Vite + Tailwind, Russian UI.

**Design doc:** `docs/plans/2026-05-08-content-bank-production-design.md`

**Two-remote deploy convention:** push to `origin` (Railway backend) AND `vercel-deploy` (Vercel frontend). Always both.

**Prod migration:** Supabase MCP `apply_migration` (we did the same for `2026-05-08-content-bank-review.sql`). The migration file in `backend/src/migrations/` is the source of truth — apply via MCP after the file is in.

---

## Stage 0: Pre-flight check

### Task 0.1: Confirm clean working tree

**Step 1: Verify git is clean**
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka && git status
```
Expected: `nothing to commit, working tree clean`. If not — stop and ask.

**Step 2: Verify branch is up to date with both remotes**
```bash
git fetch origin && git fetch vercel-deploy
git log -1 origin/main --format=%H
git log -1 vercel-deploy/main --format=%H
git log -1 HEAD --format=%H
```
All three SHAs should match. If not — pull/push to align before starting.

---

## Stage 1: Database migration

### Task 1.1: Write the migration file

**Files:**
- Create: `backend/src/migrations/2026-05-08-content-bank-production.sql`

**Step 1: Create the SQL file**

```sql
-- 2026-05-08 content-bank production block
-- Adds 4 nullable columns and a partial index. Idempotent.

ALTER TABLE content_units
  ADD COLUMN IF NOT EXISTS script_text     text,
  ADD COLUMN IF NOT EXISTS video_brief     text,
  ADD COLUMN IF NOT EXISTS voiceover_text  text,
  ADD COLUMN IF NOT EXISTS ready_at        timestamptz;

-- Partial index — backlog without a planned date is the majority,
-- there's no benefit indexing the NULLs.
CREATE INDEX IF NOT EXISTS idx_content_units_ready_at
  ON content_units (ready_at) WHERE ready_at IS NOT NULL;
```

**Step 2: Eyeball it (no test framework here — visual review)**

Confirm: 4 ADD COLUMN, all `IF NOT EXISTS`, all `nullable`. Index is `IF NOT EXISTS` and partial.

**Step 3: Commit**

```bash
git add backend/src/migrations/2026-05-08-content-bank-production.sql
git commit -m "db(content-bank): add production columns + ready_at partial index

ALTER content_units: + script_text, video_brief, voiceover_text (text),
ready_at (timestamptz). All nullable, all IF NOT EXISTS. Partial index
on ready_at WHERE NOT NULL — backlog without planned dates is majority,
no benefit indexing nulls."
```

### Task 1.2: Apply migration to prod via Supabase MCP

**Step 1: Read the migration file content** (for `apply_migration` payload)

```bash
cat backend/src/migrations/2026-05-08-content-bank-production.sql
```

**Step 2: Call `mcp__293619aa-ebe4-4569-a0d9-481fa3b9aabb__apply_migration`**

Use:
- `name: "content_bank_production"`
- `query`: full SQL from the file

Expected: success response, no rows returned.

**Step 3: Verify columns exist**

Call `mcp__293619aa-ebe4-4569-a0d9-481fa3b9aabb__execute_sql`:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'content_units'
  AND column_name IN ('script_text','video_brief','voiceover_text','ready_at')
ORDER BY column_name;
```

Expected: 4 rows, all `is_nullable = YES`.

**Step 4: Verify index**
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'content_units' AND indexname = 'idx_content_units_ready_at';
```
Expected: 1 row.

---

## Stage 2: Backend entity + sort

### Task 2.1: Add columns to `ContentUnit` entity

**Files:**
- Modify: `backend/src/entities/ContentUnit.ts:84-86` (insert before `@OneToMany`)

**Step 1: Add 4 column declarations after `reviewed_at` (line 76), before `created_by` (line 78)**

After:
```ts
  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null
```

Insert:
```ts

  @Column({ type: 'text', nullable: true })
  script_text: string | null

  @Column({ type: 'text', nullable: true })
  video_brief: string | null

  @Column({ type: 'text', nullable: true })
  voiceover_text: string | null

  @Column({ type: 'timestamptz', nullable: true })
  ready_at: Date | null

```

(Empty lines kept around the block for readability — match existing style of one-line gaps between columns.)

**Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
```
Expected: no output (empty = clean for our scope; the filter strips long-standing unrelated errors).

**Step 3: Commit**

```bash
git add backend/src/entities/ContentUnit.ts
git commit -m "feat(content-bank): production columns on ContentUnit entity

Mirrors the migration: script_text/video_brief/voiceover_text (text)
and ready_at (timestamptz), all nullable. TypeORM upsert/find paths
pick them up automatically — no controller changes required for
create/update/import/export."
```

### Task 2.2: Add `ready_at` sort branch in controller

**Files:**
- Modify: `backend/src/controllers/content-unit.controller.ts` (the sort if/else chain in `getAll`)

**Step 1: Locate the sort chain**

```bash
grep -n "sort === 'scheduled_at'" backend/src/controllers/content-unit.controller.ts
```

**Step 2: Insert a `ready_at` branch BEFORE the `scheduled_at` branch**

Replace:
```ts
      } else if (sort === 'scheduled_at') {
```

With:
```ts
      } else if (sort === 'ready_at') {
        // Plain column sort — no subquery. Backlog without a planned date
        // sinks to the bottom (NULLS LAST).
        qb.orderBy('u.ready_at', 'ASC', 'NULLS LAST')
          .addOrderBy('u.created_at', 'DESC')
      } else if (sort === 'scheduled_at') {
```

**Step 3: Typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
```
Expected: no output.

**Step 4: Commit**

```bash
git add backend/src/controllers/content-unit.controller.ts
git commit -m "feat(content-bank): sort=ready_at — chronological backlog

Plain ORDER BY u.ready_at ASC NULLS LAST + tiebreaker on created_at.
No subquery (column is on u directly), no DISTINCT-pagination concerns.
Backlog without a planned date sinks below scheduled items."
```

---

## Stage 3: Frontend API types

### Task 3.1: Extend `ContentUnit` interface and `sort` union

**Files:**
- Modify: `frontend/src/api/contentBank.ts:42-63` and `:65-75`

**Step 1: Add 4 fields to `ContentUnit` interface**

Find:
```ts
  reviewed_at: string | null
  created_by: string
```

Replace with:
```ts
  reviewed_at: string | null
  script_text: string | null
  video_brief: string | null
  voiceover_text: string | null
  ready_at: string | null
  created_by: string
```

**Step 2: Extend `sort` union in `UnitsListParams`**

Find:
```ts
  sort?: 'created_at' | 'title' | 'status' | 'scheduled_at'
```

Replace with:
```ts
  sort?: 'created_at' | 'title' | 'status' | 'scheduled_at' | 'ready_at'
```

**Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: no output.

**Step 4: Commit**

```bash
git add frontend/src/api/contentBank.ts
git commit -m "feat(content-bank): API types for production block

ContentUnit gains 4 nullable fields (script_text, video_brief,
voiceover_text, ready_at). UnitsListParams.sort accepts 'ready_at'."
```

---

## Stage 4: Frontend chip components

### Task 4.1: Create `<UnitChip>` helper

**Files:**
- Create: `frontend/src/components/content-bank/UnitChip.tsx`

**Step 1: Write the component**

```tsx
import { ContentStatus, ContentType } from '../../api/contentBank'

const STATUS_CHIP_COLOR: Record<ContentStatus, string> = {
  idea: 'bg-subtle text-brand-text-secondary',
  script: 'bg-blue-50 text-blue-700',
  filming: 'bg-amber-50 text-amber-700',
  editing: 'bg-orange-50 text-orange-700',
  ready: 'bg-green-50 text-green-700',
  published: 'bg-purple-50 text-purple-700',
  rejected: 'bg-red-50 text-red-700',
}

type Props =
  | { variant: 'rubric'; children: React.ReactNode }
  | { variant: 'status'; status: ContentStatus; children: React.ReactNode }
  | { variant: 'type'; contentType: ContentType; children: React.ReactNode }
  | { variant: 'complexity'; children: React.ReactNode }

export function UnitChip(props: Props) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap'
  let cls = ''
  switch (props.variant) {
    case 'rubric':
      cls = 'bg-subtle text-brand-text-secondary'
      break
    case 'status':
      cls = STATUS_CHIP_COLOR[props.status]
      break
    case 'type':
      cls = 'bg-subtle text-brand-text-secondary'
      break
    case 'complexity':
      cls = 'bg-amber-50 text-amber-700'
      break
  }
  return <span className={`${base} ${cls}`}>{props.children}</span>
}
```

**Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: no output.

**Step 3: Commit**

```bash
git add frontend/src/components/content-bank/UnitChip.tsx
git commit -m "feat(content-bank): UnitChip — variant-driven chip helper

Single component with 4 variants (rubric, status, type, complexity).
Status uses a per-status colour lookup; others use neutral or amber.
Used in the new compact table row."
```

---

## Stage 5: Frontend table — compact row

### Task 5.1: Restructure `<thead>` and `<tbody>` in ContentBank.tsx

**Files:**
- Modify: `frontend/src/pages/ContentBank.tsx` (lines around 422-510 — the table block)

**Step 1: Locate the table**

```bash
grep -n "<thead\|<tbody\|items.map" frontend/src/pages/ContentBank.tsx
```

**Step 2: Add `UnitChip` import + a tiny date formatter**

At the top with other imports:
```ts
import { UnitChip } from '../components/content-bank/UnitChip'
```

Just before `export default function ContentBank()`:
```ts
function formatReadyDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}
```

**Step 3: Replace `<thead>` block**

Find:
```tsx
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Статус
                  </th>
```

Replace the entire `<thead>` (which currently has Статус / Тип / Заголовок / Сети / actions) with:
```tsx
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">
                    Контент
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Сети
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    {/* действия */}
                  </th>
                </tr>
              </thead>
```

**Step 4: Replace each `<tr>` body**

Inside `{items.map((u) => (...))}`, replace the existing 5-cell row with this 3-cell version. Find:
```tsx
                  <tr
                    key={u.id}
                    onClick={() => setEditingUnit(u)}
                    className="border-b border-brand-border hover:bg-subtle cursor-pointer"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      {STATUS_LABELS[u.status]}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      {CONTENT_TYPE_LABELS[u.content_type]}
                    </td>
                    <td className="py-3 px-4">
                      {u.rubric && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-subtle text-brand-text-secondary mb-1">
                          <span>{u.rubric.emoji}</span>
                          <span>{u.rubric.title}</span>
                        </span>
                      )}
                      <div className="font-medium text-brand-text max-w-[400px] truncate">
                        {u.title}
                      </div>
```

Through to (end of the `<td>` for title — keep the surrounding `<tr>`/last two `<td>`s):
```tsx
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {u.publications.map((p) => (
```

Replace the title `<td>` (and remove the now-redundant Status and Type `<td>`s) with this single content cell:
```tsx
                  <tr
                    key={u.id}
                    onClick={() => setEditingUnit(u)}
                    className="border-b border-brand-border hover:bg-subtle cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {u.rubric && (
                          <UnitChip variant="rubric">
                            {u.rubric.emoji} {u.rubric.title}
                          </UnitChip>
                        )}
                        <UnitChip variant="status" status={u.status}>
                          {STATUS_LABELS[u.status]}
                        </UnitChip>
                        <UnitChip variant="type" contentType={u.content_type}>
                          {CONTENT_TYPE_LABELS[u.content_type]}
                        </UnitChip>
                        {u.complexity != null && COMPLEXITY_LABELS[u.complexity] && (
                          <UnitChip variant="complexity">
                            {COMPLEXITY_LABELS[u.complexity]}
                          </UnitChip>
                        )}
                        {u.ready_at && (
                          <span
                            className={
                              'ml-auto text-xs ' +
                              (sort === 'ready_at'
                                ? 'text-primary-600 font-medium'
                                : 'text-brand-text-secondary')
                            }
                          >
                            ↗ {formatReadyDate(u.ready_at)}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-brand-text leading-snug">
                        {u.title}
                      </div>
                      {u.hook && (
                        <div className="text-sm text-brand-text-secondary mt-0.5 line-clamp-1">
                          → {u.hook}
                        </div>
                      )}
                      {u.script_text && (
                        <div className="text-xs text-brand-text-secondary mt-1.5 line-clamp-3 whitespace-pre-line">
                          {u.script_text}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {u.publications.map((p) => (
```

(The trailing `<td>` for actions stays as-is — no changes there.)

**Step 5: Add Tailwind line-clamp safety**

Tailwind 3.3+ ships `line-clamp-1` / `line-clamp-3` by default. Verify:
```bash
grep -n "line-clamp\|@tailwindcss/line-clamp" frontend/tailwind.config.{js,ts,cjs} 2>/dev/null
grep -n '"tailwindcss"' frontend/package.json
```

If Tailwind < 3.3 — add `@tailwindcss/line-clamp` to deps. Otherwise no-op.

**Step 6: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: no output.

**Step 7: Commit**

```bash
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): compact table row — chips + script preview

5 columns → 3 (Контент / Сети / actions). Title cell stacks chips
(rubric/status/type/complexity), ready_at on the right (highlighted
when sort=ready_at), title bold, hook in muted, script_text 2-3
line-clamped preview underneath.

Cuts horizontal noise, gives long titles + script previews real
estate. Status/type chips colour-coded so the visual scan replaces
the previous dedicated columns."
```

### Task 5.2: Add `ready_at` to the sort dropdown

**Files:**
- Modify: `frontend/src/pages/ContentBank.tsx:285-289` (sort `<select>`)

**Step 1: Add new option after «По статусу»**

Find:
```tsx
            <option value="created_at">Сначала новые</option>
            <option value="title">По алфавиту</option>
            <option value="status">По статусу</option>
            <option value="scheduled_at">По дате публикации</option>
          </select>
```

Replace with:
```tsx
            <option value="created_at">Сначала новые</option>
            <option value="title">По алфавиту</option>
            <option value="status">По статусу</option>
            <option value="ready_at">📅 По дате готовности</option>
            <option value="scheduled_at">🚀 По дате публикации</option>
          </select>
```

**Step 2: Widen the `sort` type cast**

Find:
```ts
  const sort =
    (searchParams.get('sort') as 'created_at' | 'title' | 'status' | 'scheduled_at') ||
    'created_at'
```

Replace with:
```ts
  const sort =
    (searchParams.get('sort') as
      | 'created_at'
      | 'title'
      | 'status'
      | 'ready_at'
      | 'scheduled_at') ||
    'created_at'
```

**Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: no output.

**Step 4: Commit**

```bash
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): sort option «📅 По дате готовности»

Adds ready_at to the dropdown alongside the existing scheduled_at.
Emoji split: 📅 production timeline (backlog by planned readiness),
🚀 publication timeline (per-platform schedule)."
```

---

## Stage 6: Modal — production section + larger size

### Task 6.1: Inspect current modal

**Files:**
- Read: `frontend/src/components/content-bank/UnitEditModal.tsx`

**Step 1: Read it end-to-end**

```bash
wc -l frontend/src/components/content-bank/UnitEditModal.tsx
```

Then `Read` the whole file. Note:
- The current `max-w-*` class on the panel
- Where `formData` state is declared (need to add 4 new keys)
- Where the form sections are rendered (need to insert «🎬 Производство» between meta and publications)

### Task 6.2: Add new fields to FormData state

**Step 1: Find the `FormData` interface (line 24-ish per memory)**

Add:
```ts
  script_text: string
  video_brief: string
  voiceover_text: string
  ready_at: string  // ISO date or empty string
```

**Step 2: Initialize from `unit` (in the `useState` initializer or `useEffect` that syncs `unit` → form)**

For each, default:
```ts
script_text: typeof unit !== 'string' ? unit?.script_text ?? '' : '',
video_brief: typeof unit !== 'string' ? unit?.video_brief ?? '' : '',
voiceover_text: typeof unit !== 'string' ? unit?.voiceover_text ?? '' : '',
ready_at: typeof unit !== 'string' && unit?.ready_at
  ? new Date(unit.ready_at).toISOString().slice(0, 10)  // YYYY-MM-DD for input[type=date]
  : '',
```

(Match the existing pattern used for other optional fields — copy that style verbatim if it differs slightly.)

**Step 3: Include them in the save payload**

Inside the `handleSubmit` (or `save`) function, where the payload is built, add:
```ts
script_text: formData.script_text.trim() || null,
video_brief: formData.video_brief.trim() || null,
voiceover_text: formData.voiceover_text.trim() || null,
ready_at: formData.ready_at ? new Date(formData.ready_at).toISOString() : null,
```

**Step 4: Typecheck after each step is fine; one final check after all three:**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: no output.

**Step 5: Commit**

```bash
git add frontend/src/components/content-bank/UnitEditModal.tsx
git commit -m "feat(content-bank): production fields wired into modal state

FormData gains script_text/video_brief/voiceover_text/ready_at,
populated from unit on open and sent to the API on save (empty
string → null, date → ISO timestamp). UI rendering comes next."
```

### Task 6.3: Enlarge modal panel

**Step 1: Find the modal panel container**

```bash
grep -n "max-w-" frontend/src/components/content-bank/UnitEditModal.tsx | head -5
```

**Step 2: Replace `max-w-2xl` (or whatever is there) with `max-w-5xl`**

If currently:
```tsx
<div className="... max-w-2xl ...">
```

Replace with:
```tsx
<div className="... max-w-5xl ...">
```

**Step 3: Verify mobile remains usable**

The class chain should look something like `w-full max-w-5xl mx-auto rounded-2xl bg-card`. On `< 768px` `w-full` already takes over. No extra changes needed.

**Step 4: Commit**

```bash
git add frontend/src/components/content-bank/UnitEditModal.tsx
git commit -m "ui(content-bank): widen edit modal max-w-2xl → max-w-5xl

Modal now hosts the production block (3 long textareas + date input)
plus existing meta/publications/review/notes sections — 2xl was
cramped. Mobile still renders full-width via the existing w-full class."
```

### Task 6.4: Add «🎬 Производство» section to the modal body

**Files:**
- Modify: `frontend/src/components/content-bank/UnitEditModal.tsx` — body JSX

**Step 1: Locate the right insertion point**

Production section goes **between the meta row (Рубрика/Тип/Статус/Сложность)** and **the Publications section** (`<PublicationsEditor>`).

Confirm location:
```bash
grep -n "PublicationsEditor\|сложность\|Сложность" frontend/src/components/content-bank/UnitEditModal.tsx
```

**Step 2: Insert the «Дата готовности» input into the meta row**

Find the meta row (the flex container with rubric/type/status/complexity selects). Append:
```tsx
        <div className="flex flex-col gap-1">
          <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
            📅 Дата готовности
          </label>
          <input
            type="date"
            value={formData.ready_at}
            onChange={(e) => setFormData({ ...formData, ready_at: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400"
          />
        </div>
```

(Use the same input styling as other meta fields. Match flex/gap classes the row already uses.)

**Step 3: Insert the «🎬 Производство» block before `<PublicationsEditor>`**

```tsx
        <section className="space-y-3 border-t border-brand-border pt-4">
          <h3 className="text-sm font-semibold text-brand-text">🎬 Производство</h3>

          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
              Сценарий
            </label>
            <textarea
              value={formData.script_text}
              onChange={(e) => setFormData({ ...formData, script_text: e.target.value })}
              rows={10}
              placeholder="Полный текст сценария — проговаривается при съёмке."
              className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y font-mono text-sm whitespace-pre-line"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
                ТЗ для видео
              </label>
              <textarea
                value={formData.video_brief}
                onChange={(e) => setFormData({ ...formData, video_brief: e.target.value })}
                rows={5}
                placeholder="Что снимаем, ракурсы, реквизит, локация…"
                className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
                Озвучка
              </label>
              <textarea
                value={formData.voiceover_text}
                onChange={(e) => setFormData({ ...formData, voiceover_text: e.target.value })}
                rows={5}
                placeholder="Текст голоса за кадром."
                className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y text-sm"
              />
            </div>
          </div>
        </section>
```

**Step 4: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: no output.

**Step 5: Commit**

```bash
git add frontend/src/components/content-bank/UnitEditModal.tsx
git commit -m "feat(content-bank): «🎬 Производство» section in edit modal

New section between meta and publications:
- Сценарий (script_text) — large mono textarea, 10 rows
- ТЗ для видео + Озвучка — two-column on desktop, stack on mobile
- Дата готовности input added inline with the meta row

Existing visual/video_url/essence stay in their current places —
this commit only adds the new fields. Layout reflows naturally on
narrow screens via grid-cols-1 md:grid-cols-2."
```

---

## Stage 7: Push + smoke test

### Task 7.1: Push to both remotes

**Step 1: Verify all tasks committed**

```bash
git status
git log --oneline -15
```
Expected: working tree clean, top commits cover stages 1-6.

**Step 2: Push**

```bash
git push origin main
git push vercel-deploy main
```

**Step 3: Confirm prod deploys**

- Backend (Railway): no MCP — user can verify in Railway dashboard. Bot just needs the migration applied (Stage 1.2) and the new sort branch (Stage 2.2).
- Frontend (Vercel): poll `mcp__ee9ee30f-e259-40ba-bd4d-95c5fdb81a94__get_deployment` for the latest deployment of project `prj_GFg64z7zI1Jyx5JKPop0LIiyWKQA` (team `team_diBA8eqDEclsSiMKDHPSK0Yr`). Wait for `state: "READY"`.

### Task 7.2: Smoke checklist (manual, user-driven)

Open `https://erp.ximi4ka.ru/content-bank` and verify:

1. **Table layout**
   - 3 columns: Контент / Сети / actions
   - Old юниты show title + hook (no script preview), no errors
   - Status/type chips coloured per the lookup table

2. **Open existing unit**
   - Modal is wider (≈ 5xl)
   - «🎬 Производство» section visible between meta and publications
   - Script/Brief/Voiceover/Ready date fields present

3. **Save with new fields**
   - Enter script text, brief, voiceover, set ready_at
   - Save → toast "Сохранено"
   - Modal closes, row immediately shows ↗ {date} chip + 2-3 line script preview

4. **Sort by ready_at**
   - Change dropdown to «📅 По дате готовности»
   - Items with ready_at sort ascending; items without sink below
   - ↗ {date} chip is purple-bold for items being sorted by

5. **Sort by scheduled_at still works** (regression check)

6. **Import old JSON** (no new fields) — units appear with NULL ready_at, render fine

7. **Export** — `cat` or open the downloaded file, confirm new fields are present per unit (round-trip works)

If any step fails, surface via Systematic-Debugging skill.

---

## Out of scope / future work

- Auto-fill `ready_at` from `status='ready'` transition.
- "Дата факта готовности" separate from planned.
- Integration with Drive/YT links (today: text field).
- WYSIWYG / formatting toolbar in `script_text` (mentioned in `MEMORY.md` feedback_editor_ux — not in this scope).
- Per-network sort highlight on `scheduled_at` (similar to `ready_at` chip highlight) — small nice-to-have.

---

## Rollback

If anything goes sideways post-deploy:

1. **Revert frontend:** redeploy previous `vercel-deploy` commit via Vercel dashboard.
2. **Revert backend:** `git revert <range>` on `origin`, push.
3. **Revert migration (only if necessary):** the columns are nullable and unused, so dropping is safe but optional. Drop SQL:
   ```sql
   DROP INDEX IF EXISTS idx_content_units_ready_at;
   ALTER TABLE content_units
     DROP COLUMN IF EXISTS script_text,
     DROP COLUMN IF EXISTS video_brief,
     DROP COLUMN IF EXISTS voiceover_text,
     DROP COLUMN IF EXISTS ready_at;
   ```
   Apply via Supabase MCP `apply_migration` with name `content_bank_production_rollback`.
