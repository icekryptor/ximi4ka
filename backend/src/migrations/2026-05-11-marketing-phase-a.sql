-- 2026-05-11 Marketing Phase A — schema foundation
-- Apply in Supabase SQL Editor BEFORE deploying backend code.
-- All operations idempotent / safe to re-run.

BEGIN;

-- =========================================================
-- 1. icp_segment — strategic ICP taxonomy
-- =========================================================
CREATE TABLE IF NOT EXISTS icp_segment (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(80) UNIQUE NOT NULL,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  age_range   VARCHAR(50),
  role        VARCHAR(80),
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_icp_segment_active ON icp_segment (active);

-- =========================================================
-- 2. strategic_theme — quarterly themes
-- =========================================================
CREATE TABLE IF NOT EXISTS strategic_theme (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         VARCHAR(80) UNIQUE NOT NULL,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  active_from  DATE,
  active_to    DATE,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_strategic_theme_active
  ON strategic_theme (active_from, active_to);

-- =========================================================
-- 3. channel — first-class publishing channels
-- =========================================================
CREATE TABLE IF NOT EXISTS channel (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                VARCHAR(80) UNIQUE NOT NULL,
  display_name        VARCHAR(200) NOT NULL,
  platform            VARCHAR(40) NOT NULL,
  account_handle      VARCHAR(120),
  profile_url         VARCHAR(500),
  integration_status  VARCHAR(20) NOT NULL DEFAULT 'manual',
  active              BOOLEAN NOT NULL DEFAULT true,
  config_json         JSONB,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_platform ON channel (platform);
CREATE INDEX IF NOT EXISTS idx_channel_active ON channel (active);

-- =========================================================
-- 4. channel_budget — period budgets per channel
-- =========================================================
CREATE TABLE IF NOT EXISTS channel_budget (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    UUID NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  amount_rub    NUMERIC(14, 2) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS idx_channel_budget_channel ON channel_budget (channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_budget_period
  ON channel_budget (period_start, period_end);

-- =========================================================
-- 5. content_asset — production artifacts
-- =========================================================
CREATE TABLE IF NOT EXISTS content_asset (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_unit_id UUID NOT NULL REFERENCES content_units(id) ON DELETE CASCADE,
  recipe_step_id  VARCHAR(80),
  kind            VARCHAR(40) NOT NULL,
  storage         VARCHAR(20) NOT NULL,
  path_or_url     TEXT NOT NULL,
  size_bytes      BIGINT,
  mime            VARCHAR(120),
  provider_hint   VARCHAR(40),
  version         INT NOT NULL DEFAULT 1,
  superseded_by   UUID REFERENCES content_asset(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      VARCHAR(120)
);
CREATE INDEX IF NOT EXISTS idx_content_asset_unit ON content_asset (content_unit_id);
CREATE INDEX IF NOT EXISTS idx_content_asset_step ON content_asset (recipe_step_id);
CREATE INDEX IF NOT EXISTS idx_content_asset_kind ON content_asset (kind);

-- =========================================================
-- 6. content_metric_snapshot — per-publication metric snapshots
-- =========================================================
CREATE TABLE IF NOT EXISTS content_metric_snapshot (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id      UUID NOT NULL REFERENCES content_publications(id) ON DELETE CASCADE,
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by         VARCHAR(20) NOT NULL DEFAULT 'manual',
  views               INT,
  likes               INT,
  comments            INT,
  shares              INT,
  saves               INT,
  profile_clicks      INT,
  marketplace_clicks  INT,
  raw_json            JSONB
);
CREATE INDEX IF NOT EXISTS idx_metric_snapshot_publication
  ON content_metric_snapshot (publication_id);
CREATE INDEX IF NOT EXISTS idx_metric_snapshot_captured
  ON content_metric_snapshot (captured_at DESC);

-- =========================================================
-- 7. content_units — strategy FK + recipe state
-- =========================================================
ALTER TABLE content_units
  ADD COLUMN IF NOT EXISTS target_segment_id     UUID REFERENCES icp_segment(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS theme_id              UUID REFERENCES strategic_theme(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipe_state          JSONB,
  ADD COLUMN IF NOT EXISTS production_started_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_units_segment ON content_units (target_segment_id);
CREATE INDEX IF NOT EXISTS idx_units_theme   ON content_units (theme_id);

-- =========================================================
-- 8. content_publications — channel FK (nullable for now) + publisher fields
-- =========================================================
ALTER TABLE content_publications
  ADD COLUMN IF NOT EXISTS channel_id     UUID REFERENCES channel(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS auto_publish   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publisher_log  JSONB;
CREATE INDEX IF NOT EXISTS idx_publications_channel ON content_publications (channel_id);
-- NOTE: column `network` is NOT dropped here; backfill happens in Task 6,
-- NOT NULL + drop happens in a separate later migration after verification.

COMMIT;
