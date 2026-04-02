ALTER TABLE unit_economics_calculations ADD COLUMN IF NOT EXISTS group_id UUID DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_unit_economics_group_id ON unit_economics_calculations(group_id);
