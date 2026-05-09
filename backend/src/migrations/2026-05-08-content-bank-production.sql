-- 2026-05-08 content-bank production block
-- Adds 4 nullable columns and a partial index. Idempotent.

ALTER TABLE content_units
  ADD COLUMN IF NOT EXISTS script_text     text,
  ADD COLUMN IF NOT EXISTS video_brief     text,
  ADD COLUMN IF NOT EXISTS voiceover_text  text,
  ADD COLUMN IF NOT EXISTS ready_at        timestamptz;

-- Partial index — backlog without a planned date is the majority,
-- there's no benefit indexing the NULLs.
CREATE INDEX IF NOT EXISTS idx_content_units_ready_at
  ON content_units (ready_at) WHERE ready_at IS NOT NULL;
