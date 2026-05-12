# Marketing Unit — Phase E (Metrics + Analytics) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** ✅ Phase E complete on 2026-05-12. End of Marketing-юнита MVP. Next: реальная эксплуатация + Phase F (auto-metrics через MTProto или scraper, если нужно).

**Goal:** Закрыть аналитическую петлю маркетинг-юнита: per-publication `content_metric_snapshot` через UI manual entry для всех каналов, агрегирующая страница `/marketing/analytics` с фильтрами и срезами, + два carryover-фикса из Phase D (`publisher_log` badge, `trimChatId` для `@username`).

**Architecture:** `content_metric_snapshot` JSONB-таблица существует с Phase A. Backend CRUD + один аналитический endpoint с LATERAL-join (берёт «последний снимок per publication»). UI: модалка manual-ввода метрик из `PublicationsEditor` (кнопка «Обновить метрики» на строке публикации) + новая страница `/marketing/analytics` с фильтрами по 5 dimensions × 7 метрикам, рендерится в табличном виде. Никакого auto-collect (см. PRD scope correction внизу).

**Tech Stack:** Express + TypeORM (raw SQL для аналитики через `AppDataSource.query`), React 18 + TS + Tailwind. Без новых backend-зависимостей. На фронте — никаких chart-библиотек на v1: чистая таблица + sorted columns.

**Parent docs:**
- [Operating model](2026-05-11-marketing-unit-operating-model-design.md) §3 (модус K)
- [Content production PRD](2026-05-11-content-production-prd-design.md) §4.5 (`content_metric_snapshot` schema), §8 Phase E
- [Phase A](2026-05-11-marketing-phase-a-foundation.md) — `content_metric_snapshot` table создана.
- [Phase D](2026-05-12-marketing-phase-d-telegram-publisher.md) — Telegram publisher работает; carryover items закроем тут.

---

## ⚠ Scope correction — почему manual вместо auto-Telegram

Operating-model doc обещал «Telegram-метрики собираются автоматически фоновым воркером». При ближайшем рассмотрении:

- **Bot API НЕ возвращает views** в `Message` объекте после `sendMessage`.
- Бот **не может задним числом** запросить views своих постов (требует MTProto user-API, что = тяжёлая dependency `gramjs`/`telegram` + management сессии + другие ToS).
- Bot API даёт `views` только в `channel_post`/`edited_channel_post` webhook updates, **не покрывает посты отправленные через `sendMessage`**.

Поэтому v1 = manual entry для ВСЕХ каналов. Auto-collect — отдельная фаза F+ (либо MTProto, либо external scraper, либо webhook bridge). PRD-обещание пересмотрено.

---

## Pre-flight checklist

1. На main + актуальная схема:
   ```bash
   cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/.claude/worktrees/confident-tesla-8e46b9
   git fetch origin && git merge --ff-only origin/main
   ```
2. Baseline компилируется:
   ```bash
   cd backend && npx tsc --noEmit && npm run build && cd ..
   cd frontend && npm run build && cd ..
   ```
   Всё — exit 0.
3. БД `content_metric_snapshot` существует и пустая (или содержит ранее введённые снимки):
   ```bash
   set -a && source backend/.env && set +a
   psql "$DATABASE_URL" -c "SELECT count(*) FROM content_metric_snapshot;"
   ```
   Просто sanity check — pre-existing rows не блокируют ничего.

---

## Architectural decisions (read before any task)

### Metric snapshot data shape

Запись = один cumulative snapshot в момент времени `captured_at`. Поля (из Phase A schema):

```
publication_id          UUID FK
captured_at             timestamptz default now()
captured_by             'worker' | 'manual'   (CHECK constraint)
views                   int NULL
likes                   int NULL
comments                int NULL
shares                  int NULL
saves                   int NULL
profile_clicks          int NULL
marketplace_clicks      int NULL
raw_json                jsonb NULL
```

Operator вводит то, что знает (например, в TikTok нет saves; в Telegram только views). Поля nullable — пустые не записываются.

### Aggregation query design

В `/marketing/analytics` оператор выбирает:
- **Группировка** (`group_by`): одна из `content_type`, `channel_id`, `rubric_id`, `target_segment_id`, `theme_id` (5 dimensions).
- **Фильтры** (необязательные): `content_type`, `channel_id`, `rubric_id`, `target_segment_id`, `theme_id`, `period_start`, `period_end` (`published_at` в этом окне).
- **Период**: задаёт окно `published_at BETWEEN period_start AND period_end`.

Query (raw SQL, через `AppDataSource.query`):

```sql
WITH latest_snapshot AS (
  SELECT DISTINCT ON (publication_id)
    publication_id, views, likes, comments, shares, saves,
    profile_clicks, marketplace_clicks, captured_at
  FROM content_metric_snapshot
  ORDER BY publication_id, captured_at DESC
)
SELECT
  <dim_column> AS group_key,
  COUNT(DISTINCT pub.id) AS publications,
  COALESCE(SUM(ls.views), 0)::int AS views,
  COALESCE(SUM(ls.likes), 0)::int AS likes,
  COALESCE(SUM(ls.comments), 0)::int AS comments,
  COALESCE(SUM(ls.shares), 0)::int AS shares,
  COALESCE(SUM(ls.saves), 0)::int AS saves,
  COALESCE(SUM(ls.profile_clicks), 0)::int AS profile_clicks,
  COALESCE(SUM(ls.marketplace_clicks), 0)::int AS marketplace_clicks
FROM content_publications pub
LEFT JOIN latest_snapshot ls ON ls.publication_id = pub.id
LEFT JOIN content_units u ON u.id = pub.content_unit_id
LEFT JOIN channel ch ON ch.id = pub.channel_id
WHERE 1=1
  AND ($1::text IS NULL OR u.content_type = $1)       -- filter: content_type
  AND ($2::uuid IS NULL OR pub.channel_id = $2)        -- filter: channel_id
  AND ($3::uuid IS NULL OR u.rubric_id = $3)           -- filter: rubric_id
  AND ($4::uuid IS NULL OR u.target_segment_id = $4)   -- filter: segment
  AND ($5::uuid IS NULL OR u.theme_id = $5)            -- filter: theme
  AND ($6::timestamptz IS NULL OR pub.published_at >= $6)
  AND ($7::timestamptz IS NULL OR pub.published_at <= $7)
GROUP BY <dim_column>
ORDER BY publications DESC, views DESC NULLS LAST;
```

`<dim_column>` подставляется backend-ом из whitelist `{ content_type: 'u.content_type', channel_id: 'pub.channel_id', rubric_id: 'u.rubric_id', target_segment_id: 'u.target_segment_id', theme_id: 'u.theme_id' }`. Если параметр не в whitelist → 400.

Возвращаемый JSON: `[{ group_key, publications, views, likes, comments, shares, saves, profile_clicks, marketplace_clicks }]`. Frontend сам резолвит `group_key` UUID-ы в человекочитаемые имена (загрузив списки сегментов/тем/рубрик/каналов отдельно).

### `MetricsModal` UX

Модалка открывается из `PublicationsEditor` row. Поля:
- 7 числовых input-ов (views, likes, ..., marketplace_clicks) — все опциональные.
- `captured_at` date-time input (default = сейчас).
- Кнопка «Сохранить снимок» → POST `/api/content-metric-snapshots`.
- Под формой — компактная таблица «История снимков» этой публикации (последние 5).

### Latest-snapshot inline в `PublicationsEditor`

Под каждой публикацией показываем компактный summary: «👁 1.2K  ❤️ 45  💬 8  📅 от 5 мая» (если snapshot есть). Если нет — «Метрики не введены».

### `/marketing/analytics` UX

Top: фильтр-бар (group_by select + 5 фильтр-select-ов + period_start/end). Под ним — таблица с колонками: `group_label`, `publications`, `views`, `likes`, `comments`, `shares`, `saves`, `profile_clicks`, `marketplace_clicks`. Сортировка по столбцам клик.

### Phase D carryover fixes

1. **publisher_log badge в PublicationsEditor**: если `pub.publisher_log?.gave_up === true` → красный badge «❌ Авто-публикация остановлена: <last_error>». Если `pub.publisher_log?.attempts > 0 && !pub.publisher_log?.success` → жёлтый «⚠ Попыток: N».
2. **`trimChatId` для `@username`**: если `chat_id` начинается с `@`, URL → `https://t.me/{username}/{msg_id}` (без `/c/`).

### Phase E НЕ делает

- Auto-collect метрик из любых API.
- Графики и chart-визуализации (только табличный вид).
- Time-series (snapshots over time per publication chart) — UI shows latest only.
- Drilldown — нельзя кликнуть на ряд аналитики и увидеть составляющие публикации. Defer.
- Export to CSV/Excel — defer.
- Per-user analytics views (saved filters) — defer.
- Push notifications когда метрики обновлены — defer.
- Drop `network` column — отдельный план после всех Phase E проверок.

---

## Tasks

### Task 1 — Backend: `content_metric_snapshot` CRUD + analytics endpoint

**Files:**
- Create: `backend/src/controllers/content-metric-snapshot.controller.ts`
- Create: `backend/src/routes/content-metric-snapshot.routes.ts`
- Modify: `backend/src/server.ts` (mount route + analytics route)

**Step 1: Write CRUD controller**

```typescript
// backend/src/controllers/content-metric-snapshot.controller.ts
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentMetricSnapshot } from '../entities/ContentMetricSnapshot'

const repo = AppDataSource.getRepository(ContentMetricSnapshot)

const VALID_CAPTURED_BY = ['worker', 'manual'] as const

export const contentMetricSnapshotController = {
  async listByPublication(req: Request, res: Response) {
    try {
      const { publication_id } = req.query
      if (!publication_id || typeof publication_id !== 'string') {
        return res.status(400).json({ error: 'publication_id обязателен' })
      }
      const snapshots = await repo.find({
        where: { publication_id },
        order: { captured_at: 'DESC' },
        take: 50,
      })
      res.json(snapshots)
    } catch (error) {
      console.error('Ошибка получения снимков метрик:', error)
      res.status(500).json({ error: 'Ошибка получения снимков' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const body = req.body as Record<string, unknown>
      if (!body.publication_id || typeof body.publication_id !== 'string') {
        return res.status(400).json({ error: 'publication_id обязателен' })
      }
      if (body.captured_by !== undefined && !VALID_CAPTURED_BY.includes(body.captured_by as any)) {
        return res.status(400).json({ error: 'captured_by должен быть worker или manual' })
      }
      // Strip non-numeric values from metric fields
      const metricFields = ['views', 'likes', 'comments', 'shares', 'saves', 'profile_clicks', 'marketplace_clicks']
      for (const f of metricFields) {
        if (body[f] !== undefined && body[f] !== null && (typeof body[f] !== 'number' || !Number.isInteger(body[f]))) {
          return res.status(400).json({ error: `${f} должен быть целым числом или null` })
        }
      }
      const snapshot = repo.create({
        ...body,
        captured_by: (body.captured_by as 'worker' | 'manual') ?? 'manual',
      })
      const saved = await repo.save(snapshot)
      res.status(201).json(saved)
    } catch (error) {
      console.error('Ошибка сохранения снимка:', error)
      res.status(500).json({ error: 'Ошибка сохранения снимка' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await repo.delete(id)
      if (result.affected === 0) return res.status(404).json({ error: 'Снимок не найден' })
      res.json({ message: 'Снимок удалён' })
    } catch (error) {
      console.error('Ошибка удаления снимка:', error)
      res.status(500).json({ error: 'Ошибка удаления снимка' })
    }
  },

  async analytics(req: Request, res: Response) {
    try {
      const groupByMap: Record<string, string> = {
        content_type: 'u.content_type',
        channel_id: 'pub.channel_id',
        rubric_id: 'u.rubric_id',
        target_segment_id: 'u.target_segment_id',
        theme_id: 'u.theme_id',
      }
      const groupBy = String(req.query.group_by ?? 'content_type')
      const dimCol = groupByMap[groupBy]
      if (!dimCol) {
        return res.status(400).json({ error: `group_by должен быть одним из: ${Object.keys(groupByMap).join(', ')}` })
      }

      const params: Array<string | null> = [
        (req.query.content_type as string) || null,
        (req.query.channel_id as string) || null,
        (req.query.rubric_id as string) || null,
        (req.query.target_segment_id as string) || null,
        (req.query.theme_id as string) || null,
        (req.query.period_start as string) || null,
        (req.query.period_end as string) || null,
      ]

      const sql = `
        WITH latest_snapshot AS (
          SELECT DISTINCT ON (publication_id)
            publication_id, views, likes, comments, shares, saves,
            profile_clicks, marketplace_clicks
          FROM content_metric_snapshot
          ORDER BY publication_id, captured_at DESC
        )
        SELECT
          ${dimCol} AS group_key,
          COUNT(DISTINCT pub.id)::int AS publications,
          COALESCE(SUM(ls.views), 0)::int AS views,
          COALESCE(SUM(ls.likes), 0)::int AS likes,
          COALESCE(SUM(ls.comments), 0)::int AS comments,
          COALESCE(SUM(ls.shares), 0)::int AS shares,
          COALESCE(SUM(ls.saves), 0)::int AS saves,
          COALESCE(SUM(ls.profile_clicks), 0)::int AS profile_clicks,
          COALESCE(SUM(ls.marketplace_clicks), 0)::int AS marketplace_clicks
        FROM content_publications pub
        LEFT JOIN latest_snapshot ls ON ls.publication_id = pub.id
        LEFT JOIN content_units u ON u.id = pub.content_unit_id
        LEFT JOIN channel ch ON ch.id = pub.channel_id
        WHERE 1=1
          AND ($1::text IS NULL OR u.content_type = $1)
          AND ($2::uuid IS NULL OR pub.channel_id = $2)
          AND ($3::uuid IS NULL OR u.rubric_id = $3)
          AND ($4::uuid IS NULL OR u.target_segment_id = $4)
          AND ($5::uuid IS NULL OR u.theme_id = $5)
          AND ($6::timestamptz IS NULL OR pub.published_at >= $6)
          AND ($7::timestamptz IS NULL OR pub.published_at <= $7)
        GROUP BY ${dimCol}
        ORDER BY publications DESC, views DESC NULLS LAST
      `
      const rows = await AppDataSource.query(sql, params)
      res.json({ group_by: groupBy, rows })
    } catch (error) {
      console.error('Ошибка получения аналитики:', error)
      res.status(500).json({ error: 'Ошибка получения аналитики' })
    }
  },
}
```

**Step 2: Routes**

```typescript
// backend/src/routes/content-metric-snapshot.routes.ts
import { Router } from 'express'
import { contentMetricSnapshotController } from '../controllers/content-metric-snapshot.controller'

const router = Router()

router.get('/', contentMetricSnapshotController.listByPublication)
router.post('/', contentMetricSnapshotController.create)
router.delete('/:id', contentMetricSnapshotController.delete)
// Analytics endpoint — separate path; mount under /api/marketing/analytics in server.ts
export const analyticsHandler = contentMetricSnapshotController.analytics

export default router
```

**Step 3: Mount in `server.ts`**

Imports:
```typescript
import contentMetricSnapshotRoutes, { analyticsHandler } from './routes/content-metric-snapshot.routes';
```

После остальных `/api/...` mounts:
```typescript
app.use('/api/content-metric-snapshots', authMiddleware, contentMetricSnapshotRoutes);
app.get('/api/marketing/analytics', authMiddleware, analyticsHandler);
```

**Step 4: Typecheck + build**

```bash
cd backend && npx tsc --noEmit && npm run build && cd ..
```

**Step 5: Commit**

```bash
git add backend/src/controllers/content-metric-snapshot.controller.ts backend/src/routes/content-metric-snapshot.routes.ts backend/src/server.ts
git commit -m "feat(marketing-analytics): content_metric_snapshot CRUD + /api/marketing/analytics aggregation endpoint"
```

---

### Task 2 — Frontend types + API client

**Files:**
- Modify: `frontend/src/api/types.ts`
- Create: `frontend/src/api/metricSnapshots.ts`
- Create: `frontend/src/api/marketingAnalytics.ts`

**Step 1: Add types in `types.ts`**

В конец файла:

```typescript
// ─── Metrics + Analytics (Phase E) ──────────────────────────────────────────

export interface ContentMetricSnapshot {
  id: string
  publication_id: string
  captured_at: string
  captured_by: 'worker' | 'manual'
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  profile_clicks: number | null
  marketplace_clicks: number | null
  raw_json: Record<string, unknown> | null
}

export type AnalyticsGroupBy =
  | 'content_type'
  | 'channel_id'
  | 'rubric_id'
  | 'target_segment_id'
  | 'theme_id'

export interface AnalyticsRow {
  group_key: string | null
  publications: number
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  profile_clicks: number
  marketplace_clicks: number
}

export interface AnalyticsResponse {
  group_by: AnalyticsGroupBy
  rows: AnalyticsRow[]
}

export interface AnalyticsFilters {
  group_by?: AnalyticsGroupBy
  content_type?: string
  channel_id?: string
  rubric_id?: string
  target_segment_id?: string
  theme_id?: string
  period_start?: string  // ISO
  period_end?: string
}
```

**Step 2: Metric snapshots client**

```typescript
// frontend/src/api/metricSnapshots.ts
import { apiClient } from './client'
import type { ContentMetricSnapshot } from './types'

export const metricSnapshotsApi = {
  listByPublication: async (publicationId: string): Promise<ContentMetricSnapshot[]> => {
    const r = await apiClient.get<ContentMetricSnapshot[]>('/content-metric-snapshots', {
      params: { publication_id: publicationId },
    })
    return r.data
  },
  create: async (data: Partial<ContentMetricSnapshot>): Promise<ContentMetricSnapshot> => {
    const r = await apiClient.post<ContentMetricSnapshot>('/content-metric-snapshots', data)
    return r.data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/content-metric-snapshots/${id}`)
  },
}
```

**Step 3: Analytics client**

```typescript
// frontend/src/api/marketingAnalytics.ts
import { apiClient } from './client'
import type { AnalyticsFilters, AnalyticsResponse } from './types'

export const marketingAnalyticsApi = {
  fetch: async (filters: AnalyticsFilters): Promise<AnalyticsResponse> => {
    const r = await apiClient.get<AnalyticsResponse>('/marketing/analytics', { params: filters })
    return r.data
  },
}
```

**Step 4: Typecheck**

```bash
cd frontend && npx tsc --noEmit && cd ..
```

**Step 5: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/api/metricSnapshots.ts frontend/src/api/marketingAnalytics.ts
git commit -m "feat(frontend-api): metric snapshots + analytics types and clients"
```

---

### Task 3 — `MetricsModal` component

**Files:**
- Create: `frontend/src/components/content-bank/MetricsModal.tsx`

**Context:** Простая модалка manual entry. 7 числовых полей + history table.

**Step 1: Read existing modal patterns**

Перед написанием прочитай:
- `frontend/src/components/content-bank/UnitEditModal.tsx` — modal-shell convention (close on backdrop, header, body, footer).
- `frontend/src/contexts/ToastContext.tsx` — toast hook.

**Step 2: Write component**

```typescript
// frontend/src/components/content-bank/MetricsModal.tsx
import { useState, useEffect } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { metricSnapshotsApi } from '../../api/metricSnapshots'
import type { ContentMetricSnapshot } from '../../api/types'

interface Props {
  publicationId: string
  onClose: () => void
  /** Optional callback when a new snapshot is saved (to refresh parent list). */
  onSnapshotSaved?: (snapshot: ContentMetricSnapshot) => void
}

interface FormFields {
  views: string
  likes: string
  comments: string
  shares: string
  saves: string
  profile_clicks: string
  marketplace_clicks: string
}

const FIELD_LABELS: Record<keyof FormFields, string> = {
  views: 'Просмотры',
  likes: 'Лайки',
  comments: 'Комментарии',
  shares: 'Репосты',
  saves: 'Сохранения',
  profile_clicks: 'Переходы в профиль',
  marketplace_clicks: 'Клики на маркетплейс',
}

const EMPTY_FORM: FormFields = {
  views: '',
  likes: '',
  comments: '',
  shares: '',
  saves: '',
  profile_clicks: '',
  marketplace_clicks: '',
}

function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return String(e.response.data.error)
  return fallback
}

function parseIntOrNull(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

export function MetricsModal({ publicationId, onClose, onSnapshotSaved }: Props) {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [snapshots, setSnapshots] = useState<ContentMetricSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormFields>(EMPTY_FORM)
  const [capturedAt, setCapturedAt] = useState(() => new Date().toISOString().slice(0, 16))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    metricSnapshotsApi
      .listByPublication(publicationId)
      .then((data) => { if (!cancelled) { setSnapshots(data); setLoading(false) } })
      .catch((e) => {
        if (!cancelled) {
          setLoading(false)
          toast.error(errorMessage(e, 'Ошибка загрузки снимков'))
        }
      })
    return () => { cancelled = true }
  }, [publicationId])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const payload = {
        publication_id: publicationId,
        captured_at: new Date(capturedAt).toISOString(),
        captured_by: 'manual' as const,
        views: parseIntOrNull(form.views),
        likes: parseIntOrNull(form.likes),
        comments: parseIntOrNull(form.comments),
        shares: parseIntOrNull(form.shares),
        saves: parseIntOrNull(form.saves),
        profile_clicks: parseIntOrNull(form.profile_clicks),
        marketplace_clicks: parseIntOrNull(form.marketplace_clicks),
      }
      const saved = await metricSnapshotsApi.create(payload)
      setSnapshots([saved, ...snapshots])
      setForm(EMPTY_FORM)
      setCapturedAt(new Date().toISOString().slice(0, 16))
      toast.success('Снимок сохранён')
      onSnapshotSaved?.(saved)
    } catch (e) {
      toast.error(errorMessage(e, 'Ошибка сохранения'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Удалить снимок?',
      message: 'Это нельзя отменить.',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await metricSnapshotsApi.delete(id)
      setSnapshots(snapshots.filter((s) => s.id !== id))
      toast.success('Снимок удалён')
    } catch (e) {
      toast.error(errorMessage(e, 'Ошибка удаления'))
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-brand-text">Метрики публикации</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-text-secondary hover:text-brand-text"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Entry form */}
          <div className="space-y-3">
            <h3 className="font-semibold text-brand-text">Новый снимок</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-brand-text-secondary">Дата и время</span>
                <input
                  type="datetime-local"
                  className="input mt-1"
                  value={capturedAt}
                  onChange={(e) => setCapturedAt(e.target.value)}
                  aria-label="Дата и время снимка"
                />
              </label>
              {(Object.keys(FIELD_LABELS) as Array<keyof FormFields>).map((key) => (
                <label key={key} className="block">
                  <span className="text-xs text-brand-text-secondary">{FIELD_LABELS[key]}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="input mt-1"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    aria-label={FIELD_LABELS[key]}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary text-sm inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Сохранение...' : 'Сохранить снимок'}
            </button>
            <p className="text-xs text-brand-text-secondary">
              Снимки кумулятивные — введите текущие значения с платформы.
              Пустые поля означают «нет данных».
            </p>
          </div>

          {/* History */}
          <div className="space-y-2">
            <h3 className="font-semibold text-brand-text">История снимков</h3>
            {loading && <p className="text-sm text-brand-text-secondary">Загрузка…</p>}
            {!loading && snapshots.length === 0 && (
              <p className="text-sm text-brand-text-secondary">Снимков пока нет.</p>
            )}
            {!loading && snapshots.length > 0 && (
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-brand-text-secondary">
                    <tr>
                      <th className="px-2 py-1 text-left">Время</th>
                      <th className="px-2 py-1 text-right">👁</th>
                      <th className="px-2 py-1 text-right">❤️</th>
                      <th className="px-2 py-1 text-right">💬</th>
                      <th className="px-2 py-1 text-right">↗</th>
                      <th className="px-2 py-1 text-right">💾</th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="px-2 py-1 text-xs">
                          {new Date(s.captured_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                          <span className="ml-1 text-brand-text-secondary">({s.captured_by})</span>
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.views ?? '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.likes ?? '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.comments ?? '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.shares ?? '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.saves ?? '—'}</td>
                        <td className="px-2 py-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            className="text-red-600 hover:text-red-800"
                            aria-label="Удалить снимок"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button type="button" onClick={onClose} className="btn btn-secondary text-sm">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Typecheck + build**

```bash
cd frontend && npx tsc --noEmit && npm run build && cd ..
```

**Step 4: Commit**

```bash
git add frontend/src/components/content-bank/MetricsModal.tsx
git commit -m "feat(content-bank): MetricsModal for manual snapshot entry + history"
```

---

### Task 4 — `PublicationsEditor` integration: button + inline summary + publisher_log badge

**Files:**
- Modify: `frontend/src/components/content-bank/PublicationsEditor.tsx`

**Context:** Тройная задача:
1. Кнопка «Метрики» per row → открывает MetricsModal.
2. Inline summary последнего snapshot (вьюхи/лайки/время).
3. `publisher_log` badge (Phase D carryover): gave_up → красный; attempts>0 && !success → жёлтый.

**Step 1: Read existing PublicationsEditor**

```bash
cat frontend/src/components/content-bank/PublicationsEditor.tsx
```

Идентифицируй: state shape, row render, как обновляется одно поле.

**Step 2: Add state for modal + latest snapshots**

```typescript
import { metricSnapshotsApi } from '../../api/metricSnapshots'
import { MetricsModal } from './MetricsModal'
import type { ContentMetricSnapshot } from '../../api/types'

// inside component:
const [metricsModalFor, setMetricsModalFor] = useState<string | null>(null)
const [latestByPub, setLatestByPub] = useState<Record<string, ContentMetricSnapshot | null>>({})

// Load latest snapshot per publication on mount + when publications list changes
useEffect(() => {
  let cancelled = false
  const loadLatest = async () => {
    const result: Record<string, ContentMetricSnapshot | null> = {}
    for (const pub of publications) {
      try {
        const all = await metricSnapshotsApi.listByPublication(pub.id)
        result[pub.id] = all[0] ?? null  // first = latest (DESC by captured_at)
      } catch {
        result[pub.id] = null
      }
      if (cancelled) return
    }
    if (!cancelled) setLatestByPub(result)
  }
  if (publications.length > 0) loadLatest()
  return () => { cancelled = true }
}, [publications.map((p) => p.id).join(',')])
```

Note: фетч в loop последовательно — для 1-5 publications per unit это окей. Если рукав до батча необходим — Phase F.

**Step 3: Add "Метрики" button + inline summary in each row**

В row JSX (рядом с другими actions/inputs):

```typescript
{(() => {
  const latest = latestByPub[p.id]
  const formatN = (n: number | null | undefined) =>
    n == null ? '—' : new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(n)
  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={() => setMetricsModalFor(p.id)}
        className="btn btn-secondary text-xs"
        aria-label="Открыть метрики публикации"
      >
        📊 Метрики
      </button>
      {latest ? (
        <span className="text-brand-text-secondary">
          👁 {formatN(latest.views)} · ❤️ {formatN(latest.likes)} · 💬 {formatN(latest.comments)}
          {' · '}
          <span title={new Date(latest.captured_at).toLocaleString('ru-RU')}>
            {new Date(latest.captured_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
          </span>
        </span>
      ) : (
        <span className="text-brand-text-secondary">метрики не введены</span>
      )}
    </div>
  )
})()}
```

**Step 4: Add publisher_log badge in same row**

```typescript
{p.publisher_log && (() => {
  const log = p.publisher_log as { success?: boolean; gave_up?: boolean; attempts?: number; last_error?: string | null } | null
  if (!log) return null
  if (log.gave_up) {
    return (
      <span
        className="inline-block text-xs px-2 py-0.5 rounded bg-red-100 text-red-700"
        title={log.last_error ?? ''}
      >
        ❌ Авто-публикация остановлена
      </span>
    )
  }
  if ((log.attempts ?? 0) > 0 && !log.success) {
    return (
      <span
        className="inline-block text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700"
        title={log.last_error ?? ''}
      >
        ⚠ Попыток: {log.attempts}
      </span>
    )
  }
  return null
})()}
```

⚠ Frontend's `ContentPublication` type должен включать `publisher_log: Record<string, unknown> | null`. Проверь grep-ом; если нет — добавь.

**Step 5: Render modal**

В конец JSX (вне таблицы):

```typescript
{metricsModalFor && (
  <MetricsModal
    publicationId={metricsModalFor}
    onClose={() => setMetricsModalFor(null)}
    onSnapshotSaved={(snap) => {
      setLatestByPub((prev) => ({ ...prev, [snap.publication_id]: snap }))
    }}
  />
)}
```

**Step 6: Typecheck + build**

```bash
cd frontend && npx tsc --noEmit && npm run build && cd ..
```

**Step 7: Commit**

```bash
git add frontend/src/components/content-bank/PublicationsEditor.tsx frontend/src/api/contentBank.ts
git commit -m "feat(publications-editor): metrics button + inline summary + publisher_log badge"
```

---

### Task 5 — `/marketing/analytics` page

**Files:**
- Create: `frontend/src/pages/MarketingAnalytics.tsx`

**Context:** Страница с фильтр-баром + таблицей агрегатов. Загружает справочники (channels, rubrics, segments, themes) один раз для резолва UUID → human labels.

**Step 1: Read MarketingStrategy.tsx for layout patterns**

```bash
cat frontend/src/pages/MarketingStrategy.tsx | head -100
```

**Step 2: Write component**

```typescript
// frontend/src/pages/MarketingAnalytics.tsx
import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { BarChart3 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { marketingAnalyticsApi } from '../api/marketingAnalytics'
import { publishChannelsApi } from '../api/publishChannels'
import { icpSegmentsApi } from '../api/icpSegments'
import { strategicThemesApi } from '../api/strategicThemes'
import { rubricsApi } from '../api/contentBank'
import { CONTENT_TYPE_LABELS } from '../api/contentBank'
import type {
  AnalyticsGroupBy, AnalyticsRow, AnalyticsResponse, AnalyticsFilters,
  PublishChannel, IcpSegment, StrategicTheme, ContentRubric,
} from '../api/types'

const GROUP_BY_LABELS: Record<AnalyticsGroupBy, string> = {
  content_type: 'Тип контента',
  channel_id: 'Канал',
  rubric_id: 'Рубрика',
  target_segment_id: 'ICP-сегмент',
  theme_id: 'Тема',
}

function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return String(e.response.data.error)
  return fallback
}

export default function MarketingAnalytics() {
  const toast = useToast()
  const [filters, setFilters] = useState<AnalyticsFilters>({ group_by: 'content_type' })
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const [channels, setChannels] = useState<PublishChannel[]>([])
  const [segments, setSegments] = useState<IcpSegment[]>([])
  const [themes, setThemes] = useState<StrategicTheme[]>([])
  const [rubrics, setRubrics] = useState<ContentRubric[]>([])

  // Load dictionaries once
  useEffect(() => {
    Promise.all([
      publishChannelsApi.getAll(),
      icpSegmentsApi.getAll(),
      strategicThemesApi.getAll(),
      rubricsApi.getAll(),
    ]).then(([ch, sg, th, ru]) => {
      setChannels(ch); setSegments(sg); setThemes(th); setRubrics(ru)
    }).catch((e) => toast.error(errorMessage(e, 'Ошибка загрузки справочников')))
  }, [])

  // Fetch analytics on filter change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    marketingAnalyticsApi.fetch(filters)
      .then((r) => { if (!cancelled) { setData(r); setLoading(false) } })
      .catch((e) => {
        if (!cancelled) {
          setLoading(false)
          toast.error(errorMessage(e, 'Ошибка загрузки аналитики'))
        }
      })
    return () => { cancelled = true }
  }, [JSON.stringify(filters)])

  // Resolver: group_key → human label
  const labelForGroup = useMemo(() => {
    return (key: string | null): string => {
      if (!key) return '— не задано —'
      switch (filters.group_by) {
        case 'content_type':
          return CONTENT_TYPE_LABELS[key as keyof typeof CONTENT_TYPE_LABELS] ?? key
        case 'channel_id':
          return channels.find((c) => c.id === key)?.display_name ?? key.slice(0, 8)
        case 'rubric_id':
          return rubrics.find((r) => r.id === key)?.title ?? key.slice(0, 8)
        case 'target_segment_id':
          return segments.find((s) => s.id === key)?.name ?? key.slice(0, 8)
        case 'theme_id':
          return themes.find((t) => t.id === key)?.name ?? key.slice(0, 8)
        default:
          return key
      }
    }
  }, [filters.group_by, channels, rubrics, segments, themes])

  const totalPublications = data?.rows.reduce((s, r) => s + r.publications, 0) ?? 0
  const totalViews = data?.rows.reduce((s, r) => s + r.views, 0) ?? 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-brand-text">Маркетинг-аналитика</h1>
        </div>
        <p className="text-sm text-brand-text-secondary">
          Per-publication метрики, агрегированные по выбранному измерению. Снимки обновляются вручную из «Метрики» в карточке публикации.
        </p>
      </header>

      {/* Filter bar */}
      <div className="card p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs text-brand-text-secondary">Группировка</span>
          <select
            className="input mt-1"
            value={filters.group_by ?? 'content_type'}
            onChange={(e) => setFilters({ ...filters, group_by: e.target.value as AnalyticsGroupBy })}
            aria-label="Группировка"
          >
            {(Object.entries(GROUP_BY_LABELS) as Array<[AnalyticsGroupBy, string]>).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Тип контента (фильтр)</span>
          <select
            className="input mt-1"
            value={filters.content_type ?? ''}
            onChange={(e) => setFilters({ ...filters, content_type: e.target.value || undefined })}
            aria-label="Фильтр: тип контента"
          >
            <option value="">— все —</option>
            {(Object.entries(CONTENT_TYPE_LABELS) as Array<[string, string]>).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Канал (фильтр)</span>
          <select
            className="input mt-1"
            value={filters.channel_id ?? ''}
            onChange={(e) => setFilters({ ...filters, channel_id: e.target.value || undefined })}
            aria-label="Фильтр: канал"
          >
            <option value="">— все —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>{c.display_name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Рубрика (фильтр)</span>
          <select
            className="input mt-1"
            value={filters.rubric_id ?? ''}
            onChange={(e) => setFilters({ ...filters, rubric_id: e.target.value || undefined })}
            aria-label="Фильтр: рубрика"
          >
            <option value="">— все —</option>
            {rubrics.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">ICP-сегмент (фильтр)</span>
          <select
            className="input mt-1"
            value={filters.target_segment_id ?? ''}
            onChange={(e) => setFilters({ ...filters, target_segment_id: e.target.value || undefined })}
            aria-label="Фильтр: ICP-сегмент"
          >
            <option value="">— все —</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Тема (фильтр)</span>
          <select
            className="input mt-1"
            value={filters.theme_id ?? ''}
            onChange={(e) => setFilters({ ...filters, theme_id: e.target.value || undefined })}
            aria-label="Фильтр: тема"
          >
            <option value="">— все —</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Период с</span>
          <input
            type="date"
            className="input mt-1"
            value={filters.period_start?.slice(0, 10) ?? ''}
            onChange={(e) => setFilters({
              ...filters,
              period_start: e.target.value ? new Date(e.target.value).toISOString() : undefined,
            })}
            aria-label="Период с"
          />
        </label>

        <label className="block">
          <span className="text-xs text-brand-text-secondary">Период по</span>
          <input
            type="date"
            className="input mt-1"
            value={filters.period_end?.slice(0, 10) ?? ''}
            onChange={(e) => setFilters({
              ...filters,
              period_end: e.target.value ? new Date(e.target.value).toISOString() : undefined,
            })}
            aria-label="Период по"
          />
        </label>

        <button
          type="button"
          onClick={() => setFilters({ group_by: filters.group_by ?? 'content_type' })}
          className="btn btn-secondary self-end text-sm"
        >
          Сбросить фильтры
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card p-3">
          <div className="text-xs text-brand-text-secondary">Публикаций</div>
          <div className="text-2xl font-bold text-brand-text tabular-nums">{totalPublications}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-brand-text-secondary">Просмотров (сумма)</div>
          <div className="text-2xl font-bold text-brand-text tabular-nums">
            {new Intl.NumberFormat('ru-RU').format(totalViews)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-brand-text-secondary">Группировка</div>
          <div className="text-lg font-semibold text-brand-text">
            {GROUP_BY_LABELS[filters.group_by ?? 'content_type']}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-brand-text-secondary">Срезов</div>
          <div className="text-2xl font-bold text-brand-text tabular-nums">{data?.rows.length ?? 0}</div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading && <p className="p-4 text-sm text-brand-text-secondary">Загрузка…</p>}
        {!loading && (data?.rows.length ?? 0) === 0 && (
          <p className="p-4 text-sm text-brand-text-secondary">
            Нет данных для выбранных фильтров. Введи снимки метрик в «Метрики» на публикациях.
          </p>
        )}
        {!loading && (data?.rows.length ?? 0) > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-brand-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">{GROUP_BY_LABELS[filters.group_by ?? 'content_type']}</th>
                <th className="px-3 py-2 text-right">Публикаций</th>
                <th className="px-3 py-2 text-right">👁</th>
                <th className="px-3 py-2 text-right">❤️</th>
                <th className="px-3 py-2 text-right">💬</th>
                <th className="px-3 py-2 text-right">↗</th>
                <th className="px-3 py-2 text-right">💾</th>
                <th className="px-3 py-2 text-right">→ Профиль</th>
                <th className="px-3 py-2 text-right">→ Маркет</th>
              </tr>
            </thead>
            <tbody>
              {data!.rows.map((r) => (
                <tr key={r.group_key ?? '__null__'} className="border-t">
                  <td className="px-3 py-2">{labelForGroup(r.group_key)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.publications}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.views}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.likes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.comments}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.shares}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.saves}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.profile_clicks}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.marketplace_clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Typecheck + build**

```bash
cd frontend && npx tsc --noEmit && npm run build && cd ..
```

**Step 4: Commit**

```bash
git add frontend/src/pages/MarketingAnalytics.tsx
git commit -m "feat(frontend): MarketingAnalytics (/marketing/analytics) page with filter bar + group-by table"
```

---

### Task 6 — Routing + sidebar wiring

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: App.tsx lazy import + route**

После существующих lazy-import-ов:
```typescript
const MarketingAnalytics = lazy(() => import('./pages/MarketingAnalytics'))
```

В `<Routes>`:
```typescript
<Route path="/marketing/analytics" element={<MarketingAnalytics />} />
```

**Step 2: Layout.tsx — add Аналитика к «Маркетинг» group**

Найди nav-group `id: 'marketing'` (создан в Phase B). После «Войсовер» добавь:

```typescript
{ type: 'link', name: 'Аналитика', href: '/marketing/analytics', icon: IconMarketing },
```

(или другая иконка — например `IconReports` если хочешь визуально отделить).

**Step 3: Typecheck + build**

```bash
cd frontend && npx tsc --noEmit && npm run build && cd ..
```

**Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(frontend-routing): /marketing/analytics route + sidebar entry"
```

---

### Task 7 — `trimChatId` fix для `@username` (Phase D carryover)

**Files:**
- Modify: `backend/src/services/publishers/telegram-publisher.ts`

**Step 1: Replace `trimChatId` logic**

Текущий код:
```typescript
function trimChatId(chatId: string): string {
  const s = String(chatId)
  if (s.startsWith('-100')) return s.substring(4)
  if (s.startsWith('-')) return s.substring(1)
  return s
}
```

Замени на функцию, которая возвращает full URL (а не только ID), потому что формат URL различается для private/public:

```typescript
function buildMessageUrl(chatId: string, messageId: number): string {
  const s = String(chatId)
  // Public channel: chat_id starts with '@' → https://t.me/{username}/{msg_id}
  if (s.startsWith('@')) {
    return `https://t.me/${s.slice(1)}/${messageId}`
  }
  // Private channel: chat_id is numeric, starts with '-100' → https://t.me/c/{stripped}/{msg_id}
  if (s.startsWith('-100')) {
    return `https://t.me/c/${s.substring(4)}/${messageId}`
  }
  // Generic negative (legacy supergroups): fallback to /c/
  if (s.startsWith('-')) {
    return `https://t.me/c/${s.substring(1)}/${messageId}`
  }
  // Positive numeric (1-on-1 chat) — no public URL; return null wrapped
  return `https://t.me/c/${s}/${messageId}`
}
```

В `publish()`, замени:
```typescript
const trimmed = trimChatId(String(chatId))
const url = `https://t.me/c/${trimmed}/${msg.message_id}`
```

на:
```typescript
const url = buildMessageUrl(String(chatId), msg.message_id)
```

И удали `trimChatId` (теперь unused).

**Step 2: Typecheck + build**

```bash
cd backend && npx tsc --noEmit && npm run build && cd ..
```

**Step 3: Commit**

```bash
git add backend/src/services/publishers/telegram-publisher.ts
git commit -m "fix(telegram-publisher): correct URL for @username public channels"
```

---

### Task 8 — Smoke + mark complete + push

**Step 1: Full builds**

```bash
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
```
Оба — exit 0.

**Step 2: DB sanity**

```bash
set -a && source backend/.env && set +a
psql "$DATABASE_URL" -c "SELECT count(*) FROM content_metric_snapshot;"
psql "$DATABASE_URL" -c "SELECT 1 FROM information_schema.routines WHERE routine_name LIKE '%metric%' LIMIT 1;" # just ensure table exists
```

**Step 3: Mark Phase E complete in plan header**

```
**Status:** ✅ Phase E complete on YYYY-MM-DD. End of Marketing-юнита MVP. Next: реальная эксплуатация + Phase F (auto-metrics через MTProto или scraper, если нужно).
```

```bash
git add docs/plans/2026-05-12-marketing-phase-e-metrics-analytics.md
git commit -m "docs(plans): mark marketing phase E complete"
```

**Step 4: Push both remotes**

```bash
git push origin HEAD
git push vercel-deploy HEAD
```

---

## Post-Phase-E — что должно быть

- Backend endpoints: `GET /api/content-metric-snapshots?publication_id=...`, `POST /api/content-metric-snapshots`, `DELETE /api/content-metric-snapshots/:id`, `GET /api/marketing/analytics`.
- Frontend: `MetricsModal` для manual entry; `PublicationsEditor` показывает кнопку «Метрики» + inline summary + publisher_log badge; `/marketing/analytics` страница с filter bar + aggregations table.
- `trimChatId` обработан для `@username` каналов.
- TypeScript-сборки чистые.
- Phase A schema (`content_metric_snapshot`) полноценно используется.

## Что НЕ сделано в Phase E

- Auto-collect метрик из Telegram / TikTok / Instagram / etc.
- Графики, charts, time-series visualization.
- Drilldown (нельзя кликнуть на ряд → увидеть составляющие).
- Export CSV / Excel.
- Saved analytics views per user.
- Push-уведомления когда снимки введены.
- Drop legacy `network` column из `content_publications` — отдельный план.

## Open questions

- Operator-experience при пустых данных: текущий empty-state «Нет данных для выбранных фильтров» окей? Или нужен onboarding-tour (создай канал → опубликуй → введи метрики → смотри analytics)?
- Не превышает ли LATERAL `DISTINCT ON` performance ceiling при росте snapshots до 10k+? Скорее всего ОК на индексах `publication_id + captured_at DESC`. Можно добавить explicit index если станет медленно.
- Drilldown в Phase F: клик на row → показать список публикаций. Полезно?

## Anti-pitfalls

- **`DISTINCT ON (publication_id) ... ORDER BY publication_id, captured_at DESC`** — это правильная PG-идиома для «latest snapshot per group». Без `ORDER BY` внутри `DISTINCT ON` PG может вернуть случайную запись (warning).
- **PublicationsEditor latest-snapshot fetch in loop** — N+1, но N≤5 в худшем случае per unit. Acceptable. Если pages с 50+ publications появятся — нужен batch endpoint `GET /api/content-metric-snapshots/latest?publication_ids=...,...`.
- **`captured_at` input type=datetime-local** — браузер локального time-zone. Convert via `new Date(value).toISOString()` чтобы сохранить как UTC. Тогда `captured_at` всегда корректен. Frontend resolve обратно через `toLocaleString('ru-RU')`.
- **Aggregation sums NULL → 0** — `COALESCE(SUM(...), 0)` это сознательное решение: пустое поле = «нет данных», а не «0». Если хочется отличать в UI — добавь side-channel `views_known: bool` (через `COUNT(views) > 0`). Defer.
- **publisher_log JSONB read on frontend** — типизировать аккуратно: `as Record<string, unknown>` + сужение через checks. Чтобы не было `any`-leak.
- **`PUBLISHER_LOG` cast в Type system** — frontend `ContentPublication` type должен включать `publisher_log: Record<string, unknown> | null`. Если ещё нет — добавь в Task 4.
