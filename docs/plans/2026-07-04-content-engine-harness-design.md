# Харнесс визуализации контент-движка — Design

**Date:** 2026-07-04
**Scope:** Read-only страница-схема, показывающая устройство контент-движка: типы контента → конвейер шагов → инструкции (brand_docs + system-промпт), которые изучает агент-сценарист на каждом AI-шаге. Древовидная схема слева-направо с панелью деталей.

## Goal

Контент-движок готов (recipe-engine + YAML-рецепты + промпт-билдеры + brand_docs), но его устройство нигде не видно целиком. Нужна схема: как агент проходит шаги и какие инструкции читает на каждом. Для онбординга, отладки промптов и понимания «что движок реально делает».

## Решение: подход A — чистый React, рекурсивный конвейер

Переиспользуем паттерн `AssemblyTree` (схема сборки): рекурсивный компонент + SVG-линии, без graph-библиотек. Структура — линейный конвейер шагов с боковыми ветками инструкций, не произвольный граф. Отвергнуто: react-flow (тяжело, редактирование не нужно — схема read-only), Mermaid (статичная картинка, нельзя кликнуть шаг → панель с текстом).

## Источник данных: живой API из движка

Единый источник истины — реальный код движка, схема не расходится. Три источника сливаются в один эндпоинт:
- `recipe-engine` → `content_type` + `steps` (id, display, executor, ai_assist_key, artifact_kind, description)
- промпт-билдеры (`claude.controller`) → что читает каждый AI-шаг + dry-run промпт
- `prompt-cache` / brand_docs → заголовки + полный текст инструкций

## Backend

**Рефактор промпт-билдеров.** Сейчас `PromptBuilder → {system, user, maxTokens}`. Расширить `PromptSpec` полем `reads: string[]` (слаги brand_docs, которые билдер реально читает). Каждый билдер декларирует свои reads (`buildShortPostDraft` → `['style_guide_text','rubrics_matrix']`). Билдер = код, который собирает промпт → ноль риска рассинхрона.

**Экспортировать реестр** `PROMPT_BUILDERS` (или геттер) из claude.controller, чтобы content-engine.controller мог обойти билдеры.

**Эндпоинт `GET /api/content-engine/blueprint`** (authMiddleware):

```
{
  contentTypes: [{
    type, displayName, description,
    steps: [{
      id, displayName, description, artifactKind,
      executor: 'ai_agent' | 'self',
      aiAssistKey: string | null,
      reads: [{ slug, title }],        // только AI-шаги; [] если билдера нет
      promptPreview: string | null,     // dry-run system-промпт с плейсхолдером
      hasBuilder: boolean               // false → ai_assist_key есть, билдера нет
    }]
  }],
  docs: { [slug]: { title, content } }  // полный текст инструкций для панели
}
```

Промпт-превью: билдер вызывается с placeholder-ctx (unit.title='‹идея›', rubric.title='‹рубрика›', notes='') + реальным prompt-cache → возвращает system-промпт с подставленными brand_docs. Берём `spec.system` как preview, `spec.reads` как список.

## Frontend — `/marketing/content-engine`

**Дерево (рекурсивный React, слева-направо):**
- **Ур.1** — карточки типов контента, клик разворачивает конвейер
- **Ур.2** — шаги вправо: `[Драфт] → [Финал]`. AI-шаг: фиолетовая рамка + 🤖, self-шаг: серая + 👤. SVG-стрелки между шагами
- **Ур.3** — под AI-шагом веточки-чипы инструкций вниз (`style_guide_text`, `rubrics_matrix`), линии шаг→чип

**Правая панель:**
- Клик по шагу → заголовок, executor, artifact_kind, описание, полный system-промпт (моно, подсветка плейсхолдеров ‹…›), список читаемых доков
- Клик по чипу → заголовок + полный markdown brand_doc (рендер как в Базе знаний)

**Легенда** сверху: 🤖 AI-шаг / 👤 ручной / 📄 инструкция.

Состояние раскрытия — локальный useState. Blueprint грузится одним запросом на mount.

## Failure handling

| Ситуация | Поведение |
|---|---|
| ai_assist_key есть, билдера нет | `hasBuilder=false`, чип «промпт не реализован», шаг жёлтый |
| brand_doc слаг не в БД | чип серый «(документ пуст)» |
| один рецепт (short_post) | дерево показывает один тип, расширяется при добавлении YAML |
| blueprint упал | ошибка + «Повторить» |

## Testing

Typecheck backend/frontend. Smoke: `GET /blueprint` отдаёт short_post с 2 шагами (draft — ai_agent с reads=[style_guide_text, rubrics_matrix] + promptPreview; final — self, reads пустой). Playwright: дерево раскрывается, клик по шагу → промпт в панели, клик по чипу → текст дока. Прод-smoke.

## v2 (не сейчас)

- Диаграмма зависимостей между рецептами (карусель наследует шаги)
- Показ реальных прогонов (сколько юнитов прошло каждый шаг) поверх схемы
- Инлайн-редактирование промптов из схемы
