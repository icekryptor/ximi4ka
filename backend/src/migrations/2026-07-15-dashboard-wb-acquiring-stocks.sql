-- Дашборд WB: эквайринг + факт-комиссия в финотчёте, дневной снапшот остатков.
-- Применено на прод через Supabase apply_migration 2026-07-15 (файл — для истории/reproducibility).

-- ВАЖНО: колонки nullable БЕЗ DEFAULT — NULL = маркер «строка синкалась старым
-- парсером», по которому идёт перечитка истории новым finance-api парсером.
ALTER TABLE wb_financial_stats
  ADD COLUMN IF NOT EXISTS acquiring_cost   numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_fact  numeric(12,2) DEFAULT NULL;

-- Дневной снапшот остатков WB (агрегат по nm_id, склады суммируются).
CREATE TABLE IF NOT EXISTS wb_stock_daily (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date               date NOT NULL,
  nm_id              bigint NOT NULL,
  quantity           int NOT NULL DEFAULT 0,   -- доступно для продажи
  in_way_to_client   int NOT NULL DEFAULT 0,
  in_way_from_client int NOT NULL DEFAULT 0,
  synced_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, nm_id)
);
