-- Brand-doc taxonomy: style (per network cluster) + format (per content_type).
--
-- Slugs are added alongside existing docs (no renames) so agent_scriptwriter_prompt
-- continues to reference style_guide_video / style_guide_text without breakage.
--
-- Each row is seeded with empty content. Operator fills via UI on /marketing-strategy.
-- ON CONFLICT DO NOTHING preserves any existing rows (e.g. style_guide_carousel
-- already exists with empty content from a previous migration — it stays).

INSERT INTO brand_docs (slug, title, content) VALUES
  ('style_instagram',       'Стиль: Instagram',           ''),
  ('style_tiktok_youtube',  'Стиль: TikTok + YouTube',    ''),
  ('style_telegram',        'Стиль: Telegram',            ''),
  ('format_short_video',    'Формат: Короткое видео',     ''),
  ('format_long_video',     'Формат: Длинное видео',      ''),
  ('format_carousel',       'Формат: Карусель',           ''),
  ('format_post',           'Формат: Пост',               ''),
  ('format_longread',       'Формат: Лонгрид',            ''),
  ('format_seo_article',    'Формат: SEO-статья',         '')
ON CONFLICT (slug) DO NOTHING;
