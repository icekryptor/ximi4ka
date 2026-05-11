# Marketing Unit — Operating Model Design

**Date:** 2026-05-11
**Status:** Brainstorm finalized, ready for implementation planning
**Scope:** Карта модусов маркетинг-юнита XimOS, их границы, связи и cross-cutting слой аналитики.
**Companion doc:** [2026-05-11-content-production-prd-design.md](2026-05-11-content-production-prd-design.md)

---

## 1. Цель документа

Зафиксировать **операционную модель Marketing-юнита** XimOS: какие модусы (sub-modules) входят, какие отложены, как они взаимодействуют, какие данные шарят. Это парент-документ для всех будущих PRD внутри юнита — первый из них (контент-маркетинг) проектируется параллельно.

Документ намеренно избегает деталей реализации каждого модуса (это задача отдельных PRD) и фиксирует только границы и контракты.

---

## 2. Карта модусов

```
                      ┌──────────────────────────────┐
                      │ A. Маркетинг-стратегия        │
                      │   (парент, диктует приоритеты)│
                      └──────────────┬───────────────┘
                                     │
            ┌───────────┬────────────┼────────────┬───────────┐
            │           │            │            │           │
            ▼           ▼            ▼            ▼           ▼
      ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
      │ B.      │ │ C. PPC / │ │ D. SEO  │ │ G.       │ │ H.       │
      │ Контент-│ │ Платная  │ │         │ │ Influen- │ │ Community│
      │ марке-  │ │ реклама  │ │         │ │ cer      │ │          │
      │ тинг    │ │          │ │         │ │          │ │          │
      └────┬────┘ └────┬─────┘ └────┬────┘ └─────┬────┘ └────┬─────┘
           │           │            │            │           │
           └───────────┴────────────┼────────────┴───────────┘
                                    │
                          ┌─────────▼──────────┐
                          │ K. Маркетинг-      │
                          │ аналитика          │
                          │ (cross-cutting)    │
                          └────────────────────┘
```

**Cut модусы:** E (PR), F (CRM/Email как отдельный юнит), I (Affiliate), J (Event-маркетинг). Решение зафиксировано — возвращаемся, только когда появится реальный сигнал «нам это нужно».

---

## 3. Модусы — границы ответственности

### A. Маркетинг-стратегия (парент)

**Назначение:** задаёт ICP, темы, бюджеты, годовые цели. Тактические модусы консьюмят её программно (через FK) и через AI-промпты (через `brand_docs`).

**Структурированный слой (в БД):**

| Сущность | Поля | Использование |
|---|---|---|
| `icp_segment` | id, slug, name, description, age_range, role | FK из `content_unit.target_segment_id`, `ad_campaign.target_segment_id` |
| `strategic_theme` | id, slug, name, description, active_from, active_to | FK из `content_unit.theme_id` (optional) |
| `channel_budget` | id, channel_id, period_start, period_end, amount_rub, notes | Сверка с фактом из C (PPC) и K (analytics) |

**Свободный слой (в `brand_docs`):**

- `strategy_current` — markdown: positioning, JTBD, vision, competitor map, годовые цели, narrative. Версионируется как `style_guide_video` (см. Voiceover Studio).
- AI-промпты тактических модусов читают этот документ для контекста (например, концептуальный шаг контент-юнита получает «о чём бизнес» бесплатно).

**Не в скоупе A:** ценообразование (Финансы), product roadmap (отдельный домен), HR.

---

### B. Контент-маркетинг

**Назначение:** производство всех типов контента под органические каналы (12 форматов, см. контент-PRD).

**Входы из A:** `icp_segment`, `strategic_theme` (тегаются на каждый `content_unit`); `strategy_current.md` (читается AI-промптом на стадии «Концепт»).

**Выходы для K:** `ContentPublication` + `content_metric_snapshot`.

**Boundary с C, D, G:**
- B vs C — B не делает оплачиваемую рекламу. Если у контент-юнита есть бюджет на промо — он принадлежит C, B готовит креатив.
- B vs D — SEO-статьи делаются внутри B как content_type=`seo_article`. Keyword research, технический SEO, индексирование — задача D, статьи как формат — B.
- B vs G — посты блогеров производятся блогером, не нами; B хранит только бриф и URL-результат, реальная работа в G.

**Полный PRD:** [2026-05-11-content-production-prd-design.md](2026-05-11-content-production-prd-design.md).

---

### C. PPC / платная реклама

**v1 скоуп:** WB Реклама (страница уже есть в /sales-channels), Ozon Реклама, Яндекс Директ, VK Ads.

**Сущности (PRD позже):**
- `ad_campaign` (channel_id, target_segment_id, budget, period, status, kpi_target)
- `ad_spend_fact` (campaign_id, day, amount_rub) — заливается импортом отчётов из рекламных кабинетов
- `ad_creative` (ссылка на `content_unit` с типом `ad_creative` из B)

**Boundary с B:** PPC потребляет креативы из контент-банка (`content_type='ad_creative'`), не производит их сам.

**Boundary с A:** PPC сверяется с `channel_budget` за период; превышение бюджета — алерт, не блокировка.

**Status:** существует страница WB Рекламы. Остальное — в очередь после контент-юнита.

---

### D. SEO

**v1 скоуп:** keyword research + content brief для SEO-статей + позиции в Яндекс/Google + индексирование.

**Сущности (PRD позже):**
- `seo_keyword` (text, search_volume, difficulty, target_url, priority)
- `seo_position_snapshot` (keyword_id, day, search_engine, position)
- `seo_brief` (keyword_id → `content_unit`)

**Boundary с B:** SEO задаёт ключи и бриф, B пишет SEO-статью (тип `seo_article`), результат публикуется (как правило, на сайт/Дзен — внешний канал).

**Status:** в очередь.

---

### G. Influencer-маркетинг

**v1 скоуп:** реестр блогеров, переговоры, бриф, оплата, отчёт по интеграции.

**Сущности (PRD позже):**
- `influencer` (name, platforms, audience_size, contact, niche, rate_card)
- `influencer_campaign` (influencer_id, brief_link, status, fee_rub, content_unit_id если применимо, published_url, results)

**Boundary с B:** если блогер публикует наш креатив — он живёт как `content_unit` с executor=`contractor`. Если блогер делает свой контент о нас — это только запись в G с URL.

**Boundary с H:** Influencer — платное сотрудничество с автором. Community — взаимодействие с аудиторией. Не пересекаются.

**Status:** в очередь.

---

### H. Community-менеджмент

**v1 скоуп:** Telegram-чат(ы), модерация комментов в соц-сетях, обработка UGC.

**Сущности (PRD позже):**
- `community_thread` (channel_id, topic, started_at, status)
- `ugc_item` (source_url, type, author_hint, status, used_in_content_unit_id если переиспользовали)

**Boundary с B:** UGC может стать материалом для контента — связь через `used_in_content_unit_id`. Сам UGC — артефакт H.

**Status:** в очередь.

---

### K. Маркетинг-аналитика (cross-cutting)

**Назначение:** сводный слой, режущий контент/каналы/кампании по измерениям из A.

**v1 скоуп:**
- Сбор: `content_metric_snapshot` (см. контент-PRD), `ad_spend_fact` (из C), `seo_position_snapshot` (из D).
- Срезы: по `content_type`, `channel_id`, `rubric_id`, `target_segment_id` (FK на icp_segment), `theme_id` (FK на strategic_theme), периоду.
- Метрики: views / engagement / clicks (для контента), spend / impressions / clicks / CPM (для PPC), positions (для SEO).
- Telegram-метрики собираются автоматически фоновым воркером (Bot API). Остальные каналы — ручной ввод раз в неделю в UI.

**Не на v1:**
- ROAS / attribution (на маркетплейсах в РФ source трафика недоступен — врать цифрами не будем).
- LTV / CAC / cohort analysis (нет user-level данных).
- Marketing-mix modeling.

**Возврат к этим вопросам:** когда появится свой сайт с UTM или промокоды-per-channel. До тех пор — описательная аналитика без претензии на attribution.

---

## 4. Cross-module контракты — что шарится

| Сущность | Owner | Consumers |
|---|---|---|
| `icp_segment` | A | B (content_unit.target_segment_id), C (ad_campaign.target_segment_id), K (срез) |
| `strategic_theme` | A | B (content_unit.theme_id), K (срез) |
| `channel` (first-class) | shared / B&C | B (ContentPublication.channel_id), C (ad_campaign.channel_id), K (срез), Publisher слой |
| `channel_budget` | A | C (сверка), K (план vs факт) |
| `content_unit` | B | C (ad_creative), G (если блогер постит наш креатив), H (если UGC→контент) |
| `content_metric_snapshot` | B | K (агрегаты) |
| `ad_spend_fact` | C | K (агрегаты) |
| `brand_docs.strategy_current` | A | AI-промпты в B (concept stage) |

---

## 5. Что строится в фазе 1 vs позже

### Фаза 1 (вместе с контент-PRD)

- `icp_segment`, `strategic_theme`, `channel_budget` — три таблицы + один экран в `/marketing/strategy` (markdown editor + три табличных секции).
- `channel` — first-class сущность (минимум полей: id, slug, display_name, platform, account_handle, profile_url, integration_status, active). Экран `/settings/channels`. Миграция `ContentPublication.network` string → `channel_id` FK с backfill.
- Скелет `/marketing` в сайдбаре с подразделами: `Стратегия`, `Контент-банк` (существующий, переезжает из «Планирования»), `Аналитика` (placeholder).
- `content_metric_snapshot` + UI заполнения + Telegram-воркер для автозабора.
- Markdown `brand_docs.strategy_current` создаётся (v1.0).

### Фаза 2 (отдельные PRD)

- C — PPC консолидированный (WB Реклама уже есть, добавляются Ozon/Директ/VK).
- D — SEO модус.
- Расширение Publisher: VK API, YouTube API.

### Фаза 3 (позже)

- G — Influencer.
- H — Community.
- ROAS / attribution (когда станет возможно технически).

---

## 6. Изменения в навигации XimOS

**Текущая структура (Layout.tsx):**

```
1. Обзор → Дашборд
2. Финансы
3. Себестоимость
4. Закупки
5. Производство
6. Планирование → Направления, Регулярные задачи, Проекты, Канбан, Контент-банк, Войсовер
7. Маркетплейсы
8. Настройки
```

**После фазы 1:**

```
1. Обзор
2. Финансы
3. Себестоимость
4. Закупки
5. Производство
6. Планирование → Направления, Регулярные задачи, Проекты, Канбан
7. Маркетинг → Стратегия, Контент-банк, Войсовер, Аналитика
8. Маркетплейсы
9. Настройки → Сотрудники, Каналы продаж, Каналы публикации
```

**Migration concern:** Контент-банк и Войсовер живут под «Планированием». Их переезд под «Маркетинг» — простой routing change + sidebar edit, БД не трогаем. Старые URL редиректить на новые. Risk низкий.

---

## 7. Источники истины (single source of truth)

| Домен | Где живёт | Кто пишет |
|---|---|---|
| Текстовая стратегия (vision, JTBD, positioning) | `brand_docs.strategy_current` (markdown) | Оператор вручную |
| Style guide per формат (video/text/carousel/email) | `brand_docs.style_guide_*` | Оператор + iterative learning loop из AI-стадий |
| ICP, темы, бюджеты | `icp_segment`, `strategic_theme`, `channel_budget` (БД) | Оператор |
| Каналы публикации | `channel` (БД) | Оператор (через `/settings/channels`) |
| Контентные единицы | `content_unit` (БД) | Оператор + AI + подрядчики |
| Метрики публикации | `content_metric_snapshot` (БД) | Воркер для Telegram + оператор для остального |

---

## 8. Открытые вопросы для следующих PRD

Сознательно не решённые в этом документе и переданные в соответствующие PRD:

- **Контент-PRD** (есть): полная модель данных, recipes per type, AI-assist patterns, миграция.
- **PPC-PRD** (позже): структура `ad_campaign`, импорт отчётов из рекламных кабинетов, креатив-bridge с контент-банком.
- **SEO-PRD** (позже): источник keyword data (Wordstat? Serpstat? KeySo?), частота снимков позиций.
- **Strategy-расширение** (когда понадобится): OKR-таблица, годовой план, P&L-стыковка с финансовым модулем.
- **Influencer-PRD** (позже): payment flow, KPI и отчётность по интеграциям.
- **Community-PRD** (позже): интеграция Telegram-чата, модерация-toolset.

---

## 9. Принципы дизайна (для всех PRD внутри юнита)

1. **YAGNI.** Не строим под несуществующую сложность. Стратегия — light caркас, аналитика — без attribution, RBAC — отсутствует.
2. **Executor-абстракция везде, где есть исполнение.** `{ self | ai_agent | contractor }` — единая модель для контент-юнита, PPC-креативов, influencer-кампаний.
3. **AI как first-class executor.** Voiceover Studio — прецедент. Новые типы контента следуют той же логике: generate → factcheck → style → preprocess, с iterative learning для каждой стилевой области.
4. **Каналы — first-class entity.** Не строки.
5. **Аналитика честная или никакая.** Если измерение невозможно — не моделируем, не показываем.
6. **Markdown в brand_docs — для всего, что один человек один раз пишет в свободной форме.** AI-промпты подтягивают.
