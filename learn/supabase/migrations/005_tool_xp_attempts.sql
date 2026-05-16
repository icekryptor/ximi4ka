-- Allow task_attempts to record XP earned from interactive tools (no task_id required)
ALTER TABLE task_attempts ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE task_attempts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'lesson' CHECK (source IN ('lesson','tool_lab'));
ALTER TABLE task_attempts ADD COLUMN IF NOT EXISTS tool_meta JSONB;
CREATE INDEX IF NOT EXISTS task_attempts_user_source_idx ON task_attempts (user_id, source);
