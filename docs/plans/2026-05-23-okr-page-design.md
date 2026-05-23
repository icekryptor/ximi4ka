# OKR Visualization Page — Design

**Date:** 2026-05-23
**Scope:** Лёгкая визуализация `brand_docs.okr_2026_2027` на отдельной странице `/marketing/okr` для Понедельник/среда/пятница чек-ин ритуала. Манульное проставление статусов KR (зелёный/жёлтый/красный/done), sticky-bar с anti-goals текущего квартала.

## Goal

OKR-документ есть как 21KB markdown в `brand_docs`. Сейчас единственный способ его смотреть — открыть `/marketing/strategy`, кликнуть карточку OKR, читать markdown в textarea. Это не подходит для еженедельного ритуала: длинный скролл, нет статусов, нет визуального «что на грани».

Нужна узкоспециализированная страница для **операционного владельца OKR** (фаундер), которая за 30 секунд показывает: какие KR-ы текущего квартала, какие из них он сам поставил «на грани» / «провал», какие anti-goals квартала.

## Non-goals (YAGNI)

- **Не рендерим весь OKR-документ.** Только текущий квартал (с возможностью переключаться). Годовые Objectives, Critical paths, Risks, Operating model, History — остаются в markdown, читаются в `brand_docs` editor через ссылку.
- **Не считаем статусы автоматически из БД.** Manual-only. «Я каждую неделю осознанно ставлю статусы» = forcing function для честной самооценки.
- **Не создаём отдельную таблицу `okr_kr`.** Manual статусы — JSON-блоб в новом BrandDoc-slug. Если масштаб вырастет (команда 5+, история ретроспектив, owner per KR) — мигрируем в нормальную схему.
- **Не парсим markdown на бэкенде.** Парсер живёт во frontend, BackendAPI отдаёт сырой markdown как обычно.
- **Не делаем редактор OKR в этом UI.** Редактирование — через `/marketing/strategy` → карточка OKR → markdown textarea. Когда оператор обновляет MD, статусы валидны до тех пор, пока KR-ID остаются стабильными (позиция в таблице).
- **Не делаем Theme heatmap, Critical paths graph, Roadmap timeline.** Это другие use-case'ы (стратегические разговоры, инвесторы) — отдельные итерации позднее, если они вообще нужны.

## Architecture

### URL & routing

- Новый route `/marketing/okr` в `frontend/src/App.tsx`, lazy-loaded `OkrPage`.
- Пункт сайдбара «🎯 OKR» рядом со «Стратегией» (`/marketing/strategy`).

### Парсер OKR markdown'а

Тонкий regex-парсер в `frontend/src/lib/okr-parser.ts`. Только структуры, которые отрисуются как компоненты:

```ts
export interface ParsedOkr {
  quarters: ParsedQuarter[]
  currentQuarterId: string  // auto from today's date
}
export interface ParsedQuarter {
  id: string                // "Q2-2026"
  label: string             // "Q2 2026 (апрель-июнь)"
  focus: string             // blockquote first paragraph after header
  objectives: ParsedObjective[]
  antiGoals: string[]
}
export interface ParsedObjective {
  id: string                // "Q2-O1"
  title: string             // "Финализировать R&D детского набора (A1)"
  krs: ParsedKR[]
}
export interface ParsedKR {
  id: string                // stable: "Q2-O1-KR1" (по позиции в таблице)
  text: string              // первая колонка
  metric: string            // вторая колонка
  targetMin: string         // третья колонка как есть ("100% к 20.06" или "5 / 4")
}
```

Парсер вызывается клиентом при загрузке страницы. ~50ms на 21KB. Парсер игнорирует годовые секции (§3, §4) — они нужны только для контекста, не для daily-ритуала.

**Регулярки / эвристики:**

| Что | Шаблон |
|---|---|
| Quarter section | `^### (Q[1-4]) (\d{4})` |
| Focus blockquote | `^> Фокус: (.+)$` (первая строка `> ` после header'а) |
| Objective | `^#### (Q\d-O\d+)\. (.+)$` |
| KR table | строки `^\|` между `\| Key Result \|...` и следующим `^###?` |
| Anti-goals | секция `^#### Q\d — Anti-goals`, bullet items `^- \*\*НЕ\*\*` или `^- НЕ` |
| Current quarter | системная дата → `Q1/Q2/Q3/Q4 YYYY` |

Парсер устойчив к небольшим изменениям внутри ячеек, но **зависит от структуры заголовков**. Это документируется как часть «OKR-doc conventions» прямо в OKR-документе.

### Хранение статусов

Новый slug в `brand_docs`: **`okr_status`**. JSON-блоб как `content` (TEXT-колонка):

```json
{
  "version": 1,
  "updated_at": "2026-05-23T10:00:00Z",
  "statuses": {
    "Q2-O1-KR1": {
      "status": "on_track",
      "comment": "Дизайн готов на 60%",
      "updated_at": "2026-05-23T10:00:00Z"
    },
    "Q2-O1-KR2": {
      "status": "at_risk",
      "comment": "Фокус-группу не собрали",
      "updated_at": "2026-05-23T10:00:00Z"
    },
    "Q2-O2-KR1": {
      "status": "done",
      "updated_at": "2026-05-20T14:30:00Z"
    }
  }
}
```

`status` enum: `on_track` / `at_risk` / `off_track` / `done`. Дефолт (если KR-id отсутствует в `statuses`) — `unknown` (серый круг, "не оцен"). UI поощряет проставлять.

Запись — через существующий `brandDocsApi.upsert('okr_status', {title: 'OKR — статусы KR', content: JSON.stringify(value)})`. Read — `brandDocsApi.get('okr_status')` + `JSON.parse(content || '{}')`.

**Race condition.** Single-operator — нет risk. Если двое жмут одновременно — last-write-wins, потеря 1-2 кликов. Не критично.

### Data flow

```
1. Page mount → parallel:
   a. brandDocsApi.get('okr_2026_2027')   → markdown text
   b. brandDocsApi.get('okr_status')      → JSON text
2. Parse markdown via parseOkr() → ParsedOkr
3. Parse statuses JSON → Record<KrId, KrStatus>
4. Merge: each KR gets its status (or 'unknown')
5. Render: quarter selector, KR cards, anti-goals bar
6. User clicks KR status → optimistic UI update + brandDocsApi.upsert('okr_status', ...)
7. On error: revert UI, toast error
```

## Components & UX

### Layout

```
┌─ /marketing/okr ─────────────────────────────────────────────────┐
│ 🎯 OKR Химички                          [Q2 2026 ▾]  [📖 MD ↗]  │
│ Фокус: building blocks. Закладываем фундамент для всего года.   │
├───────────────────────────────────────────────────────────────────┤
│ ┌─ Anti-goals (sticky) ──────────────────────────────────────┐  │
│ │ 🚫 НЕ запускаем PPC-трафик                                 │  │
│ │ 🚫 НЕ начинаем переговоры с крупным B2B                    │  │
│ │ 🚫 НЕ финализируем EdTech-платформу                        │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ ┌─ Q2-O1. Финализировать R&D детского набора (A1) ────────────┐ │
│ │ 🟢 Продуктовый дизайн (упаковка, инструкция, методичка)     │ │
│ │    100% к 20.06                              [⌶ комментарий]│ │
│ │                                                              │ │
│ │ 🟡 Тестовая партия (50 единиц) с фокус-группой 6-12 лет     │ │
│ │    NPS ≥ 60 / ≥ 45  · «Не собрали фокус-группу»             │ │
│ │                                                              │ │
│ │ ⚪ Маркетинговое позиционирование (УТП, ключевики, ценник)  │ │
│ │    100% к 30.06                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ [Объективы Q2-O2, Q2-O3...]                                      │
│                                                                   │
│ ┌─ Сводка квартала ──────────────────────────────────────────┐  │
│ │ 🟢 4 on track  🟡 2 at risk  🔴 1 off track  ✅ 1 done  ⚪ 1│  │
│ └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Компоненты

- **`OkrPage`** (`frontend/src/pages/OkrPage.tsx`) — page-level, 200-250 строк
- **`QuarterSelector`** (inline-компонент) — dropdown с `[Q2 2026 ▾]` со списком всех найденных в md кварталов. Auto-pick on mount = текущий.
- **`AntiGoalsBar`** (inline) — sticky-блок anti-goals выбранного квартала. Серый, иконка 🚫.
- **`KrRow`** (inline) — одна строка KR с круглым статус-индикатором (кликабельным), текстом, target/min, опциональным комментарием. Клик на статус → выпадающее меню «🟢 On track / 🟡 At risk / 🔴 Off track / ✅ Done / Удалить статус», + поле для коммента.
- **`SummaryBar`** (inline) — внизу страницы счётчик по статусам.

Никаких новых модалок — статус-меню — popover (createPortal). Comment — inline-input под выбранным KR.

### Auto-current quarter

`function currentQuarterId(): string` — берёт `new Date()`, мапит на `Q1-Q4 + год`. Сегодня (2026-05-23) → `Q2-2026`. Если квартал не существует в OKR-доке — выбирается первый доступный.

### Markdown-link out

В шапке кнопка `[📖 MD ↗]` ведёт на `/marketing/strategy` с anchor'ом или открывает BrandDoc-editor modal для `okr_2026_2027`. Точная реализация — выбираем при кодинге, оба варианта приемлемы.

### Visual style

- Статус-кружки: ширина 16px, `bg-green-500` / `bg-amber-500` / `bg-red-500` / `bg-blue-500` (done) / `bg-gray-300` (unknown).
- Карточки Objective — `border border-brand-border rounded-2xl p-4`, паттерн как BrandDocCardsSection.
- Sticky-bar anti-goals — `position: sticky; top: 0` с лёгким glass-эффектом.

## Failure modes

| Что | Обработка |
|---|---|
| `okr_2026_2027` отсутствует в `brand_docs` | Page рендерит «OKR-документ не найден в `brand_docs.okr_2026_2027`. Создай его перед использованием.» + ссылка на BrandDoc-cards. |
| `okr_status` отсутствует | Создаётся при первом write. Read возвращает `null` → парсится как `{}`. |
| Markdown структурно сломан (нет `###` для квартала) | Парсер возвращает `quarters: []`. UI показывает «Не удалось распарсить OKR. Проверь структуру документа (см. соглашения).» |
| KR-ID-drift (оператор добавил KR в середину таблицы → ID сместились) | Статусы старых KR-ID валидны, новый KR — `unknown`. Потеря 1-2 статусов при крупных пересборках OKR — приемлемая цена. |
| `upsert('okr_status')` упал (400/500) | Toast «Не удалось сохранить статус» + revert UI. |
| Несинхронизация двух вкладок | Окно при потере фокуса = no-op. При фокусе обратно — НЕ перезагружаем (избегаем потери незакоммиченных кликов). Кнопка «🔄 Обновить» в шапке. |

## Testing

**Smoke checklist** (manual, on prod после деплоя):

1. `/marketing/okr` открывается, видишь Q2 2026 по умолчанию.
2. Anti-goals bar показывает 3 пункта из `Q2 — Anti-goals` секции.
3. 3 Objectives Q2 с KR'ами (по 3 у каждого).
4. Клик на серый кружок → popover, выбираешь «🟢 On track» → кружок зеленеет, тост «Сохранено».
5. Refresh страницы → статус сохранился.
6. Меняешь квартал в dropdown'е на Q3 2026 → anti-goals и KRs Q3.
7. Сводка квартала внизу — счётчики совпадают с количеством KR-ов и их статусами.
8. На несуществующем квартале (Q5 2026 — нет) — fallback к первому доступному.
9. Editing `okr_2026_2027` markdown (через `/marketing/strategy`) — после save, страница `/marketing/okr` подхватывает новую версию при refresh.

Автотестов нет (consistent с posture проекта).

## Migration / rollback

- Никаких миграций БД.
- Новый slug `okr_status` — additive, не ломает существующее.
- Rollback = удалить route + page файл + `okr-parser.ts` + sidebar item. Данные в `brand_docs.okr_status` останутся (harmless).

## Open questions / future

- **Auto-расчёт числовых KR-ов** (Q4 Revenue из `transactions`, MAU из EdTech-аналитики и т.д.) — v2 после ~1 месяца практики. Тогда видно, какие именно KR-ы реально хочется автоматизировать.
- **Roadmap timeline** (все 7 кварталов на одном экране) — v3, для стратегических разговоров.
- **Theme heatmap** (кварталы × темы) — v4, для quarterly портфельного аудита.
- **Critical paths graph** — отдельная страница `/marketing/okr/critical-paths`, читает §6 OKR-доке.
- **Owner per KR** — когда команда вырастет до 5+, добавим колонку с аватаром.
- **History of statuses** — если станет интересно «когда KR ушёл из green в yellow» — лог в отдельной таблице. Сейчас перезаписываем.
