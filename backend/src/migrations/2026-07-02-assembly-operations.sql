-- Схема сборки: операции поверх BOM (component_parts).
-- Операция привязана к КОМПОЗИТУ (сущности, которую производит), не к ребру:
-- у узла может быть несколько операций (розлив + закупорка), стоимость работы
-- узла = Σ time_seconds/3600 × ставка (app_settings.labor_rate_per_hour).

CREATE TABLE IF NOT EXISTS assembly_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_id uuid NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  stage int NOT NULL DEFAULT 0,
  time_seconds int,
  instruction_slug varchar(100),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assembly_ops_composite ON assembly_operations (composite_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key varchar(100) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO app_settings (key, value) VALUES ('labor_rate_per_hour', '500')
ON CONFLICT (key) DO NOTHING;
