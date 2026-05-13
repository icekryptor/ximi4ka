-- Marketing perf indexes (R2 from 2026-05-13 marketing refactor)
--
-- listByPublication and the analytics CTE both do
--   SELECT … WHERE publication_id = ? ORDER BY captured_at DESC
-- (or DISTINCT ON (publication_id) ORDER BY publication_id, captured_at DESC).
-- A composite (publication_id, captured_at DESC) lets Postgres satisfy both
-- with an index-only scan and removes the sort step.
--
-- The existing single-column idx_metric_snapshot_publication is a left prefix
-- of the composite, so the composite fully replaces it.

CREATE INDEX IF NOT EXISTS idx_metric_snapshot_pub_captured
  ON content_metric_snapshot (publication_id, captured_at DESC);

DROP INDEX IF EXISTS idx_metric_snapshot_publication;
