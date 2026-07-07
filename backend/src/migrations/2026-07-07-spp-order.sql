-- Фактическая СПП по заказам: сырьё по заказам + дневные агрегаты (view).
CREATE TABLE IF NOT EXISTS spp_order (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform     varchar(8)  NOT NULL,          -- 'wb' | 'ozon'
  nm_id        varchar(32) NOT NULL,          -- артикул
  order_id     varchar(64) NOT NULL,          -- srid (WB) / posting (Ozon)
  order_date   date        NOT NULL,
  seller_price numeric,                        -- priceWithDisc (цена продавца)
  buyer_price  numeric,                        -- finishedPrice (цена покупателя)
  spp_pct      numeric,                        -- доля 0..1
  region       varchar(128),
  is_cancel    boolean     NOT NULL DEFAULT false,
  raw          jsonb,
  synced_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_spp_order UNIQUE (platform, order_id)
);

CREATE INDEX IF NOT EXISTS idx_spp_order_sku_date ON spp_order (platform, nm_id, order_date);
CREATE INDEX IF NOT EXISTS idx_spp_order_date ON spp_order (order_date);

-- Дневные агрегаты по (platform, nm_id, day) — только не отменённые заказы.
CREATE OR REPLACE VIEW v_spp_daily AS
SELECT
  platform,
  nm_id,
  order_date,
  count(*)                                                    AS orders_count,
  avg(spp_pct)                                               AS avg_spp_pct,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY spp_pct)       AS median_spp_pct,
  min(spp_pct)                                               AS min_spp_pct,
  max(spp_pct)                                               AS max_spp_pct,
  avg(buyer_price)                                           AS avg_buyer_price,
  avg(seller_price)                                          AS avg_seller_price
FROM spp_order
WHERE is_cancel = false AND spp_pct IS NOT NULL
GROUP BY platform, nm_id, order_date;
