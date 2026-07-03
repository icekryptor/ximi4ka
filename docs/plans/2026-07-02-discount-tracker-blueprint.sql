-- ============================================================
--  СПП / Соинвест tracker — схема для Supabase (проект jubkezbvccwvujregkfq)
--  Часовые снапшоты цены на витрине vs цены продавца по SKU.
-- ============================================================

create table if not exists price_snapshots (
  id            bigint generated always as identity primary key,
  captured_at   timestamptz not null default now(),
  platform      text        not null check (platform in ('wb','ozon')),
  sku           text        not null,          -- nmId (WB) | offer_id (Ozon)
  seller_price  numeric,                        -- цена продавца (база комиссии, до СПП/соинвеста)
  shelf_price   numeric,                        -- цена на витрине (что видит покупатель)
  own_discount  numeric,                        -- своя скидка (руб), только Ozon разводит явно
  platform_disc numeric,                        -- доля площадки: СПП (WB) / соинвест на витрине (Ozon), руб
  discount_pct  numeric,                        -- 1 - shelf/seller, доля общей скидки
  platform_pct  numeric,                        -- platform_disc / seller_price — «чистая» СПП/соинвест
  raw           jsonb                           -- сырой ответ на случай разбора
);

create index if not exists idx_snap_sku_time
  on price_snapshots (platform, sku, captured_at desc);

-- Последний снапшот по каждому SKU
create or replace view v_price_latest as
select distinct on (platform, sku)
  platform, sku, captured_at, seller_price, shelf_price,
  platform_disc, platform_pct, discount_pct
from price_snapshots
order by platform, sku, captured_at desc;

-- Часовая динамика СПП/соинвеста: текущий снапшот и дельта к предыдущему
create or replace view v_spp_delta as
select
  platform, sku, captured_at,
  seller_price, shelf_price, platform_pct,
  platform_pct - lag(platform_pct) over w      as pct_delta,      -- изменение доли площадки, п.п. (в долях)
  shelf_price  - lag(shelf_price)  over w       as shelf_delta,    -- изменение витринной цены, руб
  lag(captured_at) over w                       as prev_at
from price_snapshots
window w as (partition by platform, sku order by captured_at)
order by platform, sku, captured_at desc;

-- Память алертов, чтобы не спамить об одном и том же событии
create table if not exists alert_state (
  platform     text not null,
  sku          text not null,
  last_pct     numeric,
  last_alerted timestamptz,
  primary key (platform, sku)
);
