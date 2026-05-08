# Контент-банк v2 — Design (review-loop add-ons)

**Date:** 2026-05-08
**Builds on:** [2026-05-07-content-bank-design.md](2026-05-07-content-bank-design.md) — Контент-банк MVP, deployed `0b35e39`

## Goal

Превратить контент-банк в **AI-feedback-loop**: пользователь триажит идеи (от seed'а или от AI-генератора), AI читает размеченный JSON-экспорт, генерирует следующую партию идей, человек снова триажит. Три добавления:

1. **Триаж** — отдельный focus-view режим с тремя оценками (отлично/доработать/отказ) и текстовым фидбеком, который AI получает обратно. Оценка хранится **независимо** от workflow-статуса.
2. **Импорт JSON** — upsert (новые INSERT, существующие UPDATE с защитой полей оценки) с двухстадийным preview-then-commit потоком.
3. **Экспорт JSON** — round-trippable формат, респектит текущие фильтры списка.

## Locked decisions

| # | Вопрос | Выбор |
|---|---|---|
| Triage-1 | Семантика триажа | **B** — независимое поле `review_grade` ENUM('excellent','needs_work','rejected'), не пересекается со `status` |
| Triage-2 | UX триажа | **B** — отдельная focus-view страница с большими кнопками, hotkeys (1/2/3/Tab/Cmd+Enter/←→/Esc), автопереход к следующей |
| Import-1 | Семантика импорта | **I2** — upsert (по `id` если есть): UPDATE существующих + INSERT новых; защита полей `review_grade`/`review_feedback`/`reviewed_at`/`created_by`/`created_at` от перезаписи AI-ом |
| Schema | JSON-формат | Round-trippable: `meta` + `rubrics[]` + `units[]` (с `rubric_slug` денорм + `publications[]`) |
| Export-1 | Что экспортируется | Респектит текущие URL-фильтры; `meta.filters_applied` фиксирует |
| Export-2 | Publications в экспорте | Да — для round-trip целостности |
| UI-1 | Размещение кнопок | В шапке `/content-bank`: «Триаж (N)» / «Импорт» / «Экспорт» рядом с «⚙ Рубрики» / «+ Добавить» |
| UI-2 | Filter chip для оценки | Пятый ряд фильтров «Оценка» с 4 опциями + спецзначение `null` для «не оценено» |

## Data model — изменения

```sql
ALTER TABLE content_units
  ADD COLUMN review_grade   VARCHAR(20),     -- 'excellent' | 'needs_work' | 'rejected' | NULL
  ADD COLUMN review_feedback TEXT,            -- свободный текст для AI
  ADD COLUMN reviewed_at    TIMESTAMPTZ;     -- когда оценили

CREATE INDEX idx_units_review_grade ON content_units (review_grade);
CREATE INDEX idx_units_reviewed_at  ON content_units (reviewed_at DESC);
```

Все три поля **nullable** — у только что созданной/импортированной идеи их нет, пока юзер не открыл Триаж.

**Семантика:**
- `review_grade IS NULL` = «не оценено» → попадает в очередь Триажа
- `review_grade ∈ ('excellent','needs_work','rejected')` — после Триажа
- `review_grade` **независимо** от `status`. Например, `status='filming' AND review_grade='excellent'` — снимаем хорошую идею; `status='idea' AND review_grade='rejected'` — отказная, остаётся в каталоге как negative-sample для AI.

**Защита при upsert-импорте:**
Когда AI присылает JSON с `id` существующей единицы, backend **никогда** не перезаписывает: `id`, `review_grade`, `review_feedback`, `reviewed_at`, `created_by`, `created_at`. Это в коде `importCommit` через явный allow-list (PROTECTED_FIELDS).

**TypeORM — расширение `ContentUnit.ts`:**
```ts
export type ReviewGrade = 'excellent' | 'needs_work' | 'rejected'

@Column({ type: 'varchar', length: 20, nullable: true })
review_grade: ReviewGrade | null

@Column({ type: 'text', nullable: true })
review_feedback: string | null

@Column({ type: 'timestamptz', nullable: true })
reviewed_at: Date | null
```

## Backend

### Расширение существующих эндпоинтов
- **`GET /api/content-units?...`** — фильтр `review_grade` (CSV `excellent,needs_work` или спецзначение `null` для `IS NULL`).
- **`PUT /api/content-units/:id`** — уже умеет апдейтить произвольные поля. Триаж-сейв пойдёт через него (`{review_grade, review_feedback, reviewed_at}`). Отдельный `/review` эндпоинт **не нужен**.

### Новые эндпоинты

**`GET /api/content-units/export`** — иммедиатный download JSON (`Content-Disposition: attachment`). Респектит те же фильтры что `getAll`. Возвращает:
```json
{
  "meta": {"exported_at": "...", "version": "1.0", "total_units": 95, "filters_applied": {...}},
  "rubrics": [{"id":"uuid","slug":"...","title":"...","emoji":"...","tone":"...","audience":"...","cta_template":"...","sort_order":1}],
  "units": [{
    "id": "uuid",
    "rubric_slug": "rich_on_chemistry",
    "content_type": "short_video",
    "status": "idea",
    "complexity": 2,
    "title": "...",
    "hook": "...", "hook_ab": "...", "visual": "...", "essence": "...", "notes": null,
    "video_url": null,
    "review_grade": "excellent",
    "review_feedback": "Хороший крючок, реальная польза",
    "reviewed_at": "...",
    "publications": [{"network":"youtube","scheduled_at":"...","published_at":null,"published_url":null,"notes":null}],
    "created_at": "...", "updated_at": "..."
  }]
}
```

**`POST /api/content-units/import/preview`** (multipart upload `.json` файла, multer):
- Парсит JSON, валидирует
- Строит план без записи в БД, возвращает:
```ts
{
  rubrics: { to_create: number, to_skip: number, parsed_total: number },
  units:   { to_insert: number, to_update: number, to_skip_duplicate: number, parsed_total: number },
  errors:  string[],     // невалидные записи
  warnings: string[],    // например, неизвестный rubric_slug
  preview_token: string  // план хранится в памяти процесса с TTL 5 мин
}
```

**`POST /api/content-units/import/commit { preview_token }`** — применяет план транзакционно:
```ts
{
  rubrics: { created: number, skipped: number },
  units:   { inserted: number, updated: number, skipped: number },
  errors:  []
}
```

**Хранилище preview_token:** простой in-memory `Map` с TTL 5 мин. Нет Redis (YAGNI).

**Логика upsert (псевдокод):**
```ts
const PROTECTED = ['id','review_grade','review_feedback','reviewed_at','created_by','created_at']
for (const incoming of plan.units) {
  if (incoming.id) {
    const existing = await unitRepo.findOne({ where: { id: incoming.id } })
    if (existing) {
      const patch = stripProtected(incoming)
      patch.rubric_id = incoming.rubric_slug ? slugToId.get(incoming.rubric_slug) : null
      await unitRepo.update(existing.id, patch)
      // Replace publications: delete old, insert new
      await publicationRepo.delete({ content_unit_id: existing.id })
      for (const p of incoming.publications || []) {
        await publicationRepo.save({ ...p, content_unit_id: existing.id })
      }
      stats.updated++; continue
    }
  }
  // Skip-if-duplicate by (rubric_id, hook) — preserves seed semantics
  if (incoming.rubric_slug && incoming.hook) {
    const dup = await unitRepo.findOne({
      where: { rubric_id: slugToId.get(incoming.rubric_slug), hook: incoming.hook }
    })
    if (dup) { stats.skipped++; continue }
  }
  // INSERT
  const created = await unitRepo.save({
    ...stripProtected(incoming),
    rubric_id: incoming.rubric_slug ? slugToId.get(incoming.rubric_slug) : null,
    created_by: req.user!.userId,
  })
  for (const p of incoming.publications || []) {
    await publicationRepo.save({ ...p, content_unit_id: created.id })
  }
  stats.inserted++
}
```

**`GET /api/content-units/ungraded-count`** — `{ count: N }` для бейджа «Триаж (N)».

### Регистрация роутов (порядок важен — спец-роуты до `/:id`)

```ts
router.get('/export', ...)
router.get('/ungraded-count', ...)
router.post('/import/preview', upload.single('file'), ...)
router.post('/import/commit', ...)
router.get('/', ...)         // getAll
router.get('/:id', ...)
// ...
```

## Frontend

### Новая страница «Триаж» — `pages/ContentBankTriage.tsx`

Маршрут: `/content-bank/triage`. Не модалка — отдельный route.

Логика:
- На mount: `unitsApi.list({ review_grade: 'null', limit: 200, sort: 'created_at' })` — очередь.
- Опционально query-param `?include=excellent,needs_work` чтобы переразмечать уже оценённые.
- Стейт: `currentIndex`, `feedback` (local string), `isAnimating` (для transition анимации между идеями).
- Сохранение: `unitsApi.update(id, { review_grade, review_feedback, reviewed_at: new Date().toISOString() })`. Оптимистично убирает из очереди (если grade был null) или обновляет (если переразметка).
- Очередь пуста → финальный экран «🎉 Разметил все! [Назад на Контент-банк]».

UI: одна единица на экран. Шапка: «Триаж: 12 / 95 [✕]», прогресс-бар. Контент: рубрика+complexity, hook (большой), hook_ab (поменьше), visual, essence, notes — всё в один столбец. Поле «Фидбек для AI» (textarea 4 строки). Три большие кнопки разных цветов.

Hotkeys (через `document.addEventListener('keydown')` в useEffect, при unmount removeEventListener):
- `1`/`2`/`3` — set grade + advance
- `Tab` — focus в textarea
- `Cmd+Enter` (в textarea) — save current grade + advance
- `←`/`→` — пред/след без сохранения
- `Esc` — закрыть → `navigate('/content-bank')`

### Новая модалка «Импорт JSON» — `ImportJsonModal.tsx`

Через `createPortal(..., document.body)`. Три шага:

**Step 1 — Upload:** drag-and-drop area для `.json` (как `BankImportModal`). На select → `unitsApi.importPreview(file)`.

**Step 2 — Preview:** показывает stats и предупреждения:
```
📁 Рубрики:    5 новых, 1 пропустим
📝 Идеи:       38 новых, 12 обновлений, 4 дубликата
⚠️ Предупреждения: ...
❌ Ошибок: 0

⚠️ ОБНОВЛЕНИЕ перезапишет hook/visual/essence/...
   НЕ перезапишет: review_grade, review_feedback, reviewed_at
```
Кнопки: «Отмена», «Импортировать ✓».

**Step 3 — Done:** «Импортировано: 5 / 38 / 12 / 4». Кнопка «Закрыть».

`onClose` → закрывает + `load()` родителя.

### Кнопка «Экспорт JSON»

Простая кнопка в шапке. По клику:
```ts
const blob = await unitsApi.export(filtersFromUrl)
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url; a.download = `content-bank-export-${Date.now()}.json`
document.body.appendChild(a); a.click(); a.remove()
URL.revokeObjectURL(url)
toast.success('Экспортировано: N KB')
```
Без модалки. Респектит текущие URL-фильтры.

### Шапка `ContentBank.tsx` после изменений

```
[Триаж (N)] [Импорт] [Экспорт] [⚙ Рубрики] [+ Добавить]
```

«Триаж (N)» — кнопка с бейджем количества `review_grade IS NULL`. Подгружается отдельным `unitsApi.ungradedCount()`. На клик: `navigate('/content-bank/triage')`. Бейдж рефрешится после save в Триаже и после импорта.

### Filter chip — пятый ряд

```
Оценка: [Все] [✅ отлично] [⚠️ доработать] [❌ отказ] [— не оценено —]
```

URL-state `?review_grade=excellent,needs_work` или `?review_grade=null`. Multi-select.

### Типы и константы (`api/contentBank.ts`)

```ts
export type ReviewGrade = 'excellent' | 'needs_work' | 'rejected'

export const REVIEW_GRADE_LABELS: Record<ReviewGrade, string> = {
  excellent:  '✅ отлично',
  needs_work: '⚠️ доработать',
  rejected:   '❌ отказ',
}

// Расширение интерфейса:
review_grade: ReviewGrade | null
review_feedback: string | null
reviewed_at: string | null
```

Новые методы:
```ts
unitsApi.export(params: UnitsListParams): Promise<Blob>
unitsApi.importPreview(file: File): Promise<ImportPreviewResponse>
unitsApi.importCommit(token: string): Promise<ImportCommitResponse>
unitsApi.ungradedCount(): Promise<{ count: number }>
```

## Migration & rollout

### Миграция (неразрушительная)

`backend/src/migrations/2026-05-08-content-bank-review.sql`:
```sql
BEGIN;

ALTER TABLE content_units
  ADD COLUMN review_grade   VARCHAR(20),
  ADD COLUMN review_feedback TEXT,
  ADD COLUMN reviewed_at    TIMESTAMPTZ;

CREATE INDEX idx_units_review_grade ON content_units (review_grade);
CREATE INDEX idx_units_reviewed_at  ON content_units (reviewed_at DESC);

COMMIT;
```

Только `ADD COLUMN` + `CREATE INDEX`. **Backup не обязателен** — операция полностью обратимая через `DROP COLUMN`.

### Порядок выкатки — variant α (recommend)

1. Накатить миграцию через `apply_migration` MCP
2. Merge `feat/content-bank-v2` → main
3. Push в `origin` + `vercel-deploy`
4. Smoke на проде

Окно «миграция применена, код старый» — безопасное (TypeORM на старом коде новые поля игнорирует).

### Worktree

```
~/.config/superpowers/worktrees/ximi4ka/feat-content-bank-v2
```

После успешной выкатки старый worktree `feat/content-bank` (уже смерджен) можно удалить через `git worktree remove`.

### Размер фичи

~10-11 коммитов, против 25 в первой итерации. Существенно меньше — ничего не дропаем, только расширения.

## Out of scope (для следующих итераций)

- Per-rubric AI-агенты (если каждая рубрика обучается отдельно)
- Версионирование review (история grade-изменений по идее)
- Bulk re-grading (массовое переразмечание)
- Сравнение grades между разметчиками (multi-reviewer)
- Reorderable triage queue (приоритетный порядок неоцененных идей)
