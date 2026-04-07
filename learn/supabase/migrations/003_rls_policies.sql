-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "Public profiles for leaderboard" ON profiles FOR SELECT USING (true);

-- MODULES
CREATE POLICY "Anyone can view published modules" ON modules FOR SELECT USING (is_published = true);
CREATE POLICY "Admins full access to modules" ON modules FOR ALL USING (is_admin());

-- LESSONS
CREATE POLICY "Anyone can view published lessons" ON lessons FOR SELECT USING (is_published = true);
CREATE POLICY "Admins full access to lessons" ON lessons FOR ALL USING (is_admin());

-- CONTENT BLOCKS
CREATE POLICY "Anyone can view content blocks of published lessons" ON content_blocks
  FOR SELECT USING (EXISTS (SELECT 1 FROM lessons WHERE lessons.id = content_blocks.lesson_id AND lessons.is_published = true));
CREATE POLICY "Admins full access to content blocks" ON content_blocks FOR ALL USING (is_admin());

-- TASKS
CREATE POLICY "Anyone can view tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "Admins full access to tasks" ON tasks FOR ALL USING (is_admin());

-- TASK OPTIONS
CREATE POLICY "Anyone can view task options" ON task_options FOR SELECT USING (true);
CREATE POLICY "Admins full access to task options" ON task_options FOR ALL USING (is_admin());

-- SUBSCRIPTIONS
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all subscriptions" ON subscriptions FOR SELECT USING (is_admin());
CREATE POLICY "Service role manages subscriptions" ON subscriptions FOR ALL USING (is_admin());

-- PROMO CODES
CREATE POLICY "Admins full access to promo codes" ON promo_codes FOR ALL USING (is_admin());

-- MODULE PURCHASES
CREATE POLICY "Users can view own purchases" ON module_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all purchases" ON module_purchases FOR SELECT USING (is_admin());

-- LESSON PROGRESS
CREATE POLICY "Users can manage own progress" ON lesson_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all progress" ON lesson_progress FOR SELECT USING (is_admin());

-- TASK ATTEMPTS
CREATE POLICY "Users can manage own attempts" ON task_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts" ON task_attempts FOR SELECT USING (is_admin());

-- ACHIEVEMENTS
CREATE POLICY "Anyone can view achievements" ON achievements FOR SELECT USING (true);
CREATE POLICY "Admins full access to achievements" ON achievements FOR ALL USING (is_admin());

-- USER ACHIEVEMENTS
CREATE POLICY "Users can view own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public achievements for leaderboard" ON user_achievements FOR SELECT USING (true);

-- STREAKS
CREATE POLICY "Users can view own streak" ON streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own streak" ON streaks FOR ALL USING (auth.uid() = user_id);
