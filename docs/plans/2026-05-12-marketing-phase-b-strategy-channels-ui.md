# Marketing Unit — Phase B (Strategy + Channels UI) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** ✅ Phase B complete on 2026-05-12. Ready for Phase C (recipe-engine + per-type content pipelines).

**Goal:** Поднять UX-слой над schema-фундаментом Phase A: backend CRUD для 4 новых сущностей + brand_docs, две новые страницы (`/marketing/strategy` и `/settings/channels`), реорганизация sidebar в новую секцию «Маркетинг».

**Architecture:** Backend следует существующему паттерну Counterparty (routes/* → controllers/* → AppDataSource.getRepository → JSON). Frontend использует существующий `createCrudApi<T>` фактори для API-клиентов; страницы строятся по образцу `Counterparties.tsx` (простая таблица с inline-формой). Markdown-редактор стратегии — две вкладки в одной странице: редактор (`<textarea>`) + preview (через простой markdown→HTML, можно использовать существующий `react-markdown` если установлен, иначе остановиться на чистом textarea без preview на v1).

**Tech Stack:** Node.js + Express + TypeORM (backend), React 18 + TypeScript + Vite + TailwindCSS (frontend). Без тестового фреймворка — verification через `npm run build` + ручные curl/UI смоки.

**Parent docs:**
- [Operating model](2026-05-11-marketing-unit-operating-model-design.md)
- [Content production PRD](2026-05-11-content-production-prd-design.md) §7.3, §7.4, §7.6
- [Phase A foundation](2026-05-11-marketing-phase-a-foundation.md) — мерж в main завершён, schema в проде.

---

## Pre-flight checklist (до Task 1)

1. На main + актуальная схема:
   ```bash
   cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/.claude/worktrees/confident-tesla-8e46b9
   git fetch origin && git merge --ff-only origin/main
   ```
   Ожидание: либо «Already up to date», либо fast-forward на тиp main.

2. Backend и frontend компилируются:
   ```bash
   cd backend && npx tsc --noEmit && cd ..
   cd frontend && npm run build && cd ..
   ```
   Оба — exit 0. Если нет — стоп, чинить baseline перед Phase B.

3. Открой [content production PRD §7](2026-05-11-content-production-prd-design.md) — секции 7.3 и 7.4 описывают целевой UX.

---

## Convention reminders для всех task

- **Backend pattern** (см. `backend/src/controllers/counterparty.controller.ts` + `backend/src/routes/counterparty.routes.ts`): single-exported controller object с 5 методами (`getAll`, `getById`, `create`, `update`, `delete`) + один router с 5 маршрутами. Mount в `backend/src/server.ts` через `app.use('/api/<resource>', authMiddleware, <resource>Routes)`.
- **Frontend API client** (см. `frontend/src/api/counterparties.ts`): one-liner `createCrudApi<T>('/<resource>')` из `crudFactory.ts`.
- **Frontend CRUD page** (см. `frontend/src/pages/Counterparties.tsx`): React-функция с локальным state, useEffect для fetch, inline-форма добавления/редактирования. Никакого React Query / Redux.
- **Authentication:** все routes под `authMiddleware` (кроме `/api/auth/*`, `/api/public/*`).
- **Russian UI text** строго. Технические идентификаторы — английский.
- **No tests** — проект без тест-фреймворка; verify через build + smoke.
- **No emojis в коде** — только если пользователь явно попросит (см. CLAUDE.md / global rules).

---

## Task 1 — Backend: brand-docs controller + routes

**Files:**
- Create: `backend/src/controllers/brand-doc.controller.ts`
- Create: `backend/src/routes/brand-doc.routes.ts`

**Context:** Сейчас `brand_docs` читаются только из `voiceover.controller.ts`. Phase B вводит универсальный endpoint для чтения/обновления документов стратегии. На v1 страница `/marketing/strategy` работает только с одним документом `slug='strategy_current'`, но controller сразу делаем universal — GET/PUT по slug, list для админ-вкладок.

**Step 1: Write controller**

```typescript
// backend/src/controllers/brand-doc.controller.ts
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'

const repo = AppDataSource.getRepository(BrandDoc)

export const brandDocController = {
  async getAll(_req: Request, res: Response) {
    try {
      const docs = await repo.find({ order: { slug: 'ASC' } })
      res.json(docs)
    } catch (error) {
      console.error('Ошибка при получении brand_docs:', error)
      res.status(500).json({ error: 'Ошибка при получении документов' })
    }
  },

  async getBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params
      const doc = await repo.findOne({ where: { slug } })
      if (!doc) {
        return res.status(404).json({ error: 'Документ не найден' })
      }
      res.json(doc)
    } catch (error) {
      console.error('Ошибка при получении документа:', error)
      res.status(500).json({ error: 'Ошибка при получении документа' })
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { slug } = req.params
      const { title, content, version } = req.body
      if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Поле content обязательно (string)' })
      }
      const existing = await repo.findOne({ where: { slug } })
      if (existing) {
        await repo.update(existing.id, {
          title: title ?? existing.title,
          content,
          version: version ?? existing.version,
        })
        const updated = await repo.findOne({ where: { slug } })
        return res.json(updated)
      }
      const created = repo.create({
        slug,
        title: title ?? slug,
        content,
        version: version ?? null,
      })
      const saved = await repo.save(created)
      res.status(201).json(saved)
    } catch (error) {
      console.error('Ошибка при сохранении документа:', error)
      res.status(500).json({ error: 'Ошибка при сохранении документа' })
    }
  },
}
```

Note: используем `upsert` PUT-pattern с slug в URL — фронт делает `PUT /api/brand-docs/strategy_current` независимо от того, существует ли документ. Это упрощает frontend (нет логики «создать-или-обновить»).

**Step 2: Write routes**

```typescript
// backend/src/routes/brand-doc.routes.ts
import { Router } from 'express'
import { brandDocController } from '../controllers/brand-doc.controller'

const router = Router()

router.get('/', brandDocController.getAll)
router.get('/:slug', brandDocController.getBySlug)
router.put('/:slug', brandDocController.upsert)

export default router
```

**Step 3: Typecheck**

```bash
cd backend && npx tsc --noEmit && cd ..
```
Expected: 0 errors. (Mount в server.ts — в Task 6.)

**Step 4: Commit**

```bash
git add backend/src/controllers/brand-doc.controller.ts backend/src/routes/brand-doc.routes.ts
git commit -m "feat(backend): brand-docs CRUD endpoints (getAll/getBySlug/upsert by slug)"
```

---

## Task 2 — Backend: icp-segment controller + routes

**Files:**
- Create: `backend/src/controllers/icp-segment.controller.ts`
- Create: `backend/src/routes/icp-segment.routes.ts`

**Context:** Стандартный CRUD по точному паттерну Counterparty. Сущность `IcpSegment` создана в Phase A.

**Step 1: Write controller**

```typescript
// backend/src/controllers/icp-segment.controller.ts
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { IcpSegment } from '../entities/IcpSegment'

const repo = AppDataSource.getRepository(IcpSegment)

export const icpSegmentController = {
  async getAll(req: Request, res: Response) {
    try {
      const { active } = req.query
      const where: Record<string, unknown> = {}
      if (active !== undefined) where.active = active === 'true'
      const segments = await repo.find({
        where,
        order: { sort_order: 'ASC', name: 'ASC' },
      })
      res.json(segments)
    } catch (error) {
      console.error('Ошибка при получении ICP-сегментов:', error)
      res.status(500).json({ error: 'Ошибка при получении сегментов' })
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const segment = await repo.findOne({ where: { id } })
      if (!segment) return res.status(404).json({ error: 'Сегмент не найден' })
      res.json(segment)
    } catch (error) {
      console.error('Ошибка при получении сегмента:', error)
      res.status(500).json({ error: 'Ошибка при получении сегмента' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const segment = repo.create(req.body)
      const saved = await repo.save(segment)
      res.status(201).json(saved)
    } catch (error: unknown) {
      console.error('Ошибка при создании сегмента:', error)
      const msg = error instanceof Error && error.message.includes('duplicate key')
        ? 'Сегмент с таким slug уже существует'
        : 'Ошибка при создании сегмента'
      res.status(500).json({ error: msg })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const segment = await repo.findOne({ where: { id } })
      if (!segment) return res.status(404).json({ error: 'Сегмент не найден' })
      await repo.update(id, req.body)
      const updated = await repo.findOne({ where: { id } })
      res.json(updated)
    } catch (error) {
      console.error('Ошибка при обновлении сегмента:', error)
      res.status(500).json({ error: 'Ошибка при обновлении сегмента' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await repo.delete(id)
      if (result.affected === 0) return res.status(404).json({ error: 'Сегмент не найден' })
      res.json({ message: 'Сегмент удалён' })
    } catch (error) {
      console.error('Ошибка при удалении сегмента:', error)
      res.status(500).json({ error: 'Ошибка при удалении сегмента' })
    }
  },
}
```

**Step 2: Write routes**

```typescript
// backend/src/routes/icp-segment.routes.ts
import { Router } from 'express'
import { icpSegmentController } from '../controllers/icp-segment.controller'

const router = Router()
router.get('/', icpSegmentController.getAll)
router.get('/:id', icpSegmentController.getById)
router.post('/', icpSegmentController.create)
router.put('/:id', icpSegmentController.update)
router.delete('/:id', icpSegmentController.delete)

export default router
```

**Step 3: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/controllers/icp-segment.controller.ts backend/src/routes/icp-segment.routes.ts
git commit -m "feat(backend): ICP segment CRUD endpoints"
```

---

## Task 3 — Backend: strategic-theme controller + routes

**Files:**
- Create: `backend/src/controllers/strategic-theme.controller.ts`
- Create: `backend/src/routes/strategic-theme.routes.ts`

**Step 1: Controller — копируй структуру Task 2, замени:**
- import: `StrategicTheme`
- repo: `AppDataSource.getRepository(StrategicTheme)`
- `getAll` filter: убери `active`. Опциональный фильтр `current` (булевый) — если `current=true`, добавь `where: [{ active_from: IsNull() }, { active_from: LessThanOrEqual(today), active_to: IsNull() }, { active_from: LessThanOrEqual(today), active_to: MoreThanOrEqual(today) }]`. Импорт: `import { IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm'`. Today: `new Date().toISOString().slice(0, 10)`.
- order: `{ sort_order: 'ASC', name: 'ASC' }`.
- сообщения на русском: «темы», «темы не найдены», «slug уже существует».

**Step 2: Routes — идентично Task 2, поменяй имя controller.**

**Step 3: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/controllers/strategic-theme.controller.ts backend/src/routes/strategic-theme.routes.ts
git commit -m "feat(backend): strategic theme CRUD endpoints"
```

---

## Task 4 — Backend: channel-budget controller + routes

**Files:**
- Create: `backend/src/controllers/channel-budget.controller.ts`
- Create: `backend/src/routes/channel-budget.routes.ts`

**Step 1: Controller — копируй Task 2 структуру, отличия:**
- import: `ChannelBudget`
- `getAll`: опциональные query `channel_id`, `from`, `to` (даты). Использовать `find` с `where: { channel_id: ..., period_start: MoreThanOrEqual(from), period_end: LessThanOrEqual(to) }`. Если параметр пустой — не добавлять фильтр.
- order: `{ period_start: 'DESC' }`.
- В `getAll` возвращать также имя канала: `relations: ['channel']`.
- сообщения: «бюджеты», «бюджет не найден».
- Note: `amount_rub` — string (typeorm для `numeric`). Никакой кастомной обработки не надо, axios передаст как строку.

**Step 2: Routes — идентично Task 2.**

**Step 3: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/controllers/channel-budget.controller.ts backend/src/routes/channel-budget.routes.ts
git commit -m "feat(backend): channel budget CRUD endpoints"
```

---

## Task 5 — Backend: channel controller + routes

**Files:**
- Create: `backend/src/controllers/channel.controller.ts`
- Create: `backend/src/routes/channel.routes.ts`

**Step 1: Controller — копируй Task 2 структуру, отличия:**
- import: `Channel`
- `getAll`: опциональные query `platform`, `integration_status`, `active` (string→boolean).
- order: `{ sort_order: 'ASC', display_name: 'ASC' }`.
- `delete`: перед удалением проверить `content_publications` count где `channel_id=id`. Если >0 — вернуть 409 `{ error: 'Канал используется в публикациях, удаление запрещено' }`. Использовать `AppDataSource.query` или `getRepository(ContentPublication).count({ where: { channel_id: id } })`.
- сообщения: «каналы», «канал не найден».

**Step 2: Routes — идентично Task 2.**

**Step 3: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/controllers/channel.controller.ts backend/src/routes/channel.routes.ts
git commit -m "feat(backend): channel CRUD endpoints with delete-guard against active publications"
```

---

## Task 6 — Mount all 5 routers in server.ts

**Files:**
- Modify: `backend/src/server.ts`

**Step 1: Add imports**

В блоке роут-импортов в `server.ts` (после existing imports вроде `content-rubric.routes`, `content-publication.routes`):

```typescript
import brandDocRoutes from './routes/brand-doc.routes';
import icpSegmentRoutes from './routes/icp-segment.routes';
import strategicThemeRoutes from './routes/strategic-theme.routes';
import channelBudgetRoutes from './routes/channel-budget.routes';
import channelRoutes from './routes/channel.routes';
```

(Поищи блок импортов routes и положи новые рядом, не перемешивай с не-route импортами.)

**Step 2: Mount in app.use chain**

После последнего `app.use('/api/...')` под `authMiddleware` (но до catch-all обработчиков 404 / error):

```typescript
app.use('/api/brand-docs', authMiddleware, brandDocRoutes);
app.use('/api/icp-segments', authMiddleware, icpSegmentRoutes);
app.use('/api/strategic-themes', authMiddleware, strategicThemeRoutes);
app.use('/api/channel-budgets', authMiddleware, channelBudgetRoutes);
app.use('/api/channels', authMiddleware, channelRoutes);
```

⚠ Поищи, нет ли уже маршрута `/api/channels`. Поиск:
```bash
grep -n "app.use('/api/channel" backend/src/server.ts
```
Если есть `channel-presets` — это другой ресурс, не конфликтует. Если есть `channels` (без префикса) — стоп и ask.

**Step 3: Typecheck + start backend smoke**

```bash
cd backend && npx tsc --noEmit
```
Expected: 0 errors.

Затем (без запуска dev-сервера, если он уже запущен пользователем на 3001 — конфликт; используй `npm run build` для верификации компиляции):

```bash
npm run build
```
Expected: success.

**Step 4: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat(server): mount marketing-phase-b routes (brand-docs, icp-segments, strategic-themes, channel-budgets, channels)"
```

---

## Task 7 — Frontend: API clients + types

**Files:**
- Modify: `frontend/src/api/types.ts`
- Create: `frontend/src/api/brandDocs.ts`
- Create: `frontend/src/api/icpSegments.ts`
- Create: `frontend/src/api/strategicThemes.ts`
- Create: `frontend/src/api/channelBudgets.ts`
- Create: `frontend/src/api/publishChannels.ts`

**Note про имена:** существующий `frontend/src/api/channels.ts` — это **другой** ресурс (`SalesChannel` для marketplace). Чтобы не конфликтовать — новый файл назовём `publishChannels.ts` (and соответствующий пакет API). UI и labels — всё равно «Каналы публикации».

**Step 1: Add types to `frontend/src/api/types.ts`**

В конец файла, перед `export type ...` или просто в конец:

```typescript
// ─── Marketing Phase B types ─────────────────────────────────────────────────

export interface BrandDoc {
  id: string
  slug: string
  title: string
  content: string
  version: string | null
  created_at: string
  updated_at: string
}

export interface IcpSegment {
  id: string
  slug: string
  name: string
  description: string | null
  age_range: string | null
  role: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface StrategicTheme {
  id: string
  slug: string
  name: string
  description: string | null
  active_from: string | null  // YYYY-MM-DD
  active_to: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type ChannelPlatform =
  | 'telegram' | 'tiktok' | 'reels' | 'youtube' | 'youtube_shorts'
  | 'vk' | 'x' | 'instagram' | 'yandex_zen' | 'site' | 'wb' | 'ozon' | 'email' | 'other'

export type ChannelIntegrationStatus = 'manual' | 'api_connected' | 'api_planned'

export interface PublishChannel {
  id: string
  slug: string
  display_name: string
  platform: ChannelPlatform
  account_handle: string | null
  profile_url: string | null
  integration_status: ChannelIntegrationStatus
  active: boolean
  config_json: Record<string, unknown> | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ChannelBudget {
  id: string
  channel_id: string
  channel?: PublishChannel  // optional, заполняется через relations
  period_start: string
  period_end: string
  amount_rub: string  // numeric → string
  notes: string | null
  created_at: string
  updated_at: string
}
```

**Step 2: Create API clients**

`frontend/src/api/icpSegments.ts`:
```typescript
import { createCrudApi } from './crudFactory'
import { IcpSegment } from './types'

export const icpSegmentsApi = createCrudApi<IcpSegment>('/icp-segments')
```

`frontend/src/api/strategicThemes.ts`:
```typescript
import { createCrudApi } from './crudFactory'
import { StrategicTheme } from './types'

export const strategicThemesApi = createCrudApi<StrategicTheme>('/strategic-themes')
```

`frontend/src/api/channelBudgets.ts`:
```typescript
import { createCrudApi } from './crudFactory'
import { ChannelBudget } from './types'

export const channelBudgetsApi = createCrudApi<ChannelBudget>('/channel-budgets')
```

`frontend/src/api/publishChannels.ts`:
```typescript
import { createCrudApi } from './crudFactory'
import { PublishChannel } from './types'

export const publishChannelsApi = createCrudApi<PublishChannel>('/channels')
```

`frontend/src/api/brandDocs.ts` (не CRUD-фактори — отличается endpoint shape):
```typescript
import { apiClient } from './client'
import { BrandDoc } from './types'

export const brandDocsApi = {
  list: async (): Promise<BrandDoc[]> => {
    const res = await apiClient.get<BrandDoc[]>('/brand-docs')
    return res.data
  },
  get: async (slug: string): Promise<BrandDoc | null> => {
    try {
      const res = await apiClient.get<BrandDoc>(`/brand-docs/${slug}`)
      return res.data
    } catch (e: any) {
      if (e?.response?.status === 404) return null
      throw e
    }
  },
  upsert: async (slug: string, payload: { title?: string; content: string; version?: string | null }): Promise<BrandDoc> => {
    const res = await apiClient.put<BrandDoc>(`/brand-docs/${slug}`, payload)
    return res.data
  },
}
```

**Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit && cd ..
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/api/brandDocs.ts frontend/src/api/icpSegments.ts frontend/src/api/strategicThemes.ts frontend/src/api/channelBudgets.ts frontend/src/api/publishChannels.ts
git commit -m "feat(frontend-api): marketing phase B API clients + types (brandDocs, icpSegments, strategicThemes, channelBudgets, publishChannels)"
```

---

## Task 8 — Frontend page: `/settings/channels`

**Files:**
- Create: `frontend/src/pages/PublishChannels.tsx`

**Context:** CRUD-страница для `PublishChannel`. Образец стиля и шаблона — `frontend/src/pages/Counterparties.tsx`. Цель — таблица + inline-форма для добавления / редактирования. Минимум полей в форме (slug, display_name, platform, account_handle, profile_url, integration_status, active). `config_json` не редактируем на v1.

**Step 1: Open Counterparties.tsx и СНАЧАЛА прочитай весь файл целиком** — нужно увидеть паттерн: state, useEffect, toast, обработчики submit / delete, рендер таблицы и формы. Не пиши свою версию без чтения этого файла.

**Step 2: Скопируй структуру в `PublishChannels.tsx`, заменив:**
- entity type на `PublishChannel`
- API client на `publishChannelsApi`
- Title: «Каналы публикации»
- Header subtitle: «Площадки, на которых публикуется контент. Используются модулем контент-маркетинга и аналитикой.»
- Form fields:
  - `slug` (input, required, hint: «уникальный идентификатор; для каналов с публикациями — должен совпадать с legacy network: tiktok / instagram / youtube»)
  - `display_name` (input, required)
  - `platform` (select из union — все 14 значений из ChannelPlatform, locale labels русские, e.g. `telegram → 'Telegram'`, `tiktok → 'TikTok'`, etc.)
  - `account_handle` (input, optional)
  - `profile_url` (input, optional)
  - `integration_status` (select: manual / api_connected / api_planned; русские labels: «Ручная публикация», «API подключён», «Планируется API»)
  - `active` (checkbox, default true)
- Table columns: slug, display_name, platform (badge), account_handle, integration_status (badge), active (checkmark), actions.
- При delete → confirm dialog «Удалить канал? Это нельзя отменить.» через `ConfirmDialogContext`.
- При ошибке от backend (409) — toast: «Канал используется в публикациях, удаление запрещено».

**Step 3: Build + lint check**

```bash
cd frontend && npx tsc --noEmit && cd ..
```
Expected: 0 errors. Если линтер ругается на unused imports — почистить.

**Step 4: Commit**

```bash
git add frontend/src/pages/PublishChannels.tsx
git commit -m "feat(frontend): PublishChannels (/settings/channels) CRUD page"
```

---

## Task 9 — Frontend page: `/marketing/strategy`

**Files:**
- Create: `frontend/src/pages/MarketingStrategy.tsx`

**Context:** Сложная страница из 4 секций. Чтобы не утопить implementer-subagent в одной мегатаске — он сделает minimal-viable версию: markdown-редактор (без preview) + 3 простейшие inline-CRUD таблицы (сегменты / темы / бюджеты).

**Структура страницы (на одном экране, верхне-нижняя композиция, без табов):**

```
┌─────────────────────────────────────────────────────────┐
│  Маркетинг-стратегия                                    │
│  (header + subtitle)                                    │
├─────────────────────────────────────────────────────────┤
│  Секция 1: Стратегический документ                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │ <textarea value=content rows=20>                 │  │
│  └──────────────────────────────────────────────────┘  │
│  [Сохранить]                                            │
├─────────────────────────────────────────────────────────┤
│  Секция 2: ICP-сегменты                                 │
│  Inline-table с add-form и rows                         │
├─────────────────────────────────────────────────────────┤
│  Секция 3: Стратегические темы                          │
│  Inline-table                                           │
├─────────────────────────────────────────────────────────┤
│  Секция 4: Бюджеты каналов                              │
│  Inline-table                                           │
└─────────────────────────────────────────────────────────┘
```

**Step 1: Прочитай Counterparties.tsx ещё раз — нам нужен паттерн inline CRUD-таблицы. Также прочитай `frontend/src/pages/Categories.tsx` — там тоже простая CRUD структура.**

**Step 2: Создай `frontend/src/pages/MarketingStrategy.tsx`** со следующей структурой:

- State:
  - `strategyDoc: BrandDoc | null` + `editingContent: string` для редактора
  - `segments: IcpSegment[]`, `newSegment: Partial<IcpSegment>`
  - `themes: StrategicTheme[]`, `newTheme: Partial<StrategicTheme>`
  - `budgets: ChannelBudget[]`, `channels: PublishChannel[]` (для select-а в форме бюджета), `newBudget: Partial<ChannelBudget>`
- На mount: параллельно загрузить все 4 ресурса через `Promise.all` + `brandDocsApi.get('strategy_current')`.
- Если `strategy_current` отсутствует (null) — `editingContent = ''`, save через `upsert` создаст.
- **Секция стратегии:**
  - `<textarea>` (Tailwind: `w-full min-h-[24rem] p-4 border rounded`). Подсказка над ним: «Стратегический документ в markdown. Используется AI-промптами при генерации контента.»
  - Кнопка «Сохранить» → `brandDocsApi.upsert('strategy_current', { title: 'Маркетинг-стратегия', content: editingContent })`.
  - Toast при успехе.
- **Секция ICP-сегменты:**
  - Header «ICP-сегменты» + subtitle «Целевые аудитории, к которым относятся контент-юниты и рекламные кампании.»
  - Inline add-form в одну строку: `slug` / `name` / `age_range` / `role` / [+ Добавить].
  - Table: slug / name / description (truncated) / age_range / role / active / actions (edit-toggle / delete).
  - Edit: модально через `prompt` или inline-edit с двойным кликом — простейшая версия. На v1 допустимо: «Удалить и создать заново» если редактирование не реализуется. Лучше всё-таки realy простой inline edit: при клике на ряд — открывается expanded form под рядом, с теми же полями + textarea для description.
- **Секция Стратегические темы:**
  - Add-form: `slug` / `name` / `active_from` (date) / `active_to` (date) / [+ Добавить].
  - Table: slug / name / description (truncated) / active_from / active_to / actions.
- **Секция Бюджеты каналов:**
  - Add-form: `channel_id` (select из channels) / `period_start` / `period_end` / `amount_rub` (number input) / [+ Добавить].
  - Table: channel.display_name / period_start / period_end / amount_rub (форматировано как `123 456 ₽`) / notes / actions.
  - При сохранении: amount_rub — toString().

**Минимализм:** Если subagent видит, что страница превышает ~600 строк JSX, разреши ему вынести каждую секцию в отдельный компонент в этом же файле (`<StrategyDocSection/>`, `<SegmentsSection/>`, etc.). НЕ создавай отдельных файлов — keep cohesion.

**Step 3: Build check**

```bash
cd frontend && npx tsc --noEmit && cd ..
```

**Step 4: Commit**

```bash
git add frontend/src/pages/MarketingStrategy.tsx
git commit -m "feat(frontend): MarketingStrategy (/marketing/strategy) page with markdown editor + ICP/themes/budgets sections"
```

---

## Task 10 — Routing in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Add lazy imports**

После существующих `const VoiceoverStudio = lazy(...)`:

```typescript
const MarketingStrategy = lazy(() => import('./pages/MarketingStrategy'))
const PublishChannels = lazy(() => import('./pages/PublishChannels'))
```

**Step 2: Add routes**

Внутри `<Routes>` блока (protected routes), рядом с существующими content-bank routes:

```typescript
<Route path="/marketing/strategy" element={<MarketingStrategy />} />
<Route path="/settings/channels" element={<PublishChannels />} />
```

**Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit && cd ..
```

**Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend-routing): /marketing/strategy + /settings/channels"
```

---

## Task 11 — Layout sidebar reorganization

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Context:** Контент-банк и Войсовер переезжают из «Планирования» в новую секцию «Маркетинг». URL остаются: `/content-bank`, `/voiceover` (PRD §7.6 говорит про редиректы, но мы делаем light-touch — sidebar only). Phase E добавит «Аналитика»; пока — placeholder без href или skip.

**Step 1: Add icon SVG (если ещё нет похожих)**

Найди в файле существующий icon вроде `IconContent` — он уже подходит. Добавь новый `IconMarketing`:

```typescript
const IconMarketing = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
)
```

Иконка — мегафон. Локация в коде — рядом с другими иконками в начале файла.

**Step 2: Remove «Контент-банк» и «Войсовер» из планирования**

В блоке `id: 'planning'` (см. `Layout.tsx:319-329`), удали строки 326-327 (Контент-банк, Войсовер).

**Step 3: Add new «Маркетинг» group**

Вставь новый блок ПОСЛЕ `id: 'planning'` и ДО `id: 'marketplaces'`:

```typescript
  {
    id: 'marketing',
    label: 'Маркетинг',
    items: [
      { type: 'link', name: 'Стратегия', href: '/marketing/strategy', icon: IconMarketing },
      { type: 'link', name: 'Контент-банк', href: '/content-bank', icon: IconContent },
      { type: 'link', name: 'Войсовер', href: '/voiceover', icon: IconMic },
    ],
  },
```

**Step 4: Add «Каналы публикации» в «Настройки»**

В блоке `id: 'settings'`, после `Каналы продаж`:

```typescript
      { type: 'link', name: 'Каналы публикации', href: '/settings/channels', icon: IconMarketing },
```

(Используй `IconMarketing` или придумай другой; повторное использование иконки допустимо.)

**Step 5: Typecheck + build**

```bash
cd frontend && npm run build && cd ..
```
Expected: успех. Если есть error про unused imports (`IconContent`, `IconMic` могли остаться неиспользованные? нет — они теперь в группе marketing) — почистить.

**Step 6: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat(layout): reorganize sidebar — new Маркетинг group, Контент-банк + Войсовер moved from Планирование, Каналы публикации in Настройки"
```

---

## Task 12 — Smoke test + finalize

**Files:** (no code changes)

**Step 1: Confirm everything still compiles**

```bash
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
```
Оба — exit 0.

**Step 2: Backend live smoke**

Если у пользователя уже запущен backend (порт 3001) — не дублируй, используй его. Иначе:

```bash
cd backend && npm run dev > /tmp/phase-b-smoke.log 2>&1 &
sleep 8
```

Проверь, что новые endpoints отвечают (нужен JWT — пропусти эту проверку если нет легкого способа получить токен, или вытащи токен из user's браузера и используй):

```bash
# Get user's JWT from a fresh login (см. /api/auth/login) — если уже работает в браузере,
# можешь скопировать токен из localStorage через DevTools. Иначе пропусти.
TOKEN="<paste-from-localStorage>"

curl -sf -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/icp-segments | jq 'length'
curl -sf -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/strategic-themes | jq 'length'
curl -sf -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/channel-budgets | jq 'length'
curl -sf -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/channels | jq 'length'
curl -sf -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/brand-docs | jq 'length'
```
Expected: 0, 0, 0, 8 (8 каналов из Phase A seed), 4 (BrandDoc-и из Voiceover).

Если smoke не делается через curl — отметь, что smoke deferred to UI verification.

**Step 3: Frontend live smoke (если есть преview доступ)**

Откроется в браузере по `http://localhost:5173`. Пройти:
- Sidebar показывает «Маркетинг» с тремя элементами.
- `/marketing/strategy` рендерится без ошибок: 4 секции, можно сохранить пустую стратегию, можно добавить ICP-сегмент / тему / бюджет (last needs существующий канал, есть из Phase A seed).
- `/settings/channels` показывает 8 каналов (seed), можно добавить новый, можно edit/delete.
- `/content-bank` всё ещё работает.

**Step 4: Mark Phase B complete in plan header**

В этом файле сверху замени строку Status:
```
**Status:** Phase B complete on YYYY-MM-DD. Ready for Phase C (recipe-engine + per-type pipelines).
```

```bash
git add docs/plans/2026-05-12-marketing-phase-b-strategy-channels-ui.md
git commit -m "docs(plans): mark marketing phase B complete"
```

**Step 5: Push both remotes**

```bash
git push origin HEAD
git push vercel-deploy HEAD
```

---

## Post-Phase-B — что должно быть на момент закрытия

- 5 новых backend controllers + routes (brand-docs, icp-segments, strategic-themes, channel-budgets, channels), смонтированы под `authMiddleware`.
- 5 новых frontend API clients + расширенный `types.ts`.
- 2 новые страницы: `/marketing/strategy` (4 секции), `/settings/channels` (CRUD).
- Sidebar: новая секция «Маркетинг» (Стратегия / Контент-банк / Войсовер), пункт «Каналы публикации» в «Настройках».
- Existing /content-bank, /voiceover работают как раньше.
- TypeScript-сборки backend и frontend чистые.

## Что НЕ делается в Phase B

- Markdown preview / WYSIWYG для стратегии — на v1 чистый textarea.
- Reorganization URL-paths (`/content-bank` → `/marketing/content-bank` — defer).
- `/marketing/analytics` placeholder — Phase E.
- Recipe-engine, AI-assist для новых типов контента — Phase C.
- RBAC, multi-user, share-links для стратегии — out-of-scope полностью.
- Drop `content_publications.network` column + NOT NULL на `channel_id` — отдельная мини-миграция после Phase B верификации.

---

## Anti-pitfalls

- **Не пересоздавай `frontend/src/api/channels.ts`** — это уже существующий файл для SalesChannel (marketplace). Новый файл — `publishChannels.ts`.
- **Не модифицируй existing endpoint `/api/sales-channels`** — он отдельный.
- **`amount_rub` приходит как string** из backend (TypeORM `numeric` → `string`). При вычислениях во фронте — `parseFloat(b.amount_rub)`. При сохранении — `Number(input).toString()`.
- **Воспроизведи Counterparty UX pattern, а не выдумывай свой.** Существующие страницы (Counterparties, Categories, Employees) — ground truth.
- **Не вводи новые библиотеки** (react-hook-form, formik, react-markdown, monaco-editor). Если subagent захочет — стоп и спроси. Контекст: проект минималистичный, локальный state + контролируемые inputs.
- **Не пиши tests** — нет фреймворка.
- **При смерж-конфликте с existing voiceover.controller.ts** (он читает brand_docs напрямую) — не трогай. Параллельный доступ через нашу `brand_docs CRUD` — нормально, не дублирование.
- **`integration_status` field в DB защищён CHECK constraint** (Phase A) — POST с неправильным значением вернёт 500 от Postgres. UI должен использовать select, не свободный ввод.

---

## Открытые вопросы (для будущих фаз)

- Markdown preview — react-markdown vs встроенный простой парсер vs CodeMirror. Сейчас YAGNI, добавим если оператор пожалуется.
- ICPSegment редактирование description в обычной форме vs модалка — посмотрим на UX feedback.
- Когда будет много сегментов/тем — может понадобиться bulk-import (CSV) или AI-генератор сегментов из стратегического документа. Phase X.
- Аналитика по бюджетам vs факту (модус K) — Phase E.
