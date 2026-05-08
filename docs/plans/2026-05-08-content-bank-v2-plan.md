# Контент-банк v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Превратить уже задеплоенный контент-банк (`0b35e39` на проде) в AI-feedback-loop через триаж-режим, импорт+экспорт JSON и фильтр по оценке. Только additive-изменения, никаких разрушительных миграций.

**Architecture:** 3 новых nullable-колонки на `content_units` (`review_grade`/`review_feedback`/`reviewed_at`) — ALTER TABLE ADD COLUMN. На бэке: расширение фильтров `getAll`, новые эндпоинты `export`/`import preview+commit`/`ungraded-count`. На фронте: отдельная focus-view страница `/content-bank/triage`, модалка `ImportJsonModal`, прямой экспорт-кнопка, 5-й filter-chip ряд «Оценка». Hotkeys в триаже. Защита `review_*` полей при upsert от перезаписи AI-ом.

**Tech Stack:** Express + TypeORM + Postgres (Supabase), React 18 + TS + Vite + Tailwind. Multer для file upload. In-memory Map с TTL для preview-token. Без новых зависимостей.

**Design doc:** [2026-05-08-content-bank-v2-design.md](2026-05-08-content-bank-v2-design.md)

---

## Notes for the Executor

- Проект **не имеет тест-инфраструктуры**. Каждая задача завершается **мануальной верификацией** + `npx tsc --noEmit` clean.
- **Russian text в UI** — копируется ровно как в плане, без перевода.
- **Все модалки** через `createPortal(<JSX>, document.body)` (паттерн из `446ce0e`).
- **Frequent commits** — мелко, описательно, по одной задаче.
- **Не пушить в прод** до Stage 8. Push требует обоих remote'ов (`origin` для Railway-бэка + `vercel-deploy` для Vercel-фронта).
- Все коммиты в worktree `~/.config/superpowers/worktrees/ximi4ka/feat-content-bank-v2` на ветке `feat/content-bank-v2`. Worktree создаётся через skill `using-git-worktrees` ДО Stage 1.
- Старый `feat/content-bank` worktree уже смерджен и может быть удалён через `git worktree remove` параллельно (не блокирует).

---

## Stage Overview

| Stage | Что | Задач | Коммитов |
|---|---|---|---|
| 1 | Backend: schema (миграция SQL + entity update) | 2 | 2 |
| 2 | Backend: filter `review_grade` + endpoint `ungraded-count` | 2 | 2 |
| 3 | Backend: export endpoint | 1 | 1 |
| 4 | Backend: import preview + commit endpoints | 3 | 2 |
| 5 | Frontend: types + API methods + filter chip | 2 | 2 |
| 6 | Frontend: header buttons (Триаж/Импорт/Экспорт) + ungraded badge | 1 | 1 |
| 7 | Frontend: ContentBankTriage page (focus view + hotkeys) | 2 | 2 |
| 8 | Frontend: ImportJsonModal | 1 | 1 |
| 9 | Migration & deploy | 4 | 0 |

Total: **~13 коммитов**.

---

## Stage 1 — Backend schema

### Task 1.1: SQL migration file

**Files:**
- Create: `backend/src/migrations/2026-05-08-content-bank-review.sql`

**Step 1:** Записать:
```sql
-- 2026-05-08 content-bank v2 — review-loop columns + indexes
-- Non-destructive: ADD COLUMN + CREATE INDEX only.
-- Run on Supabase via SQL console BEFORE deploying backend code.

BEGIN;

ALTER TABLE content_units
  ADD COLUMN review_grade   VARCHAR(20),
  ADD COLUMN review_feedback TEXT,
  ADD COLUMN reviewed_at    TIMESTAMPTZ;

CREATE INDEX idx_units_review_grade ON content_units (review_grade);
CREATE INDEX idx_units_reviewed_at  ON content_units (reviewed_at DESC);

COMMIT;
```

**Step 2:** Не накатываем сейчас — это для Stage 9.

**Step 3:** Commit:
```bash
git add backend/src/migrations/2026-05-08-content-bank-review.sql
git commit -m "feat(content-bank-v2): SQL migration — review_grade + review_feedback + reviewed_at columns"
```

### Task 1.2: Update `ContentUnit` entity

**Files:**
- Modify: `backend/src/entities/ContentUnit.ts`

**Step 1:** Найти существующий блок `export type ContentStatus = ...` и **сразу под ним** добавить:
```ts
export type ReviewGrade = 'excellent' | 'needs_work' | 'rejected'
```

**Step 2:** Внутри класса `ContentUnit` найти конец списка `@Column` (перед `@CreateDateColumn`/`@OneToMany`) и добавить:
```ts
@Column({ type: 'varchar', length: 20, nullable: true })
review_grade: ReviewGrade | null

@Column({ type: 'text', nullable: true })
review_feedback: string | null

@Column({ type: 'timestamptz', nullable: true })
reviewed_at: Date | null
```

**Step 3:** Backend typecheck:
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "ContentUnit\.ts:" | head
```
Expected: пусто.

**Step 4:** Commit:
```bash
git add backend/src/entities/ContentUnit.ts
git commit -m "feat(content-bank-v2): add review_grade / review_feedback / reviewed_at to ContentUnit entity"
```

---

## Stage 2 — Backend: filter + ungraded-count

### Task 2.1: Расширить getAll фильтром review_grade

**Files:**
- Modify: `backend/src/controllers/content-unit.controller.ts`

**Step 1:** В методе `getAll` найти секцию деструктуризации `req.query` — добавить `review_grade`:
```ts
const {
  status,
  rubric_id,
  content_type,
  network,
  search,
  review_grade,                  // ← NEW
  sort = 'created_at',
} = req.query as Record<string, string | undefined>
```

**Step 2:** В блоке andWhere'ов найти существующий фильтр `network` и **сразу после него** добавить:
```ts
if (review_grade) {
  const grades = review_grade.split(',')
  if (grades.includes('null')) {
    const rest = grades.filter(g => g !== 'null')
    if (rest.length > 0) {
      qb.andWhere('(u.review_grade IS NULL OR u.review_grade IN (:...rest))', { rest })
    } else {
      qb.andWhere('u.review_grade IS NULL')
    }
  } else {
    qb.andWhere('u.review_grade IN (:...grades)', { grades })
  }
}
```

(Спецзначение `null` означает «WHERE IS NULL»; смешивание `null,excellent` поддерживаем — например, «не оцененные ИЛИ отличные».)

**Step 3:** Backend typecheck:
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "content-unit.controller" | head
```
Expected: пусто.

**Step 4:** Commit:
```bash
git add backend/src/controllers/content-unit.controller.ts
git commit -m "feat(content-bank-v2): getAll filter — review_grade with NULL support"
```

### Task 2.2: New endpoint `GET /content-units/ungraded-count`

**Files:**
- Modify: `backend/src/controllers/content-unit.controller.ts`
- Modify: `backend/src/routes/content-unit.routes.ts`

**Step 1:** В `content-unit.controller.ts` после метода `getAll` добавить:
```ts
async ungradedCount(req: Request, res: Response) {
  try {
    const count = await repo.count({ where: { review_grade: IsNull() } })
    res.json({ count })
  } catch (e) {
    console.error('Error counting ungraded units:', e)
    res.status(500).json({ error: 'Ошибка подсчёта неоценённых' })
  }
},
```

В импортах вверху файла убедиться, что `IsNull` импортирован из 'typeorm':
```ts
import { IsNull } from 'typeorm'
```

**Step 2:** В `content-unit.routes.ts` зарегистрировать **до** `/:id`:
```ts
router.get('/ungraded-count', contentUnitController.ungradedCount)
router.get('/', contentUnitController.getAll)
router.get('/:id', contentUnitController.getOne)
// ...
```

**Step 3:** Backend typecheck.

**Step 4:** Commit:
```bash
git add backend/src/controllers/content-unit.controller.ts backend/src/routes/content-unit.routes.ts
git commit -m "feat(content-bank-v2): GET /content-units/ungraded-count for triage badge"
```

---

## Stage 3 — Backend: export endpoint

### Task 3.1: `GET /content-units/export`

**Files:**
- Modify: `backend/src/controllers/content-unit.controller.ts`
- Modify: `backend/src/routes/content-unit.routes.ts`

**Step 1:** В `content-unit.controller.ts` добавить новый метод (рядом с `ungradedCount`):
```ts
async export(req: Request, res: Response) {
  try {
    const { status, rubric_id, content_type, network, search, review_grade } =
      req.query as Record<string, string | undefined>

    const qb = repo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.rubric', 'r')
      .leftJoinAndSelect('u.publications', 'p')

    if (status) qb.andWhere('u.status IN (:...statuses)', { statuses: status.split(',') })
    if (rubric_id) qb.andWhere('u.rubric_id IN (:...rubrics)', { rubrics: rubric_id.split(',') })
    if (content_type) qb.andWhere('u.content_type IN (:...types)', { types: content_type.split(',') })
    if (network) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM content_publications cp WHERE cp.content_unit_id = u.id AND cp.network IN (:...networks))',
        { networks: network.split(',') },
      )
    }
    if (search) {
      qb.andWhere(
        '(u.title ILIKE :s OR u.hook ILIKE :s OR u.hook_ab ILIKE :s OR u.essence ILIKE :s)',
        { s: `%${search}%` },
      )
    }
    if (review_grade) {
      const grades = review_grade.split(',')
      if (grades.includes('null')) {
        const rest = grades.filter(g => g !== 'null')
        if (rest.length > 0) {
          qb.andWhere('(u.review_grade IS NULL OR u.review_grade IN (:...rest))', { rest })
        } else {
          qb.andWhere('u.review_grade IS NULL')
        }
      } else {
        qb.andWhere('u.review_grade IN (:...grades)', { grades })
      }
    }

    qb.orderBy('r.sort_order', 'ASC').addOrderBy('u.created_at', 'ASC')
    const units = await qb.getMany()

    const rubricRepo = AppDataSource.getRepository(ContentRubric)
    const rubrics = await rubricRepo.find({ order: { sort_order: 'ASC' } })

    const payload = {
      meta: {
        exported_at: new Date().toISOString(),
        version: '1.0',
        total_units: units.length,
        filters_applied: {
          status: status || null,
          rubric_id: rubric_id || null,
          content_type: content_type || null,
          network: network || null,
          search: search || null,
          review_grade: review_grade || null,
        },
      },
      rubrics: rubrics.map(r => ({
        id: r.id, slug: r.slug, title: r.title, emoji: r.emoji,
        tone: r.tone, audience: r.audience, cta_template: r.cta_template,
        sort_order: r.sort_order,
      })),
      units: units.map(u => ({
        id: u.id,
        rubric_slug: u.rubric?.slug || null,
        content_type: u.content_type,
        status: u.status,
        complexity: u.complexity,
        title: u.title,
        hook: u.hook,
        hook_ab: u.hook_ab,
        visual: u.visual,
        essence: u.essence,
        notes: u.notes,
        video_url: u.video_url,
        review_grade: u.review_grade,
        review_feedback: u.review_feedback,
        reviewed_at: u.reviewed_at,
        publications: (u.publications || []).map(p => ({
          network: p.network,
          scheduled_at: p.scheduled_at,
          published_at: p.published_at,
          published_url: p.published_url,
          notes: p.notes,
        })),
        created_at: u.created_at,
        updated_at: u.updated_at,
      })),
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="content-bank-export-${Date.now()}.json"`,
    )
    res.json(payload)
  } catch (e) {
    console.error('Error exporting units:', e)
    res.status(500).json({ error: 'Ошибка экспорта' })
  }
},
```

В импортах вверху файла убедиться:
```ts
import { ContentRubric } from '../entities/ContentRubric'
```

**Step 2:** В `content-unit.routes.ts` зарегистрировать **до** `/:id` (рядом с ungraded-count):
```ts
router.get('/export', contentUnitController.export)
router.get('/ungraded-count', contentUnitController.ungradedCount)
router.get('/', contentUnitController.getAll)
// ...
```

**Step 3:** Smoke-проверка (если backend крутится локально + есть данные):
```bash
curl -s -H "Authorization: Bearer <token>" "http://localhost:3001/api/content-units/export?review_grade=null" | jq '.meta'
```
Expected: `{exported_at, version, total_units, filters_applied: {review_grade: 'null', ...}}`.

**Step 4:** Backend typecheck clean.

**Step 5:** Commit:
```bash
git add backend/src/controllers/content-unit.controller.ts backend/src/routes/content-unit.routes.ts
git commit -m "feat(content-bank-v2): GET /content-units/export — full JSON dump, respects URL filters"
```

---

## Stage 4 — Backend: import preview + commit

### Task 4.1: In-memory token store helper

**Files:**
- Create: `backend/src/services/import-token-store.ts`

**Step 1:** Записать (простой Map с TTL 5 мин):
```ts
// In-memory store for content-bank import preview tokens.
// TTL 5 min. Lost on backend restart — acceptable for low-traffic admin tool.

interface ImportPlan {
  rubrics: Array<{ slug: string; title: string; emoji: string | null;
    tone: string | null; audience: string | null; cta_template: string | null;
    sort_order: number; existing_id: string | null }>
  units: Array<{
    incoming: Record<string, unknown>
    action: 'insert' | 'update' | 'skip'
    existing_id: string | null
    skip_reason?: string
  }>
  user_id: string
  created_at: number
}

const store = new Map<string, ImportPlan>()
const TTL_MS = 5 * 60 * 1000

export function saveImportPlan(plan: ImportPlan): string {
  const token = crypto.randomUUID()
  store.set(token, plan)
  // Cleanup expired
  const now = Date.now()
  for (const [t, p] of store) {
    if (now - p.created_at > TTL_MS) store.delete(t)
  }
  return token
}

export function getImportPlan(token: string): ImportPlan | null {
  const plan = store.get(token)
  if (!plan) return null
  if (Date.now() - plan.created_at > TTL_MS) {
    store.delete(token)
    return null
  }
  return plan
}

export function deleteImportPlan(token: string) {
  store.delete(token)
}

// `crypto` is a Node global on 19+; if older, use `import { randomUUID } from 'crypto'`
import { randomUUID } from 'crypto'
declare const crypto: { randomUUID: () => string }
```

(Если в проекте `tsconfig` строгий и `crypto` global не подхватывается — пользоваться `randomUUID` импортом и убрать `declare`.)

**Step 2:** Backend typecheck.

**Step 3:** Commit:
```bash
git add backend/src/services/import-token-store.ts
git commit -m "feat(content-bank-v2): in-memory import token store (TTL 5min)"
```

### Task 4.2: `POST /content-units/import/preview` + `POST /content-units/import/commit`

**Files:**
- Modify: `backend/src/controllers/content-unit.controller.ts`
- Modify: `backend/src/routes/content-unit.routes.ts`

**Step 1:** В импортах:
```ts
import { saveImportPlan, getImportPlan, deleteImportPlan } from '../services/import-token-store'
import { ContentPublication } from '../entities/ContentPublication'
```

**Step 2:** Добавить методы (рядом с `export`):

```ts
async importPreview(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' })
    let json: any
    try {
      json = JSON.parse(req.file.buffer.toString('utf-8'))
    } catch {
      return res.status(400).json({ error: 'Невалидный JSON' })
    }

    const errors: string[] = []
    const warnings: string[] = []

    if (!json.units || !Array.isArray(json.units)) {
      return res.status(400).json({ error: 'JSON должен содержать массив units[]' })
    }

    const rubricRepo = AppDataSource.getRepository(ContentRubric)
    const existingRubrics = await rubricRepo.find()
    const slugToRubric = new Map(existingRubrics.map(r => [r.slug, r]))

    const plannedRubrics: ImportPlan['rubrics'] = []
    let rubricsToCreate = 0, rubricsToSkip = 0
    if (Array.isArray(json.rubrics)) {
      for (const r of json.rubrics) {
        if (!r.slug || !r.title) {
          errors.push(`Рубрика без slug или title: ${JSON.stringify(r)}`)
          continue
        }
        const existing = slugToRubric.get(r.slug)
        plannedRubrics.push({
          slug: r.slug,
          title: r.title,
          emoji: r.emoji ?? null,
          tone: r.tone ?? null,
          audience: r.audience ?? null,
          cta_template: r.cta_template ?? null,
          sort_order: r.sort_order ?? 0,
          existing_id: existing?.id ?? null,
        })
        if (existing) rubricsToSkip++
        else rubricsToCreate++
      }
    }

    let unitsToInsert = 0, unitsToUpdate = 0, unitsToSkip = 0
    const plannedUnits: ImportPlan['units'] = []

    // Build a map for dup-check by (rubric_id, hook) — using existing DB state, not the plan
    // (We don't pre-create rubrics during preview; we rely on slug-to-existing mapping.)

    for (const incoming of json.units) {
      if (typeof incoming !== 'object' || incoming === null) {
        errors.push(`Невалидная единица: ${JSON.stringify(incoming)}`)
        continue
      }

      // Validate rubric_slug if present
      if (incoming.rubric_slug && !slugToRubric.get(incoming.rubric_slug) &&
          !plannedRubrics.find(r => r.slug === incoming.rubric_slug)) {
        warnings.push(`rubric_slug '${incoming.rubric_slug}' не найден — единица будет без рубрики`)
      }

      // Update path: id present and exists in DB
      if (incoming.id && typeof incoming.id === 'string') {
        const existing = await repo.findOne({ where: { id: incoming.id } })
        if (existing) {
          plannedUnits.push({
            incoming,
            action: 'update',
            existing_id: existing.id,
          })
          unitsToUpdate++
          continue
        }
        // id present but doesn't exist — fall through to insert
      }

      // Skip-on-duplicate: (rubric_id from slug) + hook
      if (incoming.rubric_slug && incoming.hook) {
        const existingRubric = slugToRubric.get(incoming.rubric_slug)
        if (existingRubric) {
          const dup = await repo.findOne({
            where: { rubric_id: existingRubric.id, hook: incoming.hook },
          })
          if (dup) {
            plannedUnits.push({
              incoming,
              action: 'skip',
              existing_id: dup.id,
              skip_reason: 'duplicate (rubric_id, hook)',
            })
            unitsToSkip++
            continue
          }
        }
      }

      plannedUnits.push({ incoming, action: 'insert', existing_id: null })
      unitsToInsert++
    }

    const token = saveImportPlan({
      rubrics: plannedRubrics,
      units: plannedUnits,
      user_id: req.user!.userId,
      created_at: Date.now(),
    })

    res.json({
      rubrics: { to_create: rubricsToCreate, to_skip: rubricsToSkip,
        parsed_total: plannedRubrics.length },
      units: { to_insert: unitsToInsert, to_update: unitsToUpdate,
        to_skip_duplicate: unitsToSkip, parsed_total: plannedUnits.length },
      errors,
      warnings,
      preview_token: token,
    })
  } catch (e) {
    console.error('Error in import preview:', e)
    res.status(500).json({ error: 'Ошибка предварительного разбора' })
  }
},

async importCommit(req: AuthenticatedRequest, res: Response) {
  try {
    const { preview_token } = req.body
    if (!preview_token) return res.status(400).json({ error: 'preview_token обязателен' })

    const plan = getImportPlan(preview_token)
    if (!plan) return res.status(404).json({ error: 'Токен истёк или не найден. Загрузите файл заново.' })

    const PROTECTED = ['id', 'review_grade', 'review_feedback', 'reviewed_at',
      'created_by', 'created_at', 'rubric', 'publications', 'rubric_slug']

    const stripProtected = (incoming: Record<string, unknown>) => {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(incoming)) {
        if (!PROTECTED.includes(k)) out[k] = v
      }
      return out
    }

    const rubricRepo = AppDataSource.getRepository(ContentRubric)
    const publicationRepo = AppDataSource.getRepository(ContentPublication)

    let rubricsCreated = 0, rubricsSkipped = 0
    const slugToId = new Map<string, string>()
    for (const r of plan.rubrics) {
      if (r.existing_id) {
        slugToId.set(r.slug, r.existing_id)
        rubricsSkipped++
      } else {
        const created = await rubricRepo.save(rubricRepo.create({
          slug: r.slug, title: r.title, emoji: r.emoji,
          tone: r.tone, audience: r.audience, cta_template: r.cta_template,
          sort_order: r.sort_order,
        }))
        slugToId.set(r.slug, created.id)
        rubricsCreated++
      }
    }
    // Fill slugToId with rubrics that already existed but weren't in plan.rubrics
    const allRubrics = await rubricRepo.find()
    for (const r of allRubrics) if (!slugToId.has(r.slug)) slugToId.set(r.slug, r.id)

    let unitsInserted = 0, unitsUpdated = 0, unitsSkipped = 0

    for (const item of plan.units) {
      if (item.action === 'skip') { unitsSkipped++; continue }

      const incoming = item.incoming as any
      const patch = stripProtected(incoming)
      patch.rubric_id = incoming.rubric_slug ? (slugToId.get(incoming.rubric_slug) || null) : null

      if (item.action === 'update' && item.existing_id) {
        await repo.update(item.existing_id, patch as any)
        // Replace publications: delete old, insert new
        await publicationRepo.delete({ content_unit_id: item.existing_id })
        for (const p of (incoming.publications || [])) {
          await publicationRepo.save(publicationRepo.create({
            content_unit_id: item.existing_id,
            network: p.network,
            scheduled_at: p.scheduled_at ? new Date(p.scheduled_at) : null,
            published_at: p.published_at ? new Date(p.published_at) : null,
            published_url: p.published_url ?? null,
            notes: p.notes ?? null,
          }))
        }
        unitsUpdated++
      } else {
        // INSERT
        const title = (incoming.title && String(incoming.title).trim()) ||
          (incoming.hook ? String(incoming.hook).slice(0, 80) : 'Без названия')
        const created = await repo.save(repo.create({
          ...patch,
          title,
          created_by: plan.user_id,
        } as any))
        for (const p of (incoming.publications || [])) {
          await publicationRepo.save(publicationRepo.create({
            content_unit_id: created.id,
            network: p.network,
            scheduled_at: p.scheduled_at ? new Date(p.scheduled_at) : null,
            published_at: p.published_at ? new Date(p.published_at) : null,
            published_url: p.published_url ?? null,
            notes: p.notes ?? null,
          }))
        }
        unitsInserted++
      }
    }

    deleteImportPlan(preview_token)

    res.json({
      rubrics: { created: rubricsCreated, skipped: rubricsSkipped },
      units: { inserted: unitsInserted, updated: unitsUpdated, skipped: unitsSkipped },
      errors: [],
    })
  } catch (e: any) {
    console.error('Error in import commit:', e)
    res.status(500).json({ error: 'Ошибка импорта: ' + (e?.message || 'неизвестная ошибка') })
  }
},
```

Если `AuthenticatedRequest` интерфейса в файле нет (помним — Stage 3 удалил его в пользу глобальной аугментации), используем просто `Request` и `req.user!.userId`.

**Step 3:** В `content-unit.routes.ts` зарегистрировать **до** `/:id`:
```ts
router.post('/import/preview', upload.single('file'), contentUnitController.importPreview)
router.post('/import/commit', contentUnitController.importCommit)
```

И импорт `multer`:
```ts
import multer from 'multer'
const upload = multer({ storage: multer.memoryStorage() })
```

(Проверить, нет ли уже multer в этом файле — если есть в другом роуте, переиспользовать.)

**Step 4:** Backend typecheck clean.

**Step 5:** Commit:
```bash
git add backend/src/controllers/content-unit.controller.ts backend/src/routes/content-unit.routes.ts
git commit -m "feat(content-bank-v2): POST /content-units/import preview + commit (upsert with review-fields protection)"
```

### Task 4.3: Smoke import (optional, локально)

**Files:** —

Если есть локальный backend с тестовой БД:
1. Сделать `curl -F "file=@/tmp/test.json" http://localhost:3001/api/content-units/import/preview` (с auth-токеном)
2. Получить `preview_token`, проверить статистику
3. `curl -X POST -H 'Content-Type: application/json' -d '{"preview_token":"..."}' http://localhost:3001/api/content-units/import/commit`
4. Проверить статистику применения

Без коммита — это smoke. Если сломано → fix-up commit.

---

## Stage 5 — Frontend: types + API + filter chip

### Task 5.1: Расширить `api/contentBank.ts`

**Files:**
- Modify: `frontend/src/api/contentBank.ts`

**Step 1:** После `ContentStatus` тайпа добавить:
```ts
export type ReviewGrade = 'excellent' | 'needs_work' | 'rejected'
```

**Step 2:** В `interface ContentUnit` добавить три поля (после `video_url`):
```ts
review_grade: ReviewGrade | null
review_feedback: string | null
reviewed_at: string | null
```

**Step 3:** В `interface UnitsListParams` добавить:
```ts
review_grade?: string  // CSV: 'excellent,needs_work' or special 'null'
```

**Step 4:** Добавить новые типы для импорта (после `UnitsListResponse`):
```ts
export interface ImportPreviewResponse {
  rubrics: { to_create: number; to_skip: number; parsed_total: number }
  units: { to_insert: number; to_update: number; to_skip_duplicate: number; parsed_total: number }
  errors: string[]
  warnings: string[]
  preview_token: string
}

export interface ImportCommitResponse {
  rubrics: { created: number; skipped: number }
  units: { inserted: number; updated: number; skipped: number }
  errors: string[]
}
```

**Step 5:** В `unitsApi` объект добавить методы (после `delete`):
```ts
ungradedCount: async (): Promise<{ count: number }> => {
  const r = await apiClient.get<{ count: number }>('/content-units/ungraded-count')
  return r.data
},

export: async (params: UnitsListParams = {}): Promise<Blob> => {
  const r = await apiClient.get('/content-units/export', { params, responseType: 'blob' })
  return r.data as Blob
},

importPreview: async (file: File): Promise<ImportPreviewResponse> => {
  const fd = new FormData()
  fd.append('file', file)
  const r = await apiClient.post<ImportPreviewResponse>(
    '/content-units/import/preview', fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return r.data
},

importCommit: async (token: string): Promise<ImportCommitResponse> => {
  const r = await apiClient.post<ImportCommitResponse>(
    '/content-units/import/commit', { preview_token: token },
  )
  return r.data
},
```

**Step 6:** В блок labels добавить:
```ts
export const REVIEW_GRADE_LABELS: Record<ReviewGrade, string> = {
  excellent: '✅ отлично',
  needs_work: '⚠️ доработать',
  rejected: '❌ отказ',
}
```

**Step 7:** Frontend typecheck:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "api/contentBank" | head
```
Expected: пусто.

**Step 8:** Commit:
```bash
git add frontend/src/api/contentBank.ts
git commit -m "feat(content-bank-v2): API types + review_grade filter + export/import methods + ungradedCount"
```

### Task 5.2: Add filter chip «Оценка» to ContentBank.tsx

**Files:**
- Modify: `frontend/src/pages/ContentBank.tsx`

**Step 1:** В импортах добавить `REVIEW_GRADE_LABELS, ReviewGrade`:
```ts
import { ..., REVIEW_GRADE_LABELS, ReviewGrade } from '../api/contentBank'
```

**Step 2:** Добавить derived value (рядом с другими `*Filter` объявлениями):
```ts
const reviewGradeFilter = searchParams.get('review_grade')?.split(',').filter(Boolean) || []
```

**Step 3:** В блок где сейчас 4 `<FilterChipBar>` (Тип/Рубрика/Сети/Статус) — **после** статуса добавить пятый:
```tsx
<FilterChipBar
  label="Оценка"
  options={[
    { value: 'excellent', label: REVIEW_GRADE_LABELS.excellent },
    { value: 'needs_work', label: REVIEW_GRADE_LABELS.needs_work },
    { value: 'rejected', label: REVIEW_GRADE_LABELS.rejected },
    { value: 'null', label: '— не оценено —' },
  ]}
  selected={reviewGradeFilter}
  onChange={(next) => updateParam('review_grade', next)}
/>
```

**Step 4:** В блок построения params для `unitsApi.list({...})` добавить:
```ts
if (reviewGradeFilter.length > 0) params.review_grade = reviewGradeFilter.join(',')
```
(Конкретное место зависит от структуры — найти где остальные фильтры передаются.)

**Step 5:** Frontend typecheck clean.

**Step 6:** Commit:
```bash
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank-v2): add review_grade filter chip row to ContentBank page"
```

---

## Stage 6 — Frontend: header buttons + ungraded badge

### Task 6.1: Добавить кнопки «Триаж (N)» / «Импорт» / «Экспорт» в шапку

**Files:**
- Modify: `frontend/src/pages/ContentBank.tsx`

**Step 1:** В импортах добавить:
```ts
import { useNavigate } from 'react-router-dom'
import { Download, Upload, Sparkles } from 'lucide-react'
import ImportJsonModal from '../components/content-bank/ImportJsonModal'  // exists after Stage 8
```

(`Sparkles` icon — для триажа. Можно заменить на любую другую если в проекте уже занята.)

**Step 2:** Добавить state:
```ts
const navigate = useNavigate()
const [ungraded, setUngraded] = useState(0)
const [importModalOpen, setImportModalOpen] = useState(false)
```

**Step 3:** Добавить useEffect для подгрузки счётчика (отдельно от основного `load`):
```ts
const loadUngradedCount = useCallback(async () => {
  try {
    const r = await unitsApi.ungradedCount()
    setUngraded(r.count)
  } catch {
    // silent
  }
}, [])

useEffect(() => { loadUngradedCount() }, [loadUngradedCount])
```

**Step 4:** В шапке слева от «⚙ Рубрики» добавить три кнопки:
```tsx
<button
  onClick={() => navigate('/content-bank/triage')}
  className="btn btn-secondary flex items-center gap-2"
  title="Режим триажа — оценка идей"
>
  <Sparkles size={16} />
  <span className="hidden sm:inline">Триаж{ungraded > 0 ? ` (${ungraded})` : ''}</span>
</button>

<button
  onClick={() => setImportModalOpen(true)}
  className="btn btn-secondary flex items-center gap-2"
  title="Импорт из JSON"
>
  <Upload size={16} />
  <span className="hidden sm:inline">Импорт</span>
</button>

<button
  onClick={async () => {
    try {
      const params: Record<string, string> = {}
      const sp = searchParams
      for (const k of ['status','rubric_id','content_type','network','review_grade','search']) {
        const v = sp.get(k)
        if (v) params[k] = v
      }
      const blob = await unitsApi.export(params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `content-bank-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Экспортировано: ${Math.round(blob.size / 1024)} KB`)
    } catch {
      toast.error('Ошибка экспорта')
    }
  }}
  className="btn btn-secondary flex items-center gap-2"
  title="Экспорт в JSON"
>
  <Download size={16} />
  <span className="hidden sm:inline">Экспорт</span>
</button>
```

(Расположение: до «⚙ Рубрики» и «+ Добавить» — порядок: Триаж / Импорт / Экспорт / Рубрики / Добавить.)

**Step 5:** Под основной JSX (рядом с другими модалками) добавить рендер `ImportJsonModal`:
```tsx
{importModalOpen && (
  <ImportJsonModal
    onClose={() => {
      setImportModalOpen(false)
      load()                  // reload list
      loadUngradedCount()     // refresh badge
      // also reload rubrics (could have been imported new)
      // (existing code likely has loadRubrics() — call it here too)
    }}
  />
)}
```

(Если `ImportJsonModal` ещё не создан — Stage 8 его создаёт. До тех пор typecheck сломается. Это ожидаемо. Можно временно закомментить рендер модалки если хочется промежуточный clean state — на твоё усмотрение.)

**Step 6:** Frontend typecheck — будет ошибка про `ImportJsonModal` (компонент не существует). Это OK, фиксим в Stage 8. Если хочешь чистый коммит сейчас — **закомментируй импорт + рендер модалки**, раскомментируй в Stage 8.

**Step 7:** Commit:
```bash
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank-v2): header buttons — Триаж / Импорт / Экспорт + ungraded counter"
```

---

## Stage 7 — Frontend: ContentBankTriage page

### Task 7.1: Базовый ContentBankTriage page (без hotkeys)

**Files:**
- Create: `frontend/src/pages/ContentBankTriage.tsx`
- Modify: `frontend/src/App.tsx` (добавить route)

**Step 1:** Создать `ContentBankTriage.tsx`:
```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { X, ArrowLeft, ArrowRight } from 'lucide-react'
import {
  unitsApi,
  ContentUnit,
  ReviewGrade,
  REVIEW_GRADE_LABELS,
  COMPLEXITY_LABELS,
} from '../api/contentBank'
import { useToast } from '../contexts/ToastContext'

export default function ContentBankTriage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [queue, setQueue] = useState<ContentUnit[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load queue on mount: ungraded by default, optional ?include=excellent,needs_work
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const include = searchParams.get('include')
        const reviewFilter = include
          ? `null,${include}` // also include re-graded ones
          : 'null'
        const rubricFilter = searchParams.get('rubric_id') || undefined
        const r = await unitsApi.list({
          review_grade: reviewFilter,
          rubric_id: rubricFilter,
          limit: 200,
          sort: 'created_at',
        })
        setQueue(r.data)
      } catch {
        toast.error('Ошибка загрузки очереди')
      }
      setLoading(false)
    }
    loadQueue()
  }, [searchParams, toast])

  const current = queue[currentIndex]

  // When current unit changes, sync feedback textarea
  useEffect(() => {
    if (current) setFeedback(current.review_feedback || '')
  }, [current])

  const advance = useCallback(() => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      // queue done
      setCurrentIndex(queue.length) // out-of-bounds → finish screen
    }
  }, [currentIndex, queue.length])

  const goBack = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1)
  }, [currentIndex])

  const saveAndAdvance = useCallback(async (grade: ReviewGrade) => {
    if (!current || saving) return
    setSaving(true)
    try {
      const updated = await unitsApi.update(current.id, {
        review_grade: grade,
        review_feedback: feedback.trim() || null,
        reviewed_at: new Date().toISOString(),
      } as any)
      // Update queue locally with new value (so back-navigation shows latest)
      setQueue(prev => prev.map((u, i) => i === currentIndex ? updated : u))
      advance()
    } catch {
      toast.error('Ошибка сохранения')
    }
    setSaving(false)
  }, [current, feedback, saving, currentIndex, advance, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h1 className="text-2xl font-bold text-brand-text mb-3">Очередь пуста</h1>
        <p className="text-brand-text-secondary mb-6">
          Все идеи уже размечены. Чтобы переразметить, добавь к URL <code>?include=excellent,needs_work</code>.
        </p>
        <button onClick={() => navigate('/content-bank')} className="btn btn-primary">
          Назад на Контент-банк
        </button>
      </div>
    )
  }

  if (currentIndex >= queue.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h1 className="text-3xl font-bold text-brand-text mb-3">🎉 Готово</h1>
        <p className="text-brand-text-secondary mb-6">
          Размечено {queue.length} идей. Можешь экспортировать JSON для AI.
        </p>
        <button onClick={() => navigate('/content-bank')} className="btn btn-primary">
          Назад на Контент-банк
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-brand-text">
          Триаж: {currentIndex + 1} / {queue.length}
        </h1>
        <button
          onClick={() => navigate('/content-bank')}
          className="p-2 rounded-lg hover:bg-subtle text-brand-text-secondary"
          title="Закрыть (Esc)"
        >
          <X size={20} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-subtle rounded-full h-2 mb-6">
        <div
          className="bg-primary-500 h-2 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
        />
      </div>

      {/* Current unit */}
      <div className="flex-1 max-w-3xl mx-auto w-full space-y-4">
        <div className="flex items-center gap-3 text-sm text-brand-text-secondary">
          {current.rubric && (
            <span>
              {current.rubric.emoji} {current.rubric.title}
            </span>
          )}
          {current.complexity != null && (
            <span>· {COMPLEXITY_LABELS[current.complexity] || ''}</span>
          )}
          {current.review_grade && (
            <span className="ml-auto">
              Текущая оценка: {REVIEW_GRADE_LABELS[current.review_grade]}
            </span>
          )}
        </div>

        {current.hook && (
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Hook</label>
            <p className="text-xl font-semibold text-brand-text mt-1">{current.hook}</p>
          </div>
        )}
        {current.hook_ab && (
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Hook A/B</label>
            <p className="text-base text-brand-text mt-1">{current.hook_ab}</p>
          </div>
        )}
        {current.visual && (
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Визуал</label>
            <p className="text-sm text-brand-text mt-1">{current.visual}</p>
          </div>
        )}
        {current.essence && (
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Суть</label>
            <p className="text-sm text-brand-text mt-1 whitespace-pre-line">{current.essence}</p>
          </div>
        )}
        {current.notes && (
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Заметки</label>
            <p className="text-sm text-brand-text-secondary mt-1 whitespace-pre-line">{current.notes}</p>
          </div>
        )}

        {/* Feedback textarea */}
        <div>
          <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
            Фидбек для AI
          </label>
          <textarea
            ref={textareaRef}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Почему эта идея получила такую оценку? Что бы ты улучшил?"
            className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-none"
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="max-w-3xl mx-auto w-full mt-6 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => saveAndAdvance('excellent')}
            disabled={saving}
            className="px-4 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 disabled:opacity-40"
          >
            ✅ 1 Отлично
          </button>
          <button
            onClick={() => saveAndAdvance('needs_work')}
            disabled={saving}
            className="px-4 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-40"
          >
            ⚠️ 2 Доработать
          </button>
          <button
            onClick={() => saveAndAdvance('rejected')}
            disabled={saving}
            className="px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 disabled:opacity-40"
          >
            ❌ 3 Отказ
          </button>
        </div>

        <div className="flex items-center justify-between text-sm text-brand-text-secondary">
          <button
            onClick={goBack}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 hover:text-brand-text disabled:opacity-40"
          >
            <ArrowLeft size={14} /> Назад
          </button>
          <span>{currentIndex + 1} / {queue.length}</span>
          <button
            onClick={advance}
            disabled={currentIndex >= queue.length - 1}
            className="flex items-center gap-1 hover:text-brand-text disabled:opacity-40"
          >
            Дальше <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2:** В `frontend/src/App.tsx` добавить:
```tsx
const ContentBankTriage = lazy(() => import('./pages/ContentBankTriage'))
```

И в Routes (рядом с `/content-bank`):
```tsx
<Route path="/content-bank/triage" element={<ContentBankTriage />} />
```

**Step 3:** Frontend typecheck clean.

**Step 4:** Smoke: открыть `/content-bank/triage` → загружается очередь. Кнопки сохраняют, переход к следующей. ← / → работают. Если очередь пуста — экран «Очередь пуста».

**Step 5:** Commit:
```bash
git add frontend/src/pages/ContentBankTriage.tsx frontend/src/App.tsx
git commit -m "feat(content-bank-v2): ContentBankTriage page — focus-view review with progress bar"
```

### Task 7.2: Hotkeys (1/2/3/Tab/Cmd+Enter/←→/Esc)

**Files:**
- Modify: `frontend/src/pages/ContentBankTriage.tsx`

**Step 1:** Добавить `useEffect` для keydown-listener'а (после остальных useEffect'ов):
```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    // Don't trigger 1/2/3 when typing in textarea (let user type "1" in feedback)
    const target = e.target as HTMLElement
    const isInTextarea = target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT'

    if (e.key === 'Escape') {
      e.preventDefault()
      navigate('/content-bank')
      return
    }

    if (e.key === 'ArrowLeft' && !isInTextarea) {
      e.preventDefault()
      goBack()
      return
    }
    if (e.key === 'ArrowRight' && !isInTextarea) {
      e.preventDefault()
      advance()
      return
    }

    if (e.key === 'Tab' && !isInTextarea) {
      e.preventDefault()
      textareaRef.current?.focus()
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isInTextarea) {
      // Save with current grade if already set, else default to 'excellent'
      e.preventDefault()
      const g = current?.review_grade || 'excellent'
      saveAndAdvance(g)
      return
    }

    if (!isInTextarea) {
      if (e.key === '1') { e.preventDefault(); saveAndAdvance('excellent') }
      else if (e.key === '2') { e.preventDefault(); saveAndAdvance('needs_work') }
      else if (e.key === '3') { e.preventDefault(); saveAndAdvance('rejected') }
    }
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [navigate, goBack, advance, saveAndAdvance, current])
```

**Step 2:** Smoke: тестировать `1/2/3` — оценка ставится. `←`/`→` — навигация. `Tab` — фокус в textarea. `Cmd+Enter` в textarea — сохранение и переход. `Esc` — закрытие.

**Step 3:** Commit:
```bash
git add frontend/src/pages/ContentBankTriage.tsx
git commit -m "feat(content-bank-v2): triage hotkeys — 1/2/3 grades, Tab/Cmd+Enter feedback, ←→ nav, Esc close"
```

---

## Stage 8 — Frontend: ImportJsonModal

### Task 8.1: ImportJsonModal component

**Files:**
- Create: `frontend/src/components/content-bank/ImportJsonModal.tsx`

Three steps in one modal (как `BankImportModal`): Upload → Preview → Done.

```tsx
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, FileJson, Loader2, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import {
  unitsApi,
  ImportPreviewResponse,
  ImportCommitResponse,
} from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  onClose: () => void
}

type Step = 'upload' | 'preview' | 'done'

export default function ImportJsonModal({ onClose }: Props) {
  const toast = useToast()
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [result, setResult] = useState<ImportCommitResponse | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      toast.warning('Поддерживаются только .json файлы')
      return
    }
    setLoading(true)
    try {
      const r = await unitsApi.importPreview(file)
      setPreview(r)
      setStep('preview')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка разбора файла')
    }
    setLoading(false)
  }

  const onCommit = async () => {
    if (!preview) return
    setLoading(true)
    try {
      const r = await unitsApi.importCommit(preview.preview_token)
      setResult(r)
      setStep('done')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка применения импорта')
    }
    setLoading(false)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={() => !loading && onClose()}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-border flex-shrink-0">
          <h3 className="text-lg font-bold text-brand-text">
            {step === 'upload' && 'Импорт JSON'}
            {step === 'preview' && 'Предпросмотр импорта'}
            {step === 'done' && 'Импорт завершён'}
          </h3>
          <button onClick={() => !loading && onClose()} disabled={loading}
                  className="p-2 hover:bg-subtle rounded-lg disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) onFileSelect(f)
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-brand-border rounded-xl p-12 text-center hover:border-primary-400 cursor-pointer"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onFileSelect(f)
                }}
              />
              {loading ? (
                <div className="space-y-2">
                  <Loader2 size={32} className="animate-spin mx-auto text-primary-500" />
                  <p className="text-brand-text-secondary">Разбор файла...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <FileJson size={32} className="text-primary-400 mx-auto" />
                  <p className="text-base font-medium text-brand-text">
                    Перетащи .json файл сюда
                  </p>
                  <p className="text-sm text-brand-text-secondary">или кликни для выбора</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-subtle rounded-xl p-4">
                  <p className="text-xs uppercase text-brand-text-secondary mb-2">📁 Рубрики</p>
                  <p className="text-sm text-brand-text">
                    <span className="font-bold text-green-700">{preview.rubrics.to_create}</span> новых,{' '}
                    <span className="text-brand-text-secondary">{preview.rubrics.to_skip}</span> пропустим
                  </p>
                </div>
                <div className="bg-subtle rounded-xl p-4">
                  <p className="text-xs uppercase text-brand-text-secondary mb-2">📝 Идеи</p>
                  <p className="text-sm text-brand-text">
                    <span className="font-bold text-green-700">{preview.units.to_insert}</span> новых,{' '}
                    <span className="font-bold text-amber-700">{preview.units.to_update}</span> обновим,{' '}
                    <span className="text-brand-text-secondary">{preview.units.to_skip_duplicate}</span> дублей
                  </p>
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                    <AlertTriangle size={14} /> Предупреждения:
                  </p>
                  {preview.warnings.slice(0, 5).map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">{w}</p>
                  ))}
                  {preview.warnings.length > 5 && (
                    <p className="text-xs text-amber-700">…и ещё {preview.warnings.length - 5}</p>
                  )}
                </div>
              )}

              {preview.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                    <AlertCircle size={14} /> Ошибки:
                  </p>
                  {preview.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-red-700">{e}</p>
                  ))}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                ⚠️ ОБНОВЛЕНИЕ перезапишет: <code>hook</code>, <code>hook_ab</code>, <code>visual</code>, <code>essence</code>, <code>notes</code>, <code>video_url</code>, <code>publications</code>.
                НЕ перезапишет: <code>review_grade</code>, <code>review_feedback</code>, <code>reviewed_at</code>, <code>created_*</code>.
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 'done' && result && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle size={48} className="text-green-500 mx-auto" />
              <h4 className="text-lg font-bold text-brand-text">Импорт завершён</h4>
              <div className="text-sm text-brand-text-secondary space-y-1">
                <p>Рубрики: создано <strong className="text-green-700">{result.rubrics.created}</strong>, пропущено {result.rubrics.skipped}</p>
                <p>Идеи: вставлено <strong className="text-green-700">{result.units.inserted}</strong>, обновлено <strong className="text-amber-700">{result.units.updated}</strong>, пропущено {result.units.skipped}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-brand-border flex-shrink-0">
          {step === 'upload' && (
            <button onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Закрыть
            </button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={onClose} className="btn btn-secondary" disabled={loading}>
                Отмена
              </button>
              <button
                onClick={onCommit}
                disabled={loading || preview!.errors.length > 0 || (preview!.units.to_insert + preview!.units.to_update === 0)}
                className="btn btn-primary flex items-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Импортировать ✓
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose} className="btn btn-primary">Закрыть</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

**Step 2:** Если в Stage 6 был закомментирован import + render — раскомментировать.

**Step 3:** Frontend typecheck clean.

**Step 4:** Smoke: на странице `/content-bank` нажать «Импорт» → откроется модалка → drop .json файла → preview-stats → клик «Импортировать» → done-экран → закрыть → таблица обновилась.

**Step 5:** Commit:
```bash
git add frontend/src/components/content-bank/ImportJsonModal.tsx frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank-v2): ImportJsonModal — upload → preview → commit flow"
```

---

## Stage 9 — Migration & deploy

### Task 9.1: Final typecheck + build

**Step 1:**
```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit && npm run build
```
Expected: clean (или только pre-existing errors в посторонних файлах).

### Task 9.2: Apply migration on Supabase

Через Supabase MCP `apply_migration`:
- project_id: `jubkezbvccwvujregkfq`
- name: `content_bank_review_2026_05_08`
- query: SQL из `backend/src/migrations/2026-05-08-content-bank-review.sql` (без `BEGIN`/`COMMIT` — обёртки сделает сам MCP)

Verify через `execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='content_units'
  AND column_name IN ('review_grade','review_feedback','reviewed_at');
```
Expected: 3 строки.

### Task 9.3: Merge feat/content-bank-v2 → main

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka
git checkout main
git merge --ff-only feat/content-bank-v2
```

### Task 9.4: Push в оба remote'а

```bash
git push origin main          # Railway бэк
git push vercel-deploy main   # Vercel фронт
```

### Task 9.5: Smoke на проде

После ~2-3 мин (Vercel + Railway деплои):
1. **Hard refresh** `https://erp.ximi4ka.ru/content-bank`
2. В шапке появились кнопки «Триаж (95)» / «Импорт» / «Экспорт» (счётчик 95 потому что все unfilled)
3. **Нажать «Триаж»** → открывается focus-view с первой идеей. Нажать `1` → ставится excellent + следующая идея. Cmd+Enter в textarea → сохраняет с фидбеком.
4. **Назад на /content-bank** → пятый ряд фильтров «Оценка», клик «✅ отлично» → отфильтрованная таблица.
5. **Нажать «Экспорт»** → загружается `content-bank-export-*.json`. Открыть, проверить структуру: `meta.filters_applied.review_grade='excellent'`, в `units` — только excellent.
6. **Нажать «Импорт»** → drop тот же файл (или его модификация) → preview покажет все юниты как duplicates (т.к. id совпадают, `existing_id` найден, action='update'). Можно «Импортировать» — обновит существующие, при этом review_grade/feedback не перезапишутся, потому что upsert защитил их.

Если хоть что-то сломано — fix и push hotfix.

---

## Completion Criteria

- ✅ ~13 коммитов, все на `feat/content-bank-v2`, мерджнуты в main
- ✅ Backend и frontend typecheck clean
- ✅ Миграция накатана на проде, 3 новые колонки + 2 индекса
- ✅ erp.ximi4ka.ru/content-bank работает: Триаж, Импорт, Экспорт, фильтр по оценке
- ✅ AI получает корректный JSON с метками + не может перезаписать review_* при upsert
- ✅ Hotkeys в Триаже работают
