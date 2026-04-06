CREATE TABLE IF NOT EXISTS content_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  material_url VARCHAR(1000),
  youtube_date DATE,
  instagram_date DATE,
  tiktok_date DATE,
  youtube_published BOOLEAN DEFAULT FALSE,
  instagram_published BOOLEAN DEFAULT FALSE,
  tiktok_published BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
