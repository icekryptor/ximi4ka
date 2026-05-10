# Content Engine Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a `/content-engine` page to the ERP that consumes the existing Supabase Edge Function `content-engine-stats` via an Express proxy and renders a 9-stage pipeline dashboard with metrics, today's queue, drawer, rubric distribution, recent publications, and 30s auto-refresh.

**Architecture:** Express proxy (`/api/content-engine/stats`) with 10s in-memory cache forwards to the existing Edge Function (DASHBOARD_TOKEN in Railway env). Frontend page is a single `ContentEngine.tsx` parent + 7 small components. Click on a SKU navigates to `/content-bank?search=<title>` to reuse the existing edit modal. No DB migrations.

**Tech Stack:** Express + native `fetch` (Node 18+). React + TypeScript + Tailwind. `lucide-react` (already installed) for any icons; sidebar uses inline SVG (project convention).

**Design doc:** `docs/plans/2026-05-10-content-engine-dashboard-design.md`

**Two-remote deploy convention:** push to `origin` (Railway backend) AND `vercel-deploy` (Vercel frontend). Always both.

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
Expected: working dir clean of project changes, three SHAs match.

### Task 0.2: User adds DASHBOARD_TOKEN to Railway

**Manual step:** Railway dashboard → backend project → Variables → add:
```
DASHBOARD_TOKEN=continuum-orchestrator-2026
```

This is the same token used by the Edge Function (per CONTEXT.md from zip). Without it, `/api/content-engine/stats` returns 401 from the Edge Function.

If user hasn't done this — pause and ask. The bot will not error on backend start, but every request to `/api/content-engine/stats` will return 502 until the env is set.

---

## Stage 1: Backend — proxy controller + route

### Task 1.1: Create controller + route + wire up

**Files:**
- Create: `backend/src/controllers/content-engine.controller.ts`
- Create: `backend/src/routes/content-engine.routes.ts`
- Modify: `backend/src/server.ts`

**Step 1: Controller with 10s cache**

```ts
// backend/src/controllers/content-engine.controller.ts
import { Request, Response } from 'express'

const EDGE_URL = 'https://jubkezbvccwvujregkfq.supabase.co/functions/v1/content-engine-stats'

interface CacheEntry {
  data: any
  fetchedAt: number
}
const CACHE_TTL_MS = 10 * 1000  // 10s — protects Edge Function from N×30s polling
let cache: CacheEntry | null = null

export const contentEngineController = {
  async stats(_req: Request, res: Response) {
    try {
      if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return res.json(cache.data)
      }
      const token = process.env.DASHBOARD_TOKEN ?? ''
      if (!token) {
        console.error('content-engine: DASHBOARD_TOKEN env var missing')
        return res.status(500).json({ error: 'Сервер не настроен (DASHBOARD_TOKEN)' })
      }
      const r = await fetch(`${EDGE_URL}?token=${encodeURIComponent(token)}`)
      if (!r.ok) {
        const text = await r.text()
        console.error('Edge function error:', r.status, text.slice(0, 200))
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

**Step 2: Routes file**

Match the existing route convention — auth applied at server.ts level (no auth import inside this file). Confirm by looking at `backend/src/routes/voiceover.routes.ts`.

```ts
// backend/src/routes/content-engine.routes.ts
import { Router } from 'express'
import { contentEngineController } from '../controllers/content-engine.controller'

const router = Router()
router.get('/stats', contentEngineController.stats)
export default router
```

**Step 3: Wire up in server.ts**

In `backend/src/server.ts`, find the line that registers `voiceoverRoutes` (or `claudeRoutes`). Add a sibling registration:

```ts
import contentEngineRoutes from './routes/content-engine.routes'
// ...
app.use('/api/content-engine', authMiddleware, contentEngineRoutes)
```

**Step 4: Typecheck**
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
```
Expected: empty.

**Step 5: Commit**

```bash
git add backend/src/controllers/content-engine.controller.ts backend/src/routes/content-engine.routes.ts backend/src/server.ts
git commit -m "feat(content-engine): GET /api/content-engine/stats — Edge Function proxy

Proxies to https://jubkezbvccwvujregkfq.supabase.co/functions/v1/content-engine-stats
with DASHBOARD_TOKEN from Railway env (never exposed to client bundle).

10s in-memory cache caps load on the Edge Function regardless of how many
clients poll: max 6 upstream requests/min vs N×2 with 30s client polling.

Errors mapped to user-friendly messages: 502 if Edge Function unreachable,
500 if token env missing or unexpected error. JWT-protected via the
existing authMiddleware applied at server.ts level."
```

---

## Stage 2: Frontend — API wrapper + types

### Task 2.1: Create `frontend/src/api/contentEngine.ts`

**Files:**
- Create: `frontend/src/api/contentEngine.ts`

**Step 1: Write wrapper with full types**

```ts
import { apiClient } from './client'

export type StageKey =
  | 'ideas'
  | 'triage_needs_work'
  | 'excellent'
  | 'planning'
  | 'scripting'
  | 'voiceover_prep'
  | 'production'
  | 'published'
  | 'rejected'

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
  publications: Array<{
    id: string
    network: string
    scheduled_at: string | null
    published_at: string | null
    published_url: string | null
  }>
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

**Step 2: Typecheck**
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: empty.

**Step 3: Commit**

```bash
git add frontend/src/api/contentEngine.ts
git commit -m "feat(content-engine): API wrapper + types

DashboardData mirrors the Edge Function JSON: stats / 9 buckets /
today_queue / recent_published / rubrics. StageKey union covers all
9 pipeline stages."
```

---

## Stage 3: Frontend — page skeleton + routing + sidebar

### Task 3.1: Locate routing + sidebar

```bash
grep -n "/content-bank\|/voiceover" frontend/src/App.tsx
grep -n "Войсовер\|Контент-банк" frontend/src/components/Layout.tsx
```

Note exact file paths and the existing icon style. The previous stages established that `Layout.tsx` uses inline SVG components (e.g. `IconMic`); we'll add `IconChart` in the same style.

### Task 3.2: Create stub component files

```bash
mkdir -p /Users/vasilijaistov/Desktop/continuum/ximi4ka/frontend/src/components/content-engine
```

7 stub files, each one-liner:

```tsx
// frontend/src/components/content-engine/MetricsRow.tsx
export function MetricsRow(_props: any) {
  return <div className="p-4 bg-subtle rounded-xl">MetricsRow — TODO</div>
}
```

Same pattern for `PipelineRow`, `StageDrawer`, `TodayQueue`, `Bottlenecks`, `RubricDistribution`, `RecentPublished`.

### Task 3.3: Page skeleton

**File:** `frontend/src/pages/ContentEngine.tsx` (NEW)

```tsx
import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { contentEngineApi, DashboardData, StageKey } from '../api/contentEngine'
import { MetricsRow } from '../components/content-engine/MetricsRow'
import { PipelineRow } from '../components/content-engine/PipelineRow'
import { StageDrawer } from '../components/content-engine/StageDrawer'
import { TodayQueue } from '../components/content-engine/TodayQueue'
import { Bottlenecks } from '../components/content-engine/Bottlenecks'
import { RubricDistribution } from '../components/content-engine/RubricDistribution'
import { RecentPublished } from '../components/content-engine/RecentPublished'

export default function ContentEngine() {
  const toast = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [openStage, setOpenStage] = useState<StageKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      const r = await contentEngineApi.stats()
      setData(r)
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Не удалось загрузить дашборд'
      setError(msg)
      // Show toast only on initial load failure; silent retry on poll failures
      if (!data) toast.error(msg)
    } finally {
      setFetching(false)
      setLoading(false)
    }
  }, [data, toast])

  // Initial load
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 30s polling, paused when tab hidden
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) refresh()
    }
    const timer = setInterval(tick, 30000)
    const onVisibility = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-brand-text-secondary">{error ?? 'Нет данных'}</p>
        <button onClick={refresh} className="btn btn-primary">Повторить</button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-text">📊 Контент-движок · Химичка</h1>
          <p className="text-sm text-brand-text-secondary mt-1">Операционный пульт</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-brand-text-secondary">
          <span
            className={
              'inline-block w-2 h-2 rounded-full ' +
              (fetching ? 'bg-primary-500 animate-pulse' : 'bg-green-500')
            }
            aria-label={fetching ? 'Обновляется' : 'Актуально'}
          />
          <span>Обновлено: {new Date(data.generated_at).toLocaleTimeString('ru-RU')}</span>
          <button
            onClick={refresh}
            disabled={fetching}
            className="ml-2 flex items-center gap-1 px-2 py-1 rounded-lg border border-brand-border hover:bg-subtle disabled:opacity-50"
          >
            <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} /> Обновить
          </button>
        </div>
      </div>

      {error && data && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          ⚠️ {error} (показаны последние известные данные)
        </div>
      )}

      <MetricsRow stats={data.stats} />
      <Bottlenecks counts={data.stats.counts} />
      <TodayQueue queue={data.today_queue} />
      <PipelineRow
        counts={data.stats.counts}
        openStage={openStage}
        onStageClick={(s) => setOpenStage(openStage === s ? null : s)}
      />
      {openStage && (
        <StageDrawer
          stage={openStage}
          units={data.buckets[openStage] ?? []}
          onClose={() => setOpenStage(null)}
        />
      )}
      <RubricDistribution units={data.buckets} rubrics={data.rubrics} />
      <RecentPublished items={data.recent_published} />

      <div className="text-center text-xs text-brand-text-secondary pt-6 border-t border-brand-border">
        Snapshot: {new Date(data.generated_at).toLocaleString('ru-RU')} · content-engine-stats
      </div>
    </div>
  )
}
```

### Task 3.4: Mount route

In `frontend/src/App.tsx`, add next to `/voiceover`:

```tsx
import ContentEngine from './pages/ContentEngine'

// inside <Routes>
<Route path="/content-engine" element={<ContentEngine />} />
```

If `/voiceover` is wrapped in a `ProtectedRoute > Layout` block — `/content-engine` MUST be in the same wrapper.

### Task 3.5: Sidebar entry

In `frontend/src/components/Layout.tsx`, find the sidebar nav array and the `IconMic` SVG component. Add a sibling `IconChart` SVG (use a bar-chart-like path) in the same style:

```tsx
function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
```

Then add to nav array near «🎙 Войсовер»:

```tsx
{ label: 'Контент-движок', path: '/content-engine', icon: IconChart }
```

### Task 3.6: Typecheck + commit (one big commit for Stage 3)

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: empty.

```bash
git add frontend/src/pages/ContentEngine.tsx frontend/src/components/content-engine/ frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(content-engine): page skeleton + 7 stub components + routing + sidebar

ContentEngine.tsx — wizard-less single-page dashboard. Loads stats once
on mount, polls every 30s, pauses while tab is hidden, manual refresh
button with pulsing status dot.

7 step components stubbed with placeholders, fleshed out in Stages 4-6.
Layout.tsx gets a new IconChart inline SVG matching the IconMic
convention. Route /content-engine mounted alongside /voiceover."
```

---

## Stage 4: MetricsRow + PipelineRow + Bottlenecks

### Task 4.1: MetricsRow

**File:** `frontend/src/components/content-engine/MetricsRow.tsx` (REPLACE stub)

```tsx
import { DashboardStats } from '../../api/contentEngine'

interface Props {
  stats: DashboardStats
}

const METRICS: Array<{ key: keyof Pick<DashboardStats, 'total_units' | 'total_publications' | 'published_total' | 'scheduled_total'>; label: string; emoji: string }> = [
  { key: 'total_units', label: 'SKU всего', emoji: '📦' },
  { key: 'total_publications', label: 'В плане публикаций', emoji: '🗓' },
  { key: 'published_total', label: 'Опубликовано', emoji: '🚀' },
  { key: 'scheduled_total', label: 'Запланировано', emoji: '⏳' },
]

export function MetricsRow({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {METRICS.map((m) => (
        <div key={m.key} className="rounded-2xl border border-brand-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-brand-text-secondary">
            {m.emoji} {m.label}
          </div>
          <div className="text-2xl font-bold text-brand-text mt-1">{stats[m.key]}</div>
        </div>
      ))}
    </div>
  )
}
```

### Task 4.2: PipelineRow

**File:** `frontend/src/components/content-engine/PipelineRow.tsx` (REPLACE stub)

```tsx
import { StageKey } from '../../api/contentEngine'

interface Props {
  counts: Record<StageKey, number>
  openStage: StageKey | null
  onStageClick: (s: StageKey) => void
}

const STAGES: Array<{ key: StageKey; label: string; emoji: string; classes: string }> = [
  { key: 'ideas',             label: 'Идеи',           emoji: '💡', classes: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { key: 'triage_needs_work', label: 'Триаж',          emoji: '✏️', classes: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
  { key: 'excellent',         label: 'Excellent',      emoji: '✓',  classes: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
  { key: 'planning',          label: 'Планирование',   emoji: '🗓', classes: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
  { key: 'scripting',         label: 'Сценарий',       emoji: '📝', classes: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
  { key: 'voiceover_prep',    label: 'Озвучка',        emoji: '🎤', classes: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
  { key: 'production',        label: 'Видео',          emoji: '🎬', classes: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
  { key: 'published',         label: 'Опубликовано',   emoji: '✓',  classes: 'bg-subtle border-brand-border text-brand-text-secondary hover:bg-brand-border/30' },
  { key: 'rejected',          label: 'Отказ',          emoji: '✕',  classes: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' },
]

export function PipelineRow({ counts, openStage, onStageClick }: Props) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-brand-text mb-2 uppercase tracking-wider text-brand-text-secondary">
        Конвейер
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        {STAGES.map((s) => {
          const isOpen = openStage === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onStageClick(s.key)}
              className={
                `text-left p-3 rounded-xl border transition-colors ` +
                s.classes +
                (isOpen ? ' ring-2 ring-primary-300' : '')
              }
            >
              <div className="text-lg leading-none">{s.emoji}</div>
              <div className="text-xs mt-1 font-medium leading-tight">{s.label}</div>
              <div className="text-2xl font-bold mt-1">{counts[s.key] ?? 0}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

### Task 4.3: Bottlenecks

**File:** `frontend/src/components/content-engine/Bottlenecks.tsx` (REPLACE stub)

```tsx
import { AlertTriangle } from 'lucide-react'
import { StageKey } from '../../api/contentEngine'

interface Props {
  counts: Record<StageKey, number>
}

interface Warning {
  text: string
  hint?: string
}

export function Bottlenecks({ counts }: Props) {
  const warnings: Warning[] = []

  if (counts.scripting > 10) {
    warnings.push({
      text: `${counts.scripting} сценариев готовы → запусти Агента 4 (препроцессор для ElevenLabs)`,
    })
  }
  if (counts.voiceover_prep > 0) {
    warnings.push({
      text: `${counts.voiceover_prep} SKU готовы к озвучке в ElevenLabs (ручной шаг)`,
    })
  }
  if (counts.excellent > 100) {
    warnings.push({
      text: `${counts.excellent} одобренных идей в backlog (без сценариев)`,
    })
  }

  if (warnings.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 mb-2">
        <AlertTriangle size={16} /> Узкие места
      </div>
      <ul className="space-y-1.5 text-sm text-amber-900">
        {warnings.map((w, i) => (
          <li key={i}>• {w.text}</li>
        ))}
      </ul>
    </div>
  )
}
```

### Task 4.4: Typecheck + commit

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: empty.

```bash
git add frontend/src/components/content-engine/MetricsRow.tsx frontend/src/components/content-engine/PipelineRow.tsx frontend/src/components/content-engine/Bottlenecks.tsx
git commit -m "feat(content-engine): MetricsRow + PipelineRow + Bottlenecks

- MetricsRow: 4 cards (total_units, total_publications, published_total,
  scheduled_total) — 2-col mobile, 4-col desktop
- PipelineRow: 9 stage buttons colour-coded by category (info/warn/
  success/purple/muted/danger). Active stage gets ring-2 ring-primary-300.
- Bottlenecks: amber warning block with up to 3 conditional warnings:
  scripting>10, voiceover_prep>0, excellent>100. Hidden when empty."
```

---

## Stage 5: TodayQueue + StageDrawer

### Task 5.1: TodayQueue

**File:** `frontend/src/components/content-engine/TodayQueue.tsx` (REPLACE stub)

```tsx
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { QueueItem } from '../../api/contentEngine'

interface Props {
  queue: QueueItem[]
}

const NETWORK_LABEL: Record<string, string> = {
  tiktok: 'TT',
  youtube: 'YT',
  instagram: 'IG',
}

const NETWORK_CLASSES: Record<string, string> = {
  tiktok: 'bg-black text-white',
  youtube: 'bg-red-100 text-red-700',
  instagram: 'bg-pink-100 text-pink-700',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function TodayQueue({ queue }: Props) {
  const navigate = useNavigate()

  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-card p-4">
        <h2 className="text-sm font-semibold text-brand-text mb-1">Сегодняшняя очередь</h2>
        <p className="text-sm text-brand-text-secondary">Сегодня публикаций нет</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-brand-border bg-card p-4">
      <h2 className="text-sm font-semibold text-brand-text mb-3">
        Сегодняшняя очередь · {queue.length}
      </h2>
      <ul className="space-y-2">
        {queue.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => navigate(`/content-bank?search=${encodeURIComponent(q.unit_title)}`)}
              className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-subtle transition-colors"
            >
              <span className="font-mono text-sm text-brand-text-secondary w-12 shrink-0">
                {formatTime(q.scheduled_at)}
              </span>
              <span
                className={
                  'text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ' +
                  (NETWORK_CLASSES[q.network] ?? 'bg-subtle text-brand-text-secondary')
                }
              >
                {NETWORK_LABEL[q.network] ?? q.network}
              </span>
              <span className="flex-1 text-sm text-brand-text truncate">{q.unit_title}</span>
              {q.has_video ? (
                <span className="flex items-center gap-1 text-xs text-green-700 shrink-0">
                  <CheckCircle2 size={12} /> видео
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-700 shrink-0">
                  <AlertTriangle size={12} /> нет видео
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Task 5.2: StageDrawer

**File:** `frontend/src/components/content-engine/StageDrawer.tsx` (REPLACE stub)

```tsx
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { DashboardUnit, StageKey } from '../../api/contentEngine'

interface Props {
  stage: StageKey
  units: DashboardUnit[]
  onClose: () => void
}

const STAGE_LABELS: Record<StageKey, string> = {
  ideas: '💡 Идеи',
  triage_needs_work: '✏️ Требуют доработки',
  excellent: '✓ Excellent — без сценария',
  planning: '🗓 В плане публикаций',
  scripting: '📝 Со сценариями',
  voiceover_prep: '🎤 Готовы к озвучке',
  production: '🎬 Видео готово',
  published: '✓ Опубликовано',
  rejected: '✕ Отказ',
}

const COMPLEXITY_CLASSES: Record<number, string> = {
  1: 'bg-green-50 text-green-700',
  2: 'bg-amber-50 text-amber-700',
  3: 'bg-red-50 text-red-700',
}

export function StageDrawer({ stage, units, onClose }: Props) {
  const navigate = useNavigate()
  const visible = units.slice(0, 10)
  const rest = units.length - visible.length

  return (
    <div className="rounded-2xl border border-brand-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-brand-text">
          {STAGE_LABELS[stage]} · {units.length}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-subtle text-brand-text-secondary"
          aria-label="Закрыть"
        >
          <X size={16} />
        </button>
      </div>

      {units.length === 0 ? (
        <p className="text-sm text-brand-text-secondary">Пусто</p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {visible.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/content-bank?search=${encodeURIComponent(u.title)}`)}
                  className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-subtle transition-colors"
                >
                  <span className="text-sm">{u.rubric_emoji ?? '·'}</span>
                  <span className="flex-1 text-sm text-brand-text truncate">{u.title}</span>
                  {u.complexity && (
                    <span
                      className={
                        'text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ' +
                        (COMPLEXITY_CLASSES[u.complexity] ?? 'bg-subtle text-brand-text-secondary')
                      }
                    >
                      c{u.complexity}
                    </span>
                  )}
                  {u.scheduled_count > 0 && (
                    <span className="text-[10px] text-brand-text-secondary shrink-0">
                      📅 {u.scheduled_count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {rest > 0 && (
            <p className="text-xs text-brand-text-secondary mt-2 italic">
              … и ещё {rest}. Полный список — на странице /content-bank.
            </p>
          )}
        </>
      )}
    </div>
  )
}
```

### Task 5.3: Typecheck + commit

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: empty.

```bash
git add frontend/src/components/content-engine/TodayQueue.tsx frontend/src/components/content-engine/StageDrawer.tsx
git commit -m "feat(content-engine): TodayQueue + StageDrawer

- TodayQueue: list of today's scheduled publications, time + network
  badge + title + has_video indicator. Click → /content-bank?search=
  opens the existing edit modal.
- StageDrawer: shows first 10 SKUs of the selected stage with rubric
  emoji + complexity chip + scheduled-count badge. Tail '… и ещё N'
  when stage has more. Click → same /content-bank?search= flow."
```

---

## Stage 6: RubricDistribution + RecentPublished

### Task 6.1: RubricDistribution

**File:** `frontend/src/components/content-engine/RubricDistribution.tsx` (REPLACE stub)

Aggregates count of units across **all** non-published, non-rejected buckets per rubric to show the active backlog distribution.

```tsx
import { DashboardUnit, DashboardRubric, StageKey } from '../../api/contentEngine'

interface Props {
  units: Record<StageKey, DashboardUnit[]>
  rubrics: DashboardRubric[]
}

// Active stages (excludes published & rejected — those are end-of-life)
const ACTIVE_STAGES: StageKey[] = [
  'ideas', 'triage_needs_work', 'excellent',
  'planning', 'scripting', 'voiceover_prep', 'production',
]

export function RubricDistribution({ units, rubrics }: Props) {
  // Count active units per rubric title (rubric is a string in DashboardUnit)
  const counts = new Map<string, number>()
  for (const stage of ACTIVE_STAGES) {
    for (const u of units[stage] ?? []) {
      const key = u.rubric ?? 'Без рубрики'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  if (sorted.length === 0) return null

  const max = sorted[0][1]
  const emojiByTitle = new Map(rubrics.map(r => [r.title, r.emoji]))

  return (
    <div className="rounded-2xl border border-brand-border bg-card p-4">
      <h2 className="text-sm font-semibold text-brand-text mb-3">
        Распределение по рубрикам · top 8
      </h2>
      <ul className="space-y-2">
        {sorted.map(([title, n]) => {
          const emoji = emojiByTitle.get(title) ?? '·'
          const pct = max > 0 ? (n / max) * 100 : 0
          return (
            <li key={title} className="flex items-center gap-3">
              <span className="text-sm w-6 text-center shrink-0">{emoji}</span>
              <span className="text-sm text-brand-text flex-1 truncate min-w-0">{title}</span>
              <div className="flex-1 max-w-[180px] h-2 rounded-full bg-subtle overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm font-mono text-brand-text-secondary w-8 text-right shrink-0">
                {n}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

### Task 6.2: RecentPublished

**File:** `frontend/src/components/content-engine/RecentPublished.tsx` (REPLACE stub)

```tsx
import { ExternalLink } from 'lucide-react'
import { RecentItem } from '../../api/contentEngine'

interface Props {
  items: RecentItem[]
}

const NETWORK_LABEL: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RecentPublished({ items }: Props) {
  if (items.length === 0) return null
  const visible = items.slice(0, 5)

  return (
    <div className="rounded-2xl border border-brand-border bg-card p-4">
      <h2 className="text-sm font-semibold text-brand-text mb-3">Недавно опубликовано</h2>
      <ul className="space-y-1.5">
        {visible.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-subtle"
          >
            <span className="font-mono text-xs text-brand-text-secondary w-24 shrink-0">
              {formatDate(it.published_at)}
            </span>
            <span className="text-xs text-brand-text-secondary w-16 shrink-0">
              {NETWORK_LABEL[it.network] ?? it.network}
            </span>
            <span className="flex-1 text-sm text-brand-text truncate">{it.unit_title}</span>
            {it.published_url && (
              <a
                href={it.published_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-text-secondary hover:text-primary-600 shrink-0"
                title="Открыть публикацию"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Task 6.3: Typecheck + commit

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: empty.

```bash
git add frontend/src/components/content-engine/RubricDistribution.tsx frontend/src/components/content-engine/RecentPublished.tsx
git commit -m "feat(content-engine): RubricDistribution + RecentPublished

- RubricDistribution: aggregates active backlog (excludes published &
  rejected) per rubric, shows top-8 with horizontal amber bar charts
  scaled to the leader.
- RecentPublished: last 5 publications with date, network, title,
  external-link icon. Hidden when empty."
```

---

## Stage 7: Push + smoke

### Task 7.1: Verify all commits

```bash
git status -s | grep -v "^??" | grep -v "launch.json\|^ M CLAUDE"
git log --oneline -10
```

Working tree clean of project changes. Top commits cover Stages 1-6.

### Task 7.2: Push to both remotes

```bash
git push origin main
git push vercel-deploy main
```

### Task 7.3: Confirm deploys

- **Backend (Railway):** dashboard → confirm latest deploy + `DASHBOARD_TOKEN` is set in env vars (Task 0.2). Without it, `/api/content-engine/stats` returns 500 with «Сервер не настроен».
- **Frontend (Vercel):** poll `mcp__ee9ee30f-...__list_deployments` for project `prj_GFg64z7zI1Jyx5JKPop0LIiyWKQA`, wait for `state: "READY"`.

### Task 7.4: Smoke checklist (manual, user-driven)

Open `https://erp.ximi4ka.ru/content-engine`:

1. **Sidebar:** «Контент-движок» рядом с «Войсовер», иконка bar-chart.
2. **Loading:** Spinner появляется на 1-2 сек, потом данные.
3. **Header:** «📊 Контент-движок · Химичка» + время обновления + ✓ зелёная точка (статика) → пульсирует фиолетовым во время fetch.
4. **Metrics:** 4 карточки с правильными числами (`total_units`/`total_publications`/`published_total`/`scheduled_total`).
5. **Bottlenecks:** появляется если `excellent>100`, `voiceover_prep>0` или `scripting>10`. По текущему snapshot должно быть >100 одобренных + 12 готовых к озвучке.
6. **Today queue:** список публикаций на сегодня (если есть) или «Сегодня публикаций нет». Клик по строке → редирект `/content-bank?search=<title>` → строка появляется в таблице.
7. **Pipeline:** 9 цветных карточек. Клик → drawer раскрывается ниже.
8. **Drawer:** показывает первые 10 SKU стадии. Клик по юниту → `/content-bank?search=<title>`. Закрытие через ✕ или повторный клик по той же стадии.
9. **Rubric distribution:** top-8 с амбер bar-чартами. Эмодзи рубрик подгружаются.
10. **Recent published:** 5 последних публикаций (если есть). Иконка external-link открывает `published_url` в новой вкладке.
11. **Auto-refresh:** через 30s вижу что точка пульсирует и время обновления меняется.
12. **Tab switch:** переключаюсь на другую вкладку 1 минуту → возвращаюсь → видим что fetch произошёл сразу (без ожидания 30s).
13. **Network failure:** в DevTools блокируем `/api/content-engine/stats` → видим красный баннер «не удалось загрузить (показаны последние известные данные)», старые данные остаются.

If any step fails — surface via Systematic-Debugging skill. Most likely:
- 401 → check `DASHBOARD_TOKEN` matches between Railway and Edge Function
- 502 → Edge Function down (check Supabase dashboard logs)
- Empty buckets → Edge Function's bucket logic not matching expectations

---

## Out of scope / future work

- Auto-open edit modal directly when clicking a SKU (today: `/content-bank?search=`).
- Server-Sent Events / WebSocket realtime updates (today: 30s polling).
- Time-series charts (publications-per-week, generation rates).
- Stage drag-n-drop (move SKU between stages).
- Custom stage filters (e.g. "show only complexity=3").
- Per-user `DASHBOARD_TOKEN` rotation.
- Endpoint to launch agents from UI (CONTEXT.md Variant 2).
- CSV/JSON export of snapshot.

---

## Rollback

1. **Frontend:** redeploy previous `vercel-deploy` commit via Vercel dashboard.
2. **Backend:** `git revert <range>` on `origin`, push.
3. **DB:** nothing to roll back — no migrations.
4. **Env:** `DASHBOARD_TOKEN` can stay in Railway, doesn't interfere.
