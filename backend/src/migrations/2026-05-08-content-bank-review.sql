-- 2026-05-08 content-bank v2 — review-loop columns + indexes
-- Non-destructive: ADD COLUMN + CREATE INDEX only.
-- Run on Supabase via SQL console BEFORE deploying backend code.

BEGIN;

ALTER TABLE content_units
  ADD COLUMN review_grade   VARCHAR(20),
  ADD COLUMN review_feedback TEXT,
  ADD COLUMN reviewed_at    TIMESTAMPTZ;

CREATE INDEX idx_units_review_grade ON content_units (review_grade);
CREATE INDEX idx_units_reviewed_at  ON content_units (reviewed_at DESC);

COMMIT;
