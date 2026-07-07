# Фактическая СПП по заказам — Design (2026-07-07)

## Идея
Точная СПП = разница между ценой продавца и ценой, по которой **конкретный заказ**
оформил покупатель (факт, а не синтетическая анонимная витрина). Ниже частота
(ежедневно, не почасово), выше достоверность — «что реально у людей».

Решения (согласовано): гранулярность — **и по заказам, и дневные агрегаты**;
охват — **WB сначала, Ozon следом**; текущий скрейп витрины — **убрать**;
`price_snapshots` — историю оставить (перестаём писать).

## Источник WB (без скрейпа/релея)
Statistics API `GET /api/v1/supplier/orders?dateFrom=` (тот же токен, скоуп «Статистика»).
По каждому заказу: `spp` (% СПП), `finishedPrice` (цена покупателя), `priceWithDisc`
(цена продавца), `totalPrice`, `regionName`, `srid` (id заказа), `isCancel`, `date`.
СПП берём напрямую из `spp` (официальное значение WB); дублируем расчётом
`1 − finishedPrice/priceWithDisc` для сверки.

## Данные
**Таблица `spp_order`** (факт по заказу):
```
id uuid PK,
platform varchar(8),         -- 'wb' | 'ozon'
nm_id varchar(32),           -- артикул
order_id varchar(64),        -- srid (WB) / posting (Ozon) — уник в паре с platform
order_date date,
seller_price numeric,        -- priceWithDisc
buyer_price numeric,         -- finishedPrice
spp_pct numeric,             -- доля 0..1 (spp/100)
region varchar(128) null,
is_cancel boolean default false,
raw jsonb,
synced_at timestamptz default now()
UNIQUE (platform, order_id)
```
Индексы: `(platform, nm_id, order_date)`, `(order_date)`.

**View `v_spp_daily`** — агрегаты по `(platform, nm_id, order_date)`:
count, avg/median(percentile_cont 0.5)/min/max spp_pct, avg buyer/seller price
(только не отменённые: `is_cancel=false`).

## Backend
- `wb-api.service`: метод `fetchOrders(dateFrom)` → пагинация по `lastChangeDate`
  (WB отдаёт до 80k строк, инкремент по последней дате).
- `services/spp-orders/spp-orders.service.ts`:
  - `syncWbOrders(days=14)` → fetch → map → upsert `spp_order` (ON CONFLICT (platform,order_id)).
  - `dailyRows(platform?, days)` → из `v_spp_daily` + product_name (LEFT JOIN wb_financial_stats).
  - `orderRows(platform, nm_id, date)` → сырьё по заказам (для распределения).
- Контроллер (расширяем discount-tracker.controller): `spp/daily`, `spp/orders`, `spp/sync`.
  Публичный `GET /api/public/spp/:token` — репойнт на `dailyRows('wb')` (только WB).
- Крон: заменить `*/5` витрины на `0 */4 * * *` (4×/день) синк заказов.
  «Собрать сейчас» → `syncWbOrders`.
- Убрать из планировщика/пайплайна скрейп витрины (`wb.prices.ts`). `discount-tracker.service.runOnce`
  (снапшоты витрины) больше не вызывается; файлы скрейпа удаляем (WB) — Ozon.prices остаётся до этапа 2 (не активен).

## Frontend
Данные дневные → день×час heatmap не подходит. Новое:
- **Дневная тепловая карта** СПП: строки — артикулы (вкладки на публичной), столбцы — дни,
  ячейка = средняя дневная СПП (переиспользуем аккуратные плитки `NeatHeatGrid`,
  вариант «день-столбец × артикул/строка»). Тултип — медиана, min–max, кол-во заказов.
- **Дневная таблица** по SKU: дата, заказов, средняя/медиана/min–max СПП, ср. цена покупателя.
- **Распределение по заказам** (drill-down по ячейке/дню): список/мини-гистограмма СПП заказов
  + регион — «что у людей».
- Публичная страница (WB-only) и админка — на этих данных.

## Тест
Локальный синк (мок WB orders) → upsert/дедуп по srid → v_spp_daily агрегаты
(avg/median/min/max). Прод-smoke: реальный синк, проверка чисел. Playwright: страницы.

## Ozon (этап 2, не сейчас)
`spp_order` та же. Источник — `/v2/finance/realization` (per-item) или `/v3/posting/*`
`financial_data.products[].price` (цена покупателя) − цена продавца = соинвест.
