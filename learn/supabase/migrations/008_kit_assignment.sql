ALTER TABLE kit_credentials
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_telegram TEXT,
  ADD COLUMN IF NOT EXISTS external_order_id TEXT;

CREATE INDEX IF NOT EXISTS kit_credentials_assignment_idx ON kit_credentials (batch_id, assigned_at);
CREATE INDEX IF NOT EXISTS kit_credentials_order_idx ON kit_credentials (external_order_id) WHERE external_order_id IS NOT NULL;
