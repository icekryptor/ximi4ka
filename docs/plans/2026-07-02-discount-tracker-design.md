# Трекер платформенных скидок (СПП WB / соинвест Ozon) — Design

**Date:** 2026-07-02
**Источник:** блюпринт пользователя (files.zip: tracker.ts, schema.sql, README) + 4 решения из Q&A.

## Goal

Часовой снапшот витринной цены vs цены продавца по каждому SKU WB и Ozon. Делает невидимую субсидию площадки (СПП/соинвест) измеримой величиной и алертит в Telegram, когда её срезают — ранний сигнал до просадки конверсии.

**Формулы (из блюпринта):**
- WB (публичный `card.wb.ru/cards/v2/detail`, без ключей, батчи по 100 nmId): `seller = price.product/100`, `shelf = price.total/100`, `СПП = (seller − shelf) / seller`
- Ozon (`/v5/product/info/prices`, ключи продавца, cursor-пагинация): `своя скидка = price − marketing_seller_price`, `соинвест = marketing_seller_price − marketing_price`

## Отличия от блюпринта (по Q&A)

| Блюпринт | Решение | Почему |
|---|---|---|
| GitHub Actions | **node-cron в backend Railway** (`0 * * * *`) | Секреты уже там, telegram-хелпер готов, логи в одном месте |
| supabase-js client | **TypeORM / AppDataSource** | Мы внутри того же бэкенда |
| `products.wb_nm_id` | **DISTINCT nm_id из wb_financial_stats (90 дней)** | Таблицы products нет; это живой самоподдерживающийся список. Ограничение: новый товар без продаж не попадёт — задокументировано |
| Свой Telegram-бот | **Существующий `sendMessage()` + env `SPP_ALERT_CHAT_ID`** | |
| Только коллектор | **+ мини-дашборд** `/marketplace/discount-tracker` | |

## Данные (schema.sql блюпринта как есть + entities)

Таблицы `price_snapshots`, `alert_state`, вьюхи `v_price_latest`, `v_spp_delta` — дословно из блюпринта. TypeORM entities `PriceSnapshot`, `AlertState` → зарегистрировать в `allEntities` (в проекте нет glob-discovery).

## Backend

- `services/discount-tracker/wb.prices.ts` — fetchWb(nmIds) по блюпринту
- `services/discount-tracker/ozon.prices.ts` — fetchOzon() по блюпринту; `OZON_PRICES_URL` из env с дефолтом v5 (README предупреждает о v4/v5 — при 404 лог с подсказкой сверить версию); без ключей — ветка молча скипается
- `services/discount-tracker/discount-tracker.service.ts` — runOnce(): nmIds из wb_financial_stats → fetchWb + fetchOzon → insert snapshots → maybeAlert по каждому (порог `ALERT_DROP_PP`, дефолт 5 п.п., анти-спам через alert_state)
- `services/discount-tracker/scheduler.ts` — node-cron `0 * * * *` (по образцу bank-sync/scheduler.ts), старт из server.ts
- Роуты `/api/discount-tracker` (authMiddleware): `GET /latest` (v_price_latest + названия из wb_financial_stats где есть), `GET /history?platform&sku&hours=48`, `GET /alerts` (alert_state по last_alerted desc), `POST /run` (ручной прогон, как bank-sync run)

**Env (добавляет пользователь в Railway):** `OZON_CLIENT_ID`, `OZON_API_KEY`, `SPP_ALERT_CHAT_ID`, опционально `ALERT_DROP_PP`, `OZON_PRICES_URL`. `TELEGRAM_BOT_TOKEN` уже есть.

## Frontend — «Трекер скидок» (`/marketplace/discount-tracker`, сайдбар Маркетплейсы)

- Таблица по v_price_latest: платформа, SKU (+название), цена продавца, витрина, СПП/соинвест %, время снапшота; фильтр платформы; сортировка по platform_pct
- Клик по строке → разворот: история за 48ч (SVG-спарклайн platform_pct + таблица дельт)
- Блок «Последние алерты»
- Кнопка «Запустить сейчас» → POST /run

## Failure handling

| Сбой | Поведение |
|---|---|
| WB card API != 200 | Лог, батч скипается, остальные идут |
| Ozon ключей нет | Ветка отключена молча (лог info) |
| Ozon 404 (версия API) | Лог с подсказкой про OZON_PRICES_URL/v4-v5 |
| Telegram env нет | Алерты скипаются, снапшоты пишутся |
| nmIds пусто | Лог warning, ozon-часть всё равно идёт |
| Повторный алерт | alert_state: пикаем только при новой просадке ≥ порога от последнего зафиксированного уровня |

## Testing

Typecheck, локальный runOnce против живого WB API (публичный), проверка снапшотов в БД, e2e дашборда через Playwright, прод-прогон через POST /run после деплоя.

## v2 (из README, не сейчас)

Дневная сверка баллов по отчёту реализации (`soinvest_reconciliation`), алерт на рост витринной цены, утилизация баллов.
