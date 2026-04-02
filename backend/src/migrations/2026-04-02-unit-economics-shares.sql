CREATE TABLE unit_economics_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  share_token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ue_shares_token ON unit_economics_shares(share_token);
CREATE INDEX idx_ue_shares_group ON unit_economics_shares(group_id);
