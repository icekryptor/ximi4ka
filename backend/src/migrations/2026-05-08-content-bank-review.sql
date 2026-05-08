-- 2026-05-08 content-bank v2 — review-loop columns + indexes
-- Non-destructive: ADD COLUMN + CREATE INDEX only.
-- Idempotent (IF NOT EXISTS) — safe to re-run.
-- Run on Supabase via SQL console BEFORE deploying backend code.

BEGIN;

ALTER TABLE content_units
  ADD COLUMN IF NOT EXISTS review_grade    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS review_feedback TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at     TIMESTAMPTZ;

-- Defense-in-depth: only allow the 3 known grades or NULL (= "not yet reviewed").
-- Catches typos coming from JSON imports (Stage 4).
ALTER TABLE content_units
  DROP CONSTRAINT IF EXISTS content_units_review_grade_chk,
  ADD CONSTRAINT content_units_review_grade_chk
    CHECK (review_grade IS NULL OR review_grade IN ('excellent', 'needs_work', 'rejected'));

-- Filter index: review_grade chip filter + ungraded-count
CREATE INDEX IF NOT EXISTS idx_units_review_grade
  ON content_units (review_grade);

-- Partial index: most rows are NULL until reviewed; only index the reviewed ones.
-- Used for "recently reviewed" sorts (ORDER BY reviewed_at DESC WHERE reviewed_at IS NOT NULL).
CREATE INDEX IF NOT EXISTS idx_units_reviewed_at
  ON content_units (reviewed_at DESC)
  WHERE reviewed_at IS NOT NULL;

COMMIT;
