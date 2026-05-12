# Marketing Unit — Phase D (Telegram Bot Publisher + auto-publication worker) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** ✅ Phase D complete on 2026-05-12. Next: Phase E (analytics worker + KPI dashboard) или hardening (real Telegram bot token, тестовая публикация).

**Goal:** Заложить инфраструктуру авто-публикации контента в каналы с `integration_status='api_connected'`. На v1 — одна реализация Publisher (Telegram через существующий `node-telegram-bot-api`) и cron-воркер, забирающий из `content_publications` записи с `auto_publish=true` и публикующий их.

**Architecture:** Generic `ChannelPublisher` интерфейс. Telegram-реализация использует существующий ленивый `getBot()` из `backend/src/services/telegram.service.ts` (не плодим нового бота). Каналы хранят `chat_id` в `channel.config_json` (поле уже есть из Phase A). Воркер на `node-cron` (уже в зависимостях) тикает каждую минуту, атомарно «забирает» pending-публикацию через мьютекс на ID, публикует, записывает результат. Контент берётся из `content_unit.recipe_state.steps` (шаг `final.artifact_text` — для рецептованных типов), иначе fallback `title + essence`. UI: `auto_publish` чекбокс per-row в `PublicationsEditor`, поле `chat_id` в `PublishChannels` для `platform=telegram`.

**Tech Stack:** Express + TypeORM + `node-telegram-bot-api` + `node-cron` — всё уже установлено. React 18 + TS на фронте.

**Parent docs:**
- [Operating model](2026-05-11-marketing-unit-operating-model-design.md)
- [Content production PRD](2026-05-11-content-production-prd-design.md) §6 (Publisher слой), §8 Phase D
- [Phase A foundation](2026-05-11-marketing-phase-a-foundation.md) — `auto_publish`, `publisher_log`, `channel.config_json` колонки уже есть.
- [Phase B UI](2026-05-12-marketing-phase-b-strategy-channels-ui.md) — PublishChannels + base CRUD.
- [Phase C recipe-engine](2026-05-12-marketing-phase-c-recipe-engine.md) — `recipe_state` источник текста.

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
3. Проверь `backend/.env`:
   - `TELEGRAM_BOT_TOKEN` — должен быть (используется в существующем `telegram.service.ts`). Если нет — Telegram-публикации не заработают; стоп и спроси пользователя, готов ли он создать тестового бота через @BotFather.

---

## Architectural decisions (read before any task)

### Publisher интерфейс

```typescript
// backend/src/services/publishers/types.ts
export interface PublishContext {
  unit: ContentUnit
  channel: Channel
  publication: ContentPublication
}

export interface PublishResult {
  published_url: string | null
  raw_response: unknown
}

export interface ChannelPublisher {
  /** Returns true if this publisher can handle (unit, channel) given current state. */
  canPublish(ctx: PublishContext): boolean
  /** Performs the actual API call. Throws on failure. */
  publish(ctx: PublishContext): Promise<PublishResult>
}
```

### Registry

```typescript
// backend/src/services/publishers/registry.ts
import type { ChannelPublisher } from './types'
import { telegramPublisher } from './telegram-publisher'

// Keyed by channel.platform. v1 supports 'telegram'. Future: 'vk', 'youtube'.
const PUBLISHERS: Record<string, ChannelPublisher> = {
  telegram: telegramPublisher,
}

export function getPublisher(platform: string): ChannelPublisher | null {
  return PUBLISHERS[platform] ?? null
}
```

### Telegram publisher

Использует существующий `getBot()` из `services/telegram.service.ts` (не дублируем). Читает `chat_id` из `channel.config_json.chat_id`. Текст:
1. Сначала `recipe_state.steps[i]` где `step_id === 'final'` и `status === 'completed'` → `artifact_text`.
2. Если нет recipe или final не completed — fallback: `title` (как заголовок жирным) + `essence` (если есть) + `notes` (если есть).

`bot.sendMessage(chat_id, text, { parse_mode: 'HTML', disable_web_page_preview: false })` — текст эскейпится `escapeHtml`. `published_url` собираем из chat_id + message_id (`https://t.me/c/<chat_id_trimmed>/<message_id>`) для приватных чатов, или из chat username для публичных.

### Content extraction helper

```typescript
// backend/src/services/publishers/content-extract.ts
import type { ContentUnit } from '../../entities/ContentUnit'
import { isRecipeState } from '../recipe-engine'

export function extractPublishText(unit: ContentUnit): string {
  // 1. Try recipe final step
  if (isRecipeState(unit.recipe_state)) {
    const final = unit.recipe_state.steps.find(
      (s) => s.step_id === 'final' && s.status === 'completed',
    )
    if (final?.artifact_text?.trim()) return final.artifact_text.trim()
    // accept awaiting_review final too — operator may want to publish without click-through
    const final2 = unit.recipe_state.steps.find((s) => s.step_id === 'final')
    if (final2?.artifact_text?.trim()) return final2.artifact_text.trim()
  }
  // 2. Fallback to title + essence + notes (joined with double newlines)
  const parts: string[] = []
  if (unit.title?.trim()) parts.push(unit.title.trim())
  if (unit.essence?.trim()) parts.push(unit.essence.trim())
  if (unit.notes?.trim()) parts.push(unit.notes.trim())
  return parts.join('\n\n') || '(пусто)'
}
```

### Worker

```typescript
// backend/src/services/publish-worker.ts (high-level shape, full impl in Task)
import cron from 'node-cron'
import { AppDataSource } from '../config/database'
import { ContentPublication } from '../entities/ContentPublication'
import { Channel } from '../entities/Channel'
import { ContentUnit } from '../entities/ContentUnit'
import { getPublisher } from './publishers/registry'
import { extractPublishText } from './publishers/content-extract'

const MAX_ATTEMPTS = 3
const inFlight = new Set<string>()  // process-local mutex by publication.id

export async function tickPublishWorker(): Promise<void> {
  const repo = AppDataSource.getRepository(ContentPublication)
  const now = new Date()
  const candidates = await repo
    .createQueryBuilder('cp')
    .leftJoinAndSelect('cp.channel', 'channel')
    .leftJoinAndSelect('cp.content_unit', 'unit')
    .where('cp.auto_publish = :ap', { ap: true })
    .andWhere('cp.published_at IS NULL')
    .andWhere('cp.scheduled_at IS NOT NULL')
    .andWhere('cp.scheduled_at <= :now', { now })
    .andWhere('cp.channel_id IS NOT NULL')
    .orderBy('cp.scheduled_at', 'ASC')
    .limit(20)
    .getMany()

  for (const pub of candidates) {
    if (inFlight.has(pub.id)) continue
    inFlight.add(pub.id)
    try {
      await processPublication(pub)
    } catch (e) {
      console.error(`[publish-worker] ${pub.id} fatal:`, e)
    } finally {
      inFlight.delete(pub.id)
    }
  }
}

async function processPublication(pub: ContentPublication): Promise<void> {
  const repo = AppDataSource.getRepository(ContentPublication)
  const channel = pub.channel
  const unit = pub.content_unit
  if (!channel || !unit) return  // shouldn't happen with the joins above

  const publisher = getPublisher(channel.platform)
  const attempts = (pub.publisher_log as any)?.attempts ?? 0

  if (!publisher) {
    await repo.update(pub.id, {
      auto_publish: false,
      publisher_log: {
        ...(pub.publisher_log as any || {}),
        last_error: `Publisher для платформы "${channel.platform}" не зарегистрирован`,
        attempts,
        last_attempt_at: new Date().toISOString(),
      } as any,
    })
    return
  }

  try {
    const result = await publisher.publish({ unit, channel, publication: pub })
    await repo.update(pub.id, {
      published_at: new Date(),
      published_url: result.published_url,
      publisher_log: {
        ...(pub.publisher_log as any || {}),
        success: true,
        attempts: attempts + 1,
        completed_at: new Date().toISOString(),
        raw: result.raw_response,
      } as any,
    })
    console.log(`[publish-worker] ${pub.id} published to ${channel.slug}`)
  } catch (e: any) {
    const newAttempts = attempts + 1
    const giveUp = newAttempts >= MAX_ATTEMPTS
    await repo.update(pub.id, {
      auto_publish: giveUp ? false : true,
      publisher_log: {
        ...(pub.publisher_log as any || {}),
        last_error: String(e?.message ?? e),
        attempts: newAttempts,
        last_attempt_at: new Date().toISOString(),
        gave_up: giveUp,
      } as any,
    })
    console.error(`[publish-worker] ${pub.id} attempt ${newAttempts} failed:`, e?.message ?? e)
  }
}

let _scheduled: cron.ScheduledTask | null = null

/** Start the cron worker. Idempotent — safe to call multiple times. */
export function startPublishWorker(): void {
  if (_scheduled) return
  // Every minute. Catches up on missed schedule windows because we query by scheduled_at <= now().
  _scheduled = cron.schedule('* * * * *', () => {
    tickPublishWorker().catch((e) => console.error('[publish-worker] tick crashed:', e))
  })
  console.log('[publish-worker] started (cron: every minute)')
}

export function stopPublishWorker(): void {
  if (_scheduled) {
    _scheduled.stop()
    _scheduled = null
  }
}
```

### Server.ts wiring

```typescript
// inside bootstrap(), after DB initialize, before app.listen:
import { startPublishWorker } from './services/publish-worker'
// ...
startPublishWorker()
```

### Manual trigger endpoint (для тестов и operator urgency)

`POST /api/content-publications/:id/publish-now` — same logic as worker, but for a single publication. Игнорит `scheduled_at` (публикует сразу).

### Frontend changes

1. `PublishChannels.tsx`:
   - Условный edit-block для `platform === 'telegram'`: поле `Telegram chat_id` редактирует `config_json.chat_id`.
   - Если оператор задал chat_id → автоматически предлагаем `integration_status = 'api_connected'` (без принудительного авто-флипа — checkbox с пояснением).
2. `PublicationsEditor.tsx`:
   - Per-row чекбокс «Авто-публикация» → меняет `auto_publish` для записи.
   - Disabled, если канал не имеет `integration_status === 'api_connected'`. Tooltip: «Канал не настроен для авто-публикации».
   - Чтобы знать `integration_status` без extra fetch — frontend подгрузит список каналов один раз в редакторе.

### Backend publication endpoint changes

- `create` и `update` — accept `auto_publish` поле как есть (TypeORM `repo.update(req.body)` уже принимает любые поля entity-я).
- **Channel_id auto-resolve**: если в payload приходит `network` без `channel_id`, backend ищет channel по `slug = network` и подставляет `channel_id`. Без этого новые публикации не попадут к воркеру (поле останется null). Это маленькая правка в controller.

### Phase D НЕ делает

- VK / YouTube publishers — будущие фазы.
- Auto-flip integration_status — оператор сам отмечает.
- Media-attachments (картинки/видео) — только текст. Media в Phase E.
- Reply / edit message — только новые посты.
- Retry с экспоненциальным backoff — на v1 простой counter ≤ MAX_ATTEMPTS.
- Drop `network` column из `content_publications` — отдельно после полной верификации.
- Channel-budget facts tracking from Telegram (post stats) — Phase E аналитика.

---

## Tasks

### Task 1 — Publisher interface + content-extract helper

**Files:**
- Create: `backend/src/services/publishers/types.ts`
- Create: `backend/src/services/publishers/content-extract.ts`

**Step 1: types.ts**

```typescript
import type { ContentUnit } from '../../entities/ContentUnit'
import type { Channel } from '../../entities/Channel'
import type { ContentPublication } from '../../entities/ContentPublication'

export interface PublishContext {
  unit: ContentUnit
  channel: Channel
  publication: ContentPublication
}

export interface PublishResult {
  published_url: string | null
  raw_response: unknown
}

export interface ChannelPublisher {
  canPublish(ctx: PublishContext): boolean
  publish(ctx: PublishContext): Promise<PublishResult>
}
```

**Step 2: content-extract.ts**

```typescript
import type { ContentUnit } from '../../entities/ContentUnit'
import { isRecipeState } from '../recipe-engine'

export function extractPublishText(unit: ContentUnit): string {
  // Prefer recipe's final step text
  if (isRecipeState(unit.recipe_state)) {
    const completedFinal = unit.recipe_state.steps.find(
      (s) => s.step_id === 'final' && s.status === 'completed',
    )
    if (completedFinal?.artifact_text?.trim()) return completedFinal.artifact_text.trim()
    const anyFinal = unit.recipe_state.steps.find((s) => s.step_id === 'final')
    if (anyFinal?.artifact_text?.trim()) return anyFinal.artifact_text.trim()
  }
  // Fallback for non-recipe types or empty recipe state
  const parts: string[] = []
  if (unit.title?.trim()) parts.push(unit.title.trim())
  if (unit.essence?.trim()) parts.push(unit.essence.trim())
  if (unit.notes?.trim()) parts.push(unit.notes.trim())
  return parts.join('\n\n') || '(пусто)'
}
```

**Step 3: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/services/publishers/types.ts backend/src/services/publishers/content-extract.ts
git commit -m "feat(publishers): ChannelPublisher interface + extractPublishText helper"
```

---

### Task 2 — TelegramBotPublisher

**Files:**
- Create: `backend/src/services/publishers/telegram-publisher.ts`

**Step 1: Inspect existing bot**

```bash
grep -n "getBot\|export\b" backend/src/services/telegram.service.ts | head -20
```

Find: existing module has `getBot()` (private/internal). For Phase D we need that function exported, OR we duplicate the lazy-singleton pattern. Decision: **export `getBot` from `telegram.service.ts`** so publisher can reuse the same bot instance (one Telegram connection per process). Quick modification:

In `backend/src/services/telegram.service.ts`, locate `function getBot()` and add `export`:

```typescript
export function getBot(): TelegramBot | null { ... }
```

Also export `escapeHtml` similarly (it's likely already exported — verify with grep).

**Step 2: telegram-publisher.ts**

```typescript
import type { ChannelPublisher, PublishContext, PublishResult } from './types'
import { extractPublishText } from './content-extract'
import { getBot, escapeHtml } from '../telegram.service'

function trimChatId(chatId: string): string {
  // Telegram returns negative ints for groups/channels. For URL: https://t.me/c/{abs_id_minus_minus_100}/{msg_id}
  // Public channels: https://t.me/{username}/{msg_id}.
  // We don't know username from chat_id alone here; just trim leading -100 for private.
  const s = String(chatId)
  if (s.startsWith('-100')) return s.substring(4)
  if (s.startsWith('-')) return s.substring(1)
  return s
}

export const telegramPublisher: ChannelPublisher = {
  canPublish(ctx: PublishContext): boolean {
    if (ctx.channel.platform !== 'telegram') return false
    const config = ctx.channel.config_json as Record<string, unknown> | null
    return !!(config?.chat_id)
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const bot = getBot()
    if (!bot) throw new Error('TELEGRAM_BOT_TOKEN не задан в env')
    const config = ctx.channel.config_json as Record<string, unknown> | null
    const chatId = config?.chat_id
    if (!chatId) throw new Error(`У канала "${ctx.channel.slug}" не задан chat_id в config_json`)

    const rawText = extractPublishText(ctx.unit)
    const escaped = escapeHtml(rawText)
    // Telegram limit: 4096 chars for text message. Truncate with marker if longer.
    const safe = escaped.length > 4000 ? escaped.slice(0, 4000) + '\n…' : escaped

    const msg = await bot.sendMessage(String(chatId), safe, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    })

    // Build public URL — best-effort
    const trimmed = trimChatId(String(chatId))
    const url = `https://t.me/c/${trimmed}/${msg.message_id}`

    return {
      published_url: url,
      raw_response: {
        message_id: msg.message_id,
        chat: msg.chat,
        date: msg.date,
      },
    }
  },
}
```

**Step 3: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/services/telegram.service.ts backend/src/services/publishers/telegram-publisher.ts
git commit -m "feat(publishers): TelegramBotPublisher (reuses existing bot, sends HTML-escaped text)"
```

---

### Task 3 — Publisher registry

**Files:**
- Create: `backend/src/services/publishers/registry.ts`

**Step 1: Write**

```typescript
import type { ChannelPublisher } from './types'
import { telegramPublisher } from './telegram-publisher'

// Keyed by channel.platform. Append-only — new publishers added in their own commit.
const PUBLISHERS: Record<string, ChannelPublisher> = {
  telegram: telegramPublisher,
}

export function getPublisher(platform: string): ChannelPublisher | null {
  return PUBLISHERS[platform] ?? null
}

export function listSupportedPlatforms(): string[] {
  return Object.keys(PUBLISHERS)
}
```

**Step 2: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/services/publishers/registry.ts
git commit -m "feat(publishers): registry (telegram only on v1)"
```

---

### Task 4 — Publish worker

**Files:**
- Create: `backend/src/services/publish-worker.ts`

**Step 1: Write full worker** (use code from "Architectural decisions / Worker" section above — copy verbatim).

**Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit && cd ..
```
Expected: 0. Если падает на `cron.ScheduledTask` — поправь импорт (`import cron, { ScheduledTask } from 'node-cron'` или `import * as cron from 'node-cron'`; смотри как используется в других местах через `grep -rn "node-cron" backend/src`).

**Step 3: Commit**

```bash
git add backend/src/services/publish-worker.ts
git commit -m "feat(publishers): publish-worker (cron every minute, per-publication mutex, 3 retries)"
```

---

### Task 5 — Wire worker into server.ts

**Files:**
- Modify: `backend/src/server.ts`

**Step 1: Add import + start call**

В `server.ts` найди `bootstrap()` (или эквивалентную функцию старта). После успешной инициализации DataSource (`AppDataSource.initialize()`), но до `app.listen()`:

```typescript
import { startPublishWorker } from './services/publish-worker'
// ...
startPublishWorker()
```

Если в файле есть существующий блок старта (например, `console.log('✅ База данных подключена...')`), вставь `startPublishWorker()` сразу после него.

**Step 2: Typecheck + build**

```bash
cd backend && npx tsc --noEmit && npm run build && cd ..
```

**Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat(server): start publish-worker after DB init"
```

---

### Task 6 — Manual trigger endpoint

**Files:**
- Modify: `backend/src/controllers/content-publication.controller.ts`
- Modify: `backend/src/routes/content-publication.routes.ts`

**Step 1: Add controller method**

В `content-publication.controller.ts` импорты:
```typescript
import { Channel } from '../entities/Channel'
import { ContentUnit } from '../entities/ContentUnit'
import { getPublisher } from '../services/publishers/registry'
```

Добавь метод в объект `contentPublicationController`:

```typescript
async publishNow(req: Request, res: Response) {
  try {
    const { id } = req.params
    const pub = await repo.findOne({
      where: { id },
      relations: ['channel', 'content_unit'],
    })
    if (!pub) return res.status(404).json({ error: 'Публикация не найдена' })
    if (!pub.channel) return res.status(400).json({ error: 'У публикации не задан channel_id' })
    if (!pub.content_unit) return res.status(400).json({ error: 'У публикации не найден content_unit' })

    const publisher = getPublisher(pub.channel.platform)
    if (!publisher) {
      return res.status(400).json({ error: `Publisher для "${pub.channel.platform}" не зарегистрирован` })
    }
    if (!publisher.canPublish({ unit: pub.content_unit, channel: pub.channel, publication: pub })) {
      return res.status(400).json({ error: 'Канал не готов к публикации (проверь config_json, например chat_id)' })
    }

    const result = await publisher.publish({
      unit: pub.content_unit,
      channel: pub.channel,
      publication: pub,
    })

    const attempts = (pub.publisher_log as any)?.attempts ?? 0
    await repo.update(pub.id, {
      published_at: new Date(),
      published_url: result.published_url,
      publisher_log: {
        ...(pub.publisher_log as any || {}),
        success: true,
        attempts: attempts + 1,
        completed_at: new Date().toISOString(),
        raw: result.raw_response,
        manual: true,
      } as any,
    })
    const updated = await repo.findOne({ where: { id } })
    res.json(updated)
  } catch (e: any) {
    console.error('Ошибка ручной публикации:', e)
    res.status(500).json({ error: e?.message || 'Ошибка публикации' })
  }
},
```

**Step 2: Add route**

В `backend/src/routes/content-publication.routes.ts`:
```typescript
router.post('/:id/publish-now', contentPublicationController.publishNow)
```

**Step 3: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/controllers/content-publication.controller.ts backend/src/routes/content-publication.routes.ts
git commit -m "feat(publications): POST /:id/publish-now manual trigger endpoint"
```

---

### Task 7 — Channel_id auto-resolve on POST/PUT

**Files:**
- Modify: `backend/src/controllers/content-publication.controller.ts`

**Context:** Frontend `PublicationsEditor` пока шлёт `{ network: 'telegram', ... }` без `channel_id`. Чтобы worker мог найти канал, делаем auto-resolve в controller. Phase E может полностью убрать `network` слово.

**Step 1: Add resolver helper at top of file**

```typescript
import { Channel } from '../entities/Channel'

async function resolveChannelId(body: Record<string, unknown>): Promise<void> {
  if (body.channel_id || !body.network) return  // already resolved or no slug
  const channel = await AppDataSource.getRepository(Channel).findOne({
    where: { slug: String(body.network) },
  })
  if (channel) body.channel_id = channel.id
}
```

**Step 2: Wire into `create` and `update`**

Modify `create`:
```typescript
async create(req: Request, res: Response) {
  try {
    await resolveChannelId(req.body)
    const item = repo.create(req.body)
    const saved = await repo.save(item)
    res.status(201).json(saved)
  } catch (e: any) { ... }
},
```

Modify `update`:
```typescript
async update(req: Request, res: Response) {
  try {
    await resolveChannelId(req.body)
    const item = await repo.findOne({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ error: 'Публикация не найдена' })
    await repo.update(req.params.id, req.body)
    const updated = await repo.findOne({ where: { id: req.params.id } })
    res.json(updated)
  } catch (e) { ... }
},
```

**Step 3: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/controllers/content-publication.controller.ts
git commit -m "feat(publications): auto-resolve channel_id from network slug on POST/PUT"
```

---

### Task 8 — PublishChannels UI: `chat_id` for Telegram

**Files:**
- Modify: `frontend/src/pages/PublishChannels.tsx`

**Context:** Когда оператор редактирует Telegram-канал, должно появиться поле `Telegram chat ID`. Под капотом записывается в `config_json.chat_id`. Также подсказка: если `integration_status === 'api_connected'` — auto-publish заработает.

**Step 1: Read full PublishChannels.tsx**

```bash
cat frontend/src/pages/PublishChannels.tsx
```

Найди state form и render edit-form для канала. Найди, как редактируется `config_json` (вероятно сейчас никак).

**Step 2: Add chat_id input conditional on platform**

В edit-form (там где slug, display_name, platform, и т.д.) добавь блок, отображаемый ТОЛЬКО когда `formData.platform === 'telegram'`:

```typescript
{formData.platform === 'telegram' && (
  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
    <label className="block text-sm font-medium text-brand-text mb-1">
      Telegram chat ID
    </label>
    <input
      type="text"
      value={(formData.config_json as { chat_id?: string } | null)?.chat_id ?? ''}
      onChange={(e) => setFormData({
        ...formData,
        config_json: { ...(formData.config_json || {}), chat_id: e.target.value },
      })}
      aria-label="Telegram chat ID"
      placeholder="-1001234567890 или username"
      className="input"
    />
    <p className="text-xs text-brand-text-secondary mt-1">
      Для приватных каналов — числовой ID (с минусом). Для публичных — @username.
      После заполнения и сохранения переключи статус интеграции на «API подключён».
    </p>
  </div>
)}
```

⚠ Точное имя `formData` / setter может отличаться — посмотри как state называется в этом файле и подстрой. Если форма имеет `editingForm` / `setEditingForm`, использовать те имена.

**Step 3: Submit handler передаёт `config_json` как часть body**

Если submit уже шлёт весь `formData` — нет работы. Если whitelist полей — добавь `config_json` в whitelist.

**Step 4: Typecheck + build**

```bash
cd frontend && npx tsc --noEmit && npm run build && cd ..
```

**Step 5: Commit**

```bash
git add frontend/src/pages/PublishChannels.tsx
git commit -m "feat(publish-channels): chat_id input for Telegram channels (writes to config_json)"
```

---

### Task 9 — PublicationsEditor UI: auto_publish checkbox per row

**Files:**
- Modify: `frontend/src/components/content-bank/PublicationsEditor.tsx`

**Context:** Per-row чекбокс. Загружаем список каналов один раз; для канала с `integration_status='api_connected'` чекбокс enabled, иначе disabled с tooltip.

**Step 1: Read full PublicationsEditor.tsx**

```bash
cat frontend/src/components/content-bank/PublicationsEditor.tsx
```

Идентифицируй: state, render строки публикации, существующий save-handler. Понимай, чем матчатся row → channel: сейчас по `p.network`, нам нужен `p.channel?.integration_status` или fetch каналов по slug-у.

**Step 2: Load channels once**

```typescript
import { publishChannelsApi } from '../../api/publishChannels'
import type { PublishChannel } from '../../api/types'

// In component:
const [channels, setChannels] = useState<PublishChannel[]>([])
useEffect(() => {
  publishChannelsApi.getAll().then(setChannels).catch(() => {})
}, [])

function channelForRow(p: { network: string; channel_id?: string | null }): PublishChannel | null {
  if (p.channel_id) return channels.find((c) => c.id === p.channel_id) ?? null
  return channels.find((c) => c.slug === p.network) ?? null
}
```

**Step 3: Add checkbox column**

В рендере каждой строки публикации (около существующих полей `scheduled_at`, `published_url`), добавь чекбокс:

```typescript
{(() => {
  const ch = channelForRow(p)
  const canAuto = ch?.integration_status === 'api_connected'
  return (
    <label
      className="inline-flex items-center gap-2 text-sm"
      title={canAuto ? '' : 'Канал не настроен для авто-публикации (нужен api_connected)'}
    >
      <input
        type="checkbox"
        disabled={!canAuto}
        checked={!!p.auto_publish}
        onChange={(e) => updatePublication(p.id, { auto_publish: e.target.checked })}
        aria-label="Авто-публикация"
      />
      <span className={canAuto ? 'text-brand-text' : 'text-brand-text-secondary'}>
        Авто-публикация
      </span>
    </label>
  )
})()}
```

⚠ Точные имена `updatePublication` / `setData` могут отличаться — посмотри как существующий код обновляет одно поле публикации (например `scheduled_at`) и сделай по образцу. Чекбокс должен триггерить тот же flow.

**Step 4: Typecheck + build**

```bash
cd frontend && npx tsc --noEmit && npm run build && cd ..
```

**Step 5: Commit**

```bash
git add frontend/src/components/content-bank/PublicationsEditor.tsx
git commit -m "feat(publications-editor): auto_publish checkbox per row (gated on channel integration_status)"
```

---

### Task 10 — Smoke + push

**Files:** (none)

**Step 1: Verify TELEGRAM_BOT_TOKEN exists**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/.claude/worktrees/confident-tesla-8e46b9
set -a && source backend/.env && set +a
echo "Bot token set: $([ -n "$TELEGRAM_BOT_TOKEN" ] && echo yes || echo no)"
```

Если `no` — стоп, попросить пользователя создать тестового бота через @BotFather и добавить токен в `.env`. Без него никакая auto-publish не сработает.

**Step 2: Final tsc + build sanity**

```bash
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
```

**Step 3: Mark Phase D complete in plan**

В шапке `docs/plans/2026-05-12-marketing-phase-d-telegram-publisher.md` замени:
```
**Status:** ✅ Phase D complete on YYYY-MM-DD. Next: Phase E (analytics worker + KPI dashboard) or hardening of existing phases.
```

```bash
git add docs/plans/2026-05-12-marketing-phase-d-telegram-publisher.md
git commit -m "docs(plans): mark marketing phase D complete"
```

**Step 4: Push both remotes**

```bash
git push origin HEAD
git push vercel-deploy HEAD
```

---

## Post-Phase-D — что должно быть

- `ChannelPublisher` интерфейс + `getPublisher(platform)` registry.
- `TelegramBotPublisher` использует существующий бот.
- Cron-воркер `publish-worker.ts` тикает каждую минуту, обрабатывает до 20 публикаций за тик, retry до 3 раз.
- Manual trigger `POST /api/content-publications/:id/publish-now`.
- Backend POST/PUT publications auto-resolve `channel_id` из `network` слово.
- UI: `chat_id` в PublishChannels для Telegram + `auto_publish` checkbox в PublicationsEditor.
- TypeScript-сборки чистые.
- Existing recipe-engine + Voiceover Studio не затронуты.

## Что НЕ сделано в Phase D

- VK / YouTube publishers.
- Media-attachments в Telegram-постах (только текст).
- Edit/Delete published messages.
- Exponential backoff retry.
- Drop `network` column.
- Auto-flip `integration_status` при заполнении chat_id.
- Webhook receiver для статистики постов (Phase E).

## Anti-pitfalls

- **`TELEGRAM_BOT_TOKEN` отсутствует → `getBot()` возвращает null → publisher бросает ошибку «токен не задан».** Worker запишет это в `publisher_log.last_error`. Не катастрофа, но опубликовать ничего нельзя до настройки env.
- **`chat_id` в config_json — строка**. Telegram API принимает и number и string. Frontend хранит как string (форма input). Backend конвертит в `String(chat_id)` при вызове API.
- **Concurrency:** воркер использует in-memory `Set<id>` мьютекс — работает в рамках одного процесса. Если Railway вдруг развернёт два инстанса — будут double-post-ы. На v1 ок (single instance). При scale-out — добавить DB-level lock (например `pg_try_advisory_lock(hashtext(publication_id))`).
- **`raw_response` в `publisher_log` может быть большим** (вся структура `msg.chat` с описаниями). Если беспокоит — сделай `JSON.stringify` + slice. Не на v1.
- **Cron-задачи в development:** при `nodemon` рестарте старый процесс убивается, новый стартует — `_scheduled` сбрасывается, всё ок.
- **HTML-escape:** `escapeHtml` экранирует `&<>`. Если в style_guide_text встретится `<` (в html-тегах) — он обработается как литерал. Это правильное поведение — оператор не хочет HTML-инъекций.
- **Telegram message limit 4096**. Наш truncate `slice(0, 4000) + '\n…'` оставляет запас. Длинные посты для Phase D неожиданны (short_post: 400-800 chars).

## Открытые вопросы

- Стоит ли при `чекбокс=on` сразу триггерить `publish-now` если `scheduled_at` уже в прошлом? Сейчас нет — оператор отдельно нажмёт «Опубликовать сейчас». Можно добавить логику в Phase E.
- Нужен ли read-only viewer для `publisher_log` (для debug)? Сейчас доступен через DB. Phase E или UI debug-режим.
- Что делать с публикациями где `auto_publish=true` но `scheduled_at=null`? Воркер их игнорирует. Можно добавить тост-ошибку при сохранении.
