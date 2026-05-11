-- 2026-05-11 Marketing Phase A — backfill content_publications.channel_id
-- Apply in Supabase SQL Editor AFTER `seed:channels` has run.
-- Safe to re-run: WHERE channel_id IS NULL ensures we don't overwrite.

BEGIN;

UPDATE content_publications cp
SET channel_id = c.id
FROM channel c
WHERE cp.channel_id IS NULL
  AND cp.network = c.slug;

-- Report orphans (publications whose network has no matching channel.slug).
-- If this returns rows, fix by adding the missing channel via seed, re-run backfill.
SELECT cp.id, cp.network, cp.published_url
FROM content_publications cp
WHERE cp.channel_id IS NULL;

COMMIT;
