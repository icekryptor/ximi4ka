-- 2026-05-07 content-bank — wipe legacy ContentUnit and create new schema
-- Run on Supabase via SQL console BEFORE deploying backend code.

BEGIN;

-- 1. Wipe legacy
DROP TABLE IF EXISTS content_units CASCADE;

-- 2. Rubrics (CRUD)
CREATE TABLE content_rubrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(100) UNIQUE NOT NULL,
  title         VARCHAR(255) NOT NULL,
  emoji         VARCHAR(8),
  tone          TEXT,
  audience      TEXT,
  cta_template  TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Units (main entity, replaces old content_units)
CREATE TABLE content_units (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id     UUID REFERENCES content_rubrics(id) ON DELETE SET NULL,
  content_type  VARCHAR(20) NOT NULL DEFAULT 'short_video',
  status        VARCHAR(20) NOT NULL DEFAULT 'idea',
  complexity    SMALLINT,
  title         VARCHAR(500) NOT NULL,
  hook          TEXT,
  hook_ab       TEXT,
  visual        TEXT,
  essence       TEXT,
  notes         TEXT,
  video_url     VARCHAR(1000),
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_units_rubric  ON content_units (rubric_id);
CREATE INDEX idx_units_status  ON content_units (status);
CREATE INDEX idx_units_type    ON content_units (content_type);
CREATE INDEX idx_units_created ON content_units (created_at DESC);

-- 4. Publications (per-network rows)
CREATE TABLE content_publications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_unit_id UUID NOT NULL REFERENCES content_units(id) ON DELETE CASCADE,
  network         VARCHAR(50) NOT NULL,
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  published_url   VARCHAR(1000),
  notes           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_unit_id, network)
);
CREATE INDEX idx_publications_unit      ON content_publications (content_unit_id);
CREATE INDEX idx_publications_network   ON content_publications (network);
CREATE INDEX idx_publications_scheduled ON content_publications (scheduled_at);

COMMIT;
