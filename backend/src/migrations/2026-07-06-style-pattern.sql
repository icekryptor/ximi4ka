CREATE TABLE IF NOT EXISTS style_pattern (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format varchar(50) NOT NULL,           -- content_type (short_post, ...)
  code varchar(16) NOT NULL,             -- А11 | С10 | Э8 ...
  title varchar(255) NOT NULL,
  before text,                           -- «как НЕ надо»
  after text,                            -- «как надо»
  rationale text NOT NULL,
  source_note text,                      -- контекст правки (откуда правило)
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_style_pattern_format ON style_pattern (format);
