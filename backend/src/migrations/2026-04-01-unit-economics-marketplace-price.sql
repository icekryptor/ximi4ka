-- Add marketplace_price column to unit_economics_calculations
ALTER TABLE unit_economics_calculations
ADD COLUMN IF NOT EXISTS marketplace_price DECIMAL(12, 2) DEFAULT NULL;
