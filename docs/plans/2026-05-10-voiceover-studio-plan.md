# Voiceover Studio Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Embed a 5-step wizard tool at `/voiceover` that turns content-bank ideas into ElevenLabs-ready voiceover scripts (Claude generation → factcheck → style filter → preprocess) and writes results back into `content_units.script_text` / `voiceover_text`.

**Architecture:** Express on Railway hosts 5 Claude proxy endpoints (`/api/claude/*`) plus a bootstrap endpoint (`/api/voiceover/bootstrap`) that returns rubrics + brand_docs + etalon. Frontend is a single page `VoiceoverStudio.tsx` with 5 step components and a horizontal stepper, mounted as a top-level route `/voiceover` and `/voiceover/:unitId`. UI uses our existing Tailwind/design-system tokens — no CSS-in-JS, no new fonts. Writeback happens after Step 4 (script_text) and Step 5 (voiceover_text) via existing `unitsApi.update`.

**Tech Stack:** Node.js + Express + TypeORM + PostgreSQL (Supabase). React 18 + TypeScript + Vite + TailwindCSS. `@anthropic-ai/sdk` for Claude. `lucide-react` (already installed) for icons.

**Design doc:** `docs/plans/2026-05-10-voiceover-studio-design.md`

**Two-remote deploy convention:** push to `origin` (Railway backend) AND `vercel-deploy` (Vercel frontend). Always both.

---

## Stage 0: Pre-flight

### Task 0.1: Verify clean tree + remotes aligned

**Step 1: Check git state**
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka
git fetch origin --quiet && git fetch vercel-deploy --quiet
git status -s | grep -v "^??" | grep -v "launch.json\|^ M CLAUDE"
echo "===HEAD==="
git log -1 --format=%H
git log -1 origin/main --format=%H
git log -1 vercel-deploy/main --format=%H
```
Expected: working dir clean (or only pre-existing noise — `.claude/launch.json`, screenshots), and HEAD = origin/main = vercel-deploy/main.

If misaligned — pull/push to align before starting.

### Task 0.2: User adds ANTHROPIC_API_KEY to Railway

**Manual step (user only):** open Railway dashboard for the backend project → Variables → add `ANTHROPIC_API_KEY=sk-ant-...`. Do NOT redeploy yet — the new env var will be picked up on the first push of Stage 2.

If user hasn't done this — pause and ask. The bot will not error on bootstrap (no calls yet), but the moment a user hits `/voiceover` and triggers generation it will 500 with "Claude error: ANTHROPIC_API_KEY missing".

---

## Stage 1: Backend — BrandDoc entity + voiceover bootstrap

### Task 1.1: Create `BrandDoc` entity

**Files:**
- Create: `backend/src/entities/BrandDoc.ts`

**Step 1: Write the entity**

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('brand_docs')
export class BrandDoc {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'text' })
  slug: string

  @Column({ type: 'text' })
  title: string

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'text', nullable: true })
  version: string | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
```

**Step 2: Register in DataSource**

Modify `backend/src/config/database.ts` — add `BrandDoc` to the `entities` array (alongside `ContentUnit`, `ContentRubric`, etc.).

**Step 3: Typecheck**
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
```
Expected: empty output.

**Step 4: Commit**
```bash
git add backend/src/entities/BrandDoc.ts backend/src/config/database.ts
git commit -m "feat(voiceover): BrandDoc entity for brand_docs table

Maps the existing brand_docs table (already in prod) — slug/title/content/version
plus standard timestamps. Used by the voiceover studio bootstrap to load
style_guide_video and rubrics_matrix into the Claude system prompt cache."
```

### Task 1.2: Create voiceover bootstrap controller + route

**Files:**
- Create: `backend/src/controllers/voiceover.controller.ts`
- Create: `backend/src/routes/voiceover.routes.ts`
- Modify: `backend/src/index.ts`

**Step 1: Write controller**

```ts
// backend/src/controllers/voiceover.controller.ts
import { Request, Response } from 'express'
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'
import { ContentUnit } from '../entities/ContentUnit'
import { ContentRubric } from '../entities/ContentRubric'

const ETALON_UNIT_ID = 'f25b0c52-c5e7-4c5b-9fcf-881fa8e7838a'

interface BootstrapCache {
  brandDocs: { style_guide_video: string; rubrics_matrix: string }
  etalonScript: string | null
  fetchedAt: number
}

const CACHE_TTL_MS = 30 * 60 * 1000  // 30 minutes
let cache: BootstrapCache | null = null

async function loadFromDB(): Promise<BootstrapCache> {
  const docRepo = AppDataSource.getRepository(BrandDoc)
  const unitRepo = AppDataSource.getRepository(ContentUnit)

  const docs = await docRepo.find({
    where: { slug: In(['style_guide_video', 'rubrics_matrix']) },
  })
  const docMap: Record<string, string> = {}
  for (const d of docs) docMap[d.slug] = d.content

  const etalon = await unitRepo.findOne({
    where: { id: ETALON_UNIT_ID },
    select: ['id', 'script_text'],
  })

  return {
    brandDocs: {
      style_guide_video: docMap.style_guide_video ?? '',
      rubrics_matrix: docMap.rubrics_matrix ?? '',
    },
    etalonScript: etalon?.script_text || null,
    fetchedAt: Date.now(),
  }
}

export const voiceoverController = {
  async bootstrap(req: Request, res: Response) {
    try {
      // Lazy refresh
      if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
        cache = await loadFromDB()
      }

      const rubricRepo = AppDataSource.getRepository(ContentRubric)
      const rubrics = await rubricRepo.find({
        order: { sort_order: 'ASC' },
      })

      res.json({
        rubrics,
        brandDocs: cache.brandDocs,
        etalonScript: cache.etalonScript,
      })
    } catch (e: any) {
      console.error('Voiceover bootstrap error:', e?.message || e)
      res.status(500).json({ error: 'Ошибка загрузки данных студии' })
    }
  },
}
```

**Step 2: Write routes**

```ts
// backend/src/routes/voiceover.routes.ts
import { Router } from 'express'
import { voiceoverController } from '../controllers/voiceover.controller'
import { authenticate } from '../middleware/auth'  // existing JWT middleware

const router = Router()

router.get('/bootstrap', authenticate, voiceoverController.bootstrap)

export default router
```

If the auth middleware import path differs — check existing routes (e.g. `backend/src/routes/content-unit.routes.ts`) for the canonical import.

**Step 3: Wire up in index.ts**

Modify `backend/src/index.ts`. Find existing `app.use('/api/content-units', ...)` block and add a sibling line:

```ts
import voiceoverRoutes from './routes/voiceover.routes'
// ... existing imports
app.use('/api/voiceover', voiceoverRoutes)
```

**Step 4: Typecheck**
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
```
Expected: empty output.

**Step 5: Commit**
```bash
git add backend/src/controllers/voiceover.controller.ts backend/src/routes/voiceover.routes.ts backend/src/index.ts
git commit -m "feat(voiceover): GET /api/voiceover/bootstrap — rubrics + brand_docs + etalon

Single endpoint serving everything the studio needs at page load:
content rubrics (existing), brand_docs (style_guide_video + rubrics_matrix),
and the etalon script_text from unit f25b0c52-... (returns null when empty,
graceful fallback in prompts).

In-memory cache with 30-min TTL — brand_docs and etalon rarely change."
```

---

## Stage 2: Backend — Anthropic SDK + Claude controller

### Task 2.1: Install @anthropic-ai/sdk

**Step 1: Install**
```bash
cd backend && npm install @anthropic-ai/sdk
```

**Step 2: Verify install**
```bash
cd backend && grep -A1 '"@anthropic-ai/sdk"' package.json
```
Expected: a line with the version like `"@anthropic-ai/sdk": "^0.x.y"`.

**Step 3: Commit lockfile + manifest**
```bash
git add backend/package.json backend/package-lock.json
git commit -m "deps(backend): add @anthropic-ai/sdk

For the voiceover studio Claude proxy endpoints (/api/claude/*)."
```

### Task 2.2: Create Claude controller — generate

**Files:**
- Create: `backend/src/controllers/claude.controller.ts`

**Step 1: Skeleton + helper**

```ts
// backend/src/controllers/claude.controller.ts
import { Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'
import { ContentUnit } from '../entities/ContentUnit'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
const MODEL = 'claude-sonnet-4-5-20250929'
const ETALON_UNIT_ID = 'f25b0c52-c5e7-4c5b-9fcf-881fa8e7838a'

interface PromptCache {
  styleGuideVideo: string
  rubricsMatrix: string
  etalonScript: string | null
  fetchedAt: number
}
const CACHE_TTL_MS = 30 * 60 * 1000
let promptCache: PromptCache | null = null

async function loadPromptResources(): Promise<PromptCache> {
  if (promptCache && Date.now() - promptCache.fetchedAt < CACHE_TTL_MS) {
    return promptCache
  }
  const docRepo = AppDataSource.getRepository(BrandDoc)
  const unitRepo = AppDataSource.getRepository(ContentUnit)
  const docs = await docRepo.find({
    where: { slug: In(['style_guide_video', 'rubrics_matrix']) },
  })
  const map: Record<string, string> = {}
  for (const d of docs) map[d.slug] = d.content
  const etalon = await unitRepo.findOne({
    where: { id: ETALON_UNIT_ID },
    select: ['id', 'script_text'],
  })
  promptCache = {
    styleGuideVideo: map.style_guide_video ?? '',
    rubricsMatrix: map.rubrics_matrix ?? '',
    etalonScript: etalon?.script_text || null,
    fetchedAt: Date.now(),
  }
  return promptCache
}

async function callClaude(system: string, user: string, maxTokens = 4096): Promise<string> {
  const r = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  })
  return r.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
}

function handleClaudeError(e: any, res: Response, defaultMsg: string) {
  const status = e?.status || e?.response?.status
  if (status === 429) {
    return res.status(503).json({ error: 'Сервис временно перегружен, попробуйте через минуту' })
  }
  if (status === 401) {
    console.error('Claude auth error — check ANTHROPIC_API_KEY')
    return res.status(500).json({ error: defaultMsg })
  }
  if (e?.code === 'ETIMEDOUT' || e?.name === 'TimeoutError') {
    return res.status(504).json({ error: 'Превышено время ожидания, попробуйте ещё раз' })
  }
  console.error('Claude error:', e?.message || e)
  return res.status(500).json({ error: defaultMsg })
}

export const claudeController = {
  async generate(req: Request, res: Response) {
    try {
      const { topic, brand = 'Химичка', duration = '60', styles = [] } = req.body as {
        topic?: string
        brand?: string
        duration?: string
        styles?: string[]
      }
      if (!topic || !topic.trim()) {
        return res.status(400).json({ error: 'Поле topic обязательно' })
      }
      const r = await loadPromptResources()
      const stylesStr = styles.length > 0 ? styles.join(', ') : 'образовательный'
      const system = `Ты — сценарист коротких видео (TikTok, Reels) для бренда ${brand} (ximi4ka.ru). Производим наборы для химических опытов, продаём на Wildberries.

## Стилевой гайд (обязательно к исполнению)
${r.styleGuideVideo}

## Матрица рубрик
${r.rubricsMatrix}

## Эталонный сценарий (образец стиля, тона, ритма)
${r.etalonScript ?? 'Не загружен.'}

## Задача
Напиши сценарий по теме ниже. Стиль: ${stylesStr}. Длина: ~${duration} сек.
Структура: ХУК → ЗАЯВКА → ОБЪЯСНЕНИЕ → РАЗВЯЗКА → ВЫВОД.
CTA-формула: «Найти нас можно по слову "Химичка" в поисковиках, ВБ и Озон».
Только текст сценария, без пояснений, без разметки визуал/речь. Абзацами, как будет говориться вслух.
Перед написанием определи рубрику и её тональную группу из матрицы, примени соответствующие правила.`
      const text = await callClaude(system, topic, 4096)
      res.json({ text })
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка генерации сценария')
    }
  },

  // factcheck / style / edit / preprocess — see Task 2.3, 2.4
}
```

**Step 2: Typecheck**
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
```
Expected: empty output.

**Step 3: Commit**
```bash
git add backend/src/controllers/claude.controller.ts
git commit -m "feat(voiceover): claude.controller.generate — script generation endpoint

System prompt baked from brand_docs + etalon (cached 30min in memory).
Frontend sends only topic/brand/duration/styles. Returns {text}.

Error mapping: 429 → 503, 401 → 500 + log, timeout → 504, other → 500.
Model: claude-sonnet-4-5-20250929 (current). max_tokens: 4096."
```

### Task 2.3: Add factcheck + style + edit endpoints

**Files:**
- Modify: `backend/src/controllers/claude.controller.ts`

**Step 1: Add three more methods inside `claudeController`** (after `generate`, before the closing `}`):

```ts
  async factcheck(req: Request, res: Response) {
    try {
      const { script } = req.body as { script?: string }
      if (!script || !script.trim()) {
        return res.status(400).json({ error: 'Поле script обязательно' })
      }
      const system = `Ты — редактор и фактчекер бренда Химичка (наборы для химических опытов).

ОСОБЫЕ ЗОНЫ ВНИМАНИЯ:
- Цитаты, даты, имена, названия конвенций — обязательна точность
- Свойства химических веществ: запах, токсичность, число атомов, формулы
- Количество жертв, исторические факты
- Названия организаций (ОЗХО, не ОПХО и т.д.)

Проверь текст. Ответь строго JSON-массивом: [{"type":"ok"|"warn"|"err","text":"описание"}]. Только JSON.`
      const raw = await callClaude(system, script, 2048)
      // Try to parse — fallback to single-item array if model wrapped in fences or added prose
      let items: Array<{ type: string; text: string }>
      try {
        const cleaned = raw.replace(/```json|```/g, '').trim()
        items = JSON.parse(cleaned)
        if (!Array.isArray(items)) throw new Error('not array')
      } catch {
        items = [{ type: 'info', text: raw }]
      }
      res.json({ items })
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка фактчекинга')
    }
  },

  async style(req: Request, res: Response) {
    try {
      const { script, brand = 'Химичка' } = req.body as {
        script?: string
        brand?: string
      }
      if (!script || !script.trim()) {
        return res.status(400).json({ error: 'Поле script обязательно' })
      }
      const r = await loadPromptResources()
      const system = `Ты — редактор бренда ${brand}. Обработай сценарий по стилевому гайду ниже.

## Стилевой гайд
${r.styleGuideVideo}

## Задача
Примени все 14 базовых правил, аудиальные правила А1–А10, стилистические С1–С9, уточнения Э1–Э7.
Проверь: нет ли прокладок, разжёвывания, пафоса, лишних мемов.
Прочитай мысленно вслух — есть ли ритм? Не спотыкается ли голос?
Верни только финальный текст без пояснений.`
      const text = await callClaude(system, script, 4096)
      res.json({ text })
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка стиль-фильтра')
    }
  },

  async edit(req: Request, res: Response) {
    try {
      const { script, notes } = req.body as { script?: string; notes?: string }
      if (!script || !script.trim()) {
        return res.status(400).json({ error: 'Поле script обязательно' })
      }
      if (!notes || !notes.trim()) {
        return res.status(400).json({ error: 'Поле notes обязательно' })
      }
      const system = `Ты — редактор. Примени правки к тексту. Правки: "${notes}". Только готовый текст.`
      const text = await callClaude(system, script, 4096)
      res.json({ text })
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка применения правок')
    }
  },
```

**Step 2: Typecheck**
Same command as before, expected empty.

**Step 3: Commit**
```bash
git add backend/src/controllers/claude.controller.ts
git commit -m "feat(voiceover): claude.controller — factcheck/style/edit endpoints

- factcheck: returns {items: [{type, text}]} parsed from JSON, fallback
  wraps raw output as a single 'info' item if the model breaks format
- style: applies the full style_guide_video (14 base rules + А1–А10 +
  С1–С9 + Э1–Э7), returns final {text}
- edit: applies free-form user revision notes to a script, returns {text}"
```

### Task 2.4: Add preprocess endpoint

**Files:**
- Modify: `backend/src/controllers/claude.controller.ts`

**Step 1: Append `preprocess` method** (last method in `claudeController`):

```ts
  async preprocess(req: Request, res: Response) {
    try {
      const { script } = req.body as { script?: string }
      if (!script || !script.trim()) {
        return res.status(400).json({ error: 'Поле script обязательно' })
      }
      const system = `Ты — препроцессор текста для синтеза речи ElevenLabs v3 (русский язык).

УДАРЕНИЯ:
- Расставь ударения ТОЛЬКО через символ U+0301 (комбинирующий акут) ПОСЛЕ ударной гласной.
- НИКОГДА не дублируй гласные (не "замоок", а "замо́к"). Только символ ́ .
- Ставь только в неоднозначных словах: омографы (замо́к/за́мок, сто́ит/стои́т), редкие ударения, иностранные слова, имена.
- Не ставь там, где ударение и так очевидно для TTS.

ЭМОЦИОНАЛЬНЫЕ ТЕГИ:
- Доступные теги: [thoughtful] [whisper] [serious] [authoritative] [happy] [sad] [chuckle] [annoyed] [narrator] [somber].
- Ставь перед фразой/предложением, только там где реально нужна смена интонации.
- Не переусердствуй — не каждая фраза нуждается в теге.
- Для CTA (призыв к действию в конце) — используй связку [chuckle] → [thoughtful] или [happy], это снимает "рекламность".
- Для перечислений запретного/опасного — [whisper] создаёт ощущение запретного знания.
- Для исторических фактов — [narrator] или [serious], не перегружая.

ТЕКСТОВАЯ ОБРАБОТКА:
- Латиницу переводи в кириллицу фонетически: VX → вэ-икс, Wildberries → Вайлдберриз, eSIM → и-сим, FBI → ФБР, Northwestern → Нортвестерн (правило С6 из гайда).
- Числа и аббревиатуры пиши прописью: 54.1 → пятьдесят четыре целых одна десятая, НК → Налоговый кодекс.
- Тире (—) заменяй на точки или запятые — модель путается с интонацией на тире. ИСКЛЮЧЕНИЕ: «Но —» в начале предложения оставь — это интонационная пауза-вдох перед выводом (правило С7).
- Многоточия (...) заменяй на точку + новое предложение — многоточия провоцируют странные паузы.
- Точка с запятой = короткая пауза, точка = длиннее. Используй это для ритма.
- Скобки внутри текста = интонационное понижение, шёпот в сторону (правило А9). Не трогай их — ElevenLabs v3 обрабатывает их как тихий комментарий.
- Если предлог идёт в быстром ударном месте — выбирай короткий: «о» вместо «про» (правило А3).

ЧАНКИ:
- Раздели текст на чанки по 200-350 символов.
- Режь по смыслу — не рубй фразы на полуслове.
- Каждый чанк должен быть самостоятельной единицей для озвучки.

Формат: строго JSON {"chunks":["чанк1","чанк2",...]}. Только JSON, без пояснений.`
      const raw = await callClaude(system, script, 4096)
      let chunks: string[]
      try {
        const cleaned = raw.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        chunks = Array.isArray(parsed?.chunks) ? parsed.chunks : [raw]
      } catch {
        chunks = [raw]
      }
      res.json({ chunks })
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка препроцессинга')
    }
  },
```

**Step 2: Typecheck**
Same command as before, expected empty.

**Step 3: Commit**
```bash
git add backend/src/controllers/claude.controller.ts
git commit -m "feat(voiceover): claude.controller.preprocess — ElevenLabs prep

Returns {chunks: string[]}. Heavy system prompt covers stress marks
(U+0301 only — no vowel doubling), emotional tags, latin→cyrillic
phonetic transliteration, dash/ellipsis cleanup, 200-350 char chunking
along semantic boundaries.

Fallback: if model output isn't parseable JSON, wrap raw as single chunk."
```

### Task 2.5: Wire Claude routes

**Files:**
- Create: `backend/src/routes/claude.routes.ts`
- Modify: `backend/src/index.ts`

**Step 1: Routes**

```ts
// backend/src/routes/claude.routes.ts
import { Router } from 'express'
import { claudeController } from '../controllers/claude.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.post('/generate', authenticate, claudeController.generate)
router.post('/factcheck', authenticate, claudeController.factcheck)
router.post('/style', authenticate, claudeController.style)
router.post('/edit', authenticate, claudeController.edit)
router.post('/preprocess', authenticate, claudeController.preprocess)

export default router
```

**Step 2: Wire in index.ts**

Modify `backend/src/index.ts`. Near the existing `app.use('/api/voiceover', voiceoverRoutes)` (added in Stage 1):

```ts
import claudeRoutes from './routes/claude.routes'
// ...
app.use('/api/claude', claudeRoutes)
```

**Step 3: Typecheck**
Same command, expected empty.

**Step 4: Commit**
```bash
git add backend/src/routes/claude.routes.ts backend/src/index.ts
git commit -m "feat(voiceover): mount /api/claude/* routes (5 POST endpoints)

generate / factcheck / style / edit / preprocess — all JWT-protected.
Frontend will hit these as a wizard flow."
```

---

## Stage 3: Frontend — voiceover API wrapper + types

### Task 3.1: API wrapper

**Files:**
- Create: `frontend/src/api/voiceover.ts`

**Step 1: Write wrapper**

```ts
import { apiClient } from './client'
import { ContentRubric } from './contentBank'

export interface FactcheckItem {
  type: 'ok' | 'warn' | 'err' | 'info'
  text: string
}

export interface BootstrapResponse {
  rubrics: ContentRubric[]
  brandDocs: {
    style_guide_video: string
    rubrics_matrix: string
  }
  etalonScript: string | null
}

export const voiceoverApi = {
  bootstrap: async (): Promise<BootstrapResponse> => {
    const r = await apiClient.get<BootstrapResponse>('/voiceover/bootstrap')
    return r.data
  },

  generate: async (params: {
    topic: string
    brand?: string
    duration?: string
    styles?: string[]
  }): Promise<{ text: string }> => {
    const r = await apiClient.post<{ text: string }>('/claude/generate', params)
    return r.data
  },

  factcheck: async (script: string): Promise<{ items: FactcheckItem[] }> => {
    const r = await apiClient.post<{ items: FactcheckItem[] }>('/claude/factcheck', { script })
    return r.data
  },

  style: async (script: string, brand?: string): Promise<{ text: string }> => {
    const r = await apiClient.post<{ text: string }>('/claude/style', { script, brand })
    return r.data
  },

  edit: async (script: string, notes: string): Promise<{ text: string }> => {
    const r = await apiClient.post<{ text: string }>('/claude/edit', { script, notes })
    return r.data
  },

  preprocess: async (script: string): Promise<{ chunks: string[] }> => {
    const r = await apiClient.post<{ chunks: string[] }>('/claude/preprocess', { script })
    return r.data
  },
}
```

**Step 2: Typecheck**
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: empty output.

**Step 3: Commit**
```bash
git add frontend/src/api/voiceover.ts
git commit -m "feat(voiceover): API wrapper — bootstrap + 5 Claude endpoints

Mirrors the backend contract — narrow types per endpoint, all responses
go through axios apiClient (auth header + baseURL handled centrally)."
```

---

## Stage 4: Frontend — page skeleton + StepNav + routing + sidebar

### Task 4.1: Inspect routing + sidebar

Before writing the page — find where routes and sidebar live.

**Step 1: Locate**
```bash
grep -rn "createBrowserRouter\|<Route\|<Routes" frontend/src/ --include="*.tsx" -l
grep -rn "Sidebar\|NavMenu\|navigation" frontend/src/ --include="*.tsx" -l
ls frontend/src/components/Layout/ 2>/dev/null
```

Note the exact filenames so subsequent tasks can edit them.

### Task 4.2: VoiceoverStudio page skeleton

**Files:**
- Create: `frontend/src/pages/VoiceoverStudio.tsx`

**Step 1: Skeleton with shared state, lazy bootstrap, step machine**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { unitsApi, ContentUnit, ContentRubric } from '../api/contentBank'
import { voiceoverApi, BootstrapResponse, FactcheckItem } from '../api/voiceover'
import { StepNav } from '../components/voiceover/StepNav'
import { UnitPicker } from '../components/voiceover/UnitPicker'
import { GenerateStep } from '../components/voiceover/GenerateStep'
import { FactcheckStep } from '../components/voiceover/FactcheckStep'
import { StyleStep } from '../components/voiceover/StyleStep'
import { PreprocessStep } from '../components/voiceover/PreprocessStep'

export type StepKey = 'pick' | 'generate' | 'factcheck' | 'style' | 'preprocess'

export interface WizardState {
  step: StepKey
  unit: ContentUnit | null

  topic: string
  duration: '60' | '90' | '120'
  styles: string[]

  draft: string
  factcheck: FactcheckItem[]
  finalScript: string
  editNotes: string
  chunks: string[]
}

const INITIAL: WizardState = {
  step: 'pick',
  unit: null,
  topic: '',
  duration: '60',
  styles: [],
  draft: '',
  factcheck: [],
  finalScript: '',
  editNotes: '',
  chunks: [],
}

export default function VoiceoverStudio() {
  const toast = useToast()
  const navigate = useNavigate()
  const { unitId } = useParams<{ unitId?: string }>()

  const [state, setState] = useState<WizardState>(INITIAL)
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Load bootstrap once
  useEffect(() => {
    voiceoverApi
      .bootstrap()
      .then(setBootstrap)
      .catch(() => toast.error('Не удалось загрузить данные студии'))
      .finally(() => setLoading(false))
  }, [toast])

  // If unitId is in URL — preload that unit and skip pick step
  useEffect(() => {
    if (!unitId) return
    unitsApi
      .getOne(unitId)
      .then(unit => {
        const topic = buildTopicFromUnit(unit, bootstrap?.rubrics ?? [])
        setState(s => ({
          ...s,
          step: 'generate',
          unit,
          topic,
          draft: unit.script_text ?? '',
          finalScript: unit.script_text ?? '',
        }))
      })
      .catch(() => toast.error('Не удалось загрузить юнит'))
  }, [unitId, bootstrap, toast])

  const update = useCallback(
    (patch: Partial<WizardState>) => setState(s => ({ ...s, ...patch })),
    [],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <StepNav currentStep={state.step} onJump={(s) => update({ step: s })} />

      {state.step === 'pick' && bootstrap && (
        <UnitPicker
          rubrics={bootstrap.rubrics}
          onSelect={(unit) => {
            const topic = buildTopicFromUnit(unit, bootstrap.rubrics)
            update({
              step: 'generate',
              unit,
              topic,
              draft: unit.script_text ?? '',
              finalScript: unit.script_text ?? '',
            })
          }}
        />
      )}

      {state.step === 'generate' && (
        <GenerateStep state={state} update={update} onBack={() => update({ step: 'pick' })} onNext={() => update({ step: 'factcheck' })} />
      )}

      {state.step === 'factcheck' && (
        <FactcheckStep state={state} update={update} onBack={() => update({ step: 'generate' })} onNext={() => update({ step: 'style' })} />
      )}

      {state.step === 'style' && (
        <StyleStep state={state} update={update} onBack={() => update({ step: 'factcheck' })} onNext={() => update({ step: 'preprocess' })} />
      )}

      {state.step === 'preprocess' && (
        <PreprocessStep
          state={state}
          update={update}
          onBack={() => update({ step: 'style' })}
          onDone={() => navigate(`/content-bank?search=${encodeURIComponent(state.unit?.title ?? '')}`)}
        />
      )}
    </div>
  )
}

function buildTopicFromUnit(unit: ContentUnit, rubrics: ContentRubric[]): string {
  let t = unit.title
  if (unit.hook) t += `\n\nХук: ${unit.hook}`
  if (unit.essence) t += `\n\nСуть: ${unit.essence}`
  const rubric = rubrics.find(r => r.id === unit.rubric_id)
  if (rubric) {
    t += `\n\nРубрика: ${rubric.title}${rubric.tone ? ' | Тон: ' + rubric.tone : ''}`
  }
  return t
}
```

**Note on imports** — at this step the step components don't exist yet. Either:
- (a) Stub them with `export function GenerateStep() { return null }` placeholders so the whole skeleton typechecks today, OR
- (b) Comment out imports/usages until Stage 5/6/7 land.

Recommended: stub them as one-liners now, fill in their bodies in subsequent tasks. That way each step component task can be completed independently.

**Step 2: Create stub files** (one-liners, just so import resolves)

```bash
mkdir -p frontend/src/components/voiceover
```

For each of `StepNav`, `UnitPicker`, `GenerateStep`, `FactcheckStep`, `StyleStep`, `PreprocessStep`:

```tsx
// e.g., frontend/src/components/voiceover/GenerateStep.tsx
export function GenerateStep(_props: any) {
  return <div className="p-4 bg-subtle rounded-xl">GenerateStep — TODO</div>
}
```

**Step 3: Typecheck**
Same command as before, expected empty.

**Step 4: Commit**
```bash
git add frontend/src/pages/VoiceoverStudio.tsx frontend/src/components/voiceover/
git commit -m "feat(voiceover): VoiceoverStudio page skeleton — wizard shell + state

Single useState wizard state (step, unit, topic, drafts, chunks).
Loads bootstrap once on mount. If /voiceover/:unitId in URL — preloads
the unit and skips pick step into 'generate'. Step components stubbed
with placeholders, filled in subsequent tasks.

State machine: pick → generate → factcheck → style → preprocess → done.
Done redirects to /content-bank with the unit's title in search."
```

### Task 4.3: StepNav

**Files:**
- Modify: `frontend/src/components/voiceover/StepNav.tsx` (replace stub)

**Step 1: Implementation**

```tsx
import { StepKey } from '../../pages/VoiceoverStudio'

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'pick', label: 'Идея' },
  { key: 'generate', label: 'Сценарий' },
  { key: 'factcheck', label: 'Факты' },
  { key: 'style', label: 'Стиль' },
  { key: 'preprocess', label: 'ТЗ' },
]

interface Props {
  currentStep: StepKey
  onJump: (s: StepKey) => void
}

export function StepNav({ currentStep, onJump }: Props) {
  const currentIdx = STEPS.findIndex(s => s.key === currentStep)
  return (
    <div className="flex items-center justify-between gap-1 sm:gap-2 border-b border-brand-border pb-4">
      {STEPS.map((s, i) => {
        const passed = currentIdx > i
        const current = currentIdx === i
        const clickable = passed
        return (
          <div key={s.key} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(s.key)}
              className={
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ' +
                (passed
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : current
                  ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-300'
                  : 'bg-subtle text-brand-text-secondary')
              }
              aria-label={`Шаг ${i + 1}: ${s.label}`}
            >
              {passed ? '✓' : i + 1}
            </button>
            <span
              className={
                'text-sm whitespace-nowrap ' +
                (current ? 'font-semibold text-brand-text' : 'text-brand-text-secondary')
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={'w-4 sm:w-8 h-0.5 ' + (passed ? 'bg-primary-500' : 'bg-subtle')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Typecheck**, **Step 3: Commit**

```bash
git add frontend/src/components/voiceover/StepNav.tsx
git commit -m "feat(voiceover): StepNav — horizontal stepper with click-back

5 steps coloured by state: passed (filled primary, clickable to revisit),
current (ringed light primary), future (muted). Jumps forward disabled —
forces sequential flow."
```

### Task 4.4: Mount route + sidebar entry

**Files:**
- Modify: `frontend/src/App.tsx` (or wherever Routes live — found in Task 4.1)
- Modify: sidebar/nav component (found in Task 4.1)

**Step 1: Add 2 routes**

In the routes file:
```tsx
import VoiceoverStudio from './pages/VoiceoverStudio'

// inside <Routes>
<Route path="/voiceover" element={<VoiceoverStudio />} />
<Route path="/voiceover/:unitId" element={<VoiceoverStudio />} />
```

If routing is wrapped in any auth-required layout — make sure `/voiceover` is inside it (matches `/content-bank` placement).

**Step 2: Add sidebar entry**

Find the array of nav items (probably an object array with `label`, `path`, `icon`). Add next to «Контент-банк»:

```tsx
import { Mic } from 'lucide-react'
// ...
{ label: 'Войсовер', path: '/voiceover', icon: <Mic size={18} /> }
```

If the sidebar uses some other icon prop convention — match it.

**Step 3: Typecheck + commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout/Sidebar.tsx  # adjust paths
git commit -m "feat(voiceover): mount /voiceover route + sidebar entry «🎙 Войсовер»

Two routes — bare /voiceover (picker) and /voiceover/:unitId (preloaded).
Sidebar item placed next to «Контент-банк» using lucide Mic icon."
```

---

## Stage 5: Frontend — Step 1 (UnitPicker) + Step 2 (GenerateStep)

### Task 5.1: UnitPicker

**Files:**
- Modify: `frontend/src/components/voiceover/UnitPicker.tsx` (replace stub)

**Step 1: Implementation**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import { unitsApi, ContentUnit, ContentRubric, STATUS_LABELS, ContentStatus } from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  rubrics: ContentRubric[]
  onSelect: (unit: ContentUnit) => void
}

export function UnitPicker({ rubrics, onSelect }: Props) {
  const toast = useToast()
  const [items, setItems] = useState<ContentUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ContentStatus | ''>('')
  const [rubricId, setRubricId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { limit: 100, sort: 'created_at' }
      if (search.trim()) params.search = search.trim()
      if (status) params.status = status
      if (rubricId) params.rubric_id = rubricId
      const r = await unitsApi.list(params as any)
      setItems(r.data)
    } catch {
      toast.error('Не удалось загрузить идеи')
    } finally {
      setLoading(false)
    }
  }, [search, status, rubricId, toast])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-brand-text">Выбор идеи</h2>
        <p className="text-sm text-brand-text-secondary mt-1">
          Идея из контент-банка станет основой сценария.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по заголовку, хуку, сути…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ContentStatus | '')}
          className="px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400"
        >
          <option value="">Любой статус</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={rubricId}
          onChange={(e) => setRubricId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400"
        >
          <option value="">Любая рубрика</option>
          {rubrics.map((r) => (
            <option key={r.id} value={r.id}>{r.emoji} {r.title}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-brand-text-secondary">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-brand-text-secondary">Ничего не найдено</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          {items.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect(u)}
              className="text-left p-4 rounded-xl border border-brand-border bg-card hover:border-primary-300 hover:bg-subtle transition-colors"
            >
              <div className="text-xs text-brand-text-secondary mb-1">{STATUS_LABELS[u.status]}</div>
              <div className="font-semibold text-brand-text leading-snug">{u.title}</div>
              {u.hook && (
                <div className="text-sm text-brand-text-secondary mt-1 line-clamp-2">→ {u.hook}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Typecheck + commit**

```bash
git add frontend/src/components/voiceover/UnitPicker.tsx
git commit -m "feat(voiceover): UnitPicker — Step 1 with debounced search/filters

Reuses unitsApi.list. Debounce 250ms on search/status/rubric. Cards in
2-column grid, click selects → upstream wizard moves to Generate step
with pre-built topic from title/hook/essence/rubric."
```

### Task 5.2: GenerateStep

**Files:**
- Modify: `frontend/src/components/voiceover/GenerateStep.tsx` (replace stub)

**Step 1: Implementation**

```tsx
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { voiceoverApi } from '../../api/voiceover'
import { useToast } from '../../contexts/ToastContext'
import type { WizardState } from '../../pages/VoiceoverStudio'

const STYLE_OPTIONS = [
  'образовательный',
  'провокационный',
  'историчный',
  'мрачный',
  'весёлый',
  'детективный',
]

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

export function GenerateStep({ state, update, onBack, onNext }: Props) {
  const toast = useToast()
  const [running, setRunning] = useState(false)

  const toggleStyle = (s: string) => {
    update({
      styles: state.styles.includes(s) ? state.styles.filter(x => x !== s) : [...state.styles, s],
    })
  }

  const generate = async () => {
    if (!state.topic.trim()) {
      toast.error('Опиши тему сценария')
      return
    }
    setRunning(true)
    try {
      const r = await voiceoverApi.generate({
        topic: state.topic,
        duration: state.duration,
        styles: state.styles,
      })
      update({ draft: r.text, finalScript: r.text })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка генерации')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-brand-text">Сценарий</h2>
        <p className="text-sm text-brand-text-secondary mt-1">
          Опиши тему и стилистические предпочтения. Claude сгенерирует сценарий по гайду.
        </p>
      </div>

      <div>
        <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Тема</label>
        <textarea
          value={state.topic}
          onChange={(e) => update({ topic: e.target.value })}
          rows={6}
          className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y text-sm whitespace-pre-line"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Длина (сек)</label>
          <select
            value={state.duration}
            onChange={(e) => update({ duration: e.target.value as WizardState['duration'] })}
            className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400"
          >
            <option value="60">60</option>
            <option value="90">90</option>
            <option value="120">120</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Стиль</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {STYLE_OPTIONS.map((s) => {
              const sel = state.styles.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStyle(s)}
                  className={
                    'px-2.5 py-1 text-xs rounded-full border transition-colors ' +
                    (sel
                      ? 'bg-primary-100 border-primary-300 text-primary-700'
                      : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300')
                  }
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {state.draft && (
        <div>
          <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Черновик</label>
          <textarea
            value={state.draft}
            onChange={(e) => update({ draft: e.target.value, finalScript: e.target.value })}
            rows={14}
            className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-subtle text-brand-text outline-none focus:border-primary-400 resize-y font-mono text-sm whitespace-pre-line"
          />
          <p className="text-xs text-brand-text-secondary mt-1">
            Можно править вручную — изменения попадут в фактчек и стиль-фильтр.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-brand-border">
        <button onClick={onBack} className="btn btn-secondary">← К идеям</button>
        <div className="flex gap-2">
          <button onClick={generate} disabled={running} className="btn btn-secondary">
            {running ? <Loader2 size={14} className="animate-spin" /> : '🪄'}
            {state.draft ? 'Перегенерировать' : 'Сгенерировать'}
          </button>
          <button onClick={onNext} disabled={!state.draft.trim()} className="btn btn-primary">
            Дальше — фактчек →
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Typecheck + commit**

```bash
git add frontend/src/components/voiceover/GenerateStep.tsx
git commit -m "feat(voiceover): GenerateStep — Step 2 (Claude generation)

Topic textarea + duration select + style chips. 'Сгенерировать' calls
voiceoverApi.generate, draft can be edited inline before moving on.
Editing draft also updates finalScript so style step has the same input."
```

---

## Stage 6: Frontend — Step 3 (FactcheckStep) + Step 4 (StyleStep)

### Task 6.1: FactcheckStep

**Files:**
- Modify: `frontend/src/components/voiceover/FactcheckStep.tsx` (replace stub)

**Step 1: Implementation**

```tsx
import { useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'
import { voiceoverApi } from '../../api/voiceover'
import { useToast } from '../../contexts/ToastContext'
import type { WizardState } from '../../pages/VoiceoverStudio'

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

const TYPE_META = {
  ok:   { color: 'text-green-700  bg-green-50  border-green-200',  Icon: CheckCircle2 },
  warn: { color: 'text-amber-700  bg-amber-50  border-amber-200',  Icon: AlertTriangle },
  err:  { color: 'text-red-700    bg-red-50    border-red-200',    Icon: XCircle },
  info: { color: 'text-blue-700   bg-blue-50   border-blue-200',   Icon: Info },
} as const

export function FactcheckStep({ state, update, onBack, onNext }: Props) {
  const toast = useToast()
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    try {
      const r = await voiceoverApi.factcheck(state.draft)
      update({ factcheck: r.items })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка фактчекинга')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-brand-text">Фактчек</h2>
        <p className="text-sm text-brand-text-secondary mt-1">
          Проверка цитат, дат, химических свойств, имён организаций.
        </p>
      </div>

      <div className="bg-subtle rounded-xl p-4 max-h-64 overflow-y-auto">
        <div className="text-xs uppercase text-brand-text-secondary tracking-wider mb-2">Сценарий</div>
        <pre className="text-sm whitespace-pre-line font-mono text-brand-text">{state.draft}</pre>
      </div>

      {state.factcheck.length === 0 && !running && (
        <button onClick={run} className="btn btn-primary">
          🔍 Запустить фактчек
        </button>
      )}

      {running && (
        <div className="flex items-center gap-2 text-brand-text-secondary">
          <Loader2 size={16} className="animate-spin" /> Проверяем факты…
        </div>
      )}

      {state.factcheck.length > 0 && (
        <div className="space-y-2">
          {state.factcheck.map((item, i) => {
            const meta = TYPE_META[item.type as keyof typeof TYPE_META] ?? TYPE_META.info
            const Icon = meta.Icon
            return (
              <div key={i} className={`flex items-start gap-2 p-3 rounded-xl border ${meta.color}`}>
                <Icon size={16} className="mt-0.5 shrink-0" />
                <div className="text-sm whitespace-pre-line">{item.text}</div>
              </div>
            )
          })}
          <button onClick={run} disabled={running} className="btn btn-secondary text-sm">
            🔄 Перезапустить фактчек
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-brand-border">
        <button onClick={onBack} className="btn btn-secondary">← К сценарию</button>
        <button onClick={onNext} className="btn btn-primary">Дальше — стиль →</button>
      </div>
    </div>
  )
}
```

**Step 2: Typecheck + commit**

```bash
git add frontend/src/components/voiceover/FactcheckStep.tsx
git commit -m "feat(voiceover): FactcheckStep — Step 3 with colour-coded results

Runs voiceoverApi.factcheck on the current draft. Renders {ok/warn/err/info}
items with lucide icons + Tailwind colour pairs (green/amber/red/blue).
Re-run button stays available in case the user edited the draft and wants
a fresh check. Always allows moving to style step (factcheck is advisory)."
```

### Task 6.2: StyleStep

**Files:**
- Modify: `frontend/src/components/voiceover/StyleStep.tsx` (replace stub)

**Step 1: Implementation**

```tsx
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { voiceoverApi } from '../../api/voiceover'
import { unitsApi } from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { WizardState } from '../../pages/VoiceoverStudio'

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

export function StyleStep({ state, update, onBack, onNext }: Props) {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [styling, setStyling] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const runStyle = async () => {
    setStyling(true)
    try {
      const r = await voiceoverApi.style(state.draft)
      update({ finalScript: r.text })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка стиль-фильтра')
    } finally {
      setStyling(false)
    }
  }

  const applyEdits = async () => {
    if (!state.editNotes.trim()) return
    setEditing(true)
    try {
      const r = await voiceoverApi.edit(state.finalScript, state.editNotes)
      update({ finalScript: r.text, editNotes: '' })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка применения правок')
    } finally {
      setEditing(false)
    }
  }

  const saveAndNext = async () => {
    if (!state.unit) return onNext()
    const existing = state.unit.script_text ?? ''
    if (existing && existing.trim() !== state.finalScript.trim()) {
      const ok = await confirm({
        title: 'Перезаписать сценарий?',
        message: 'В юните уже сохранён сценарий. Перезаписать его новым из студии?',
        variant: 'danger',
        confirmText: 'Перезаписать',
      })
      if (!ok) return
    }
    setSaving(true)
    try {
      await unitsApi.update(state.unit.id, { script_text: state.finalScript } as any)
      onNext()
    } catch {
      toast.error('Не удалось сохранить сценарий')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-brand-text">Стиль-фильтр</h2>
        <p className="text-sm text-brand-text-secondary mt-1">
          Прогон через style_guide_video — 14 базовых правил + аудиальные/стилистические уточнения.
        </p>
      </div>

      {!state.finalScript && (
        <button onClick={runStyle} disabled={styling} className="btn btn-primary">
          {styling ? <Loader2 size={14} className="animate-spin" /> : '✨'} Применить стиль
        </button>
      )}

      {state.finalScript && (
        <>
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Финальный сценарий</label>
            <textarea
              value={state.finalScript}
              onChange={(e) => update({ finalScript: e.target.value })}
              rows={16}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-subtle text-brand-text outline-none focus:border-primary-400 resize-y font-mono text-sm whitespace-pre-line"
            />
          </div>

          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Правки</label>
            <textarea
              value={state.editNotes}
              onChange={(e) => update({ editNotes: e.target.value })}
              rows={3}
              placeholder="Например: убрать пафос в финале, добавить шутку в середине…"
              className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y text-sm"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={applyEdits}
                disabled={editing || !state.editNotes.trim()}
                className="btn btn-secondary text-sm"
              >
                {editing ? <Loader2 size={14} className="animate-spin" /> : '✏️'} Применить правки
              </button>
              <button onClick={runStyle} disabled={styling} className="btn btn-secondary text-sm">
                {styling ? <Loader2 size={14} className="animate-spin" /> : '🔄'} Прогнать стиль ещё раз
              </button>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-brand-border">
        <button onClick={onBack} className="btn btn-secondary">← К фактчеку</button>
        <button
          onClick={saveAndNext}
          disabled={saving || !state.finalScript.trim()}
          className="btn btn-primary"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : '💾'} Сохранить и продолжить →
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Typecheck + commit**

```bash
git add frontend/src/components/voiceover/StyleStep.tsx
git commit -m "feat(voiceover): StyleStep — Step 4 (style filter + edits + writeback)

Three actions: apply style filter (voiceoverApi.style), free-form edits
(voiceoverApi.edit with user notes), save-and-next (writes finalScript to
content_units.script_text via unitsApi.update with confirm dialog if the
unit already had a non-empty script_text)."
```

---

## Stage 7: Frontend — Step 5 + per-unit entry button

### Task 7.1: PreprocessStep

**Files:**
- Modify: `frontend/src/components/voiceover/PreprocessStep.tsx` (replace stub)

**Step 1: Implementation**

```tsx
import { useState } from 'react'
import { Loader2, Copy, Download } from 'lucide-react'
import { voiceoverApi } from '../../api/voiceover'
import { unitsApi } from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'
import type { WizardState } from '../../pages/VoiceoverStudio'

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onDone: () => void
}

function buildTZ(state: WizardState): string {
  const lines = [
    'ТЗ для монтажника',
    `Проект: Химичка · Войсовер`,
    `Тема: ${(state.unit?.title ?? state.topic).slice(0, 80)}`,
    `Длина: ~${state.duration} сек`,
    `Чанков: ${state.chunks.length}`,
    '',
    'НАСТРОЙКИ ELEVENLABS:',
    'Модель: Turbo v2.5',
    'Stability: 0.55',
    'Similarity: 0.80',
    'Style exaggeration: 0',
    'Speaker Boost: включён',
    'Output format: mp3_44100_128',
    '',
    'ВОЙСОВЕР:',
    'Загружай каждый чанк ОТДЕЛЬНО (не bulk!).',
    'Файлы: chunk_01.mp3, chunk_02.mp3 …',
    '',
    'МОНТАЖ:',
    'Склеивать в порядке нумерации.',
    'Пауза между чанками: 100–200 мс.',
    'Нормализация: -16 LUFS.',
    'Постобработка: de-click (iZotope RX / Adobe Podcast).',
    '',
    'ТЕКСТ ПО ЧАНКАМ:',
    ...state.chunks.map((c, i) => `\n[${i + 1}] ${c}`),
  ]
  return lines.join('\n')
}

export function PreprocessStep({ state, update, onBack, onDone }: Props) {
  const toast = useToast()
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)

  const run = async () => {
    setRunning(true)
    try {
      const r = await voiceoverApi.preprocess(state.finalScript)
      update({ chunks: r.chunks })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка препроцессинга')
    } finally {
      setRunning(false)
    }
  }

  const copyChunk = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast.success('Чанк скопирован')
  }

  const downloadTZ = () => {
    const blob = new Blob([buildTZ(state)], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tz_voiceover.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const finish = async () => {
    if (!state.unit) return onDone()
    const assembled = state.chunks.join(' ').trim()
    if (!assembled) return onDone()
    setSaving(true)
    try {
      await unitsApi.update(state.unit.id, { voiceover_text: assembled } as any)
      toast.success('Сценарий и озвучка сохранены в контент-банк')
      onDone()
    } catch {
      toast.error('Не удалось сохранить озвучку')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-brand-text">ТЗ для ElevenLabs</h2>
        <p className="text-sm text-brand-text-secondary mt-1">
          Расстановка ударений (U+0301), эмоциональные теги, чанки 200-350 символов.
        </p>
      </div>

      {state.chunks.length === 0 && !running && (
        <button onClick={run} className="btn btn-primary">
          🎙 Запустить препроцессор
        </button>
      )}

      {running && (
        <div className="flex items-center gap-2 text-brand-text-secondary">
          <Loader2 size={16} className="animate-spin" /> Расставляем ударения и режем на чанки…
        </div>
      )}

      {state.chunks.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={run} disabled={running} className="btn btn-secondary text-sm">
              🔄 Перезапустить
            </button>
            <button onClick={downloadTZ} className="btn btn-secondary text-sm">
              <Download size={14} /> Скачать ТЗ
            </button>
            <span className="text-xs text-brand-text-secondary ml-auto">{state.chunks.length} чанков</span>
          </div>

          <div className="space-y-2">
            {state.chunks.map((c, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-xl border border-brand-border bg-subtle">
                <div className="text-xs font-mono text-brand-text-secondary w-6 shrink-0">{i + 1}</div>
                <pre className="flex-1 text-sm whitespace-pre-line font-mono text-brand-text">{c}</pre>
                <button
                  onClick={() => copyChunk(c)}
                  className="text-brand-text-secondary hover:text-primary-600"
                  title="Копировать"
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-brand-border">
        <button onClick={onBack} className="btn btn-secondary">← К стилю</button>
        <button
          onClick={finish}
          disabled={saving || state.chunks.length === 0}
          className="btn btn-primary"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : '✅'} Готово
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Typecheck + commit**

```bash
git add frontend/src/components/voiceover/PreprocessStep.tsx
git commit -m "feat(voiceover): PreprocessStep — Step 5 (chunks + TZ + writeback)

Calls voiceoverApi.preprocess. Each chunk shows with copy button.
Download generates plain-text TZ file with ElevenLabs settings + chunked
text. 'Готово' assembles voiceover_text from chunks and writes back to
content_units, then redirects via onDone (back to /content-bank with the
unit in search)."
```

### Task 7.2: «🎙 Открыть в студии» button in UnitEditModal

**Files:**
- Modify: `frontend/src/components/content-bank/UnitEditModal.tsx`

**Step 1: Locate the script_text textarea inside the «🎬 Производство» section**

```bash
grep -n "script_text\|Сценарий" frontend/src/components/content-bank/UnitEditModal.tsx
```

**Step 2: Add a small button immediately under that textarea**

```tsx
<button
  type="button"
  onClick={() => unit !== 'new' && navigate(`/voiceover/${unit.id}`)}
  disabled={unit === 'new'}
  className="text-xs text-primary-600 hover:text-primary-700 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
>
  🎙 Открыть в войсовер-студии →
</button>
```

If `useNavigate` isn't already imported in this file:
```ts
import { useNavigate } from 'react-router-dom'
// inside component
const navigate = useNavigate()
```

**Step 3: Typecheck + commit**

```bash
git add frontend/src/components/content-bank/UnitEditModal.tsx
git commit -m "feat(content-bank): «🎙 Открыть в студии» button in modal

Sits right under the script_text textarea in the Production section.
Disabled for unsaved 'new' units. Opens /voiceover/:unitId — preloads
this unit and skips the picker step."
```

---

## Stage 8: Push + smoke

### Task 8.1: Verify all stages committed

```bash
git status -s | grep -v "^??" | grep -v "launch.json\|^ M CLAUDE"
git log --oneline -25
```

Working tree clean of voiceover-related changes. Top commits should cover Stages 1-7.

### Task 8.2: Push to both remotes

```bash
git push origin main
git push vercel-deploy main
```

### Task 8.3: Confirm deployments

- **Backend (Railway):** open dashboard, watch build for the latest commit. Check that `ANTHROPIC_API_KEY` is set in env vars (Task 0.2). Verify `/health` and `/api/voiceover/bootstrap` return 200 (with auth).
- **Frontend (Vercel):** poll `mcp__ee9ee30f-...__list_deployments` for project `prj_GFg64z7zI1Jyx5JKPop0LIiyWKQA`. Wait for `state: "READY"`.

### Task 8.4: Smoke checklist (manual, user-driven)

Open `https://erp.ximi4ka.ru/voiceover` and verify:

1. **Sidebar:** «🎙 Войсовер» рядом с «Контент-банк», иконка микрофона.
2. **Bootstrap:** Loading спиннер → picker рендерится с фильтрами (поиск, статус, рубрика).
3. **Pick unit:** клик по карточке → переход на Step 2 «Сценарий», `topic` предзаполнен заголовком + хук + суть.
4. **Generate:** Тыкаем «Сгенерировать», ждём 10-30 сек → черновик появляется. Можно править.
5. **Factcheck:** Дальше → run factcheck → элементы с цветными иконками (зелёный/жёлтый/красный/синий).
6. **Style:** Дальше → «Применить стиль» → финальный сценарий. Поле «Правки» → «Применить правки» — обновляет финал.
7. **Writeback (script_text):** «Сохранить и продолжить» — если в юните уже был сценарий → confirm dialog. Подтверждаем → переход на Step 5.
8. **Preprocess:** «Запустить препроцессор» → чанки с ударениями + кнопками копирования. «Скачать ТЗ» отдаёт `tz_voiceover.txt`.
9. **Writeback (voiceover_text):** «Готово» → toast «Сохранено» → редирект на `/content-bank?search=<title>`.
10. **Per-unit entry:** открыть тот же юнит из `/content-bank` → модалка → секция «🎬 Производство» → `script_text` заполнен. Кнопка «🎙 Открыть в войсовер-студии» — клик → попадаем сразу на Step 2 со state preloaded.
11. **Превью в таблице:** строка юнита показывает 2-3 строки `script_text` под заголовком (через line-clamp-3 из Stage 5 продакшн-блока).
12. **Empty etalon graceful fallback:** генерация работает даже когда `etalon_script` в bootstrap = `null` (просто хуже по качеству — это ожидаемо).

If any step fails — surface via Systematic-Debugging skill. The most likely failure modes:
- 401/500 on `/api/claude/*` → check `ANTHROPIC_API_KEY` in Railway
- Auth middleware blocks `/api/voiceover/bootstrap` → check JWT cookie/header
- CORS on Railway → check CORS allowlist includes `erp.ximi4ka.ru`
- `brand_docs` rows changed/deleted → re-seed via Supabase

---

## Out of scope / future work

- Streaming Claude responses (SSE) — when latency becomes a UX issue.
- Versioning / undo / diff for regenerated scripts.
- Autosave drafts between steps — close-tab loses progress.
- ElevenLabs API direct integration (today: copy/paste chunks manually).
- Cost tracking / token budget per user.
- Force-refresh endpoint for `brand_docs` cache (today: 30min TTL).
- Customise etalon UUID via UI (today: hardcoded constant + manual SQL update).
- Multi-user collaboration / shared draft.

---

## Rollback

1. **Frontend:** redeploy previous `vercel-deploy` commit via Vercel dashboard.
2. **Backend:** `git revert <range>` on `origin`, push.
3. **DB:** nothing to roll back — no migrations in this plan.
4. **Env:** `ANTHROPIC_API_KEY` can stay in Railway, doesn't interfere.
