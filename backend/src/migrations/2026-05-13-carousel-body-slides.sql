-- Carousel body text + slides[] for content_type = 'carousel'
--
-- Both columns are nullable: non-carousel content_types leave them NULL.
-- slides is jsonb with shape: [{text: string, visual: string}, ...]
-- Empty slides (both fields blank) are filtered out at write time by the controller.

ALTER TABLE content_units
  ADD COLUMN IF NOT EXISTS body_caption text,
  ADD COLUMN IF NOT EXISTS slides       jsonb;
