-- Profiles (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('base', 'base_promo')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  yandex_pay_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Promo codes
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  discount_plan TEXT NOT NULL DEFAULT 'base_promo',
  free_months INTEGER NOT NULL DEFAULT 1,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Module purchases (premium one-time buy)
CREATE TABLE module_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  price_paid NUMERIC(10,2) NOT NULL,
  yandex_pay_id TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Lesson progress
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Task attempts
CREATE TABLE task_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  answer JSONB NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Achievements
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  condition JSONB NOT NULL,
  points INTEGER NOT NULL DEFAULT 0
);

-- User achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Streaks
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_module_purchases_user_id ON module_purchases(user_id);
CREATE INDEX idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX idx_task_attempts_user_id ON task_attempts(user_id);
CREATE INDEX idx_task_attempts_attempted_at ON task_attempts(attempted_at);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);

-- Leaderboard materialized views
CREATE MATERIALIZED VIEW leaderboard_weekly AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_url,
  COALESCE(SUM(ta.points_earned), 0) AS weekly_xp,
  COALESCE(s.current_streak, 0) AS current_streak
FROM profiles p
LEFT JOIN task_attempts ta ON ta.user_id = p.id
  AND ta.attempted_at >= date_trunc('week', now())
LEFT JOIN streaks s ON s.user_id = p.id
GROUP BY p.id, p.display_name, p.avatar_url, s.current_streak
ORDER BY weekly_xp DESC;

CREATE UNIQUE INDEX idx_leaderboard_weekly_user ON leaderboard_weekly(user_id);

CREATE MATERIALIZED VIEW leaderboard_monthly AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_url,
  COALESCE(SUM(ta.points_earned), 0) AS monthly_xp,
  COALESCE(s.current_streak, 0) AS current_streak
FROM profiles p
LEFT JOIN task_attempts ta ON ta.user_id = p.id
  AND ta.attempted_at >= date_trunc('month', now())
LEFT JOIN streaks s ON s.user_id = p.id
GROUP BY p.id, p.display_name, p.avatar_url, s.current_streak
ORDER BY monthly_xp DESC;

CREATE UNIQUE INDEX idx_leaderboard_monthly_user ON leaderboard_monthly(user_id);

CREATE MATERIALIZED VIEW leaderboard_alltime AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_url,
  COALESCE(SUM(ta.points_earned), 0) AS total_xp,
  COALESCE(s.current_streak, 0) AS current_streak
FROM profiles p
LEFT JOIN task_attempts ta ON ta.user_id = p.id
LEFT JOIN streaks s ON s.user_id = p.id
GROUP BY p.id, p.display_name, p.avatar_url, s.current_streak
ORDER BY total_xp DESC;

CREATE UNIQUE INDEX idx_leaderboard_alltime_user ON leaderboard_alltime(user_id);
