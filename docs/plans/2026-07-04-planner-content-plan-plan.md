# Planner + контент-план (волна 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: subagent-driven-development / Workflow-оркестрация.

**Goal:** Upstream-агент Planner (воронка+ЦА+цели стратегии → контент-план) + Writer читает план. Отражение в харнессе + ссылка на план + мини-инструкция Cowork. Ноль вызовов Claude (всё в Cowork).

**Architecture:** blueprint расширяется top-level узлом `planner`; контент-план — гибрид (brand_doc `content_plan_current` + таблица `content_plan_item`); воронка — brand_doc `funnel_levels`. Всё через brand_docs + одна таблица.

**Design:** `docs/plans/2026-07-04-planner-content-plan-design.md`

**Testing:** typecheck + smoke blueprint/CRUD + Playwright + прод.

---

## Task 1: Данные — воронка, контент-план doc, индекс-таблица

**Files:**
- Create: `backend/src/migrations/2026-07-04-content-plan.sql`
- Create: `backend/src/entities/ContentPlanItem.ts`
- Modify: `backend/src/config/database.ts` (allEntities — добавить ContentPlanItem)

**Step 1: Миграция** `2026-07-04-content-plan.sql`:
```sql
CREATE TABLE IF NOT EXISTS content_plan_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_date date,
  funnel_level varchar(8),               -- TOFU|MOFU|BOFU
  segment_id uuid REFERENCES icp_segment(id) ON DELETE SET NULL,
  theme_id uuid REFERENCES strategic_theme(id) ON DELETE SET NULL,
  format varchar(50),                    -- content_type
  goal text,
  status varchar(20) NOT NULL DEFAULT 'planned',  -- planned|in_progress|published
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_plan_item_date ON content_plan_item (plan_date DESC);

-- brand_docs-заглушки (создаём если нет; оператор заполнит через редактор)
INSERT INTO brand_docs (slug, title, content)
VALUES
  ('funnel_levels', 'Воронка контента (TOFU/MOFU/BOFU)',
   E'# Уровни воронки\n\n## TOFU — Top of Funnel\nОхват и узнаваемость. Знакомство с брендом, широкая аудитория, познавательный/развлекательный контент.\n\n## MOFU — Middle of Funnel\nВовлечение и доверие. Аудитория знает бренд, углубляем интерес, кейсы/польза/отзывы.\n\n## BOFU — Bottom of Funnel\nКонверсия. Готовы к покупке, снятие возражений, оффер/CTA/акции.'),
  ('content_plan_current', 'Контент-план (текущий)',
   E'# Контент-план\n\n_План ещё не создан. Составь его через Planner в Cowork и сохрани сюда._')
ON CONFLICT (slug) DO NOTHING;
```
Применить через Supabase MCP (`apply_migration`, project `jubkezbvccwvujregkfq`, name `2026_07_04_content_plan`). Verify: таблица + 2 brand_docs существуют.

**Step 2: Entity** `ContentPlanItem.ts` — `@Entity('content_plan_item')`, поля по миграции (`funnel_level`, `segment_id`/`theme_id` nullable string, `format`, `goal` nullable, `status`, `sort_order`, `plan_date` nullable, timestamps). Образец — любой существующий entity со стилем проекта.

**Step 3:** Зарегистрировать `ContentPlanItem` в `allEntities` (database.ts).

**Step 4:** Typecheck backend. Commit: `feat(planner): миграция — content_plan_item + brand_docs воронки/плана`

---

## Task 2: Backend — Planner в blueprint, Writer читает план, content-plan API

**Files:**
- Modify: `backend/src/services/prompt-cache.ts` (грузить content_plan_current, funnel_levels)
- Modify: `backend/src/controllers/claude.controller.ts` (`buildShortPostDraft` reads += content_plan_current; блок плана в промпте)
- Modify: `backend/src/controllers/content-engine.controller.ts` (blueprint += planner)
- Create: `backend/src/controllers/content-plan.controller.ts` + `backend/src/routes/content-plan.routes.ts`
- Modify: `backend/src/server.ts` (mount `/api/content-plan`)

**Step 1: prompt-cache** — в `In([...])` добавить `'content_plan_current'`, `'funnel_levels'`; расширить тип `brandDocs` полями `content_plan_current: string`, `funnel_levels: string`.

**Step 2: Writer** — `buildShortPostDraft`: reads += `'content_plan_current'`; в system добавить блок `## Контент-план (пиши в рамках повестки)` с `ctx.cache.brandDocs.content_plan_current` (fallback «план не задан — пиши по рубрике»). Разместить после стратегии/сегмента, перед матрицей.

**Step 3: Planner в blueprint** — в `content-engine.controller.blueprint` добавить сбор `planner`:
```
// Planner-промпт: статически из воронки + активных ICP + выжимки стратегии
const funnel = docsMap['funnel_levels'] ?? ''
const strategy = cache.brandDocs.strategy_summary ?? ''  // если доступно; иначе загрузить
const segments = await AppDataSource.getRepository(IcpSegment).find({ where: { active: true }, order: { sort_order: 'ASC' } })
const segLines = segments.map(s => `- ${s.name}${s.role ? ' ('+s.role+')' : ''}${s.age_range ? ', '+s.age_range : ''}`).join('\n')
const plannerPrompt = `Ты — контент-стратег (Planner) бренда Химичка.\n\n## Воронка\n${funnel}\n\n## Целевые сегменты\n${segLines}\n\n## Цели (из стратегии)\n${strategy}\n\n## Задача\nСоставь контент-план на период: по каждому пункту укажи дату, уровень воронки (TOFU/MOFU/BOFU), сегмент, тему, формат и цель. Балансируй воронку. Верни markdown-таблицей.`
```
Добавить в ответ blueprint: `planner: { reads: [{slug:'funnel_levels',title},{slug:'strategy_current',title},{slug:'icp_segments',title:'ICP-сегменты (динамически)'}], produces: {slug:'content_plan_current', title:'Контент-план'}, promptPreview: plannerPrompt }`. Доки funnel_levels/content_plan_current догрузить в `docs` ответа. (Импорт `IcpSegment`.)

**Step 4: content-plan API:**
- `GET /api/content-plan` → `{ doc: {title,content} из brand_docs content_plan_current, items: content_plan_item[] с order sort_order,plan_date }`
- `POST /api/content-plan/items` {plan_date,funnel_level,segment_id,theme_id,format,goal,status,sort_order}
- `PUT /api/content-plan/items/:id` (partial)
- `DELETE /api/content-plan/items/:id`
- error-паттерн bank-sync.controller.ts

**Step 5:** routes `content-plan.routes.ts` + mount в server.ts под authMiddleware.

**Step 6:** Typecheck. Commit: `feat(planner): backend — Planner в blueprint, Writer читает план, content-plan API`

---

## Task 3: Frontend — Planner-узел, секция плана, мини-инструкция

**Files:**
- Modify: `frontend/src/api/contentEngine.ts` (тип blueprint += planner; api контент-плана)
- Create: `frontend/src/api/contentPlan.ts`
- Modify: `frontend/src/pages/ContentEngineHarness.tsx`
- Modify: `frontend/src/components/content-engine/EngineTree.tsx` (Planner-узел слева)
- Create: `frontend/src/components/content-engine/ContentPlanSection.tsx`, `CoworkGuide.tsx`

**Step 1: API** — `BlueprintData` += `planner: { reads[], produces, promptPreview } | null`. `contentPlan.ts`: get()/createItem/updateItem/deleteItem + типы (funnel_level, status).

**Step 2: Planner в дереве** — `EngineTree`: перед колонкой типов рендерить узел 🧭 Planner (reads-чипы + «→ Контент-план»); клик по узлу → selection kind 'planner' (промпт в панель, как step); клик по «Контент-план» → selection kind 'doc' slug content_plan_current. StepDetailPanel: обработать kind 'planner' (заголовок, промпт-превью с CopyButton, reads-чипы).

**Step 3: Секция плана** `ContentPlanSection.tsx` — под деревом: заголовок «Актуальный контент-план» + ссылка «Открыть/редактировать» (на brand-doc редактор или инлайн) + таблица items (дата, воронка-бейдж цветной TOFU/MOFU/BOFU, сегмент, тема, формат, цель, статус). Inline: «+ строка», смена статуса. Empty state «плана ещё нет». Данные из contentPlanApi.

**Step 4: Мини-инструкция** `CoworkGuide.tsx` — коллапсибл «Как работать с агентами через Cowork»: шаги Planner (Cowork → промпт → план → сохрани) + Writer (генерь по плану → правь), заметка «цикл обучения — скоро (волна 2)». Разместить на странице (сверху или в конце).

**Step 5:** ContentEngineHarness собирает: дерево (с Planner) + ContentPlanSection + CoworkGuide + панель. Typecheck. Commit: `feat(planner): харнесс — Planner-узел, секция контент-плана, гайд Cowork`

---

## Task 4: E2E + деплой

1. Backend build; smoke: `GET /blueprint` → planner.promptPreview непустой (воронка+сегменты+цели), Writer.reads содержит content_plan_current; `GET /content-plan` → doc+items; POST item работает
2. Playwright (прод после деплоя): Planner-узел виден слева, клик → промпт в панели; секция плана рендерится, добавление строки; мини-инструкция раскрывается; у Writer появилась веточка content_plan_current
3. push origin + vercel-deploy; прод-smoke
4. Временный e2e-юзер (ключ токена `auth_token`, логин через форму), удалить после

---

## Параллелизация (Workflow)

- Task 1 → Task 2 последовательно (данные → API)
- Task 3 после Task 2
- Task 4 финал
- Каждая: implementer → spec-review → quality-review

## Reference

- Дизайн: `docs/plans/2026-07-04-planner-content-plan-design.md`
- Образцы: content-engine.controller.ts (blueprint), StepDetailPanel/EngineTree.tsx (дерево+панель), KnowledgeBase.tsx (markdown), bank-sync.controller.ts (error), previewRecipeStepPrompt (dry-run промпт)
- ВАЖНО: e2e-логин — ключ `auth_token`, логиниться через форму (инъекция токена гоняется с auth-гейтом)
