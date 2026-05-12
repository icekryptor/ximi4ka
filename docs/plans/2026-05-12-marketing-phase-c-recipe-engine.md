# Marketing Unit — Phase C (Recipe Engine + short_post recipe) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** ✅ Phase C complete on 2026-05-12. Ready for Phase D (Telegram Bot Publisher + auto-publication worker).

**Goal:** Реализовать recipe-engine (YAML-определяемые per-type пайплайны производства) и первый рецепт для `content_type='short_post'` — минимальный путь Идея → Draft (AI) → Final (manual). Existing short_video pipeline (Voiceover Studio) не трогаем — для него рецепт появится в отдельной фазе.

**Architecture:** Recipe = YAML-файл в `backend/src/content/recipes/<content_type>.yaml`, описывающий шаги (id, artifact_kind, default_executor, ai_assist_key). При загрузке сервера парсятся все YAML-файлы, кэшируются в памяти. `content_unit.recipe_state` (JSONB-колонка из Phase A) хранит per-unit состояние шагов. Новый generic-endpoint `POST /api/claude/recipe-step` маршрутизирует AI-assist вызовы по `(content_type, step_id)` к prompt-builder функциям. UI: новый компонент `RecipeView.tsx` показывается в `UnitEditModal` для типов с зарегистрированным рецептом (на v1 — только `short_post`); для остальных типов модалка работает как раньше.

**Tech Stack:** Node.js + Express + TypeORM + Anthropic SDK (всё уже есть). Новая backend-зависимость: `js-yaml` + `@types/js-yaml`. React 18 + TS на фронте.

**Parent docs:**
- [Operating model](2026-05-11-marketing-unit-operating-model-design.md)
- [Content production PRD](2026-05-11-content-production-prd-design.md) §3 (workflow), §5 (AI-assist), §8 Phase C
- [Phase A foundation](2026-05-11-marketing-phase-a-foundation.md) — `content_units.recipe_state` уже есть.
- [Phase B UI](2026-05-12-marketing-phase-b-strategy-channels-ui.md) — мерж в main.

---

## Pre-flight checklist

1. На main + актуальная схема:
   ```bash
   cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/.claude/worktrees/confident-tesla-8e46b9
   git fetch origin && git merge --ff-only origin/main
   ```
2. Baseline компилируется:
   ```bash
   cd backend && npx tsc --noEmit && cd ..
   cd frontend && npm run build && cd ..
   ```
   Оба — exit 0.
3. Проверь, что `backend/.env` имеет `ANTHROPIC_API_KEY` (необходим для recipe-step AI вызовов; если нет — стоп, спроси пользователя).

---

## Architectural decisions (read before any task)

### Recipe data shape

YAML example (`backend/src/content/recipes/short_post.yaml`):
```yaml
content_type: short_post
display_name: "Короткий пост"
description: "Текстовый пост для Telegram / VK / X. 1-2 факта + мысль."
steps:
  - id: draft
    display_name: "Драфт текста"
    artifact_kind: text  # одно из: text / script_text / image / audio / video_external / pdf / other
    default_executor: ai_agent
    ai_assist_key: short_post_draft
    description: "Claude генерит первый драфт по идее, рубрике и стиль-гайду style_guide_text."
  - id: final
    display_name: "Финальный текст"
    artifact_kind: text
    default_executor: self
    ai_assist_key: null  # manual step
    description: "Оператор правит драфт и подтверждает финал. Текст идёт в публикацию."
```

### `recipe_state` shape (in `content_units.recipe_state` JSONB)

```jsonc
{
  "version": 1,                     // schema-version для будущей миграции
  "recipe_content_type": "short_post",
  "started_at": "2026-05-12T12:00:00Z",
  "steps": [
    {
      "step_id": "draft",
      "status": "completed",         // pending | in_progress | awaiting_review | completed | skipped
      "executor_type": "ai_agent",
      "artifact_text": "...",        // inline для text-артефактов
      "artifact_asset_id": null,     // для file-артефактов (Supabase Storage)
      "ai_run_count": 1,
      "completed_at": "2026-05-12T12:01:30Z"
    },
    {
      "step_id": "final",
      "status": "in_progress",
      "executor_type": "self",
      "artifact_text": "...",
      "completed_at": null
    }
  ]
}
```

### API endpoints

- `GET /api/recipes` — список зарегистрированных рецептов (для проверки в UI и админки).
- `GET /api/recipes/:content_type` — детали рецепта или 404.
- `POST /api/content-units/:id/recipe-init` — инициализирует `recipe_state` для unit-а из YAML текущего content_type (если ещё пуст). Идемпотентно.
- `POST /api/claude/recipe-step` — body `{ unit_id, step_id, custom_prompt? }`. Маршрутизирует на handler по `(content_unit.content_type, step_id)`. Возвращает `{ text: string, model: string, tokens?: number }`. Не модифицирует `recipe_state` — UI делает PATCH следующим запросом.
- `PATCH /api/content-units/:id/recipe-state` — обновляет JSONB полным объектом или подмножеством шагов. Валидирует структуру.

### UI flow в UnitEditModal

- Если `content_unit.content_type` имеет recipe (из `GET /api/recipes/:content_type`), показываем `<RecipeView />` ВЫШЕ legacy production-блока.
- Для типов БЕЗ рецепта — legacy блок как сейчас, ничего не меняется.
- `RecipeView`:
  - Загружает recipe + текущее `recipe_state`.
  - Кнопка «Инициализировать рецепт», если state пустой → POST `/recipe-init`.
  - Для каждого шага: компактная карточка с status badge, executor_type, описанием.
  - Для AI-шага в `pending` — кнопка «Сгенерировать»; во время вызова — спиннер; на успех — текст в textarea + переход в `awaiting_review`; кнопки «Принять» (→ completed) / «Перегенерировать».
  - Для manual-шага — textarea для редактирования artifact_text + кнопка «Подтвердить» (→ completed).
  - Linear progression: следующий шаг доступен только после `completed` предыдущего.

### Claude prompt for `short_post_draft`

```
system: |
  Ты — копирайтер бренда Химичка (наборы для химических опытов, ximi4ka.ru,
  продажи на WB и Ozon).

  ## Стилевой гайд (обязательно к исполнению)
  {style_guide_text}

  ## Матрица рубрик
  {rubrics_matrix}

  ## Задача
  Напиши короткий пост для Telegram / VK / X на основе идеи ниже.
  Структура: один хук-крючок + 1-2 факта + закрытие (мысль или мягкий CTA).
  Длина: 400-800 символов. Без хэштегов.
  Только текст поста, без пояснений и markdown-разметки.
  Перед написанием определи рубрику и тональную группу из матрицы.

user: |
  Идея: {title}
  Рубрика (опционально): {rubric_title}
  Дополнительные заметки: {notes}
  {custom_prompt_block}
```

`{style_guide_text}` берётся из `brand_docs.style_guide_text` через существующий prompt-cache; **если этого документа нет — Claude получает пустую строку, в ответе возможен generic-tone**. Рекомендуем создать placeholder через `/marketing/strategy` UI (или через seed-скрипт в Task 7).

### Phase C НЕ делает

- Не трогает Voiceover Studio (short_video остаётся на legacy endpoint-ах).
- Не делает iterative-learning addenda для short_post (Phase D).
- Не интегрирует publishing/Telegram bot (Phase D).
- Не вводит контракт executor=contractor (Phase E или позже — на v1 только `self` и `ai_agent`).
- Не добавляет recipe-management UI (редактор YAML через UI) — статические файлы.
- Не добавляет рецепты для других типов — отдельные PR/планы.

---

## Tasks

### Task 1 — Install `js-yaml` dependency

**Files:**
- Modify: `backend/package.json`, `backend/package-lock.json`

**Step 1: Install**
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/.claude/worktrees/confident-tesla-8e46b9/backend
npm install js-yaml@^4.1.0
npm install --save-dev @types/js-yaml@^4.0.9
```
Expected: package.json gets two new entries (`dependencies.js-yaml` + `devDependencies.@types/js-yaml`); package-lock.json updated.

**Step 2: Verify compile**
```bash
npx tsc --noEmit
```
Expected: exit 0 (no usage yet — should still pass).

**Step 3: Commit**
```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add js-yaml + @types/js-yaml for recipe loading"
```

---

### Task 2 — Recipe YAML directory + short_post recipe

**Files:**
- Create: `backend/src/content/recipes/short_post.yaml`

**Step 1: Create directory + file**

Создай `backend/src/content/recipes/short_post.yaml` с СОДЕРЖИМЫМ exactly:

```yaml
content_type: short_post
display_name: "Короткий пост"
description: "Текстовый пост для Telegram / VK / X. 1-2 факта + мысль."
steps:
  - id: draft
    display_name: "Драфт текста"
    artifact_kind: text
    default_executor: ai_agent
    ai_assist_key: short_post_draft
    description: "Claude генерит первый драфт по идее, рубрике и стиль-гайду."
  - id: final
    display_name: "Финальный текст"
    artifact_kind: text
    default_executor: self
    ai_assist_key: null
    description: "Оператор правит драфт и подтверждает финал."
```

Note: ОБЯЗАТЕЛЬНО двойные кавычки на string-значениях с пробелами / кириллицей — YAML парсер строгий.

**Step 2: Commit**
```bash
git add backend/src/content/recipes/short_post.yaml
git commit -m "feat(recipes): short_post recipe (draft → final, 2 steps)"
```

---

### Task 3 — Recipe service (load YAML, cache, lookup)

**Files:**
- Create: `backend/src/services/recipe-engine.ts`

**Step 1: Write service**

```typescript
// backend/src/services/recipe-engine.ts
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

export type ExecutorType = 'self' | 'ai_agent' | 'contractor'
export type ArtifactKind = 'text' | 'script_text' | 'image' | 'audio' | 'video_external' | 'pdf' | 'other'

export interface RecipeStep {
  id: string
  display_name: string
  artifact_kind: ArtifactKind
  default_executor: ExecutorType
  ai_assist_key: string | null
  description: string
}

export interface Recipe {
  content_type: string
  display_name: string
  description: string
  steps: RecipeStep[]
}

const RECIPES_DIR = path.join(__dirname, '..', 'content', 'recipes')

let cache: Map<string, Recipe> | null = null

function loadAll(): Map<string, Recipe> {
  const map = new Map<string, Recipe>()
  if (!fs.existsSync(RECIPES_DIR)) {
    console.warn(`[recipe-engine] directory not found: ${RECIPES_DIR}`)
    return map
  }
  for (const file of fs.readdirSync(RECIPES_DIR)) {
    if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue
    const full = path.join(RECIPES_DIR, file)
    try {
      const raw = fs.readFileSync(full, 'utf-8')
      const doc = yaml.load(raw) as Recipe
      if (!doc || typeof doc !== 'object') {
        console.error(`[recipe-engine] ${file}: empty or non-object YAML`)
        continue
      }
      if (!doc.content_type || !Array.isArray(doc.steps)) {
        console.error(`[recipe-engine] ${file}: missing content_type or steps`)
        continue
      }
      map.set(doc.content_type, doc)
      console.log(`[recipe-engine] loaded ${doc.content_type} (${doc.steps.length} steps) from ${file}`)
    } catch (e) {
      console.error(`[recipe-engine] failed to load ${file}:`, e)
    }
  }
  return map
}

function getCache(): Map<string, Recipe> {
  if (!cache) cache = loadAll()
  return cache
}

export const recipeEngine = {
  list(): Recipe[] {
    return Array.from(getCache().values())
  },
  get(contentType: string): Recipe | null {
    return getCache().get(contentType) ?? null
  },
  has(contentType: string): boolean {
    return getCache().has(contentType)
  },
  /**
   * Initial recipe_state for a unit of given content_type.
   * Returns null if no recipe exists for the type.
   */
  initialState(contentType: string): RecipeState | null {
    const recipe = this.get(contentType)
    if (!recipe) return null
    return {
      version: 1,
      recipe_content_type: recipe.content_type,
      started_at: new Date().toISOString(),
      steps: recipe.steps.map((s) => ({
        step_id: s.id,
        status: 'pending' as const,
        executor_type: s.default_executor,
        artifact_text: null,
        artifact_asset_id: null,
        ai_run_count: 0,
        completed_at: null,
      })),
    }
  },
  /** Force reload from disk (for dev hot-reload). Not exposed via API on v1. */
  reload(): void {
    cache = null
    getCache()
  },
}

export type RecipeStepStatus = 'pending' | 'in_progress' | 'awaiting_review' | 'completed' | 'skipped'

export interface RecipeStepState {
  step_id: string
  status: RecipeStepStatus
  executor_type: ExecutorType
  artifact_text: string | null
  artifact_asset_id: string | null
  ai_run_count: number
  completed_at: string | null
}

export interface RecipeState {
  version: 1
  recipe_content_type: string
  started_at: string
  steps: RecipeStepState[]
}
```

**Step 2: Typecheck**
```bash
cd backend && npx tsc --noEmit && cd ..
```
Expected: exit 0.

**Step 3: Commit**
```bash
git add backend/src/services/recipe-engine.ts
git commit -m "feat(recipe-engine): YAML recipe loader + initial-state generator"
```

---

### Task 4 — `GET /api/recipes` + `GET /api/recipes/:content_type` endpoints

**Files:**
- Create: `backend/src/controllers/recipe.controller.ts`
- Create: `backend/src/routes/recipe.routes.ts`
- Modify: `backend/src/server.ts` (mount route)

**Step 1: Controller**

```typescript
// backend/src/controllers/recipe.controller.ts
import { Request, Response } from 'express'
import { recipeEngine } from '../services/recipe-engine'

export const recipeController = {
  list(_req: Request, res: Response) {
    res.json(recipeEngine.list())
  },

  getByType(req: Request, res: Response) {
    const { content_type } = req.params
    const recipe = recipeEngine.get(content_type)
    if (!recipe) {
      return res.status(404).json({ error: 'Рецепт для этого типа контента не найден' })
    }
    res.json(recipe)
  },
}
```

**Step 2: Routes**

```typescript
// backend/src/routes/recipe.routes.ts
import { Router } from 'express'
import { recipeController } from '../controllers/recipe.controller'

const router = Router()
router.get('/', recipeController.list)
router.get('/:content_type', recipeController.getByType)

export default router
```

**Step 3: Mount in server.ts**

В блоке routes-импортов:
```typescript
import recipeRoutes from './routes/recipe.routes';
```

В блоке `app.use('/api/...')` (после Phase B mounts):
```typescript
app.use('/api/recipes', authMiddleware, recipeRoutes);
```

**Step 4: Typecheck + build**
```bash
cd backend && npx tsc --noEmit && npm run build && cd ..
```

**Step 5: Commit**
```bash
git add backend/src/controllers/recipe.controller.ts backend/src/routes/recipe.routes.ts backend/src/server.ts
git commit -m "feat(backend): recipe registry endpoints (GET /api/recipes, /api/recipes/:content_type)"
```

---

### Task 5 — `POST /api/content-units/:id/recipe-init`

**Files:**
- Modify: `backend/src/controllers/content-unit.controller.ts`
- Modify: `backend/src/routes/content-unit.routes.ts`

**Step 1: Add controller method**

Прочитай существующий `content-unit.controller.ts` — он экспортирует объект `contentUnitController`. Добавь метод (в конец объекта, перед закрывающей `}`):

```typescript
async recipeInit(req: Request, res: Response) {
  try {
    const { id } = req.params
    const unit = await AppDataSource.getRepository(ContentUnit).findOne({ where: { id } })
    if (!unit) return res.status(404).json({ error: 'Контент-юнит не найден' })

    // Idempotent: если recipe_state уже инициализирован под тот же content_type — возвращаем как есть.
    if (unit.recipe_state && (unit.recipe_state as any).recipe_content_type === unit.content_type) {
      return res.json(unit)
    }

    const initial = recipeEngine.initialState(unit.content_type)
    if (!initial) {
      return res.status(400).json({ error: `Рецепт для типа "${unit.content_type}" не зарегистрирован` })
    }

    unit.recipe_state = initial as unknown as Record<string, unknown>
    unit.production_started_at = unit.production_started_at ?? new Date()
    await AppDataSource.getRepository(ContentUnit).save(unit)
    res.json(unit)
  } catch (error) {
    console.error('Ошибка инициализации рецепта:', error)
    res.status(500).json({ error: 'Ошибка инициализации рецепта' })
  }
},
```

Добавь импорт в начало файла:
```typescript
import { recipeEngine } from '../services/recipe-engine'
```

**Step 2: Add route**

В `backend/src/routes/content-unit.routes.ts` добавь после существующих routes:
```typescript
router.post('/:id/recipe-init', contentUnitController.recipeInit)
```

**Step 3: Typecheck**
```bash
cd backend && npx tsc --noEmit && cd ..
```

**Step 4: Commit**
```bash
git add backend/src/controllers/content-unit.controller.ts backend/src/routes/content-unit.routes.ts
git commit -m "feat(content-unit): POST /:id/recipe-init endpoint (idempotent)"
```

---

### Task 6 — `PATCH /api/content-units/:id/recipe-state`

**Files:**
- Modify: `backend/src/controllers/content-unit.controller.ts`
- Modify: `backend/src/routes/content-unit.routes.ts`

**Step 1: Add controller method**

```typescript
async patchRecipeState(req: Request, res: Response) {
  try {
    const { id } = req.params
    const newState = req.body as Record<string, unknown>
    if (!newState || typeof newState !== 'object') {
      return res.status(400).json({ error: 'Тело запроса должно быть JSON-объектом recipe_state' })
    }
    if (typeof newState.version !== 'number' || !Array.isArray((newState as any).steps)) {
      return res.status(400).json({ error: 'recipe_state должен содержать version (number) и steps (array)' })
    }
    const repo = AppDataSource.getRepository(ContentUnit)
    const unit = await repo.findOne({ where: { id } })
    if (!unit) return res.status(404).json({ error: 'Контент-юнит не найден' })
    unit.recipe_state = newState
    await repo.save(unit)
    res.json(unit)
  } catch (error) {
    console.error('Ошибка сохранения recipe_state:', error)
    res.status(500).json({ error: 'Ошибка сохранения recipe_state' })
  }
},
```

**Step 2: Add route**

```typescript
router.patch('/:id/recipe-state', contentUnitController.patchRecipeState)
```

**Step 3: Typecheck + commit**
```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/controllers/content-unit.controller.ts backend/src/routes/content-unit.routes.ts
git commit -m "feat(content-unit): PATCH /:id/recipe-state endpoint"
```

---

### Task 7 — Seed `brand_docs.style_guide_text` (placeholder)

**Files:**
- Create: `backend/src/seeds/seed-style-guide-text.ts`
- Modify: `backend/package.json` (add npm script)

**Context:** Phase C нужен `style_guide_text` doc в `brand_docs` чтобы `short_post_draft` AI-prompt не получал пустую строку. Минимальный placeholder, оператор расширит через `/marketing/strategy`.

**Step 1: Write seed**

```typescript
// backend/src/seeds/seed-style-guide-text.ts
import 'reflect-metadata'
import dotenv from 'dotenv'
dotenv.config()

import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'

const SLUG = 'style_guide_text'
const TITLE = 'Стиль-гайд: текстовые посты'
const PLACEHOLDER = `# Стиль-гайд для текстовых постов

## Тон голоса

- Уверенный, познавательный, без морализаторства.
- Простые предложения. Минимум канцелярита.
- Эмоция > сухие факты, но факты — точные.

## Структура

- Хук: цепляющая первая строка (вопрос / парадокс / неожиданный факт).
- Основа: 1-2 факта или мысль с примером.
- Закрытие: мысль или мягкий CTA (без «купи»).

## Лексика

- Не используем: «делимся», «рады представить», «обращаем ваше внимание».
- Используем: бытовые слова, точные термины там, где нужны термины.

## Длина

- Telegram / VK / X: 400-800 символов.

## TODO

Этот документ — placeholder. Оператор: расширь через /marketing/strategy →
сохрани полный гайд в brand_docs.style_guide_text.
`

async function main() {
  await AppDataSource.initialize()
  const repo = AppDataSource.getRepository(BrandDoc)
  const existing = await repo.findOne({ where: { slug: SLUG } })
  if (existing) {
    console.log(`brand_docs.${SLUG} уже существует — пропускаю`)
    await AppDataSource.destroy()
    return
  }
  await repo.save(
    repo.create({
      slug: SLUG,
      title: TITLE,
      content: PLACEHOLDER,
      version: '1.0-placeholder',
    }),
  )
  console.log(`brand_docs.${SLUG} создан`)
  await AppDataSource.destroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

**Step 2: Add npm script**

В `backend/package.json` после `"seed:channels"`:
```json
"seed:style-guide-text": "ts-node src/seeds/seed-style-guide-text.ts",
```

**Step 3: Typecheck + commit (не запускать в проде в этом step)**
```bash
cd backend && npx tsc --noEmit && cd ..
git add backend/src/seeds/seed-style-guide-text.ts backend/package.json
git commit -m "feat(seeds): style_guide_text placeholder for short_post recipe AI prompts"
```

Run-seed step — после всех code-tasks: `cd backend && npm run seed:style-guide-text`. Идемпотентно.

---

### Task 8 — `POST /api/claude/recipe-step` endpoint

**Files:**
- Modify: `backend/src/controllers/claude.controller.ts`
- Modify: `backend/src/routes/claude.routes.ts`

**Step 1: Add prompt builders + handler**

В `claude.controller.ts` ДО объекта `claudeController` (после `handleClaudeError`):

```typescript
import { AppDataSource } from '../config/database'
import { ContentUnit } from '../entities/ContentUnit'
import { ContentRubric } from '../entities/ContentRubric'
import { recipeEngine } from '../services/recipe-engine'

interface RecipeStepContext {
  unit: ContentUnit
  rubric: ContentRubric | null
  cache: Awaited<ReturnType<typeof getPromptCache>>
  custom_prompt?: string
}

/** Returns { system, user, maxTokens } for a given (content_type, step_id), or null if not implemented. */
async function buildRecipeStepPrompt(
  contentType: string,
  stepId: string,
  ctx: RecipeStepContext,
): Promise<{ system: string; user: string; maxTokens: number } | null> {
  // (short_post, draft)
  if (contentType === 'short_post' && stepId === 'draft') {
    const guide = ctx.cache.brandDocs.style_guide_text ?? ''
    const rubrics = ctx.cache.brandDocs.rubrics_matrix ?? ''
    const customBlock = ctx.custom_prompt ? `\nДополнительные инструкции: ${ctx.custom_prompt}` : ''
    const system = `Ты — копирайтер бренда Химичка (наборы для химических опытов, ximi4ka.ru, продажи на WB и Ozon).

## Стилевой гайд (обязательно к исполнению)
${guide || '(не задан — используй нейтральный познавательный тон)'}

## Матрица рубрик
${rubrics}

## Задача
Напиши короткий пост для Telegram / VK / X на основе идеи ниже.
Структура: хук (одна сильная первая строка) + 1-2 факта или мысль + закрытие.
Длина: 400-800 символов. Без хэштегов и markdown-разметки.
Только текст поста, без пояснений.
Перед написанием определи рубрику и тональную группу из матрицы.`
    const user = `Идея: ${ctx.unit.title}
Рубрика: ${ctx.rubric?.title ?? 'не выбрана'}
Заметки: ${ctx.unit.notes ?? ''}${customBlock}`
    return { system, user, maxTokens: 2048 }
  }
  // (short_post, final) is manual — no AI prompt
  return null
}
```

И в объект `claudeController` добавь метод (в конец):

```typescript
async recipeStep(req: Request, res: Response) {
  try {
    const { unit_id, step_id, custom_prompt } = req.body as {
      unit_id?: string
      step_id?: string
      custom_prompt?: string
    }
    if (!unit_id || !step_id) {
      return res.status(400).json({ error: 'unit_id и step_id обязательны' })
    }
    const unitRepo = AppDataSource.getRepository(ContentUnit)
    const unit = await unitRepo.findOne({
      where: { id: unit_id },
      relations: ['rubric'],
    })
    if (!unit) return res.status(404).json({ error: 'Контент-юнит не найден' })

    const recipe = recipeEngine.get(unit.content_type)
    if (!recipe) return res.status(400).json({ error: `Рецепт для "${unit.content_type}" не зарегистрирован` })

    const step = recipe.steps.find((s) => s.id === step_id)
    if (!step) return res.status(400).json({ error: `Шаг "${step_id}" не найден в рецепте` })
    if (step.default_executor !== 'ai_agent' || !step.ai_assist_key) {
      return res.status(400).json({ error: 'Шаг не предусматривает AI-исполнение' })
    }

    const cache = await getPromptCache()
    const prompt = await buildRecipeStepPrompt(unit.content_type, step.id, {
      unit,
      rubric: unit.rubric,
      cache,
      custom_prompt,
    })
    if (!prompt) {
      return res.status(501).json({ error: `Prompt builder для (${unit.content_type}, ${step.id}) не реализован` })
    }

    const text = await callClaude(prompt.system, prompt.user, prompt.maxTokens)
    res.json({ text, model: MODEL })
  } catch (e: any) {
    handleClaudeError(e, res, 'Ошибка выполнения шага рецепта')
  }
},
```

**Step 2: Mount route**

В `backend/src/routes/claude.routes.ts`:
```typescript
router.post('/recipe-step', claudeController.recipeStep)
```

**Step 3: Update prompt-cache to expose style_guide_text**

Проверь `backend/src/services/prompt-cache.ts` (по grep). Если `getPromptCache()` ещё не загружает `style_guide_text` — добавь его в загружаемый набор brand_docs. Текущий код:

```bash
grep -n "brandDocs\." backend/src/services/prompt-cache.ts | head -20
```

Если уже есть `style_guide_text` — пропусти. Иначе добавь по образцу `style_guide_video`. Если найдёшь, что cache принимает массив slug-ов из конфига — добавь `'style_guide_text'` туда. Stop and ask, если структура неоднозначна.

**Step 4: Typecheck + build**
```bash
cd backend && npx tsc --noEmit && npm run build && cd ..
```
Expected: оба 0.

**Step 5: Commit**
```bash
git add backend/src/controllers/claude.controller.ts backend/src/routes/claude.routes.ts backend/src/services/prompt-cache.ts
git commit -m "feat(claude): POST /api/claude/recipe-step generic endpoint + short_post.draft prompt"
```

---

### Task 9 — Frontend types + API client for recipes and recipe-state

**Files:**
- Modify: `frontend/src/api/types.ts`
- Create: `frontend/src/api/recipes.ts`

**Step 1: Add types to `types.ts` (в конец)**

```typescript
// ─── Recipe engine (Phase C) ─────────────────────────────────────────────────

export type ExecutorType = 'self' | 'ai_agent' | 'contractor'
export type ArtifactKind = 'text' | 'script_text' | 'image' | 'audio' | 'video_external' | 'pdf' | 'other'
export type RecipeStepStatus = 'pending' | 'in_progress' | 'awaiting_review' | 'completed' | 'skipped'

export interface RecipeStep {
  id: string
  display_name: string
  artifact_kind: ArtifactKind
  default_executor: ExecutorType
  ai_assist_key: string | null
  description: string
}

export interface Recipe {
  content_type: string
  display_name: string
  description: string
  steps: RecipeStep[]
}

export interface RecipeStepState {
  step_id: string
  status: RecipeStepStatus
  executor_type: ExecutorType
  artifact_text: string | null
  artifact_asset_id: string | null
  ai_run_count: number
  completed_at: string | null
}

export interface RecipeState {
  version: 1
  recipe_content_type: string
  started_at: string
  steps: RecipeStepState[]
}
```

**Step 2: API client**

```typescript
// frontend/src/api/recipes.ts
import { apiClient } from './client'
import { Recipe, ContentUnit } from './types'
import type { RecipeState } from './types'

export const recipesApi = {
  list: async (): Promise<Recipe[]> => {
    const res = await apiClient.get<Recipe[]>('/recipes')
    return res.data
  },
  getByType: async (contentType: string): Promise<Recipe | null> => {
    try {
      const res = await apiClient.get<Recipe>(`/recipes/${contentType}`)
      return res.data
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number } }
      if (ax?.response?.status === 404) return null
      throw e
    }
  },
  initForUnit: async (unitId: string): Promise<ContentUnit> => {
    const res = await apiClient.post<ContentUnit>(`/content-units/${unitId}/recipe-init`)
    return res.data
  },
  patchState: async (unitId: string, state: RecipeState): Promise<ContentUnit> => {
    const res = await apiClient.patch<ContentUnit>(`/content-units/${unitId}/recipe-state`, state)
    return res.data
  },
  runStep: async (unitId: string, stepId: string, customPrompt?: string): Promise<{ text: string; model: string }> => {
    const res = await apiClient.post<{ text: string; model: string }>('/claude/recipe-step', {
      unit_id: unitId,
      step_id: stepId,
      custom_prompt: customPrompt,
    })
    return res.data
  },
}
```

**Step 3: Typecheck**
```bash
cd frontend && npx tsc --noEmit && cd ..
```
Expected: 0. Если жалуется на `ContentUnit.recipe_state` — нужно добавить поле в existing ContentUnit type. Открой `frontend/src/api/types.ts`, найди существующий `ContentUnit` interface и добавь:
```typescript
recipe_state: RecipeState | null
production_started_at: string | null
target_segment_id: string | null
theme_id: string | null
```
(Эти поля уже есть в backend entity с Phase A, но фронт-types их мог не отразить — приведём в соответствие.)

**Step 4: Commit**
```bash
git add frontend/src/api/types.ts frontend/src/api/recipes.ts
git commit -m "feat(frontend-api): recipe types + recipesApi client (list/getByType/initForUnit/patchState/runStep)"
```

---

### Task 10 — `RecipeView` component

**Files:**
- Create: `frontend/src/components/content-bank/RecipeView.tsx`

**Context:** Компонент рендерит шаги рецепта для одного unit-а. Получает `unit`, `recipe`, `onChange(updatedUnit)` через props. Внутренние действия:
1. Если `unit.recipe_state === null` → показать кнопку «Инициализировать рецепт». При клике: `recipesApi.initForUnit(unit.id)` → onChange.
2. Если state есть — отрендерить список шагов из `recipe.steps`. Для каждого:
   - Badge с status + executor.
   - Description.
   - Если step.default_executor === 'ai_agent' и status === 'pending':
     - Кнопка «Сгенерировать» (опционально textarea для custom_prompt).
     - При клике: `recipesApi.runStep(unit.id, step.id, customPrompt)` → получить text → обновить state локально (status: 'awaiting_review', artifact_text: text, ai_run_count++) → `recipesApi.patchState` → onChange.
   - Если status === 'awaiting_review' (AI вернул artifact):
     - Textarea с artifact_text (редактируемый).
     - Кнопки «Принять» (→ status: 'completed', completed_at: now) / «Перегенерировать» (→ снова runStep) / «Сохранить черновик» (просто patchState с новым artifact_text).
   - Если step.default_executor === 'self':
     - Textarea (всегда editable).
     - Кнопки «Подтвердить» (→ completed) / «Сохранить черновик».
   - Если status === 'completed':
     - Showed text (collapsed by default? просто read-only textarea с кнопкой «Открыть для правки» возвращающей в `in_progress`).

**Step 1: Read existing modal components**

Прочитай `frontend/src/components/content-bank/UnitEditModal.tsx` целиком — это даст шаблон toast / confirm / API-call handling в контексте modal.

**Step 2: Write component**

`frontend/src/components/content-bank/RecipeView.tsx`:

```typescript
import { useState } from 'react'
import { Sparkles, Check, RotateCw, Save, FileText, Bot, User } from 'lucide-react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import { recipesApi } from '../../api/recipes'
import type { ContentUnit, Recipe, RecipeState, RecipeStepState, RecipeStep } from '../../api/types'

interface Props {
  unit: ContentUnit
  recipe: Recipe
  onChange: (updated: ContentUnit) => void
}

const STATUS_LABELS: Record<RecipeStepState['status'], string> = {
  pending: 'Ожидает',
  in_progress: 'В работе',
  awaiting_review: 'На проверке',
  completed: 'Готово',
  skipped: 'Пропущено',
}

const STATUS_COLORS: Record<RecipeStepState['status'], string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  awaiting_review: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-500',
}

function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return String(e.response.data.error)
  return fallback
}

export function RecipeView({ unit, recipe, onChange }: Props) {
  const { showToast } = useToast()
  const [initLoading, setInitLoading] = useState(false)
  const [runningStepId, setRunningStepId] = useState<string | null>(null)
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({})

  const state = unit.recipe_state as RecipeState | null

  async function handleInit() {
    setInitLoading(true)
    try {
      const updated = await recipesApi.initForUnit(unit.id)
      onChange(updated)
      showToast('success', 'Рецепт инициализирован')
    } catch (e) {
      showToast('error', errorMessage(e, 'Ошибка инициализации'))
    } finally {
      setInitLoading(false)
    }
  }

  function updateStepLocal(stepId: string, patch: Partial<RecipeStepState>): RecipeState | null {
    if (!state) return null
    return {
      ...state,
      steps: state.steps.map((s) => (s.step_id === stepId ? { ...s, ...patch } : s)),
    }
  }

  async function persistState(newState: RecipeState) {
    const updated = await recipesApi.patchState(unit.id, newState)
    onChange(updated)
  }

  async function handleRunAi(step: RecipeStep) {
    setRunningStepId(step.id)
    try {
      const { text } = await recipesApi.runStep(unit.id, step.id, customPrompts[step.id])
      const cur = state?.steps.find((s) => s.step_id === step.id)
      const newState = updateStepLocal(step.id, {
        status: 'awaiting_review',
        artifact_text: text,
        ai_run_count: (cur?.ai_run_count ?? 0) + 1,
      })
      if (newState) await persistState(newState)
      showToast('success', 'Шаг выполнен')
    } catch (e) {
      showToast('error', errorMessage(e, 'Ошибка генерации'))
    } finally {
      setRunningStepId(null)
    }
  }

  async function handleAcceptStep(stepId: string, finalText: string) {
    const newState = updateStepLocal(stepId, {
      status: 'completed',
      artifact_text: finalText,
      completed_at: new Date().toISOString(),
    })
    if (newState) {
      try {
        await persistState(newState)
        showToast('success', 'Шаг принят')
      } catch (e) {
        showToast('error', errorMessage(e, 'Ошибка сохранения'))
      }
    }
  }

  async function handleSaveDraft(stepId: string, draftText: string) {
    const newState = updateStepLocal(stepId, { artifact_text: draftText })
    if (newState) {
      try {
        await persistState(newState)
        showToast('success', 'Черновик сохранён')
      } catch (e) {
        showToast('error', errorMessage(e, 'Ошибка сохранения'))
      }
    }
  }

  async function handleReopenStep(stepId: string) {
    const newState = updateStepLocal(stepId, { status: 'in_progress', completed_at: null })
    if (newState) await persistState(newState)
  }

  if (!state) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-start gap-3 mb-3">
          <FileText className="w-5 h-5 mt-0.5 text-brand-text-secondary" />
          <div>
            <h3 className="font-semibold text-brand-text">{recipe.display_name}</h3>
            <p className="text-sm text-brand-text-secondary">{recipe.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleInit}
          disabled={initLoading}
          className="btn btn-primary text-sm"
        >
          {initLoading ? 'Инициализация...' : 'Инициализировать рецепт'}
        </button>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 mt-0.5 text-brand-text-secondary" />
        <div>
          <h3 className="font-semibold text-brand-text">{recipe.display_name}</h3>
          <p className="text-sm text-brand-text-secondary">{recipe.description}</p>
        </div>
      </div>

      {recipe.steps.map((step, idx) => {
        const stepState = state.steps.find((s) => s.step_id === step.id)
        if (!stepState) return null
        const ExecutorIcon = stepState.executor_type === 'ai_agent' ? Bot : User
        const isRunning = runningStepId === step.id
        const isAiStep = step.default_executor === 'ai_agent' && step.ai_assist_key
        const canRunAi = isAiStep && (stepState.status === 'pending' || stepState.status === 'in_progress')

        return (
          <div key={step.id} className="border rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-brand-text-secondary">{idx + 1}.</span>
                  <h4 className="font-semibold text-brand-text">{step.display_name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[stepState.status]}`}>
                    {STATUS_LABELS[stepState.status]}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 inline-flex items-center gap-1">
                    <ExecutorIcon className="w-3 h-3" />
                    {stepState.executor_type === 'ai_agent' ? 'AI' : stepState.executor_type === 'self' ? 'Оператор' : 'Подрядчик'}
                  </span>
                </div>
                <p className="text-xs text-brand-text-secondary">{step.description}</p>
              </div>
            </div>

            {/* AI step — pending: show generate button + optional custom prompt */}
            {canRunAi && stepState.status !== 'awaiting_review' && (
              <div className="space-y-2">
                <textarea
                  className="w-full p-2 text-sm border rounded resize-none"
                  rows={2}
                  placeholder="Дополнительные инструкции для AI (опционально)"
                  aria-label="Дополнительные инструкции для AI"
                  value={customPrompts[step.id] ?? ''}
                  onChange={(e) => setCustomPrompts({ ...customPrompts, [step.id]: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => handleRunAi(step)}
                  disabled={isRunning}
                  className="btn btn-primary text-sm inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isRunning ? 'Генерация...' : stepState.ai_run_count > 0 ? 'Перегенерировать' : 'Сгенерировать'}
                </button>
                {stepState.ai_run_count > 0 && (
                  <span className="text-xs text-brand-text-secondary ml-2">
                    Запусков: {stepState.ai_run_count}
                  </span>
                )}
              </div>
            )}

            {/* awaiting_review (AI returned) or in_progress (manual edit) — editable textarea */}
            {(stepState.status === 'awaiting_review' || (stepState.status === 'in_progress' && !isAiStep)) && (
              <StepEditor
                initialText={stepState.artifact_text ?? ''}
                onAccept={(text) => handleAcceptStep(step.id, text)}
                onSaveDraft={(text) => handleSaveDraft(step.id, text)}
                onRegenerate={isAiStep ? () => handleRunAi(step) : undefined}
              />
            )}

            {/* completed — show readonly + reopen */}
            {stepState.status === 'completed' && (
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 border rounded text-sm whitespace-pre-wrap text-brand-text">
                  {stepState.artifact_text}
                </div>
                <button
                  type="button"
                  onClick={() => handleReopenStep(step.id)}
                  className="btn btn-secondary text-xs"
                >
                  Открыть для правки
                </button>
              </div>
            )}

            {/* Manual step that's still pending — let operator start it */}
            {!isAiStep && stepState.status === 'pending' && (
              <button
                type="button"
                onClick={() => handleSaveDraft(step.id, stepState.artifact_text ?? '')}
                className="btn btn-secondary text-sm"
              >
                Начать шаг
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface StepEditorProps {
  initialText: string
  onAccept: (text: string) => void | Promise<void>
  onSaveDraft: (text: string) => void | Promise<void>
  onRegenerate?: () => void | Promise<void>
}

function StepEditor({ initialText, onAccept, onSaveDraft, onRegenerate }: StepEditorProps) {
  const [text, setText] = useState(initialText)
  return (
    <div className="space-y-2">
      <textarea
        className="w-full p-3 text-sm border rounded resize-y"
        rows={8}
        aria-label="Текст артефакта шага"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAccept(text)}
          className="btn btn-primary text-sm inline-flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          Принять
        </button>
        <button
          type="button"
          onClick={() => onSaveDraft(text)}
          className="btn btn-secondary text-sm inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Сохранить черновик
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="btn btn-secondary text-sm inline-flex items-center gap-2"
          >
            <RotateCw className="w-4 h-4" />
            Перегенерировать
          </button>
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
git add frontend/src/components/content-bank/RecipeView.tsx
git commit -m "feat(content-bank): RecipeView component (steps, AI generation, accept/regenerate)"
```

---

### Task 11 — Wire `RecipeView` into `UnitEditModal`

**Files:**
- Modify: `frontend/src/components/content-bank/UnitEditModal.tsx`

**Context:** Когда `unit.content_type` имеет рецепт (грузим через `recipesApi.getByType`), показываем `<RecipeView />` поверх legacy полей. Legacy production-блок прячем только если рецепт активен; остальное (title, hook, status, rubric) — оставляем как есть.

**Step 1: Read full UnitEditModal.tsx**

Прочитай файл целиком — где renders production-блок, где state-хук на форму. Найди подходящее место (после section title или рядом с production-блоком).

**Step 2: Add recipe load**

В UnitEditModal добавь:

```typescript
const [recipe, setRecipe] = useState<Recipe | null>(null)
const [recipeLoading, setRecipeLoading] = useState(false)

useEffect(() => {
  let cancelled = false
  setRecipe(null)
  if (!unit) return
  setRecipeLoading(true)
  recipesApi.getByType(unit.content_type).then((r) => {
    if (!cancelled) {
      setRecipe(r)
      setRecipeLoading(false)
    }
  }).catch(() => {
    if (!cancelled) setRecipeLoading(false)
  })
  return () => { cancelled = true }
}, [unit?.id, unit?.content_type])
```

**Step 3: Render RecipeView**

Где-то в JSX (например, перед production-блоком), добавь:

```typescript
{recipe && unit && (
  <div className="mb-4">
    <RecipeView
      unit={unit}
      recipe={recipe}
      onChange={(updatedUnit) => {
        // обновляем локальный unit (если modal держит копию) + сигналим наружу для рефреша listа
        if (onUnitUpdated) onUnitUpdated(updatedUnit)
      }}
    />
  </div>
)}
```

⚠ Если UnitEditModal не имеет prop `onUnitUpdated` — нужно либо использовать существующий callback (обычно после `save()`), либо добавить новый. Прочитай modal-API сначала и подбери best fit. Stop and ask, если непонятно.

**Step 4: Imports**

```typescript
import { useEffect } from 'react'  // если ещё нет
import { RecipeView } from './RecipeView'
import { recipesApi } from '../../api/recipes'
import type { Recipe } from '../../api/types'
```

**Step 5: Typecheck + build**
```bash
cd frontend && npx tsc --noEmit && npm run build && cd ..
```
Expected: оба 0.

**Step 6: Commit**
```bash
git add frontend/src/components/content-bank/UnitEditModal.tsx
git commit -m "feat(content-bank): show RecipeView in UnitEditModal for types with registered recipe"
```

---

### Task 12 — Run seed + smoke test + push

**Files:** (no code changes)

**Step 1: Run style-guide-text seed against prod**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/.claude/worktrees/confident-tesla-8e46b9/backend
npm run seed:style-guide-text
```
Expected: `brand_docs.style_guide_text создан` (или «уже существует»).

**Step 2: Verify recipe loader works**

Стартани backend если не запущен (учти, пользователь возможно держит свой на 3001 — тогда пропусти этот шаг и смокни через psql/curl с его токеном):

```bash
# Quick standalone-mode проверка через ts-node REPL или скрипт:
npx ts-node -e "import('./src/services/recipe-engine').then(m => { console.log(JSON.stringify(m.recipeEngine.list(), null, 2)) })"
```
Expected: вывод массива с 1 элементом — short_post recipe.

**Step 3: TypeScript final sanity**

```bash
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
```
Оба — exit 0.

**Step 4: DB invariants**

```bash
set -a && source backend/.env && set +a
psql "$DATABASE_URL" -c "SELECT slug FROM brand_docs WHERE slug='style_guide_text';"
```
Expected: 1 строка.

**Step 5: Mark Phase C complete**

В шапке `docs/plans/2026-05-12-marketing-phase-c-recipe-engine.md` замени:
```
**Status:** ✅ Phase C complete on YYYY-MM-DD. Ready for Phase D (Telegram Bot Publisher + auto-publication worker).
```

```bash
git add docs/plans/2026-05-12-marketing-phase-c-recipe-engine.md
git commit -m "docs(plans): mark marketing phase C complete"
```

**Step 6: Push both remotes**

```bash
git push origin HEAD
git push vercel-deploy HEAD
```

---

## Post-Phase-C — что должно быть

- `js-yaml` зависимость + типы.
- 1 recipe в YAML (`short_post.yaml`).
- Recipe-engine сервис.
- 5 новых API endpoint-ов (`GET /api/recipes`, `GET /api/recipes/:type`, `POST /api/content-units/:id/recipe-init`, `PATCH /api/content-units/:id/recipe-state`, `POST /api/claude/recipe-step`).
- `brand_docs.style_guide_text` (placeholder) в проде.
- `RecipeView` компонент + интеграция в `UnitEditModal`.
- Operator может создать `short_post` unit, инициализировать рецепт, сгенерировать draft через Claude, отредактировать, перейти к final, подтвердить.
- TypeScript-сборки чистые.

## Что НЕ сделано в Phase C (для следующих фаз)

- Рецепты для остальных типов (long_post, carousel, seo_article, …) — отдельные PR / планы.
- Voiceover Studio переход на recipe-модель — отдельная фаза (риск ломать рабочий пайплайн, требует осторожной миграции).
- Iterative learning loop для short_post (style-guide-text addenda) — Phase D или E.
- Контракт `executor=contractor` (задача → подрядчик → артефакт-URL) — Phase E.
- ChannelPublisher + Telegram Bot — Phase D.
- Аналитика per-step (сколько раз перегенерили, время на шаг) — Phase E.

## Anti-pitfalls

- **Не редактируй существующие endpoints `/api/claude/*`** — `generate`, `factcheck` и пр. остаются для Voiceover Studio как есть.
- **`recipe_state` поле уже существует в БД** (Phase A) — не нужно ALTER TABLE.
- **YAML строгий к отступам**: 2 пробела, без табов. Кириллица в значениях — обязательно двойные кавычки если есть пробелы.
- **`content/recipes/*.yaml` НЕ копируется в `dist/` автоматически при `npm run build`** — это runtime asset. Проверь `backend/tsconfig.json` — если он копирует только `.ts` файлы, то в проде на Railway YAML файлы могут не появиться. На v1 это окей — `__dirname` в `src/` режиме (ts-node) работает; но для прода нужно либо `tsc-alias` + copy step, либо хранить рецепты в коде (TS-литералы). Если backend Railway-деплой ломается на `RECIPES_DIR` пустой — стоп, фикс отдельно (вынести в `src/` структуру через CopyPlugin или embedded literals).
- **`@types/js-yaml`** — devDependencies, не dependencies (Railway не запускает tsc в проде, использует `dist/`). Если падает прод-сборка с unknown type → проверь. Должно быть OK через `npm install` + `tsc`.
- **Не push до Task 12 шага 6.** Mid-task pushes триггерят Railway-redeploy с неполным состоянием.

## Открытые вопросы (не блокеры)

- Сборка YAML в prod — действительно ли `dist/content/recipes/*.yaml` появится? Проверим в Task 12 на смоке: если Railway не отдаёт recipes → стоп, делаем quick-fix (copy step в `npm run build`).
- Стоит ли обновить MODEL до `claude-sonnet-4-6`? CLAUDE.md рекомендует latest, но это отдельное решение — обсудим перед Phase D.
- Хочешь ли сразу добавить второй recipe (carousel или long_post) в Phase C, или строго один — для проверки engine? Рекомендация: один (short_post), Phase D добавит следующий после реального использования.
