# Контент-банк — Design

**Date:** 2026-05-07
**Replaces:** «Контентные единицы» (`ContentUnit` entity, `/content-units` route, YouTube/YaDisk/Sheets integrations)
**Source-of-truth seed:** `chemichka_content_bank.json` (6 рубрик, 95 идей)

## Goal

Превратить страницу «Контентные единицы» в **Контент-банк** — удобный, сортируемый, пополняемый каталог разнотипного контента (короткие ролики, текстовые посты), снимающий боль постоянно генерить новые идеи. Каждая единица идёт по сквозному workflow `idea → script → filming → editing → ready → published` (плюс `rejected` сбоку), привязана к рубрике (творческая стратегия с tone/audience/CTA) и распределяется по N соцсетям через дочернюю таблицу публикаций.

## Locked decisions

| # | Вопрос | Выбор |
|---|---|---|
| A | Базовая модель | JSON-схема + расширения (target networks, video_url, content_type) |
| A1 | Workflow | 7 статусов: `idea / script / filming / editing / ready / published / rejected` |
| B3 | Network-теги | Гибрид: enum KNOWN_NETWORKS + custom-строки в `content_publications.network` |
| - | Даты публикаций | Дочерняя таблица `content_publications` (per-network rows), а не плоские колонки |
| C2 | Типы контента | Enum `content_type`: `short_video / text_post / other`. UI показывает разные поля по типу |
| D2 | Рубрики | Полноценная CRUD-таблица `content_rubrics` со всеми полями JSON (tone/audience/cta_template) |
| E1 | Интеграции | Дропаем все три: Yandex.Disk sync, Google Sheets export, YouTube auto-publish |
| F | A/B-крючок | Два поля `hook` + `hook_ab`, точно как в JSON. Без обобщения в массив |
| G | video_url | Одно поле на уровне единицы (не per-network). Контент-менеджер скачивает и пилит вручную |
| H | Миграция | Wipe `content_units` + drop старых колонок. 95 идей загружаются из JSON как seed |

## Data model

### `content_rubrics` (CRUD, seed из 6 рубрик)

```sql
CREATE TABLE content_rubrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(100) UNIQUE NOT NULL,
  title         VARCHAR(255) NOT NULL,
  emoji         VARCHAR(8),
  tone          TEXT,
  audience      TEXT,
  cta_template  TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `content_units` (основная сущность)

```sql
CREATE TABLE content_units (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id     UUID REFERENCES content_rubrics(id) ON DELETE SET NULL,
  content_type  VARCHAR(20) NOT NULL DEFAULT 'short_video', -- short_video|text_post|other
  status        VARCHAR(20) NOT NULL DEFAULT 'idea',         -- idea|script|filming|editing|ready|published|rejected
  complexity    SMALLINT,                                    -- 1|2|3 nullable
  title         VARCHAR(500) NOT NULL,
  hook          TEXT,
  hook_ab       TEXT,
  visual        TEXT,
  essence       TEXT,
  notes         TEXT,
  video_url     VARCHAR(1000),                                -- master-ссылка для контент-менеджера
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_units_rubric  ON content_units (rubric_id);
CREATE INDEX idx_units_status  ON content_units (status);
CREATE INDEX idx_units_type    ON content_units (content_type);
CREATE INDEX idx_units_created ON content_units (created_at DESC);
```

### `content_publications` (per-network выходы)

```sql
CREATE TABLE content_publications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_unit_id UUID NOT NULL REFERENCES content_units(id) ON DELETE CASCADE,
  network         VARCHAR(50) NOT NULL,
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  published_url   VARCHAR(1000),
  notes           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_unit_id, network)
);
CREATE INDEX idx_publications_unit      ON content_publications (content_unit_id);
CREATE INDEX idx_publications_network   ON content_publications (network);
CREATE INDEX idx_publications_scheduled ON content_publications (scheduled_at);
```

### KNOWN_NETWORKS (TS-константа в `frontend/src/lib/networks.ts`)

```ts
export const KNOWN_NETWORKS = [
  { value: 'youtube',   label: 'YouTube',   color: '#FF0000', icon: 'Youtube' },
  { value: 'instagram', label: 'Instagram', color: '#E4405F', icon: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok',    color: '#000000', icon: 'IconTikTok' },
  { value: 'telegram',  label: 'Telegram',  color: '#0088CC', icon: 'Send' },
  { value: 'vk',        label: 'VK',        color: '#0077FF', icon: 'IconVK' },
  { value: 'twitter',   label: 'X / Twitter', color: '#000000', icon: 'X' },
] as const
```

В `content_publications.network` хранится свободная строка. UI показывает чипы с автокомплитом по KNOWN_NETWORKS + поддерживает custom-теги (например, `threads`, `zen`). Кастомы рендерятся нейтральным серым.

## Backend

### Сущности (TypeORM)

- `entities/ContentRubric.ts` — новая, с `@OneToMany` на `ContentUnit`
- `entities/ContentUnit.ts` — переписывается с нуля (старая дропается вместе с таблицей)
- `entities/ContentPublication.ts` — новая, с `@ManyToOne` на `ContentUnit`, `@Unique(['content_unit_id', 'network'])`

### REST API

**`/api/content-rubrics`** (`content-rubric.routes.ts` + контроллер):
- GET `/` — список (sorted by `sort_order`, then `title`)
- GET `/:id` — одна
- POST `/` — создать
- PUT `/:id` — обновить
- DELETE `/:id` — удалить (units → `rubric_id=NULL` через `ON DELETE SET NULL`)

**`/api/content-units`** (полностью переписанный `content-unit.routes.ts` + контроллер):
- GET `/` — список с фильтрами `?status`, `?rubric_id`, `?content_type`, `?network` (через JOIN с publications), `?search` (LIKE по title+hook+essence), `?sort` (`created_at`/`title`/`status`), пагинация `?page&limit`. Возвращает `{data, pagination}`.
- GET `/:id` — одна с `relations: ['rubric', 'publications']`
- POST `/` — создать (только base-fields)
- PUT `/:id` — обновить
- DELETE `/:id` — удалить (CASCADE дропает publications)

**`/api/content-publications`** (`content-publication.routes.ts` + контроллер):
- POST `/` — создать (body: `{content_unit_id, network, scheduled_at?, ...}`)
- PUT `/:id` — обновить
- DELETE `/:id` — удалить

(Список публикаций отдаётся через `GET /api/content-units/:id` в составе relations.)

### Удаляемые файлы (backend)

- `services/yadisk-download.service.ts`
- `services/google-sheets.service.ts` *(если других потребителей нет — проверить grep'ом)*
- `services/youtube.service.ts`
- `routes/youtube.routes.ts` *(если есть отдельным)*
- В `controllers/content-unit.controller.ts` — методы `syncYaDisk`, `exportToSheets`, `publishYouTube`, `markPublished`, `getYouTubeAuthUrl`, `getYouTubeStatus`. Остаётся чистый CRUD.

### Seed (`backend/src/seeds/seed-content-bank.ts`)

Идемпотентный одноразовый скрипт:
1. Читает `backend/src/seeds/data/chemichka_content_bank.json`.
2. Для каждой `rubric` — `INSERT INTO content_rubrics` (`slug`, `title`, `emoji`, `tone`, `audience`, `cta_template`, `sort_order = id`). Skip-on-conflict по `slug`.
3. Для каждой `idea`:
   - `title` = первые 80 символов `hook` (или `hook` целиком, если короче)
   - `content_type = 'short_video'`
   - `status` = из JSON напрямую
   - `complexity`, `hook`, `hook_ab`, `visual`, `essence`, `notes` — копия
   - `rubric_id` = lookup по `slug`
   - `created_by` = id первого admin'а (`role='admin'`)
   - Skip-on-conflict по комбинации `(rubric_id, hook)`.
4. `content_publications` — пустые на seed-этапе.

В `package.json` backend'а: `"seed:content-bank": "ts-node src/seeds/seed-content-bank.ts"`.

## Frontend

### Маршрут и сайдбар

- Роут: `/content-bank` (был `/content-units`)
- Старый адрес `/content-units` → 302 на `/content-bank` через `<Navigate to="/content-bank" replace />`
- Сайдбар: «Контентные единицы» → **«Контент-банк»**

### Структура страницы (только table view)

```
┌────────────────────────────────────────────────────────────────┐
│ Контент-банк                  [⚙ Рубрики] [+ Добавить]         │
├────────────────────────────────────────────────────────────────┤
│ [🔍 Поиск...]                          [Сорт: новые ▾]          │
│                                                                │
│ Тип:      [Все] [🎬 Ролик] [📝 Текст] [Прочее]                │
│ Рубрика:  [Все] [💰 Разбогатеть] [🚀 Миллиардер] ...           │
│ Сети:     [Все] [▶ YouTube] [📷 Instagram] [TikTok] ...        │
│ Статус:   [Все] [💡] [📝] [🎬] [✂] [✅] [🚀] [❌]             │
├────────────────────────────────────────────────────────────────┤
│ # │ Рубрика │ Стат │ Тип │ Название/hook │ Сети │ ⋯           │
│ ...                                                            │
├────────────────────────────────────────────────────────────────┤
│ Показано 1–50 из 95            [<] [1] [2] [>]                │
└────────────────────────────────────────────────────────────────┘
```

Все фильтры и search хранятся в URL query-string (`?status=script,filming&rubric=1,3`) для shareability.

### Edit modal — динамическая по `content_type`

- Тип переключается radio'ом сверху (Ролик / Текст / Прочее)
- Селектор рубрики; справа — мелким текстом tone/audience/cta_template выбранной рубрики (творческая подсказка)
- Status picker — 6 пилюль workflow + отдельная кнопка `❌ rejected`
- Complexity — звёздочки 1/2/3
- Title (auto-fill из первых 80 символов hook'а)
- **Conditional fields:**
  - `short_video`: `hook`, `hook_ab`, `visual`, `essence`, `notes`
  - `text_post`: «Заголовок» (= hook), «Тело поста» (= essence, large textarea), `notes`
  - `other`: все поля видны
- `video_url` (master-ссылка)
- **Секция «Публикации»** — список `content_publications` для этой единицы. На каждой записи: network-chip (с цветом), `scheduled_at`, `published_at`, `published_url`, `notes`, кнопка delete. Добавление через dropdown с KNOWN_NETWORKS + поле «свой тег».

### Modal «⚙ Рубрики»

CRUD-список рубрик: drag-handle для `sort_order` (или ↑/↓), edit/delete по строке, кнопка `+ Добавить рубрику` с под-модалкой (slug, title, emoji, tone, audience, cta_template). Удаление с confirm: «Удалить рубрику? N единиц контента останутся без рубрики».

### Новые файлы (frontend)

| Файл | Что |
|---|---|
| `pages/ContentBank.tsx` | главная страница (заменяет `ContentUnits.tsx`) |
| `components/content-bank/UnitTable.tsx` | таблица единиц (или inline в page-компоненте) |
| `components/content-bank/UnitEditModal.tsx` | модалка create/edit (через portal) |
| `components/content-bank/PublicationsEditor.tsx` | секция «Публикации» внутри edit-модалки |
| `components/content-bank/RubricsManagerModal.tsx` | CRUD рубрик |
| `components/content-bank/StatusPicker.tsx` | переключатель статуса (7 пилюль) |
| `components/content-bank/NetworkChips.tsx` | селектор сетей (KNOWN + custom) — для фильтров и `PublicationsEditor` |
| `api/contentBank.ts` | API-модуль: `unitsApi`, `rubricsApi`, `publicationsApi` |
| `lib/networks.ts` | KNOWN_NETWORKS константа + helper'ы |

### Удаляемые файлы (frontend)

- `pages/ContentUnits.tsx`
- `api/contentUnits.ts`

### Все модалки — через `createPortal(..., document.body)`
По итогам ERP-багов (commit `446ce0e`) — паттерн уже зашит, чтобы не наступать на containing-block-проблему.

## Migration & rollout

### SQL-миграция (single shot, разрушительная)

```sql
-- 1. Wipe старого
DROP TABLE IF EXISTS content_units CASCADE;

-- 2. Новая схема (см. data model)
CREATE TABLE content_rubrics ( ... );
CREATE TABLE content_units ( ... );
CREATE TABLE content_publications ( ... );
-- + индексы
```

### Порядок выкатки

Backend-changes требуют push в **оба** remote'а (Vercel-фронт + Railway-бэк), как зафиксировано в deploy-convention.

1. Все коммиты делаются локально.
2. **Backup БД** перед миграцией (snapshot Supabase + ручной dump).
3. Накатать миграцию на Supabase напрямую через SQL-консоль **до** push'а кода.
4. Запустить seed на проде через Railway shell: `npm run seed:content-bank`.
5. Push:
   - `git push vercel-deploy main` — фронт обновится
   - `git push origin main` — Railway-бэк обновится
6. Hard refresh `/content-bank` на проде — новая страница работает, в каталоге 95 идей.

### Откат

Поскольку старые данные wipe'нуты — откатиться можно только через `git revert` + восстановление backup'а БД.

## Testing

Проект ERP не имеет тест-инфраструктуры (ни на backend, ни на frontend). Стратегия — мануальный smoke-чеклист:

1. После миграции — три таблицы созданы, остальные не повреждены.
2. После seed'а — `SELECT count(*) FROM content_rubrics` = 6, `FROM content_units` = 95.
3. Открыть `/content-bank` — таблица показывает 95 строк, фильтры работают.
4. Создать новую единицу типа `text_post` — поля переключаются корректно, save срабатывает.
5. Добавить публикацию в YouTube — появляется чип, дата сохраняется.
6. Удалить рубрику — units получают `rubric_id=NULL` (отображаются как «Без рубрики»).
7. Удалить единицу — её publications исчезают (CASCADE).
8. Старый URL `/content-units` редиректит на `/content-bank`.

Автоматических тестов не пишем, чтобы не конфликтовать с культурой проекта (нет vitest/jest setup).

## Out of scope (для следующих итераций)

- Двухуровневая модель (вариант C из брейншторма) — одна идея → много публикаций с разными сценариями. Если контент-стратегия начнёт требовать этого — добавим уровнем выше.
- Возврат YaDisk/Sheets/YouTube-интеграций при необходимости.
- Tags на уровне единицы (свободные хэштеги) — пока нет, можно класть в `essence`.
- Календарь публикаций (kanban/gantt-view по `scheduled_at`).
- Bulk-actions (отметить несколько единиц как `rejected` разом).
