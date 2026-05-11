# Content Production — PRD Design

**Date:** 2026-05-11
**Status:** Brainstorm finalized, ready for implementation planning
**Scope:** Контент-маркетинг — модус B Marketing-юнита XimOS.
**Parent doc:** [2026-05-11-marketing-unit-operating-model-design.md](2026-05-11-marketing-unit-operating-model-design.md)

---

## 1. Что строим и зачем

Контент-юнит — основной производственный модус Marketing. Должен покрывать **12 форматов** контента, поддерживать **executor-абстракцию** (соло-оператор + AI + подрядчики), **двухслойный workflow** (концепт + per-type technical recipe) и стыковаться со Strategy/Analytics через FK.

Эволюция, а не переписка: существующая инфраструктура (`ContentUnit`, `ContentRubric`, `ContentPublication`, Voiceover Studio, iterative learning loop, content-bank UI с триажем и pipeline) — фундамент, на котором достраиваем недостающее.

### Цели PRD

- Обобщить `ContentUnit` под 12 форматов без поломки текущего пайплайна short-video.
- Ввести executor-абстракцию для исполнения работ AI и подрядчиками.
- Перевести каналы на first-class entity.
- Добавить asset storage с гибридной моделью (Supabase Storage для light, URL для heavy).
- Подготовить ground для `ChannelPublisher` (Telegram Bot — первая реализация).
- Связать контент со Strategy (segment, theme) и Analytics (metrics).

### Не цели

- Перепроектировать триаж и pipeline UI (они работают, расширяем).
- Полноценный RBAC и multi-user (соло-оператор + контракторы без аккаунтов).
- ROAS / attribution.

---

## 2. 12 форматов контента

| # | content_type slug | Видео/текст/гибрид | Каналы по умолчанию | Status v1 |
|---|---|---|---|---|
| 1 | `short_video` | Video | TikTok, Reels, YT Shorts | Recipe готов (текущий) |
| 2 | `long_video` | Video | YouTube | Recipe слот |
| 3 | `stream` | Video live | YouTube, Twitch, VK Live | Recipe слот |
| 4 | `podcast` | Audio | YouTube, Apple Podcasts | Recipe слот |
| 5 | `short_post` | Text | Telegram, X, VK | Recipe слот |
| 6 | `long_post` | Text | Telegram, VK | Recipe слот |
| 7 | `carousel` | Visual | Instagram, LinkedIn | Recipe слот |
| 8 | `seo_article` | Text | Сайт, Дзен | Recipe слот |
| 9 | `email_newsletter` | Text | Email (вручную через сторонний сервис) | Recipe слот |
| 10 | `lead_magnet_pdf` | Document | Telegram/VK/блогеры | Recipe слот |
| 11 | `marketplace_card` | Visual+text | WB, Ozon | Recipe слот |
| 12 | `ad_creative` | Video/Visual | (потребляется PPC-юнитом) | Recipe слот |

«Recipe слот» = тип зарегистрирован в системе, можно создать `content_unit` этого типа, но technical recipe (подстадии и AI-assist) реализуем по одному в порядке приоритета.

**Приоритет роллаута recipes:** short_video (уже) → short_post → long_post → carousel → seo_article → lead_magnet_pdf → marketplace_card → ad_creative → long_video → email_newsletter → podcast → stream.

---

## 3. Двухслойный workflow

### Верхний слой — концептуальный (общий для всех типов)

```
┌───────┐    ┌───────────┐    ┌──────────────┐    ┌─────────────┐
│ Идея  │ →  │ Концепт   │ →  │ Производство │ →  │ Публикация  │
└───────┘    └───────────┘    └──────────────┘    └─────────────┘
            (оператор + AI)   (per-type recipe   (per-channel
                              + executors)        Publisher)
```

**Стадия 1 — Идея.** `content_unit.title`, `rubric_id`, `target_segment_id`, `theme_id`. Минимум для попадания в pipeline. Источники: внутренние брейнштормы, UGC (модус H), внешние идеи, AI-генератор идей (опциональный assist).

**Стадия 2 — Концепт.** Раскрытая идея: `hook`, `hook_ab`, `essence`, `notes`, `cta`, `complexity`. AI-assist подтягивает `brand_docs.strategy_current` + `brand_docs.style_guide_*` + рубрику + сегмент. Iterative learning расширяет style guide через addenda (как сейчас в Voiceover Studio для script). Концепт executor-agnostic — он одинаков для любого типа.

**Стадия 3 — Производство.** Здесь развилка по `content_type` — запускается **technical recipe** этого типа. Recipe = упорядоченный набор подзадач, у каждой:
- `executor_type` (self / ai_agent / contractor),
- `artifact_kind` (script / audio / image / video / pdf / ...),
- состояние (pending / in_progress / awaiting_review / accepted / rejected).

**Стадия 4 — Публикация.** Один `ContentPublication` per канал. Для каналов с `integration_status='api_connected'` (Telegram на v1) — авто-публикация фоновым воркером на `scheduled_at`. Для остальных — ручной режим: оператор публикует, проставляет URL, фиксирует факт.

### Нижний слой — per-type technical recipes

Recipe — JSON-структура (или связанная таблица), описывающая подзадачи. Пример для short_video (текущий пайплайн, оформленный в новой модели):

```yaml
short_video:
  - id: script
    artifact_kind: script_text
    default_executor: ai_agent  # Voiceover Studio step 2
    ai_assist: claude_script_generator
  - id: factcheck
    artifact_kind: script_text  # обновление того же артефакта
    default_executor: ai_agent
    ai_assist: claude_factcheck
  - id: style
    artifact_kind: script_text
    default_executor: ai_agent  # iterative learning loop
    ai_assist: claude_style_applier
  - id: voiceover_text
    artifact_kind: voiceover_text
    default_executor: ai_agent
    ai_assist: claude_preprocess  # ElevenLabs-ready
  - id: video_brief
    artifact_kind: video_brief_text
    default_executor: ai_agent
    ai_assist: claude_video_brief
  - id: voiceover_audio
    artifact_kind: audio_file       # → Supabase Storage
    default_executor: ai_agent      # ElevenLabs
  - id: video_edit
    artifact_kind: video_external   # → external URL
    default_executor: contractor    # монтажёр
  - id: thumbnail
    artifact_kind: image_file       # → Supabase Storage
    default_executor: contractor    # дизайнер, опционально AI
```

Для других типов recipe выглядит иначе — например, carousel:

```yaml
carousel:
  - id: copy
    artifact_kind: carousel_copy  # JSON: per-slide headline+body
    default_executor: ai_agent
    ai_assist: claude_carousel_writer
  - id: slides_design
    artifact_kind: image_file[]   # → Supabase Storage (N штук)
    default_executor: contractor  # или ai_agent (image-gen)
  - id: caption
    artifact_kind: text
    default_executor: ai_agent
```

**Хранение recipes:** на старте — статический файл `backend/src/content/recipes/*.yaml`, импортируется при загрузке сервера. Перенос в БД (для редактирования через UI) — отложен до момента, когда возникнет реальная потребность.

---

## 4. Модель данных — эволюция

### 4.1. `content_unit` — обобщение

Новые/изменённые поля:

| Поле | Тип | Назначение |
|---|---|---|
| `content_type` | enum (расширен) | См. список 12 типов |
| `target_segment_id` | UUID FK → `icp_segment` | Стратегический таргетинг (nullable на legacy данных) |
| `theme_id` | UUID FK → `strategic_theme` | Тема квартала (optional) |
| `recipe_state` | JSONB | Текущее состояние подзадач: `[{step_id, status, executor_type, executor_hint, artifact_id?, accepted_at?}]` |
| `production_started_at` | timestamp | Когда recipe запустили |

Существующие поля production-блока (`script_text`, `video_brief`, `voiceover_text`, `visual`, `video_url`) — **остаются для backward compatibility short_video pipeline**, но новые типы пишут в `content_asset` через recipe_state. Постепенно short_video мигрирует на новую модель (в отдельной задаче).

### 4.2. `content_asset` — новая таблица

```sql
content_asset (
  id              UUID PK
  content_unit_id UUID FK → content_unit
  recipe_step_id  TEXT          -- из recipe (script / voiceover_audio / ...)
  kind            ENUM          -- image | audio | pdf | video_external | published_url | script_text | other
  storage         ENUM          -- supabase | external
  path_or_url     TEXT          -- supabase path или external URL
  size_bytes      BIGINT NULL
  mime            TEXT NULL
  provider_hint   TEXT NULL     -- google_drive / yandex_disk / youtube / ...
  version         INT DEFAULT 1
  superseded_by   UUID NULL FK → content_asset
  created_at      timestamp
  created_by      TEXT NULL     -- executor identity, free-form
)
```

**Правило:** light-артефакты (≤ ~20 MB) — `storage='supabase'`. Heavy (видео > 50 MB, raw footage) — `storage='external'` с URL. Final published на платформе — отдельная сущность, см. ниже.

### 4.3. `channel` — first-class

```sql
channel (
  id                   UUID PK
  slug                 TEXT UNIQUE   -- 'telegram_main', 'tiktok_main', 'vk_school'
  display_name         TEXT
  platform             ENUM          -- telegram | tiktok | reels | youtube | vk | x | instagram | yandex_zen | site | wb | ozon | email | other
  account_handle       TEXT NULL     -- '@ximi4ka'
  profile_url          TEXT NULL
  integration_status   ENUM          -- manual | api_connected | api_planned
  active               BOOLEAN
  config_json          JSONB NULL    -- для api_connected: токен (зашифровано), chat_id и т.п.
  created_at, updated_at
)
```

UI: `/settings/channels` — CRUD-таблица. Доступ только администратору (на v1 = единственный пользователь).

### 4.4. `content_publication` — миграция

| Поле | Старое | Новое |
|---|---|---|
| `network` | `string` | удалить после миграции |
| `channel_id` | — | UUID FK → `channel` |
| `scheduled_at`, `published_at`, `published_url`, `notes`, `sort_order` | как есть | как есть |
| `auto_publish` | — | BOOLEAN — для каналов с `integration_status='api_connected'`; воркер берёт `auto_publish=true AND scheduled_at <= now() AND published_at IS NULL` |
| `publisher_log` | — | JSONB — лог попыток автопубликации (для дебага) |

**Migration plan для network → channel_id:**
1. Создать таблицу `channel`.
2. Сидеть начальный набор: `tiktok_main`, `reels_main`, `youtube_shorts`, `telegram_main`, `vk_main`, `x_main` — slug соответствует возможным значениям `network`.
3. Добавить `channel_id` nullable.
4. Backfill: `UPDATE content_publication SET channel_id = (SELECT id FROM channel WHERE slug = content_publication.network)`.
5. После проверки — `channel_id NOT NULL` + drop `network`.

### 4.5. `content_metric_snapshot` — новая таблица

```sql
content_metric_snapshot (
  id                   UUID PK
  publication_id       UUID FK → content_publication
  captured_at          timestamp
  captured_by          ENUM           -- worker | manual
  views                INT NULL
  likes                INT NULL
  comments             INT NULL
  shares               INT NULL
  saves                INT NULL
  profile_clicks       INT NULL
  marketplace_clicks   INT NULL
  raw_json             JSONB NULL     -- сырые данные для отладки
)
```

Снимки кумулятивные (на момент captured_at). Для Telegram воркер делает снимок раз в N часов; для остальных — оператор через UI «обновить метрики» раз в неделю.

### 4.6. `recipe_definition` (опционально, на v2)

Если уйдём от статических YAML в БД — таблица `recipe_definition (content_type, version, definition_json, active)`. На v1 — не строим.

---

## 5. AI-assist patterns

**Базовая модель** (унаследована от Voiceover Studio): `generate → factcheck → style → preprocess`, с iterative learning, расширяющим `brand_docs.style_guide_*` через addenda.

Расширения per type:

| Тип | Brand doc | Что AI делает |
|---|---|---|
| short_video, long_video | `style_guide_video` (есть, v1.5) | script gen, factcheck, style apply, preprocess для ElevenLabs |
| short_post, long_post | `style_guide_text` (новый) | draft, factcheck, style apply |
| carousel | `style_guide_carousel` (новый) | per-slide copy gen, caption gen |
| seo_article | `style_guide_seo` (новый, опирается на seo_brief из D) | draft под бриф, keyword-aware editing |
| email_newsletter | `style_guide_email` (новый) | draft, subject lines A/B |
| lead_magnet_pdf | `style_guide_pdf` (новый) | structure outline, секции, summary |
| podcast | `style_guide_podcast` (новый) | outline, talking points |
| stream | — | outline, опорные тезисы; live-контент почти не assist |
| marketplace_card | `style_guide_marketplace` (новый) | description, infographic copy |
| ad_creative | `style_guide_ad_creative` (новый) | hook variants, headlines |

**Iterative learning loop переиспользуется** для каждого style_guide_*: оператор правит вывод AI → Claude извлекает паттерны → addenda пишутся в соответствующий `brand_docs.style_guide_*`. Versioning и cache invalidation — как сейчас в Voiceover Studio.

**Endpoint реструктуризация:** текущие `/api/claude/*` (специфичные для voiceover) — оставить для legacy, добавить generic `/api/claude/recipe-step` (content_unit_id, recipe_step_id, custom_prompt?) который роутит на нужный assist по step_id + content_type.

---

## 6. Publisher слой (для Telegram + future)

**Интерфейс (backend):**

```ts
interface ChannelPublisher {
  canPublish(unit: ContentUnit, channel: Channel): boolean;
  publish(unit: ContentUnit, channel: Channel, assets: ContentAsset[]):
    Promise<{ published_url: string; raw_response: unknown }>;
}
```

**Реализации v1:**
- `TelegramBotPublisher` — берёт текст из соответствующих recipe-артефактов, медиа из `content_asset` (light → upload, heavy external — отправляет ссылкой); поддерживает текст, фото, документ (для PDF), медиа-группу.
- `ManualPublisher` (placeholder) — `publish()` no-op, требует ручной ввод URL после факта.

**Воркер `publishScheduledWorker`:**
- Cron раз в минуту.
- Запрос: `content_publication` где `auto_publish=true AND scheduled_at <= now() AND published_at IS NULL`.
- Для каждой записи — резолв канала → инстанс Publisher → `publish()` → запись `published_at`, `published_url`, `publisher_log`.
- Ошибки: запись в `publisher_log`, retry 3 раза с backoff, потом — флаг `manual_intervention_needed=true`, нотификация оператору.

---

## 7. UI изменения

### 7.1. `/content-bank` (существующий)

- Фильтр `content_type` расширен до 12 значений (сейчас 3).
- Карточка `content_unit` показывает `target_segment` и `theme` бейджами.
- Production-блок становится **recipe view**: список подзадач из `recipe_state`, для каждой — executor (self/AI/contractor), статус, артефакт-ссылка/превью, кнопки «передать в AI» / «передать подрядчику» / «отметить готовым».
- Раздел «Артефакты» — список `content_asset` с превью (для light) и линками (для external).

### 7.2. `/voiceover` (существующий)

Остаётся как специализированный wizard для типа short_video. После миграции short_video на recipe-модель — wizard переписывается как UI поверх recipe-steps. До тех пор — работает как сейчас.

### 7.3. `/marketing/strategy` (новый)

Парент-страница Strategy: markdown editor для `strategy_current.md` + три табличные секции (`icp_segment`, `strategic_theme`, `channel_budget`). Подробности — см. operating model doc.

### 7.4. `/settings/channels` (новый)

CRUD для `channel`. Для каналов с `integration_status='api_connected'` — отдельная вкладка «настройка интеграции» (для Telegram — токен бота + chat_id, тестовая отправка).

### 7.5. `/marketing/analytics` (новый, минимальный)

Таблица с фильтрами (content_type / channel / rubric / target_segment / theme / период) и базовыми графиками. Source — `content_metric_snapshot`. На v1 без дашбордов, без BI.

### 7.6. Sidebar реорганизация

См. operating model doc §6. Контент-банк и Войсовер переезжают из «Планирования» в новую секцию «Маркетинг». Routing редиректы для старых URL.

---

## 8. Миграционный план (без поломок текущего пайплайна)

**Принцип:** новая модель сосуществует со старой, миграция данных идёт фоном.

### Phase A — фундамент (не трогает существующий UX)

1. Создать `channel`, `icp_segment`, `strategic_theme`, `channel_budget`, `content_asset`, `content_metric_snapshot`.
2. Сидеть `channel` начальными значениями, соответствующими существующим `network`-строкам.
3. Backfill `content_publication.channel_id`.
4. Расширить enum `content_type` всеми 12 значениями.
5. Добавить `target_segment_id`, `theme_id`, `recipe_state`, `production_started_at` в `content_unit` как nullable.

После Phase A: легаси работает as-is, новые поля доступны.

### Phase B — Strategy + Channels UI

6. Страница `/marketing/strategy` (markdown editor + 3 секции).
7. Страница `/settings/channels`.
8. Sidebar реорганизация.

### Phase C — Recipe engine для одного нового типа (short_post или carousel)

9. Файл `recipes/short_post.yaml` (или `carousel.yaml`) + сервис исполнения recipe.
10. UI карточки `content_unit` — recipe view для типов с recipe (для остальных — fallback на старый production-блок).
11. Endpoint `/api/claude/recipe-step` с роутингом по `(content_type, step_id)`.

### Phase D — Publisher слой + Telegram автопостинг

12. `ChannelPublisher` интерфейс + `TelegramBotPublisher`.
13. Воркер `publishScheduledWorker`.
14. UI для пометки публикации `auto_publish=true`.

### Phase E — Метрики

15. `content_metric_snapshot` UI: «обновить метрики» на странице публикации.
16. Воркер Telegram-метрик.
17. `/marketing/analytics` страница.

### Phase F — Миграция short_video на recipe-модель

18. Recipe `short_video.yaml`, идентичный текущему пайплайну.
19. Перенос Voiceover Studio на recipe-view; legacy endpoints оставить до полной верификации.

### Phase G — Расширение типов

20. Recipes для оставшихся типов по приоритету.

**Никаких разовых big-bang миграций.** Каждая фаза — отдельный план/PR.

---

## 9. Открытые вопросы (для будущих PRD)

- Где визуализировать iterative-learning addenda поперёк всех style_guide_* (общий «обучающий журнал»)?
- Roadmap AI-image-gen для carousel/thumbnails: какой провайдер, как кэшировать, как версионировать. Отложено до момента, когда возникнет реальный контракторный bottleneck по дизайну.
- Email-инфра: при росте — отдельный F-модуль (см. operating model doc). До тех пор — email-newsletter живёт как content_type без доставки.
- Long-video / podcast / stream recipes — приоритет низкий, ждут появления реального production.

---

## 10. Связь с operating model

Этот PRD реализует **модус B** из operating model. Сущности, которые он создаёт и которыми владеет:

- `content_unit` (расширенный), `content_asset`, `content_metric_snapshot`, `content_publication` (мигрированный).

Сущности, которые он **потребляет** (от других модусов):

- `icp_segment`, `strategic_theme` (модус A — owner).
- `channel`, `channel_budget` (shared / модус A).
- `brand_docs.strategy_current`, `brand_docs.style_guide_*` (модус A).

Сущности, **которые он отдаёт** наружу:

- `content_unit` типа `ad_creative` → потребляет модус C (PPC).
- `content_unit` типа `seo_article` → бриф приходит от модуса D (SEO).
- `content_metric_snapshot` → агрегирует модус K (Analytics).

---

## 11. Принципы PRD (для последующих implementation plans)

1. **Сохранять short_video pipeline работающим на каждом шаге.** Никаких миграций, ломающих текущий поток.
2. **Phase A — only schema, no UX change.** Любая Phase, начиная с B, идёт под флагом / отдельной страницей до готовности.
3. **Static YAML recipes до момента, когда мульти-редактирование станет реальной болью.** Не строим recipe-editor «на будущее».
4. **Каждый новый recipe = отдельный PR.** Не batch-merge 5 типов сразу.
5. **AI-assist endpoint — generic с дискриминатором.** Не плодим `/api/claude/short_post_generate`, `/api/claude/carousel_copy_gen`, ...
6. **Чистая стыковка со Strategy через FK.** `target_segment_id` и `theme_id` — single source of truth, никаких дублирующих строковых полей.
