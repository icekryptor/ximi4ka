-- OKR → Projects/Tasks soft-reference link.
--
-- okr_kr_id — composite KR id from frontend OKR parser ("Q2-2026-O1-KR1").
-- KR is a markdown structure in brand_docs.okr_2026_2027, NOT a DB entity,
-- so this is a soft-reference (not FK). Dangling refs are accepted as MVP
-- trade-off (see design doc §«Soft-reference trade-offs»).
--
-- Partial indexes — most projects/tasks won't be linked. Index stays small
-- (~10-100 rows vs thousands) and fast for GROUP BY aggregation in the
-- counts endpoint.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS okr_kr_id varchar(64);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS okr_kr_id varchar(64);

CREATE INDEX IF NOT EXISTS idx_projects_okr_kr_id
  ON projects (okr_kr_id) WHERE okr_kr_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_okr_kr_id
  ON tasks (okr_kr_id) WHERE okr_kr_id IS NOT NULL;
