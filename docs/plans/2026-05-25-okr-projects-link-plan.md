# OKR → Projects/Tasks Link Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Привязка `Project` и `Task` к OKR-KR'ам через soft-reference. Бейдж счётчика на OKR-странице + переход в Planning с фильтром.

**Architecture:** Новые колонки `projects.okr_kr_id` + `tasks.okr_kr_id` (varchar(64), nullable, partial-indexed). Новый агрегатный эндпоинт `GET /api/okr-links/counts`. Frontend: переиспользуемый `OkrKrSelector` с hierarchical native `<select>`, интеграция в существующие inline-формы Projects + TaskModal, URL-фильтр `?okr_kr=` на странице Projects, бейдж `📁 N · ✓ M` на каждом KR в OkrPage.

**Tech Stack:** TypeORM миграция SQL, существующие entities/controllers расширяются, frontend — React + TS + Tailwind. Никаких новых deps.

**Design reference:** `docs/plans/2026-05-25-okr-projects-link-design.md`

**Testing note:** Проект без test runner. Каждая задача завершается typecheck + smoke. Финал — smoke на проде.

---

## Task 1: Миграция БД

**Files:**
- Create: `backend/src/migrations/2026-05-25-okr-kr-link.sql`

**Step 1: Создать миграцию**

`backend/src/migrations/2026-05-25-okr-kr-link.sql`:

```sql
-- OKR → Projects/Tasks soft-reference link.
--
-- okr_kr_id — composite KR id from frontend OKR parser ("Q2-2026-O1-KR1").
-- KR is a markdown structure in brand_docs.okr_2026_2027, NOT a DB entity,
-- so this is a soft-reference (not FK). Dangling refs are accepted as MVP
-- trade-off (see design doc §«Soft-reference trade-offs»).
--
-- Partial indexes — most projects/tasks won't be linked. Index stays small
-- (~10-100 rows vs thousands) and fast for GROUP BY aggregation in the
-- counts endpoint.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS okr_kr_id varchar(64);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS okr_kr_id varchar(64);

CREATE INDEX IF NOT EXISTS idx_projects_okr_kr_id
  ON projects (okr_kr_id) WHERE okr_kr_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_okr_kr_id
  ON tasks (okr_kr_id) WHERE okr_kr_id IS NOT NULL;
```

**Step 2: Применить через Supabase MCP**

`apply_migration` на project `jubkezbvccwvujregkfq`, name: `2026_05_25_okr_kr_link`.

**Step 3: Verify**

`execute_sql`:
```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('projects', 'tasks') AND column_name = 'okr_kr_id'
ORDER BY table_name;

SELECT indexname FROM pg_indexes
WHERE indexname IN ('idx_projects_okr_kr_id', 'idx_tasks_okr_kr_id');
```

Expected: 2 columns (`projects.okr_kr_id varchar nullable`, `tasks.okr_kr_id varchar nullable`) + 2 indexes.

**Step 4: Commit**

```bash
git add backend/src/migrations/2026-05-25-okr-kr-link.sql
git commit -m "feat(okr-links): migration — projects/tasks okr_kr_id columns + partial indexes"
```

---

## Task 2: Backend — entities + counts endpoint

**Files:**
- Modify: `backend/src/entities/Project.ts` (add column)
- Modify: `backend/src/entities/Task.ts` (add column)
- Create: `backend/src/controllers/okr-links.controller.ts`
- Create: `backend/src/routes/okr-links.routes.ts`
- Modify: `backend/src/server.ts` (mount route)

**Step 1: Расширить Project entity**

В `backend/src/entities/Project.ts`, после поля `color_tag` (около строки 53), добавить:

```typescript
  @Column({ type: 'varchar', length: 64, nullable: true, comment: 'Привязка к OKR KR (composite id из парсера)' })
  okr_kr_id: string | null
```

**Step 2: Расширить Task entity**

В `backend/src/entities/Task.ts`, после последней колонки до `@CreateDateColumn` / `@UpdateDateColumn`, добавить:

```typescript
  @Column({ type: 'varchar', length: 64, nullable: true, comment: 'Привязка к OKR KR (composite id из парсера)' })
  okr_kr_id: string | null
```

(Сначала прочитай файл чтобы найти точное место — последняя `@Column` перед date-колонками.)

**Step 3: Counts controller**

`backend/src/controllers/okr-links.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'

export const okrLinksController = {
  /**
   * Aggregate counts of linked projects and tasks per KR.
   * Returns: Record<krId, { projects: number; tasks: number }>
   *
   * Used by /marketing/okr page to render «📁 N · ✓ M» badges next to each KR.
   * Cheap query — partial indexes idx_*_okr_kr_id make GROUP BY fast even with
   * thousands of rows total.
   */
  async counts(_req: Request, res: Response) {
    try {
      const projectRows = await AppDataSource.query<Array<{ okr_kr_id: string; n: string }>>(
        `SELECT okr_kr_id, COUNT(*)::text AS n
         FROM projects
         WHERE okr_kr_id IS NOT NULL
         GROUP BY okr_kr_id`,
      )
      const taskRows = await AppDataSource.query<Array<{ okr_kr_id: string; n: string }>>(
        `SELECT okr_kr_id, COUNT(*)::text AS n
         FROM tasks
         WHERE okr_kr_id IS NOT NULL
         GROUP BY okr_kr_id`,
      )

      const result: Record<string, { projects: number; tasks: number }> = {}
      for (const row of projectRows) {
        result[row.okr_kr_id] = { projects: Number(row.n), tasks: 0 }
      }
      for (const row of taskRows) {
        if (!result[row.okr_kr_id]) {
          result[row.okr_kr_id] = { projects: 0, tasks: Number(row.n) }
        } else {
          result[row.okr_kr_id].tasks = Number(row.n)
        }
      }
      res.json(result)
    } catch (e: any) {
      console.error('[okr-links.counts]', e?.message || e)
      res.status(500).json({ error: 'Ошибка загрузки счётчиков OKR-связок' })
    }
  },
}
```

**Step 4: Routes**

`backend/src/routes/okr-links.routes.ts`:

```typescript
import { Router } from 'express'
import { okrLinksController } from '../controllers/okr-links.controller'

const router = Router()

router.get('/counts', okrLinksController.counts)

export default router
```

**Step 5: Mount в server.ts**

В `backend/src/server.ts`, после `app.use('/api/content-metric-snapshots', ...)` (около строки 155), добавить:

```typescript
import okrLinksRoutes from './routes/okr-links.routes'
// ...
app.use('/api/okr-links', authMiddleware, okrLinksRoutes)
```

(Import — в верхней секции server.ts, рядом с другими `import *Routes from`.)

**Step 6: Typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "js-yaml"
```
Expected: пусто.

**Step 7: Commit**

```bash
git add backend/src/entities/Project.ts backend/src/entities/Task.ts backend/src/controllers/okr-links.controller.ts backend/src/routes/okr-links.routes.ts backend/src/server.ts
git commit -m "feat(okr-links): backend — entities + GET /api/okr-links/counts"
```

---

## Task 3: OkrKrSelector reusable компонент

**Files:**
- Create: `frontend/src/components/okr/OkrKrSelector.tsx`

**Step 1: Implement**

`frontend/src/components/okr/OkrKrSelector.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { brandDocsApi } from '../../api/brandDocs'
import { parseOkr, ParsedOkr } from '../../lib/okr-parser'

const OKR_SLUG = 'okr_2026_2027'

// Module-level cache — parse once per app session, share across instances.
let okrCache: Promise<ParsedOkr> | null = null

function loadOkr(): Promise<ParsedOkr> {
  if (okrCache) return okrCache
  okrCache = brandDocsApi.get(OKR_SLUG).then((doc) => {
    if (!doc || !doc.content) {
      return { quarters: [], currentQuarterId: null }
    }
    return parseOkr(doc.content)
  }).catch(() => ({ quarters: [], currentQuarterId: null }))
  return okrCache
}

interface Props {
  value: string | null
  onChange: (krId: string | null) => void
  label?: string
}

/**
 * Hierarchical OKR KR selector. Loads OKR markdown on mount (cached after
 * first call), parses it, renders a native <select> with <optgroup> per
 * quarter. If OKR doc is missing/empty — selector is disabled but doesn't
 * block form submission.
 */
export function OkrKrSelector({ value, onChange, label = 'Привязка к OKR' }: Props) {
  const [okr, setOkr] = useState<ParsedOkr | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadOkr().then((parsed) => {
      if (!cancelled) {
        setOkr(parsed)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const hasOkr = okr && okr.quarters.length > 0
  const valueInOkr = !value || (okr?.quarters.some((q) =>
    q.objectives.some((o) => o.krs.some((kr) => kr.id === value))
  ) ?? false)

  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading || !hasOkr}
      >
        <option value="">— Не привязан —</option>
        {!loading && !hasOkr && (
          <option disabled>— OKR-документ недоступен —</option>
        )}
        {value && !valueInOkr && (
          <option value={value}>
            {value} (не найдена в текущем OKR)
          </option>
        )}
        {okr?.quarters.map((q) => (
          <optgroup key={q.id} label={q.label}>
            {q.objectives.map((o) =>
              o.krs.map((kr) => (
                <option key={kr.id} value={kr.id}>
                  {o.id.split('-').slice(-1)[0]}. {kr.text.slice(0, 80)}
                </option>
              ))
            )}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
```

**Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep OkrKrSelector
```
Expected: пусто.

**Step 3: Commit**

```bash
git add frontend/src/components/okr/OkrKrSelector.tsx
git commit -m "feat(okr-links): OkrKrSelector reusable — hierarchical native select with module cache"
```

---

## Task 4: Projects form — поле + URL-фильтр

**Files:**
- Modify: `frontend/src/api/projects.ts` (расширить Project type)
- Modify: `frontend/src/pages/Projects.tsx` (form field + URL filter banner)

**Step 1: Расширить Project type**

В `frontend/src/api/projects.ts`, найди `interface Project` (или `type Project`) и добавь поле:

```typescript
okr_kr_id?: string | null
```

(Сначала прочитай файл чтобы понять style — может это interface или type, может с другими опциональными полями.)

**Step 2: Projects.tsx — добавить поле в форму**

В `frontend/src/pages/Projects.tsx`:

1. Добавить импорт:
```tsx
import { OkrKrSelector } from '../components/okr/OkrKrSelector'
import { useSearchParams } from 'react-router-dom'
```

2. Расширить `form` state — добавить `okr_kr_id: ''` к initial:
```tsx
const [form, setForm] = useState({ name: '', department_id: '', description: '', budget: '', start_date: '', end_date: '', deliverables: '', responsible_id: '', okr_kr_id: '' })
```

3. В JSX формы создания (найти где остальные поля типа `name`, `department_id`), добавить:
```tsx
<OkrKrSelector
  value={form.okr_kr_id || null}
  onChange={(v) => setForm({ ...form, okr_kr_id: v || '' })}
/>
```

4. В обработчике сохранения (где `projectsApi.create({ ... })`) добавить в payload:
```tsx
okr_kr_id: form.okr_kr_id || null
```

5. **URL-filter** — в начале компонента:
```tsx
const [searchParams, setSearchParams] = useSearchParams()
const okrKrFilter = searchParams.get('okr_kr')
```

Локальная фильтрация — найти где `projects.map(...)` рендерится, обернуть:
```tsx
const visibleProjects = okrKrFilter
  ? projects.filter((p) => p.okr_kr_id === okrKrFilter)
  : projects
```

6. Banner-фильтр — добавить над списком проектов (если `okrKrFilter`):
```tsx
{okrKrFilter && (
  <div className="rounded-2xl border border-primary-300 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-700 px-4 py-2 mb-3 flex items-center justify-between">
    <span className="text-sm text-primary-700 dark:text-primary-300">
      🎯 Фильтр: KR <code className="font-mono">{okrKrFilter}</code> · показано {visibleProjects.length} из {projects.length}
    </span>
    <button
      type="button"
      onClick={() => {
        const sp = new URLSearchParams(searchParams)
        sp.delete('okr_kr')
        setSearchParams(sp)
      }}
      className="text-xs px-2 py-1 rounded-lg hover:bg-primary-100"
    >
      ✕ Сбросить
    </button>
  </div>
)}
```

**Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "projects|Projects"
```
Expected: пусто.

**Step 4: Commit**

```bash
git add frontend/src/api/projects.ts frontend/src/pages/Projects.tsx
git commit -m "feat(okr-links): Projects form field + ?okr_kr= URL filter with banner"
```

---

## Task 5: TaskModal — поле OKR

**Files:**
- Modify: `frontend/src/components/TaskModal.tsx`

**Step 1: Найти Task type и форму**

`TaskModal.tsx` — 517 строк, inline-форма (как Projects.tsx). Найти:
- Где определён локальный `form` state с полями типа `title`, `description`
- Где этот state отправляется при сохранении (`onSave` или `handleSubmit`)
- Где импортируется тип `Task` для props

**Step 2: Добавить okr_kr_id**

1. В интерфейс Task (либо в `frontend/src/api/tasks.ts` если есть, либо локально в `TaskModal.tsx`) — добавить `okr_kr_id?: string | null`.

2. В `form`-state TaskModal — добавить `okr_kr_id: task.okr_kr_id || ''`.

3. В JSX формы — добавить `<OkrKrSelector ... />` (как в Projects).

4. В save-payload — добавить `okr_kr_id: form.okr_kr_id || null`.

**Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "TaskModal|tasks"
```
Expected: пусто.

**Step 4: Commit**

```bash
git add frontend/src/components/TaskModal.tsx frontend/src/api/tasks.ts
git commit -m "feat(okr-links): TaskModal — OkrKrSelector field"
```

(`frontend/src/api/tasks.ts` — если такого файла нет, проверь куда привязан тип Task. Может быть в `frontend/src/api/projects.ts` или прямо в TaskModal.tsx.)

---

## Task 6: OkrPage счётчики — API + бейдж в KrRow

**Files:**
- Create: `frontend/src/api/okrLinks.ts`
- Modify: `frontend/src/components/okr/KrRow.tsx`
- Modify: `frontend/src/pages/OkrPage.tsx`

**Step 1: Frontend API**

`frontend/src/api/okrLinks.ts`:

```typescript
import { apiClient } from './client'

export type OkrLinkCounts = Record<string, { projects: number; tasks: number }>

export const okrLinksApi = {
  async counts(): Promise<OkrLinkCounts> {
    const r = await apiClient.get<OkrLinkCounts>('/okr-links/counts')
    return r.data
  },
}
```

**Step 2: Расширить KrRow props**

В `frontend/src/components/okr/KrRow.tsx`:

1. Добавить в `interface Props`:
```tsx
linkCounts?: { projects: number; tasks: number }
```

2. Добавить импорт:
```tsx
import { Link } from 'react-router-dom'
```

3. В JSX — справа от блока `<div className="flex-1 min-w-0">...</div>` (но внутри его обёртки или рядом, чтобы не ломать flex layout), добавить рендер бейджа:
```tsx
{linkCounts && (linkCounts.projects > 0 || linkCounts.tasks > 0) && (
  <Link
    to={`/planning/projects?okr_kr=${kr.id}`}
    onClick={(e) => e.stopPropagation()}
    className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300"
    title="Открыть проекты этого KR"
  >
    📁 {linkCounts.projects} · ✓ {linkCounts.tasks}
  </Link>
)}
```

Положение: в `flex items-start gap-3 py-2` контейнере, сразу после `<div className="flex-1 min-w-0">...</div>`, перед `{popoverOpen && (...)}`.

**Step 3: OkrPage — загрузить counts и прокинуть в KrRow**

В `frontend/src/pages/OkrPage.tsx`:

1. Импорт:
```tsx
import { okrLinksApi, OkrLinkCounts } from '../api/okrLinks'
```

2. Стейт:
```tsx
const [linkCounts, setLinkCounts] = useState<OkrLinkCounts>({})
```

3. В `load()` функции — расширить `Promise.all`:
```tsx
const [doc, statusD, counts] = await Promise.all([
  brandDocsApi.get(OKR_SLUG),
  okrStatusApi.load(),
  okrLinksApi.counts().catch(() => ({})),  // graceful fail
])
// ... existing logic
setLinkCounts(counts)
```

4. В рендере карточек Objective — передать в `KrRow`:
```tsx
<KrRow
  key={kr.id}
  kr={kr}
  status={statusDoc?.statuses[kr.id]?.status ?? 'unknown'}
  comment={statusDoc?.statuses[kr.id]?.comment}
  linkCounts={linkCounts[kr.id]}
  onChange={handleKrChange}
  busy={busyKrId === kr.id}
/>
```

**Step 4: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "OkrPage|KrRow|okrLinks"
```
Expected: пусто.

**Step 5: Commit**

```bash
git add frontend/src/api/okrLinks.ts frontend/src/components/okr/KrRow.tsx frontend/src/pages/OkrPage.tsx
git commit -m "feat(okr-links): OkrPage badge + counts API integration"
```

---

## Task 7: Финальный smoke + push

**Step 1: Локальный smoke checklist**

Pre-flight: `cd backend && npm run dev`, `cd frontend && npm run dev`. Залогинься.

1. **Миграция применена** — через Supabase MCP: `\d projects` (или эквивалент SQL) показывает `okr_kr_id varchar(64)`. Индексы существуют (см. Task 1 Step 3).
2. **Backend health** — `curl http://localhost:3001/health` → 200.
3. **Counts endpoint** — `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/okr-links/counts` → `{}` (пусто, проектов с привязкой ещё нет).
4. **Создать проект с привязкой**: открыть `/planning/projects` → «Создать проект» → заполнить required (name, department) → в селекторе OKR выбрать любой KR (например, Q2-2026-O1-KR1) → сохранить.
5. **Проверить запись в БД**: через Supabase MCP `SELECT okr_kr_id FROM projects WHERE name = '...' LIMIT 1;` → возвращает Q2-2026-O1-KR1.
6. **Counts обновился** — `curl /api/okr-links/counts` → `{"Q2-2026-O1-KR1": {"projects": 1, "tasks": 0}}`.
7. **OkrPage badge**: `/marketing/okr` → справа от Q2-2026-O1-KR1 виден бейдж `📁 1 · ✓ 0`.
8. **Click → filter**: клик по бейджу → URL стал `/planning/projects?okr_kr=Q2-2026-O1-KR1` → banner-фильтр виден → виден созданный проект, остальные скрыты.
9. **Сброс фильтра**: клик ✕ в banner → URL без `okr_kr`, видны все проекты.
10. **Task-привязка**: открыть проект → создать задачу через TaskModal → в форме выбрать KR → сохранить → counts стал `{"Q2-2026-O1-KR1": {"projects": 1, "tasks": 1}}`, badge на OkrPage `📁 1 · ✓ 1`.
11. **Removal**: открыть проект в edit-form → поменять привязку на «— Не привязан —» → сохранить → counts уменьшается до `{"Q2-2026-O1-KR1": {"projects": 0, "tasks": 1}}`, badge `📁 0 · ✓ 1`.
12. **Dangling reference test**: через Supabase MCP `UPDATE projects SET okr_kr_id = 'Q9-2099-O1-KR1' WHERE id = ...` → открыть проект в edit-form → в селекторе видно «Q9-2099-O1-KR1 (не найдена в текущем OKR)». OkrPage не показывает этот KR (он не существует).

**Step 2: Push**

```bash
git push origin main
git push vercel-deploy main
```

**Step 3: Прод-smoke**

После Railway+Vercel deploy (~3 мин) — повторить ключевые пункты (4-9) на `https://erp.ximi4ka.ru`.

---

## Reference: skill bridges

- @superpowers:executing-plans — execute этот план task-by-task (Subagent-Driven из этой сессии)
- @superpowers:systematic-debugging — если что-то ломается на smoke
- @superpowers:verification-before-completion — verify smoke до push'а

## Principles baked in

- **DRY** — `OkrKrSelector` переиспользуется в Projects + TaskModal без копирования логики
- **YAGNI** — нет FK, нет accordion, нет bulk-операций, нет ML-suggestions; только point-to-point soft-reference и счётчик
- **TDD-адаптированный** — каждая задача завершается typecheck + smoke
- **Frequent commits** — 7 атомарных коммитов, каждый ревьюется/откатывается независимо
