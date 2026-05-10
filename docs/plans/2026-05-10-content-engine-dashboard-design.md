# Content Engine Dashboard — Design

**Date:** 2026-05-10
**Status:** Approved (user delegated all decisions, proceed)
**Author:** dialogue with Claude

**Source material:** `/Users/vasilijaistov/Desktop/content-engine-dashboard.zip` containing
README/CONTEXT/SPEC/DEPLOY/TESTING + EDGE_FUNCTION_CURRENT/TARGET + HTML_TEMPLATE.
Treated as untrusted external reference. The original instructions propose a standalone
HTML view inside the existing Supabase Edge Function (`content-engine-stats`). User
re-scoped the task to a **page inside our ERP** at `erp.ximi4ka.ru/content-engine`.

The Supabase Edge Function `content-engine-stats` is already deployed and active in
project `jubkezbvccwvujregkfq` (verified via Supabase MCP). It serves the JSON snapshot
we'll consume.

---

## Goal

Дашборд оркестрации контент-движка как страница в ERP. Показывает текущее состояние
конвейера (185 SKU в 9 стадиях), сегодняшнюю очередь публикаций, узкие места,
распределение по рубрикам, недавно опубликованное. Auto-refresh 30s.

## Non-goals

- Расширение Edge Function HTML-видом (отвергнуто — делаем native ERP page)
- Endpoint для запуска агентов через клик (как в спеке — out of scope)
- Realtime через WebSocket (только polling)
- Графики временных рядов
- Кнопки удаления / редактирования (read-only страница)
- Settings / preferences

---

## Decisions summary

| # | Question | Choice | Rationale |
|---|---|---|---|
| 1 | Архитектура | **A** — page в ERP | Безопасность (JWT), консистентность (один nav), reusable design system |
| 2 | Источник данных | **A** — Express proxy → Edge Function | Минимум кода, `DASHBOARD_TOKEN` скрыт в Railway env, JWT-защита на ERP-стороне |
| 3 | Логика статусов | Используем готовые buckets из Edge Function | Не дублируем эвристики (`has_script`/`has_voiceover`/`has_video`) |
| 4 | Клик по SKU в drawer | `navigate('/content-bank?search=<title>')` | Reuse существующего поиска контент-банка; тот же UX |
| 5 | `script` vs `script_text` | Никаких правок | Edge Function: `has_script = !!(unit.script \|\| unit.script_text)` — наш `script_text` подхватывается |
| 6 | Auto-refresh | 30s polling + pause при `document.hidden` + ручная кнопка | Спец-инвариант |
| 7 | Стиль | Наш ERP design-system | Светлая тема, фиолетовый primary, Arial, rounded-2xl |

---

## Architecture

```
┌─ Frontend (React, ERP) ─────────────────────────────────┐
│  /content-engine — dashboard page                        │
│  Sidebar: «📊 Контент-движок»                            │
│  Components: MetricsRow / PipelineRow / StageDrawer /    │
│              TodayQueue / Bottlenecks / RubricDist /     │
│              RecentPublished                              │
└──────────────────────────────────────────────────────────┘
        ▼ GET /api/content-engine/stats
┌─ Backend (Express, Railway) ─────────────────────────────┐
│  content-engine.controller.ts → fetch Edge Function       │
│  DASHBOARD_TOKEN из Railway env                          │
│  In-memory cache 10s TTL (защищает от 30s polling spam)  │
└──────────────────────────────────────────────────────────┘
        ▼ GET https://...supabase.co/functions/v1/
                  content-engine-stats?token=...
┌─ Supabase Edge Function (existing) ──────────────────────┐
│  Returns full JSON snapshot:                             │
│  { stats, buckets, today_queue, recent_published,        │
│    rubrics, generated_at }                                │
└──────────────────────────────────────────────────────────┘
```

---

## Backend

### New route: `GET /api/content-engine/stats`

**File:** `backend/src/controllers/content-engine.controller.ts` (NEW)

```ts
import { Request, Response } from 'express'

const EDGE_URL = 'https://jubkezbvccwvujregkfq.supabase.co/functions/v1/content-engine-stats'
const TOKEN = process.env.DASHBOARD_TOKEN ?? ''

interface CacheEntry {
  data: any
  fetchedAt: number
}
const CACHE_TTL_MS = 10 * 1000  // 10s — protects Edge Function from 30s polling
let cache: CacheEntry | null = null

export const contentEngineController = {
  async stats(req: Request, res: Response) {
    try {
      if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return res.json(cache.data)
      }
      const r = await fetch(`${EDGE_URL}?token=${encodeURIComponent(TOKEN)}`)
      if (!r.ok) {
        const text = await r.text()
        console.error('Edge function error:', r.status, text)
        return res.status(502).json({ error: 'Не удалось загрузить данные дашборда' })
      }
      const data = await r.json()
      cache = { data, fetchedAt: Date.now() }
      res.json(data)
    } catch (e: any) {
      console.error('content-engine stats error:', e?.message || e)
      res.status(500).json({ error: 'Ошибка дашборда' })
    }
  },
}
```

**File:** `backend/src/routes/content-engine.routes.ts` (NEW)

```ts
import { Router } from 'express'
import { contentEngineController } from '../controllers/content-engine.controller'

const router = Router()
router.get('/stats', contentEngineController.stats)
export default router
```

**File:** `backend/src/server.ts` (MODIFY)

```ts
import contentEngineRoutes from './routes/content-engine.routes'
app.use('/api/content-engine', authMiddleware, contentEngineRoutes)
```

### Env var (Railway dashboard, manual)

```
DASHBOARD_TOKEN=continuum-orchestrator-2026
```

(Same value as in CONTEXT.md from zip. User adds in Railway dashboard.)

---

## Frontend

### Page + routing

**File:** `frontend/src/pages/ContentEngine.tsx` (NEW)

Main page layout (top to bottom):

1. **Header** — заголовок «📊 Контент-движок · Химичка» + время обновления + кнопка «Обновить» + пульсирующая точка во время fetch
2. **MetricsRow** — 4 карточки (total_units / total_publications / published_total / scheduled_total)
3. **Bottlenecks** — warning-блок (только если есть): «N сценариев готовы → Агент 4», «N SKU готовы к ElevenLabs», «N одобренных в backlog»
4. **TodayQueue** — список публикаций на сегодня
5. **PipelineRow** — 9 stage cards (ideas, triage, excellent, planning, scripting, voiceover_prep, production, published, rejected)
6. **StageDrawer** — раскрывается при клике на этап, показывает первые 10 SKU
7. **RubricDistribution** — top 8 рубрик с горизонтальными bar-чартами
8. **RecentPublished** — недавние публикации
9. **Footer** — generated_at + version

Hooks:
- `useState<DashboardData | null>` — текущие данные
- `useState<StageKey | null>` — открытая стадия (drawer)
- `useEffect` polling — `setInterval(fetch, 30000)`, pause при `document.hidden`, kill on unmount
- `useCallback` refresh — ручная кнопка

### Component split

```
frontend/src/components/content-engine/
  MetricsRow.tsx           — 4 metric cards
  PipelineRow.tsx          — 9 stage chips (clickable)
  StageDrawer.tsx          — list of 10 SKUs for selected stage
  TodayQueue.tsx           — today's publications
  Bottlenecks.tsx          — warning banners (conditional)
  RubricDistribution.tsx   — bar chart
  RecentPublished.tsx      — recent publications list
```

### Sidebar entry

В `frontend/src/components/Layout.tsx`, рядом с «🎙 Войсовер»:
```tsx
{ label: 'Контент-движок', path: '/content-engine', icon: IconChart }
```

(Custom inline SVG component `IconChart`, как `IconMic` для VoiceoverStudio — match project convention.)

### Route

В `frontend/src/App.tsx`:
```tsx
<Route path="/content-engine" element={<ContentEngine />} />
```

### API wrapper

**File:** `frontend/src/api/contentEngine.ts` (NEW)

```ts
import { apiClient } from './client'

export type StageKey =
  | 'ideas' | 'triage_needs_work' | 'excellent'
  | 'planning' | 'scripting' | 'voiceover_prep'
  | 'production' | 'published' | 'rejected'

export interface DashboardUnit {
  id: string
  title: string
  hook: string | null
  complexity: number | null
  rubric: string | null
  rubric_emoji: string | null
  status: string
  review_grade: string | null
  has_script: boolean
  has_voiceover: boolean
  has_video: boolean
  publications: any[]
  published_count: number
  scheduled_count: number
  updated_at: string
  ready_at: string | null
}

export interface QueueItem {
  id: string
  unit_id: string
  unit_title: string
  network: 'tiktok' | 'youtube' | 'instagram'
  scheduled_at: string
  has_video: boolean
}

export interface RecentItem {
  id: string
  unit_title: string
  network: string
  published_at: string
  published_url: string | null
}

export interface DashboardRubric {
  id: string
  slug: string
  title: string
  emoji: string | null
}

export interface DashboardStats {
  counts: Record<StageKey, number>
  total_units: number
  total_publications: number
  published_total: number
  scheduled_total: number
}

export interface DashboardData {
  ok: true
  generated_at: string
  stats: DashboardStats
  buckets: Record<StageKey, DashboardUnit[]>
  today_queue: QueueItem[]
  recent_published: RecentItem[]
  rubrics: DashboardRubric[]
}

export const contentEngineApi = {
  stats: async (): Promise<DashboardData> => {
    const r = await apiClient.get<DashboardData>('/content-engine/stats')
    return r.data
  },
}
```

### UI tokens (existing ERP design system)

| Stage | Tailwind classes |
|---|---|
| `ideas` | `bg-blue-50 border-blue-200 text-blue-700` 💡 |
| `triage_needs_work` | `bg-amber-50 border-amber-200 text-amber-700` ✏️ |
| `excellent` | `bg-green-50 border-green-200 text-green-700` ✓ |
| `planning` | `bg-purple-50 border-purple-200 text-purple-700` 🗓 |
| `scripting` | `bg-purple-50 border-purple-200 text-purple-700` 📝 |
| `voiceover_prep` | `bg-purple-50 border-purple-200 text-purple-700` 🎤 |
| `production` | `bg-purple-50 border-purple-200 text-purple-700` 🎬 |
| `published` | `bg-subtle border-brand-border text-brand-text-secondary` ✓ |
| `rejected` | `bg-red-50 border-red-200 text-red-700` ✕ |

Cards: `rounded-2xl border bg-card shadow-sm`. Active stage: `ring-2 ring-primary-300`.

Network icons via `lucide-react`: nothing — нужны эмодзи 🎵 (TikTok-приближение) или текст. Использую текст «TT/YT/IG» в чипах сетей.

### Auto-refresh logic

```tsx
useEffect(() => {
  let timer: ReturnType<typeof setInterval>
  const tick = () => { if (!document.hidden) refresh() }
  timer = setInterval(tick, 30000)
  const onVisibility = () => { if (!document.hidden) refresh() }  // refresh on return to tab
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}, [refresh])
```

### Click → content-bank link

Когда пользователь кликает SKU в `StageDrawer` или в `TodayQueue`:

```tsx
navigate(`/content-bank?search=${encodeURIComponent(unit.title)}`)
```

`/content-bank` уже умеет фильтровать по `search` (через `useSearchParams`), пользователь увидит юнит в списке и кликнет — откроется существующий `UnitEditModal`.

---

## Files changed (summary)

### Backend (3 new + 1 modification)

- `controllers/content-engine.controller.ts` — NEW (proxy + 10s cache)
- `routes/content-engine.routes.ts` — NEW
- `server.ts` — +2 lines (`app.use('/api/content-engine', authMiddleware, contentEngineRoutes)`)
- `package.json` — без изменений (используем встроенный `fetch` Node 18+)

### Frontend (9 new + 2 modifications)

- `pages/ContentEngine.tsx` — NEW (главная страница)
- `components/content-engine/MetricsRow.tsx` — NEW
- `components/content-engine/PipelineRow.tsx` — NEW
- `components/content-engine/StageDrawer.tsx` — NEW
- `components/content-engine/TodayQueue.tsx` — NEW
- `components/content-engine/Bottlenecks.tsx` — NEW
- `components/content-engine/RubricDistribution.tsx` — NEW
- `components/content-engine/RecentPublished.tsx` — NEW
- `api/contentEngine.ts` — NEW
- `App.tsx` — +1 Route
- `components/Layout.tsx` — +1 sidebar item + IconChart SVG

**Итого:** 12 новых файлов + 3 модификации.
**Migrations:** 0.

### Env / infra

- Railway dashboard: `DASHBOARD_TOKEN=continuum-orchestrator-2026` (юзер добавляет до push-а).

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Edge Function down → 502 | 10s cache на нашем бэке смягчает; пользователь видит warning баннер «не удалось загрузить» |
| `DASHBOARD_TOKEN` leak | Только в Railway env, не в client bundle. Rotate в Supabase + Railway если что |
| Polling spam Edge Function (5 пользователей × 30s) | 10s cache на бэке = max 6 запросов в минуту к Edge Function независимо от количества клиентов |
| Edge Function cold start (>2s) | Спинеры на initial fetch, ручная кнопка remains responsive (показывает «загрузка…»). После прогрева — fast |
| Tab inactive — расходуем сеть впустую | `document.hidden` pause |
| Big bucket lists (excellent = 147) | Drawer показывает первые 10 + «… и ещё 137». Полный просмотр — через `/content-bank` |

---

## Rollback

1. **Frontend:** redeploy предыдущий `vercel-deploy` коммит через Vercel dashboard.
2. **Backend:** `git revert <range>` на `origin`, push.
3. **DB:** ничего откатывать не нужно — миграций нет.
4. **Env:** `DASHBOARD_TOKEN` можно оставить в Railway, не мешает.

---

## Out of scope

- Edge Function HTML view (отвергнуто в пользу A-варианта)
- Запуск агентов из UI
- Realtime websockets
- Графики временных рядов
- Авто-открытие модалки юнита по клику в drawer (сейчас — через `/content-bank?search=`)
- Кастомный токен per-user / Supabase Auth integration (Variant 2 — отдельная задача)
- Drag-n-drop переноса SKU между стадиями
- Экспорт snapshot в CSV/JSON
