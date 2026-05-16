ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram TEXT;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users read profiles" ON profiles;
CREATE POLICY "Users read profiles" ON profiles FOR SELECT USING (true);
