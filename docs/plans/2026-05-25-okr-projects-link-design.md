# OKR → Projects/Tasks Link — Design

**Date:** 2026-05-25
**Scope:** Облегчённая привязка `Project` и `Task` к конкретному KR-у OKR-документа. На OKR-странице — счётчик-бейдж «📁 N · ✓ M» с click-to-filter в Planning. Декомпозиция KR'ов в исполняемые сущности XimOS.

## Goal

OKR-страница (`/marketing/okr`) показывает Q2 цели, но **не показывает что под ними реально делается**. KR «Финализировать R&D детского набора» — это абстракция; конкретная работа живёт в `projects` / `tasks` (планнинг). Сейчас между ними нет связи.

Цель: каждый KR может быть **выполнен через 0+ проектов и/или 0+ задач**. На OKR-странице — счётчик. Клик → переход в Planning с фильтром по этому KR. Так оператор за один клик переходит «вот цель → вот что я под неё делаю».

## Non-goals (YAGNI)

- Не делаем FK constraint на `okr_kr_id`. KR — это markdown-структура, не БД-сущность. Soft-reference достаточно.
- Не делаем accordion-раскрытие списка проектов прямо в OKR-строке — `click-to-navigate` проще и не разрывает дневной flow.
- Не делаем bulk-операций (привязать N проектов одним кликом).
- Не делаем history/audit changes привязок.
- Не делаем «automatic suggestions» («ты создаёшь проект про R&D детского набора — возможно привязать к Q2-O1?»). Сейчас оператор выбирает руками.

## Architecture

### DB schema

Миграция:

```sql
ALTER TABLE projects ADD COLUMN okr_kr_id varchar(64) NULL;
ALTER TABLE tasks    ADD COLUMN okr_kr_id varchar(64) NULL;

CREATE INDEX IF NOT EXISTS idx_projects_okr_kr_id
  ON projects (okr_kr_id) WHERE okr_kr_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_okr_kr_id
  ON tasks (okr_kr_id) WHERE okr_kr_id IS NOT NULL;
```

**Шейп:** `varchar(64)`, nullable, default NULL.

**Значение:** композитный id из OKR-парсера: `Q2-2026-O1-KR1`. KR живёт в markdown (`brand_docs.okr_2026_2027`), а не в отдельной таблице — поэтому **не FK**. Это soft-reference со всеми его trade-off'ами:

| Pro | Con |
|---|---|
| Нет нужды в синхронизации между MD и БД | Dangling references возможны (KR переименован/удалён → projects.okr_kr_id указывает в никуда) |
| Парсер уже на frontend — простая интеграция | Нельзя сделать `JOIN okr_kr ON ...` в SQL |
| Markdown остаётся source-of-truth | Изменение `KR-id` ломает все привязки (positional stability — уже задокументирован риск) |

Для MVP single-operator workflow приемлемо. Если масштаб вырастет — мигрируем KR'ы в отдельную таблицу с FK + миграция значений `varchar` → `uuid`.

**Partial indexes** — большинство строк имеют `okr_kr_id = NULL`. Индекс с `WHERE okr_kr_id IS NOT NULL` остаётся крошечным (10-100 строк против тысяч), быстрым для `GROUP BY okr_kr_id` агрегаций.

### Backend

**Entities (расширение):**
- `Project.ts` — добавить `@Column({ type: 'varchar', length: 64, nullable: true }) okr_kr_id: string | null`
- `Task.ts` — то же

**Controllers (минимальная правка):**
- `ProjectController.create / update` — поле уже подхватывается через `req.body` (TypeORM делает diff)
- `TaskController.create / update` — то же

**Новый эндпоинт `GET /api/okr-links/counts`:**

Возвращает агрегат за один запрос для всех KR'ов:

```typescript
// backend/src/controllers/okr-links.controller.ts
// GET /api/okr-links/counts → { [krId]: { projects: number; tasks: number } }
```

Под капотом два SQL `GROUP BY okr_kr_id`:

```sql
SELECT okr_kr_id, COUNT(*) AS n FROM projects WHERE okr_kr_id IS NOT NULL GROUP BY okr_kr_id;
SELECT okr_kr_id, COUNT(*) AS n FROM tasks    WHERE okr_kr_id IS NOT NULL GROUP BY okr_kr_id;
```

Merge на сервере в одну `Record<krId, {projects, tasks}>`. Дешёвый запрос (partial index в помощь). Кэш 30 секунд опционально.

Routes: новый `backend/src/routes/okr-links.routes.ts` → mount `/api/okr-links` под `authMiddleware`.

### Frontend

**1. `OkrKrSelector` — reusable компонент.**

Расположение: `frontend/src/components/okr/OkrKrSelector.tsx`.

Props: `{ value: string | null; onChange: (krId: string | null) => void; label?: string }`.

Поведение:
- На mount пуллит `brandDocsApi.get('okr_2026_2027')` один раз (module-level cache `let cached: Promise<ParsedOkr> | null = null`)
- Парсит через `parseOkr(content)` из существующей `okr-parser.ts`
- Рендерит native `<select>` с hierarchical-options:
  ```
  <option value="">— Не привязан —</option>
  <optgroup label="Q2 2026">
    <option value="Q2-2026-O1-KR1">Q2-O1. Продуктовый дизайн</option>
    <option value="Q2-2026-O1-KR2">Q2-O1. Тестовая партия</option>
    <option value="Q2-2026-O2-KR1">Q2-O2. Все 5 каналов на cadence</option>
    ...
  </optgroup>
  <optgroup label="Q3 2026">...</optgroup>
  ```
- Если OKR-документ не загружается → селектор показывает `[ — OKR недоступен — ]` disabled, чтобы не блокировать сохранение проекта/задачи

**2. Интеграция в `Projects.tsx`:**

- Добавить `okr_kr_id: ''` в начальный `form`-state
- Поле `<OkrKrSelector value={form.okr_kr_id || null} onChange={(v) => setForm({...form, okr_kr_id: v || ''})} />` в форме создания
- При сохранении — отправлять `okr_kr_id: form.okr_kr_id || null` в payload

URL-фильтр на странице:
- Читать `useSearchParams` для `okr_kr`
- Если задан → локально фильтровать `projects.filter(p => p.okr_kr_id === krId)`
- Сверху banner: `«🎯 Фильтр: KR <human-readable-title> [✕]»`
- Кнопка ✕ убирает `okr_kr` из URL

**3. Интеграция в Task forms:**

Tasks редактируются в `TaskModal.tsx` (или эквиваленте — найти при имплементации). Та же логика: поле в форме + сохранение в payload. URL-фильтр НЕ нужен на Planning (не запрашивали в Q2-сценарии — переход всегда в Projects).

**4. `OkrPage.tsx` изменения:**

- На mount параллельно с `okr_2026_2027` и `okr_status` пуллить `okrLinksApi.counts()`
- Передать `counts` как prop в `KrRow`
- `KrRow` рендерит inline бейдж справа от метаданных:
  ```tsx
  {(count.projects > 0 || count.tasks > 0) && (
    <Link to={`/planning/projects?okr_kr=${kr.id}`} className="...badge-classes">
      📁 {count.projects} · ✓ {count.tasks}
    </Link>
  )}
  ```
- Бейдж не рендерится если оба счётчика 0 (нет визуального шума на пустых KR'ах)

### Data flow

```
1. Operator opens /marketing/okr
   → Promise.all: brandDocsApi.get('okr_2026_2027'), okrStatusApi.load(), okrLinksApi.counts()
   → render KR cards with badges
2. Operator clicks badge "📁 3 · ✓ 12" on a KR
   → router navigates to /planning/projects?okr_kr=Q2-2026-O1-KR1
3. Projects page reads ?okr_kr= from URL
   → filters projects locally; shows filter-banner
4. Operator opens project edit form
   → OkrKrSelector dropdown loads + parses OKR doc (cached after first call)
   → operator picks new KR or clears
   → save → projects.okr_kr_id updated
5. (Optional) Operator returns to /marketing/okr
   → counts re-fetch → badges update
```

## Failure handling

| Failure | Behavior |
|---|---|
| OKR markdown не парсится / документ пустой | `OkrKrSelector` показывает disabled `[ — OKR недоступен — ]`. Форма проекта работает без привязки. |
| `okr_kr_id` ссылается на удалённый/переименованный KR | OkrPage counts не показывают такой KR (его нет в parsed.quarters). В Projects-form при редактировании поле показывает значение «Q2-2026-O1-KR1 (не найдена)» + опция «Очистить». |
| `/api/okr-links/counts` упал | OkrPage рендерится без бейджей. Console.warn. Основной use-case (статусы) не блокируется. |
| Filter URL `?okr_kr=X` указывает на несуществующий KR | Projects показывает empty state «Нет проектов по этому KR» + кнопка сбросить. |
| Operator вводит invalid varchar (через консоль/SQL) — длина > 64 | TypeORM truncates / throws на сохранении. На UI этот путь невозможен (selector контролирует значения). |

## Testing — manual smoke

После деплоя:

1. **Миграция применена** — `\d projects` показывает `okr_kr_id varchar(64)`, partial индекс существует.
2. **Создание проекта с привязкой**: открыть форму, в селекторе видны все ~50 KR'ов (7 кварталов × ~3 Objectives × ~3 KRs), выбрать любой, сохранить — projects.okr_kr_id = выбранному значению.
3. **OkrPage счётчик**: на странице `/marketing/okr` справа от выбранного KR появился бейдж `📁 1 · ✓ 0`.
4. **Click → filter**: клик по бейджу → `/planning/projects?okr_kr=...` → видишь созданный проект и banner-фильтр.
5. **Сброс фильтра**: ✕ → URL без `okr_kr`, видишь все проекты.
6. **Task-привязка**: создать task в проекте, привязать к KR — `📁 1 · ✓ 1` на OKR-странице.
7. **Removal**: в форме проекта поменять привязку на «— Не привязан —» → counts уменьшается → бейдж исчезает (если был последний).
8. **Edge: dangling**: вручную через SQL обновить `okr_kr_id = 'fake-id'` → форма редактирования показывает «(не найдена)» + опция очистки.

## Open questions / future

- **Task-привязка через Projects-форму**: возможно стоит автоматически наследовать `okr_kr_id` от проекта при создании задачи внутри него (если у проекта есть привязка). Сейчас задача указывает KR независимо. Решим после реального использования.
- **«Untracked KRs» виджет**: на OKR-странице можно показать «3 KR без привязанных проектов» — подсказка где dwarf в декомпозиции. v2.
- **«Untracked projects» виджет**: на Projects-странице — «12 проектов не связаны с OKR». v2.
- **Цвет бейджа по статусу KR**: бейдж 📁 3 окрашен в цвет KR (зелёный/жёлтый/...) для бóльшей плотности информации. v2 cosmetic.
- **Automatic suggestion** при создании проекта: «Похоже, это связано с Q2-O1 — привязать?». ML/heuristic. Очень-очень не сейчас.
