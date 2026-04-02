CREATE TABLE channel_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name VARCHAR(100) NOT NULL UNIQUE,
  variable_blocks JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default presets for ВБ and Озон
INSERT INTO channel_presets (channel_name, variable_blocks) VALUES
('ВБ', '[
  {"type": "commission", "label": "Комиссия площадки", "value_type": "percent", "value": 25},
  {"type": "logistics", "label": "Стоимость логистики", "value_type": "fixed", "value": 150},
  {"type": "storage", "label": "Хранение", "value_type": "fixed", "value": 30},
  {"type": "advertising", "label": "Доля рекламных расходов", "value_type": "percent", "value": 7}
]'),
('Озон', '[
  {"type": "commission", "label": "Комиссия площадки", "value_type": "percent", "value": 20},
  {"type": "logistics", "label": "Стоимость логистики", "value_type": "fixed", "value": 120},
  {"type": "storage", "label": "Хранение", "value_type": "fixed", "value": 25},
  {"type": "advertising", "label": "Доля рекламных расходов", "value_type": "percent", "value": 5}
]');
