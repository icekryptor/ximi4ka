-- Production orders + QC (ОТК) tables
-- Схема соответствует entities: SalesChannel, ProductionOrder, QcChecklist, QcInspection

-- Каналы продаж (FK-цель для production_orders.channel_id)
CREATE TABLE IF NOT EXISTS sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  marketplace VARCHAR(30) NOT NULL,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  logistics_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  storage_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  ad_spend_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  return_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Заказы на производство
CREATE TABLE IF NOT EXISTS production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50),
  kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE RESTRICT,
  quantity INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'created',
  channel_id UUID REFERENCES sales_channels(id) ON DELETE SET NULL,
  target_date DATE,
  completed_date DATE,
  fbo_shipment_id VARCHAR(255),
  planned_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(12,2),
  qc_passed INT NOT NULL DEFAULT 0,
  qc_failed INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_kit_id ON production_orders(kit_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_target_date ON production_orders(target_date);

-- Чек-листы ОТК
CREATE TABLE IF NOT EXISTS qc_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  items JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_checklists_kit_id ON qc_checklists(kit_id);

-- Проверки ОТК
CREATE TABLE IF NOT EXISTS qc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  checklist_id UUID REFERENCES qc_checklists(id) ON DELETE SET NULL,
  inspector_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  inspected_qty INT NOT NULL,
  passed_qty INT NOT NULL DEFAULT 0,
  failed_qty INT NOT NULL DEFAULT 0,
  result VARCHAR(20) NOT NULL,
  item_results JSONB NOT NULL DEFAULT '[]',
  defect_description TEXT,
  defect_photos TEXT,
  batch_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_inspections_order_id ON qc_inspections(order_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_result ON qc_inspections(result);
