# Content Engine Harness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans / subagent-driven-development.

**Goal:** Read-only страница-схема контент-движка: типы → конвейер шагов → инструкции (brand_docs + system-промпт), которые читает агент. Дерево слева-направо + панель деталей.

**Architecture:** Промпт-билдеры декларируют `reads` (слаги brand_docs) → эндпоинт `GET /api/content-engine/blueprint` собирает живую структуру из recipe-engine + билдеров + brand_docs → рекурсивное React-дерево (паттерн AssemblyTree, без graph-либ).

**Design:** `docs/plans/2026-07-04-content-engine-harness-design.md`

**Testing note:** typecheck + smoke эндпоинта + Playwright + прод-smoke.

---

## Task 1: Backend — reads в промпт-билдерах + экспорт реестра

**Files:**
- Modify: `backend/src/controllers/claude.controller.ts`

**Step 1:** Расширить `PromptSpec` (около строки 68):
```typescript
type PromptSpec = { system: string; user: string; maxTokens: number; reads: string[] }
```

**Step 2:** В `buildShortPostDraft` (строка ~72) добавить в возврат `reads: ['style_guide_text', 'rubrics_matrix']` (именно те слаги, что билдер реально читает из `ctx.cache.brandDocs`). Проверить в теле билдера какие поля cache используются и перечислить их слаги.

**Step 3:** Экспортировать реестр и dry-run для blueprint. После `PROMPT_BUILDERS` добавить экспортируемый геттер:
```typescript
export interface BlueprintStepPrompt {
  reads: string[]
  promptPreview: string
}

/** Для харнесс-схемы: dry-run билдера с плейсхолдер-ctx → reads + system-превью.
 *  Возвращает null если билдера для (contentType, stepId) нет. */
export async function previewRecipeStepPrompt(
  contentType: string,
  stepId: string,
): Promise<BlueprintStepPrompt | null> {
  const builder = PROMPT_BUILDERS[`${contentType}.${stepId}`]
  if (!builder) return null
  const cache = await getPromptCache()
  const placeholderUnit = {
    title: '‹идея контент-юнита›',
    notes: '',
  } as unknown as ContentUnit
  const placeholderRubric = { title: '‹рубрика›' } as unknown as ContentRubric
  const spec = await builder({
    unit: placeholderUnit,
    rubric: placeholderRubric,
    cache,
    custom_prompt: undefined,
  })
  return { reads: spec.reads, promptPreview: spec.system }
}
```
(Проверить импорты `ContentUnit`, `ContentRubric`, `getPromptCache` — уже есть в файле.)

**Step 4:** Typecheck: `cd backend && npx tsc --noEmit`. Ожидание: чисто (если другие места создают PromptSpec без reads — добавить reads там же; сейчас единственный билдер — short_post).

**Step 5:** Commit: `feat(content-engine): промпт-билдеры декларируют reads + previewRecipeStepPrompt для харнесса`

---

## Task 2: Backend — blueprint эндпоинт

**Files:**
- Modify: `backend/src/controllers/content-engine.controller.ts` (добавить метод `blueprint`)
- Modify: `backend/src/routes/content-engine.routes.ts` (добавить `GET /blueprint`)

**Step 1:** В `content-engine.controller.ts` добавить импорты:
```typescript
import { recipeEngine } from '../services/recipe-engine'
import { previewRecipeStepPrompt } from './claude.controller'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'
```

**Step 2:** Добавить метод `blueprint` в `contentEngineController`:
```typescript
async blueprint(_req: Request, res: Response) {
  try {
    const recipes = recipeEngine.list()
    const neededSlugs = new Set<string>()
    const contentTypes = []

    for (const r of recipes) {
      const steps = []
      for (const s of r.steps) {
        const isAi = s.default_executor === 'ai_agent' && !!s.ai_assist_key
        let reads: string[] = []
        let promptPreview: string | null = null
        let hasBuilder = false
        if (isAi) {
          const preview = await previewRecipeStepPrompt(r.content_type, s.id)
          if (preview) {
            hasBuilder = true
            reads = preview.reads
            promptPreview = preview.promptPreview
            reads.forEach((sl) => neededSlugs.add(sl))
          }
        }
        steps.push({
          id: s.id,
          displayName: s.display_name,
          description: s.description ?? '',
          artifactKind: s.artifact_kind,
          executor: s.default_executor,
          aiAssistKey: s.ai_assist_key ?? null,
          reads,       // слаги; фронт резолвит title из docs
          promptPreview,
          hasBuilder,
        })
      }
      contentTypes.push({
        type: r.content_type,
        displayName: r.display_name,
        description: r.description ?? '',
        steps,
      })
    }

    // brand_docs для панели
    const docs: Record<string, { title: string; content: string }> = {}
    if (neededSlugs.size > 0) {
      const rows = await AppDataSource.getRepository(BrandDoc).find({
        where: { slug: In([...neededSlugs]) },
      })
      for (const d of rows) docs[d.slug] = { title: d.title ?? d.slug, content: d.content ?? '' }
    }
    // слаги без записи в БД — пустышка, чтобы фронт показал «документ пуст»
    for (const sl of neededSlugs) if (!docs[sl]) docs[sl] = { title: sl, content: '' }

    res.json({ contentTypes, docs })
  } catch (e: any) {
    console.error('[content-engine.blueprint]', e?.message || e)
    res.status(500).json({ error: 'Ошибка построения схемы движка' })
  }
}
```
(Добавить `import { In } from 'typeorm'`. Проверить точные имена полей RecipeStep: `display_name`, `artifact_kind`, `ai_assist_key`, `default_executor`, `description` — из recipe-engine.ts interface.)

**Step 3:** Route в `content-engine.routes.ts`: `router.get('/blueprint', contentEngineController.blueprint)`.

**Step 4:** Typecheck. Локальный smoke (если бэкенд поднимается): `curl -H "Authorization: Bearer <jwt>" .../api/content-engine/blueprint` → JSON с short_post, draft.reads=['style_guide_text','rubrics_matrix'], promptPreview непустой, final.hasBuilder=false.

**Step 5:** Commit: `feat(content-engine): GET /blueprint — живая структура движка для харнесса`

---

## Task 3: Frontend — API + страница-дерево

**Files:**
- Create: `frontend/src/api/contentEngine.ts`
- Create: `frontend/src/pages/ContentEngineHarness.tsx`
- Create: `frontend/src/components/content-engine/EngineTree.tsx`, `StepDetailPanel.tsx`

**Step 1: API** `contentEngine.ts` — типы (BlueprintContentType, BlueprintStep, BlueprintDoc) + `contentEngineApi.blueprint()` → GET `/content-engine/blueprint`.

**Step 2: Дерево** `EngineTree.tsx`:
- Ур.1: карточки типов (displayName + description), клик разворачивает
- Ур.2: шаги слева-направо `[Драфт]→[Финал]`. AI-шаг (executor==='ai_agent'): рамка primary + 🤖; self: серая + 👤; hasBuilder===false у AI-шага → жёлтая рамка + бейдж «промпт не реализован». SVG/CSS-стрелки между шагами
- Ур.3: под AI-шагом чипы reads (📄 slug) вниз, линии шаг→чип; пустой reads — ничего
- Клик по шагу → onSelect({kind:'step', ...}); клик по чипу → onSelect({kind:'doc', slug})
- Паттерн рекурсии/линий — как `components/assembly/AssemblyTree.tsx` (посмотреть для консистентности)

**Step 3: Панель** `StepDetailPanel.tsx`:
- kind==='step': заголовок, executor-бейдж, artifactKind, description, промпт-превью в `<pre className="whitespace-pre-wrap">` с подсветкой плейсхолдеров ‹…› (обернуть regex `/‹[^›]+›/` в span), список читаемых доков (клик → переключает на doc)
- kind==='doc': title + `<pre className="whitespace-pre-wrap">` полного content (или пусто → «документ пуст»)

**Step 4: Страница** `ContentEngineHarness.tsx`: заголовок «Контент-движок», легенда (🤖 AI / 👤 ручной / 📄 инструкция), загрузка blueprint на mount, лэйаут: дерево слева (flex-1) + панель справа (фикс ширина, sticky). Loading/error по паттернам проекта (ошибка + «Повторить»). НЕ трогать App.tsx/Layout.tsx.

**Step 5:** Typecheck. Commit: `feat(content-engine): харнесс-страница — дерево движка + панель промптов/инструкций`

---

## Task 4: Роут + сайдбар

**Files:**
- Modify: `frontend/src/App.tsx` — `<Route path="/marketing/content-engine" element={<ContentEngineHarness />} />` (lazy, рядом с content-bank/okr)
- Modify: `frontend/src/components/Layout.tsx` — секция «Маркетинг», пункт «Контент-движок» (после «Контент-банк», иконка по образцу)

Typecheck. Commit: `feat(content-engine): route + sidebar — Контент-движок`

---

## Task 5: E2E + деплой

1. Backend build + локальный прогон (или прод после деплоя): `GET /blueprint` отдаёт short_post, draft — ai с reads+preview, final — self
2. Playwright: `/marketing/content-engine` → раскрыть тип → клик по шагу «Драфт» → панель с system-промптом (виден стиль-гайд, плейсхолдеры ‹идея›) → клик по чипу style_guide_text → полный текст дока
3. push origin + vercel-deploy; прод-smoke пунктов 1-2 на erp.ximi4ka.ru
4. Временный e2e-юзер (bcrypt) для прод-логина, удалить после

---

## Параллелизация (для Workflow)

- Task 1 → Task 2 строго последовательно (билдер reads → blueprint)
- Task 3 после Task 2 (фронт зависит от формы API)
- Task 4 после Task 3; Task 5 финал
- Каждая задача: implementer → spec-review → quality-review

## Reference

- Дизайн: `docs/plans/2026-07-04-content-engine-harness-design.md`
- Образцы: `components/assembly/AssemblyTree.tsx` (дерево+линии), `pages/KnowledgeBase.tsx` (markdown-панель), `bank-sync.controller.ts` (error-паттерн)
