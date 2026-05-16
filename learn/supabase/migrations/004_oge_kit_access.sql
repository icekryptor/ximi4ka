-- 004_oge_kit_access.sql
-- OGE kit launch: module-scoped access, kit credentials, device tracking

-- Add is_oge flag to existing modules table
ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_oge BOOLEAN NOT NULL DEFAULT false;

-- Seed the OGE module if not present
INSERT INTO modules (title, slug, description, tier, is_oge, is_published, order_index)
VALUES ('ОГЭ-модуль 2026', 'oge', 'Полный курс подготовки к ОГЭ по химии 2026', 'base', true, true, 0)
ON CONFLICT (slug) DO UPDATE SET is_oge = true;

-- user_modules: time-bound access grant per user × module
CREATE TABLE user_modules (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id   UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('kit','paid','admin')),
  PRIMARY KEY (user_id, module_id)
);

CREATE INDEX user_modules_expires_idx ON user_modules (user_id, expires_at);

-- kit_batches: one row per "Batch #N of K codes for module X"
CREATE TABLE kit_batches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  module_id       UUID NOT NULL REFERENCES modules(id),
  count           INTEGER NOT NULL CHECK (count > 0),
  duration_days   INTEGER NOT NULL CHECK (duration_days > 0),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- kit_credentials: one row per generated login/password pair
CREATE TABLE kit_credentials (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id            UUID NOT NULL REFERENCES kit_batches(id) ON DELETE CASCADE,
  login               TEXT UNIQUE NOT NULL,
  password_plain      TEXT,
  supabase_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_disabled         BOOLEAN NOT NULL DEFAULT false,
  activated_at        TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX kit_credentials_batch_idx ON kit_credentials (batch_id);
CREATE INDEX kit_credentials_login_idx ON kit_credentials (login);

-- user_devices: tracks which devices a user is logged into
CREATE TABLE user_devices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL,
  user_agent      TEXT,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX user_devices_active_idx ON user_devices (user_id, last_active_at DESC);

-- RLS policies
ALTER TABLE user_modules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_batches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_credentials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices     ENABLE ROW LEVEL SECURITY;

-- user_modules: users read their own; service role writes
CREATE POLICY "Users read own modules" ON user_modules
  FOR SELECT USING (auth.uid() = user_id);

-- kit_batches and kit_credentials: admin-only
CREATE POLICY "Admin read kit batches" ON kit_batches
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin read kit credentials" ON kit_credentials
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- user_devices: users read own; service role writes; users delete own
CREATE POLICY "Users read own devices" ON user_devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users delete own devices" ON user_devices
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users update own devices" ON user_devices
  FOR UPDATE USING (auth.uid() = user_id);
