# Самообучение Writer'а (волна 2) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans / Workflow.

**Goal:** Writer накапливает правила стиля из правок копирайтера через MCP: learn_from_edit → анализ в Cowork → save_style_patterns → writer_context отдаёт накопленное. Отразить в харнессе.

**Design:** `docs/plans/2026-07-06-writer-self-learning-design.md`

**Testing:** typecheck + локальный MCP-цикл (save/list/дедуп/writer_context с правилами) + прод-smoke + Playwright харнесс.

---

## Task 1: Данные — таблица style_pattern

**Files:**
- Create: `backend/src/migrations/2026-07-06-style-pattern.sql`
- Create: `backend/src/entities/StylePattern.ts`
- Modify: `backend/src/config/database.ts` (импорт + allEntities — glob-discovery нет!)

Миграция: таблица style_pattern (id uuid PK, format varchar(50), code varchar(16), title varchar(255), before text null, after text null, rationale text, source_note text null, created_at timestamptz default now()) + `idx_style_pattern_format`. Применить apply_migration (name `2026_07_06_style_pattern`), verify.

Entity StylePattern (@Entity('style_pattern'), поля как в миграции, nullable → `string | null`). ВНИМАНИЕ: `before`/`after` — зарезервированные слова, но как имена колонок TypeORM ок (в кавычках). Регистрация в allEntities.

Typecheck. Commit: `feat(writer-learning): миграция — таблица style_pattern`

## Task 2: Backend — context-service + MCP-инструменты

**Files:**
- Modify: `backend/src/services/content-context.service.ts`
- Modify: `backend/src/mcp/content-mcp.server.ts`
- Modify: `backend/src/controllers/content-engine.controller.ts` (blueprint: Writer reads += style_learned маркер)

**content-context.service.ts:**
```typescript
export async function listStylePatterns(format: string): Promise<StylePattern[]>
  // repo find where format, order by code ASC
export async function saveStylePatterns(format, patterns: Array<{code,title,before?,after?,rationale}>, sourceNote?)
  : Promise<{ added: number; skipped: number }>
  // для каждого: если (format,code) уже есть → skipped++, иначе insert added++
export async function buildLearningPrompt(a: {format, original, edited?, notes?}): Promise<string>
  // системная инструкция анализа (перенести текст из claude.controller editWithLearning,
  // категории А11+/С10+/Э8+, «0 лучше мусора») + текущие правила формата (listStylePatterns)
  // + оригинал/правка. Чистая строка.
```
`getWriterContext`: после блока сегмента/плана добавить «## Накопленные правила стиля (применяй все)» из listStylePatterns(format ← content_type шага; для writer_context брать format из opts или дефолт 'short_post'). Добавить 'style_learned' в reads writer-контекста.

ВАЖНО: getWriterContext сейчас не знает format — добавить необязательный `format?` в opts (дефолт 'short_post'), MCP writer_context прокидывает.

**content-mcp.server.ts — 3 новых registerTool:**
- `list_style_patterns` { format: z.string() } → listStylePatterns → JSON.
- `learn_from_edit` { format: z.string(), original: z.string(), edited: z.string().optional(), notes: z.string().optional() } → buildLearningPrompt → text. Описание: «Возвращает промпт для анализа правки. Выполни анализ, затем вызови save_style_patterns.»
- `save_style_patterns` { format: z.string(), patterns: z.array(z.object({code:z.string(),title:z.string(),before:z.string().optional(),after:z.string().optional(),rationale:z.string()})), source_note: z.string().optional() } → saveStylePatterns → «добавлено N, пропущено M. N=0 → стиль стабилизировался».
Оборачивать write в safeTool.

**blueprint:** Writer-шаг reads += 'style_learned' (как content_plan_current). docs['style_learned'] = виртуальный { title: 'Накопленные правила стиля (динамически)', content: '' } (как unit.target_segment). Либо отдать реальный список правил — проще виртуальный маркер + отдельная секция на фронте.

Typecheck. Commit: `feat(writer-learning): backend — style_pattern сервис + MCP learn/save/list инструменты`

## Task 3: Frontend — секция обучения + гайд

**Files:**
- Create: `frontend/src/api/stylePatterns.ts` (тип StylePattern + `stylePatternsApi.list(format)` → GET /api/content-plan/... или новый /api/style-patterns?format=)
- Create: `backend/src/controllers` route для чтения правил фронтом: `GET /api/style-patterns?format=` (read-only, authMiddleware) — или расширить content-plan controller. (Backend: добавить в Task 2 лёгкий GET-эндпоинт для фронта.)
- Create: `frontend/src/components/content-engine/StyleLearningSection.tsx`
- Modify: `frontend/src/components/content-engine/CoworkGuide.tsx` (блок «🔄 Обучение Writer'а»)
- Modify: `frontend/src/pages/ContentEngineHarness.tsx` (вставить секцию)

StyleLearningSection: селектор формата (из blueprint contentTypes) → таблица правил (code, title, before→after, rationale) + счётчик + «сигнал сходимости: +0 новых за N правок = стиль пойман» (если есть данные о датах). Empty state «правил пока нет — появятся после первых правок через агента».

CoworkGuide: добавить блок обучения (4 шага: дать оригинал+правку → learn_from_edit → save_style_patterns → переписать; пометка ~10-15 итераций, сигнал 0 новых).

Writer-веточка style_learned в дереве появится сама (blueprint reads). StepDetailPanel: клик по чипу style_learned → показать секцию/пометку «динамически, см. Обучение стиля».

Typecheck. Commit: `feat(writer-learning): харнесс — секция правил стиля + гайд обучения`

## Task 4: E2E + деплой

1. Backend build + локальный MCP (MCP_ACCESS_TOKEN в .env):
   - `list_style_patterns {format:short_post}` → [] пусто
   - `save_style_patterns {format:short_post, patterns:[{code:С10,title:...,rationale:...},{code:Э8,...}]}` → added=2
   - `list_style_patterns` → 2
   - `save` те же коды → skipped=2, added=0 (сигнал)
   - `writer_context {segment_slug,rubric_slug}` → бриф содержит блок «Накопленные правила стиля» с С10/Э8
   - `learn_from_edit {format, original, edited}` → промпт с текущими правилами
   - убрать тестовые правила из БД
2. push origin; прод-smoke те же MCP-вызовы.
3. Vercel deploy; Playwright: харнесс — Writer style_learned веточка, секция обучения, гайд блок.
4. Убрать тестового юзера, обновить память.

## Reference
- Дизайн: `docs/plans/2026-07-06-writer-self-learning-design.md`
- editWithLearning (claude.controller.ts ~строка 276) — источник промпт-текста анализа + формат паттернов
- content-mcp.server.ts, content-context.service.ts (волна MCP), CoworkGuide.tsx
