# Дэшборд аналитики маркетплейсов (WB + Ozon) — Design (2026-07-07)

**Цель:** годовой дэшборд «продажи + воронка» по WB (v1) и Ozon (этап 2),
данные ежедневно через API. Образец — гугл-таблица «Аналитика продаж лето 26»
(дневная выручка по продуктам + итоги/доли) и xlsx «Воронка продаж».

## Ключевой вывод
WB `nm-report/detail/history` и Ozon `/v1/analytics/data` дают **одинаковую форму**:
день × SKU → воронка (показы→корзина→заказ→выкуп, конверсии) + продажи (₽/шт).
Поэтому — **одна таблица `mp_funnel_daily`** с `platform`, дэшборд платформо-агностичный.

## Данные: таблица `mp_funnel_daily`
```
id uuid PK,
platform varchar(8),      -- 'wb' | 'ozon'
date date,
sku varchar(32),          -- nmId (WB) / sku (Ozon)
views numeric,            -- показы (openCardCount / hits_view)
cart numeric,             -- положили в корзину (addToCartCount / hits_tocart)
orders_count numeric,     -- заказали, шт (ordersCount / ordered_units)
orders_sum numeric,       -- заказали на сумму, ₽ (ordersSumRub / revenue)
buyouts_count numeric,    -- выкупили, шт
buyouts_sum numeric,      -- выкупили на сумму, ₽
cancels_count numeric,    -- отмены
returns_count numeric,    -- возвраты (Ozon)
cart_conv numeric,        -- конверсия в корзину, %
order_conv numeric,       -- конверсия в заказ, %
buyout_percent numeric,   -- % выкупа
avg_price numeric,        -- средняя цена
stock_end numeric,        -- остаток на конец
raw jsonb,
synced_at timestamptz default now()
UNIQUE (platform, sku, date)
```
Индексы: `(platform, sku, date)`, `(platform, date)`.
Дневные/недельные/месячные сводки — агрегатами в запросах (view/SQL), не отдельными таблицами.

## Backend
- `wb-api.service.getNmReportHistory(nmIds, begin, end)` →
  `POST https://seller-analytics-api.wildberries.ru/api/v2/nm-report/detail/history`
  body `{ nmIDs, period:{begin,end}, aggregationLevel:'day' }`. Поля истории:
  dt, openCardCount, addToCartCount, ordersCount, ordersSumRub, buyoutsCount,
  buyoutsSumRub, cancelCount, addToCartConversion, cartToOrderConversion,
  buyoutPercent (имена сверить на первом синке — храним raw). Лимит ~3 req/min → суточный крон ок.
- `services/mp-analytics/mp-analytics.service.ts`:
  - `syncWbFunnel(days)` → fetch → map → upsert `mp_funnel_daily` (ON CONFLICT platform,sku,date).
  - `dailyRows(platform, days)` → таймсерия + product_name.
  - `summaryByProduct(platform, days)` → итоги по SKU (сумма заказов, кол-во, доля %, выкупы) + сравнение к пред. периоду.
- Контроллер+роуты `/api/mp-analytics/{daily,summary,sync}` (sync — fire-and-forget).
- Крон раз в день (отдельно/рядом со spp-крон).

## Frontend — страница «Аналитика» (Маркетплейсы), вкладки WB/Ozon
- **Итоги по продуктам:** сумма заказов ₽, кол-во, доля %, выкупы (как в гугл-таблице).
- **Дневная выручка по продуктам:** таблица/график (заказы + выкупы), по дням.
- **Воронка:** показы → CTR/переходы → корзина → заказ → выкуп + конверсии, % выкупа;
  сравнение период-к-периоду. Имена продуктов из product_name.

## Ozon (этап 2)
`POST /v1/analytics/data` (Client-Id/Api-Key), dimensions=[sku, day],
metrics=[hits_view, hits_tocart, ordered_units, revenue, cancellations, returns,
conv_tocart, ...] → та же `mp_funnel_daily` (platform='ozon').

## Тест
typecheck; первый реальный синк (крон/ручной) — сверить имена полей WB + числа с xlsx;
Playwright: страница рендерит итоги/таймсерию/воронку.
ВАЖНО: WB API сейчас под самонаведённым rate-limit (см. spp) — живой тест после остывания.
