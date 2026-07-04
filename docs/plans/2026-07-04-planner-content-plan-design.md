# Planner-агент + контент-план (волна 1) — Design

**Date:** 2026-07-04
**Scope:** Upstream-агент Planner, создающий контент-план из воронки (TOFU/MOFU/BOFU) + ICP-сегментов + целей стратегии. Writer читает план как инструкцию. Отражение двухагентной логики в харнессе + ссылка на актуальный контент-план + мини-инструкция по работе через Cowork. Волна 2 (цикл самообучения Writer'а) — отдельно, позже.

## Goal

Сейчас харнесс показывает только Writer (рецепты + инструкции). Нет ни планирования, ни контент-плана — Writer пишет «в вакууме» без повестки. Нужен upstream-агент Planner: он планирует что и когда постить исходя из воронки, ЦА и целей стратегии; Writer пишет уже по плану. Всё через Claude Desktop Cowork (Max-подписка), ноль трат на API — ERP хранит состояние и генерит промпты.

## Архитектура (что харнесс покажет)

```
🧭 PLANNER                              ✍️ WRITER (рецепты)
 читает:                                читает:
  • Воронка TOFU/MOFU/BOFU (funnel_levels)   • content_plan_current ← [ссылка]
  • ICP-сегменты (icp_segment, 11)           • style_guide_text
  • strategy_current (цели)                  • rubrics_matrix
 создаёт:                                    • strategy_current (выжимка)
  → 📋 content_plan_current ────────────────► • unit.target_segment
```

Planner — новый top-level узел в blueprint (не recipe-step), слева от рецептов, «питает» контент-план. Оба агента работают в Cowork; ERP даёт промпты для копи-паста и хранит результаты.

## Данные

**Гибрид для контент-плана:**
- `content_plan_current` — brand_doc (markdown). Planner пишет в Cowork, оператор сохраняет через существующий brand-doc редактор. Writer читает как инструкцию (источник истины).
- `content_plan_item` — новая лёгкая таблица-индекс:
  ```sql
  CREATE TABLE content_plan_item (
    id uuid PK,
    plan_date date,
    funnel_level varchar(8),      -- TOFU | MOFU | BOFU
    segment_id uuid NULL → icp_segment,
    theme_id uuid NULL → strategic_theme,
    format varchar(50),           -- content_type рецепта
    goal text,
    status varchar(20) DEFAULT 'planned',  -- planned|in_progress|published
    sort_order int DEFAULT 0,
    created_at timestamptz
  )
  ```
  Entity + миграция + регистрация в `allEntities` (glob-discovery нет).

**Воронка:** brand_doc `funnel_levels` (markdown) — TOFU (охват/узнаваемость), MOFU (вовлечение/доверие), BOFU (конверсия), с описанием цели каждого. Редактируемый, Planner читает.

## Backend (ноль вызовов Claude)

**Расширить `GET /api/content-engine/blueprint`:** добавить top-level `planner`:
```
planner: {
  reads: [{ slug, title }],   // funnel_levels, strategy_current + маркер icp (динамич.)
  produces: { slug: 'content_plan_current', title: 'Контент-план' },
  promptPreview: string       // статически собранный промпт Planner для Cowork
}
```
Planner-промпт собирается из шаблона: воронка + список активных ICP-сегментов + выжимка стратегии → инструкция «составь контент-план на период». Без callClaude — просто строка.

**Writer:** `buildShortPostDraft` добавляет `content_plan_current` в `reads` (Writer ссылается на план). prompt-cache грузит его в `brandDocs`.

**Контент-план API** (`content-plan.controller` + routes под `/api/content-plan`):
- `GET /` — `{ doc: content_plan_current, items: [...] }`
- `POST /items` / `PUT /items/:id` / `DELETE /items/:id` — CRUD индекса
- Planner-промпт отдаётся в blueprint.planner.promptPreview (отдельный эндпоинт не нужен)

## Frontend — расширение страницы Контент-движка

**Дерево:** слева от типов контента — узел **🧭 Planner** с чипами reads (Воронка, ICP-сегменты, Стратегия) + стрелка «→ Контент-план». Клик по узлу → панель с Planner-промптом (копи-паст в Cowork). Клик по «Контент-план» → панель с markdown-плана + кнопка «Открыть/редактировать».

**Секция «Актуальный контент-план»** под деревом: компактная таблица `content_plan_item` (дата, воронка-бейдж, сегмент, тема, формат, цель, статус) + ссылка на полный markdown. Лёгкий inline-CRUD строк (добавить/статус).

**У Writer** новая веточка `content_plan_current` появляется автоматически (blueprint reads).

**Коллапсибл «Как работать с агентами через Cowork»:**
1. Planner: открой Claude Desktop Cowork (проект Химички) → вставь Planner-промпт (воронка+ЦА+цели) → получи контент-план → сохрани в ERP (`content_plan_current` + строки индекса).
2. Writer: генерь по плану (рубрика+идея+сегмент+план) → правь. *(цикл обучения — волна 2)*

## Failure handling

| Ситуация | Поведение |
|---|---|
| content_plan_current пуст | Writer-веточка «(план не задан)», Planner-панель подсказывает создать |
| funnel_levels нет | Planner-промпт с дефолтным описанием воронки + пометка |
| нет активных ICP | Planner-промпт «сегменты не заданы» |
| content_plan_item пуст | таблица — empty state «плана ещё нет» |

## Testing

Typecheck. Smoke: blueprint отдаёт planner-узел с reads+промптом, Writer.reads содержит content_plan_current; content-plan CRUD работает. Playwright: Planner-узел виден, клик → промпт; таблица плана рендерится; мини-инструкция раскрывается. Прод-smoke.

## v2 / волна 2

- Цикл самообучения Writer'а (feedback → анализ → learned-док) — отдельный дизайн
- Автогенерация `content_plan_item` из markdown-плана парсером
- Статусы-связь план↔контент-юниты
