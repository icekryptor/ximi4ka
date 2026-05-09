# Content-Bank Production Block — Design

**Date:** 2026-05-08
**Status:** Approved, ready for implementation plan
**Author:** dialogue with Claude

---

## Goal

Превратить таблицу `Контент-банк` из «реестра идей» в полноценный продакшн-инструмент: добавить production-блок (сценарий, ТЗ, озвучка, плановая дата готовности), компактизировать табличную строку, расширить модалку.

## Non-goals

- Воркфлоу-движок (триггеры, автопереходы статусов) — пока не нужен.
- Авто-вычисление `ready_at` из `status='ready'` — поле остаётся ручным плановым.
- Связь со внешними сервисами (Drive, YT, etc.) — ссылка просто текстовое поле.

---

## Architecture

Изменения **аддитивные**: новые колонки в `content_units`, новые секции в UI, ничего из существующего не ломаем.

```
┌─ DB ──────────────────────────────────────────────────┐
│  content_units                                          │
│    + script_text     text                               │
│    + video_brief     text                               │
│    + voiceover_text  text                               │
│    + ready_at        timestamptz                        │
│    + idx_content_units_ready_at  partial WHERE NOT NULL │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─ API ───────────────────────────────────────────────────┐
│  GET /content-units?sort=ready_at                       │
│    ORDER BY u.ready_at ASC NULLS LAST,                  │
│             u.created_at DESC                           │
│  (никаких subquery — ready_at прямо на u)              │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─ UI ────────────────────────────────────────────────────┐
│  Table: 5 колонок → 3 (Контент / Сети / ···)            │
│  Modal: max-w-2xl → max-w-5xl, новая секция Производство│
│  Sort dropdown: +1 опция «📅 По дате готовности»        │
└─────────────────────────────────────────────────────────┘
```

---

## Data model

### Migration: `2026-05-08-content-bank-production.sql` (idempotent)

```sql
ALTER TABLE content_units
  ADD COLUMN IF NOT EXISTS script_text     text,
  ADD COLUMN IF NOT EXISTS video_brief     text,
  ADD COLUMN IF NOT EXISTS voiceover_text  text,
  ADD COLUMN IF NOT EXISTS ready_at        timestamptz;

CREATE INDEX IF NOT EXISTS idx_content_units_ready_at
  ON content_units (ready_at) WHERE ready_at IS NOT NULL;
```

Partial index: бэклог идей без даты — миноритарная масса, не нужна в индексе.

### Семантика `ready_at`

**Plan A (выбран):** плановая дата — «к этой дате обязуемся подготовить контент». Ставится при планировании, используется для chronological sort бэклога. Факт готовности отдельно — через `status='ready'`.

### Production-блок: новые поля

| Field            | Type   | Назначение                                    |
|------------------|--------|------------------------------------------------|
| `script_text`    | text   | Полный сценарий (длинный, многоабзацный)       |
| `video_brief`    | text   | ТЗ для видео (что снять, ракурсы, реквизит)    |
| `voiceover_text` | text   | Текст озвучки                                  |
| `ready_at`       | tz     | Плановая дата готовности к публикации          |

### Что переиспользуем без изменений

- `visual` (text) — «Видеоряд» (как сейчас)
- `video_url` (varchar 1000) — ссылка на готовый артефакт (Drive/Yandex/...)
- `essence` (text) — короткая суть (для триажа), сосуществует со `script_text`
- `publications[].published_url` — per-network ссылки на опубликованное

### TypeScript types

`frontend/src/api/contentBank.ts`:
```ts
export interface ContentUnit {
  // ... existing ...
  script_text: string | null
  video_brief: string | null
  voiceover_text: string | null
  ready_at: string | null   // ISO timestamp
}

export interface UnitsListParams {
  // ... existing ...
  sort?: 'created_at' | 'title' | 'status' | 'scheduled_at' | 'ready_at'
}
```

---

## Backend

### Sort branch — `getAll` controller

```ts
} else if (sort === 'ready_at') {
  qb.orderBy('u.ready_at', 'ASC', 'NULLS LAST')
    .addOrderBy('u.created_at', 'DESC')
}
```

Простой `ORDER BY` по колонке самого юнита — никаких subquery. После недавнего фикса (убрали `joinAndSelect publications`, batch-hydrate после пагинации) DISTINCT-pagination не срабатывает — любой sort работает корректно.

### Create / Update / Import / Export

**Изменений нет.** TypeORM `repo.save/update` примет произвольные поля entity, новые колонки попадут автоматически. Импорт upsert уже whitelistит все ContentUnit-поля. Экспорт отдаёт всё через `qb.getMany()`.

### Валидация

`ready_at` — ISO-string, парсится TypeORM-transformer как `reviewed_at`/`scheduled_at`. Пустая строка с фронта → конвертим в `null` на фронте.

---

## Frontend

### Таблица — структура одной строки

5 колонок (`Статус / Тип / Заголовок / Сети / ···`) сжимаются до **3 (`Контент / Сети / ···`)**.

```tsx
<td className="py-3 px-4">
  {/* Линия 1: чипы + дата справа */}
  <div className="flex flex-wrap items-center gap-1.5 mb-1">
    {u.rubric && <Chip variant="rubric">{rubric.emoji} {rubric.title}</Chip>}
    <Chip variant="status" status={u.status}>{STATUS_LABELS[u.status]}</Chip>
    <Chip variant="type">{CONTENT_TYPE_LABELS[u.content_type]}</Chip>
    {u.complexity && <Chip variant="complexity">{COMPLEXITY_LABELS[u.complexity]}</Chip>}
    <span className={cn(
      'ml-auto text-xs',
      sort === 'ready_at' ? 'text-primary-600 font-medium' : 'text-brand-text-secondary'
    )}>
      {u.ready_at ? `↗ ${formatDate(u.ready_at)}` : null}
    </span>
  </div>

  {/* Линия 2: заголовок */}
  <div className="font-semibold text-brand-text leading-snug">
    {u.title}
  </div>

  {/* Линия 3: хук */}
  {u.hook && (
    <div className="text-sm text-brand-text-secondary mt-0.5 line-clamp-1">
      → {u.hook}
    </div>
  )}

  {/* Линия 4: превью сценария */}
  {u.script_text && (
    <div className="text-xs text-brand-text-secondary mt-1.5 line-clamp-3 whitespace-pre-line">
      {u.script_text}
    </div>
  )}
</td>
```

#### Чип-варианты

| variant      | bg / text colors                                            |
|--------------|-------------------------------------------------------------|
| `rubric`     | `bg-subtle text-brand-text-secondary`                       |
| `status`     | per-status lookup (idea=серый, script=синий, filming=жёлтый, editing=оранжевый, ready=зелёный, published=фиолетовый, rejected=красный) |
| `type`       | `bg-subtle text-brand-text-secondary`                       |
| `complexity` | `bg-amber-50 text-amber-700`                                |

Все чипы: `text-[10px] px-2 py-0.5 rounded-full`.

#### Подсветка активного сорта

`↗ дата` ярко-фиолетовая (`text-primary-600 font-medium`), когда `sort === 'ready_at'`.

#### Что удаляется

- `<th>Статус</th>`, `<th>Тип</th>`, `<th>Заголовок</th>` — переехали в `Контент`.

#### Что сохраняется

- `<td>Сети</td>` — `<NetworkChips>` без изменений.
- `<td>···</td>` (действия) — иконки ✏️ / 🗑 с `onClick={(e) => e.stopPropagation()}`.
- Клик по `<tr>` — `onClick={() => setEditingUnit(u)}` (уже сделано).

### Модалка — крупнее, с production-секцией

**Размер:** `max-w-2xl` → `max-w-5xl` на десктопе, full-screen на мобильном.

**Структура (сверху вниз):**

1. **Шапка:** `<h2>` + ✕
2. **Заголовок:** title (full), hook (full), hook_ab (full)
3. **Мета (одна строка):** [Рубрика ▾] [Тип ▾] [Статус ▾] [Сложность ▾] · [📅 Дата готовности]
4. **🎬 Производство** (новая секция, expanded по умолчанию):
   - Суть (`essence`, 2-3 строки)
   - Сценарий (`script_text`, large textarea 8-12 строк)
   - 2 колонки: ТЗ для видео (`video_brief`) | Озвучка (`voiceover_text`)
   - Видеоряд (`visual`, text)
   - Ссылка на готовый артефакт (`video_url`)
5. **🚀 Публикации:** `<PublicationsEditor>` без изменений
6. **📝 Заметки:** `notes` textarea
7. **⭐ Ревью** (collapsed по умолчанию): grade buttons + feedback + reviewed_at
8. **Футер (sticky):** хинты слева / Отмена · Сохранить справа

**Адаптив:**
- `max-w-5xl mx-auto`
- < 768px: full-screen, 2 колонки → 1
- Мета-строка: wrap на узких экранах

### Sort dropdown

```tsx
<select value={sort} onChange={(e) => updateSort(e.target.value)}>
  <option value="created_at">Сначала новые</option>
  <option value="title">По алфавиту</option>
  <option value="status">По статусу</option>
  <option value="ready_at">📅 По дате готовности</option>
  <option value="scheduled_at">🚀 По дате публикации</option>
</select>
```

Эмодзи: 📅 — production-таймлайн (бэклог идей); 🚀 — publication-таймлайн (расписание).

URL state не меняется — уже работает через `useSearchParams` + `updateSort` (с `sp.delete('page')`).

---

## Files changed

### Backend (3)
- `migrations/2026-05-08-content-bank-production.sql` — **NEW**
- `entities/ContentUnit.ts` — +4 колонки
- `controllers/content-unit.controller.ts` — +1 ветка `sort=ready_at`

### Frontend (3)
- `api/contentBank.ts` — +4 поля в `ContentUnit`, +1 опция в `sort` union
- `pages/ContentBank.tsx` — реструктуризация `<thead>`/`<tbody>` (5 колонок → 3), +1 опция в дропдауне, чип-компоненты
- `components/content-bank/UnitEditModal.tsx` — `max-w-2xl` → `max-w-5xl`, новая секция «Производство» (3 textarea + 1 date input), сворачиваемые секции

---

## Migration & deploy

1. **Прод-миграция** через Supabase MCP `apply_migration` (как `2026-05-08-content-bank-review.sql`). Idempotent — `IF NOT EXISTS` на всех ALTER/CREATE.
2. **Деплой:** один пуш на оба ремоута:
   - `origin` → Railway (бэк подхватит миграцию + sort branch)
   - `vercel-deploy` → Vercel (фронт подхватит UI-изменения)
3. **Order:** миграция → бэк-деплой → фронт-деплой. Если фронт окажется впереди — ничего страшного, новые поля в payload просто `null`, бэк их не отдаст.

---

## Risk / fallback

- **Старые юниты** без `script_text`/`ready_at` → таблица показывает только заголовок + хук, никаких ошибок.
- **Импорт старого JSON** без новых полей → upsert принимает, поля остаются `null`.
- **Сортировка пустого `ready_at`** → `NULLS LAST`, бэклог естественно опускается вниз.
- **Откат миграции:** если потребуется — `DROP COLUMN` через отдельную migration. Колонки `nullable`, данных нет на момент применения, потеря безопасна.

---

## Testing

Ручной smoke-test после деплоя:
1. Создать новую идею с заполненным `script_text` + `ready_at` → отображается превью + дата.
2. Сорт `ready_at`:
   - Юниты без даты — внизу.
   - Юниты с датой — по возрастанию.
   - Чип `↗ дата` подсвечивается фиолетовым.
3. Импорт старого JSON (из commit ранее) → обратная совместимость.
4. Экспорт → новые поля попадают в JSON, round-trip OK.
5. Модалка — открывается на десктопе/мобильном, секция «Производство» удобна, поля сохраняются.

Автотестов нет — проект без unit-test-фреймворка пока что.
