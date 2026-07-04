CREATE TABLE IF NOT EXISTS content_plan_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_date date,
  funnel_level varchar(8),               -- TOFU|MOFU|BOFU
  segment_id uuid REFERENCES icp_segment(id) ON DELETE SET NULL,
  theme_id uuid REFERENCES strategic_theme(id) ON DELETE SET NULL,
  format varchar(50),                    -- content_type
  goal text,
  status varchar(20) NOT NULL DEFAULT 'planned',  -- planned|in_progress|published
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_plan_item_date ON content_plan_item (plan_date DESC);

-- brand_docs-заглушки (создаём если нет; оператор заполнит через редактор)
INSERT INTO brand_docs (slug, title, content)
VALUES
  ('funnel_levels', 'Воронка контента (TOFU/MOFU/BOFU)',
   E'# Уровни воронки\n\n## TOFU — Top of Funnel\nОхват и узнаваемость. Знакомство с брендом, широкая аудитория, познавательный/развлекательный контент.\n\n## MOFU — Middle of Funnel\nВовлечение и доверие. Аудитория знает бренд, углубляем интерес, кейсы/польза/отзывы.\n\n## BOFU — Bottom of Funnel\nКонверсия. Готовы к покупке, снятие возражений, оффер/CTA/акции.'),
  ('content_plan_current', 'Контент-план (текущий)',
   E'# Контент-план\n\n_План ещё не создан. Составь его через Planner в Cowork и сохрани сюда._')
ON CONFLICT (slug) DO NOTHING;
