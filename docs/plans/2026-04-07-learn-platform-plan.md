# XimiLearn Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an education platform at learn.ximi4ka.ru for chemistry students with modular lessons, payments via YandexPay, and gamification.

**Architecture:** Next.js 14 App Router fullstack app with Supabase (Auth, DB, Storage, RLS). Block-based content editor (Tiptap) in admin panel. YandexPay for subscriptions and one-time module purchases. KaTeX for chemical formulas.

**Tech Stack:** Next.js 14, TypeScript, TailwindCSS, Supabase, Tiptap, KaTeX, @dnd-kit, YandexPay API

**Design doc:** `docs/plans/2026-04-07-learn-platform-design.md`

---

## Phase 1: Project Setup & Database

### Task 1: Scaffold Next.js project

**Files:**
- Create: `learn/` (project root)
- Create: `learn/package.json`
- Create: `learn/.env.local.example`

**Step 1: Create Next.js project**

Run:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka
npx create-next-app@14 learn --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Step 2: Install dependencies**

Run:
```bash
cd learn
npm install @supabase/supabase-js @supabase/ssr katex @tiptap/react @tiptap/starter-kit @tiptap/extension-image @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities clsx
npm install -D @types/katex supabase
```

**Step 3: Create .env.local.example**

Create `learn/.env.local.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
YANDEX_PAY_MERCHANT_ID=your-merchant-id
YANDEX_PAY_API_KEY=your-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 4: Configure Tailwind with Ximi4ka design tokens**

Modify `learn/tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#836efe",
        "primary-dark": "#6703ff",
        "primary-gradient-start": "rgba(141,103,255,1)",
        "primary-gradient-end": "rgba(200,86,255,1)",
        "text-dark": "#1c1528",
        "text-secondary": "#524667",
        border: "#e8e5ef",
        "bg-light": "#eeebf3",
      },
      borderRadius: {
        xl: "20px",
        "2xl": "30px",
        "3xl": "40px",
        "4xl": "55px",
      },
      fontFamily: {
        sans: ["Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
```

**Step 5: Verify dev server starts**

Run: `npm run dev`
Expected: Server running on http://localhost:3000

**Step 6: Commit**

```bash
git add learn/
git commit -m "feat(learn): scaffold Next.js 14 project with Tailwind and dependencies"
```

---

### Task 2: Setup Supabase client utilities

**Files:**
- Create: `learn/src/lib/supabase/client.ts`
- Create: `learn/src/lib/supabase/server.ts`
- Create: `learn/src/lib/supabase/middleware.ts`
- Create: `learn/src/middleware.ts`

**Step 1: Create browser client**

Create `learn/src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create server client**

Create `learn/src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}
```

**Step 3: Create middleware helper**

Create `learn/src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes
  const isLearnRoute = request.nextUrl.pathname.startsWith("/learn");
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isAdmin = request.nextUrl.pathname.startsWith("/admin");
  const isProfile = request.nextUrl.pathname.startsWith("/profile");
  const isCheckout = request.nextUrl.pathname.startsWith("/checkout");

  if (!user && (isLearnRoute || isDashboard || isAdmin || isProfile || isCheckout)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Admin routes — check role (via profile metadata)
  if (isAdmin && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}
```

**Step 4: Create middleware**

Create `learn/src/middleware.ts`:
```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 5: Commit**

```bash
git add learn/src/lib/supabase/ learn/src/middleware.ts
git commit -m "feat(learn): add Supabase client utilities and auth middleware"
```

---

### Task 3: Database schema — content tables

**Files:**
- Create: `learn/supabase/migrations/001_content_tables.sql`

**Step 1: Write migration**

Create `learn/supabase/migrations/001_content_tables.sql`:
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Modules
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  tier TEXT NOT NULL DEFAULT 'base' CHECK (tier IN ('base', 'premium')),
  price NUMERIC(10,2),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lessons
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_id, slug)
);

-- Content blocks
CREATE TABLE content_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'formula', 'image', 'task', 'video')),
  content JSONB NOT NULL DEFAULT '{}',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_block_id UUID NOT NULL REFERENCES content_blocks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'numeric_input', 'equation_balance')),
  question TEXT NOT NULL,
  explanation TEXT,
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task options (for choice-based tasks)
CREATE TABLE task_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_lessons_module_id ON lessons(module_id);
CREATE INDEX idx_content_blocks_lesson_id ON content_blocks(lesson_id);
CREATE INDEX idx_tasks_content_block_id ON tasks(content_block_id);
CREATE INDEX idx_task_options_task_id ON task_options(task_id);
CREATE INDEX idx_modules_slug ON modules(slug);
CREATE INDEX idx_modules_published ON modules(is_published);
```

**Step 2: Apply migration to Supabase**

Run via Supabase MCP tool `execute_sql` or Supabase dashboard.

**Step 3: Commit**

```bash
git add learn/supabase/
git commit -m "feat(learn): add content tables migration (modules, lessons, blocks, tasks)"
```

---

### Task 4: Database schema — users, subscriptions, gamification

**Files:**
- Create: `learn/supabase/migrations/002_users_and_gamification.sql`

**Step 1: Write migration**

Create `learn/supabase/migrations/002_users_and_gamification.sql`:
```sql
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

-- Leaderboard materialized view
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
```

**Step 2: Apply migration**

Run via Supabase MCP tool `execute_sql` or dashboard.

**Step 3: Commit**

```bash
git add learn/supabase/
git commit -m "feat(learn): add users, subscriptions, gamification tables and leaderboard views"
```

---

### Task 5: Database schema — Row Level Security

**Files:**
- Create: `learn/supabase/migrations/003_rls_policies.sql`

**Step 1: Write RLS policies**

Create `learn/supabase/migrations/003_rls_policies.sql`:
```sql
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
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());
CREATE POLICY "Public profiles for leaderboard" ON profiles
  FOR SELECT USING (true);

-- MODULES (public read for published)
CREATE POLICY "Anyone can view published modules" ON modules
  FOR SELECT USING (is_published = true);
CREATE POLICY "Admins full access to modules" ON modules
  FOR ALL USING (is_admin());

-- LESSONS (public read for published)
CREATE POLICY "Anyone can view published lessons" ON lessons
  FOR SELECT USING (is_published = true);
CREATE POLICY "Admins full access to lessons" ON lessons
  FOR ALL USING (is_admin());

-- CONTENT BLOCKS (public read)
CREATE POLICY "Anyone can view content blocks of published lessons" ON content_blocks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lessons WHERE lessons.id = content_blocks.lesson_id AND lessons.is_published = true)
  );
CREATE POLICY "Admins full access to content blocks" ON content_blocks
  FOR ALL USING (is_admin());

-- TASKS (public read for question, not answers)
CREATE POLICY "Anyone can view tasks" ON tasks
  FOR SELECT USING (true);
CREATE POLICY "Admins full access to tasks" ON tasks
  FOR ALL USING (is_admin());

-- TASK OPTIONS (hide is_correct from non-admins via API, not RLS)
CREATE POLICY "Anyone can view task options" ON task_options
  FOR SELECT USING (true);
CREATE POLICY "Admins full access to task options" ON task_options
  FOR ALL USING (is_admin());

-- SUBSCRIPTIONS
CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR SELECT USING (is_admin());
CREATE POLICY "Service role manages subscriptions" ON subscriptions
  FOR ALL USING (is_admin());

-- PROMO CODES
CREATE POLICY "Admins full access to promo codes" ON promo_codes
  FOR ALL USING (is_admin());

-- MODULE PURCHASES
CREATE POLICY "Users can view own purchases" ON module_purchases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all purchases" ON module_purchases
  FOR SELECT USING (is_admin());

-- LESSON PROGRESS
CREATE POLICY "Users can manage own progress" ON lesson_progress
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all progress" ON lesson_progress
  FOR SELECT USING (is_admin());

-- TASK ATTEMPTS
CREATE POLICY "Users can manage own attempts" ON task_attempts
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts" ON task_attempts
  FOR SELECT USING (is_admin());

-- ACHIEVEMENTS
CREATE POLICY "Anyone can view achievements" ON achievements
  FOR SELECT USING (true);
CREATE POLICY "Admins full access to achievements" ON achievements
  FOR ALL USING (is_admin());

-- USER ACHIEVEMENTS
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public achievements for leaderboard" ON user_achievements
  FOR SELECT USING (true);

-- STREAKS
CREATE POLICY "Users can view own streak" ON streaks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own streak" ON streaks
  FOR ALL USING (auth.uid() = user_id);
```

**Step 2: Apply migration**

Run via Supabase MCP tool.

**Step 3: Commit**

```bash
git add learn/supabase/
git commit -m "feat(learn): add RLS policies for all tables"
```

---

### Task 6: TypeScript types and Supabase type generation

**Files:**
- Create: `learn/src/lib/types/database.ts`
- Create: `learn/src/lib/types/index.ts`

**Step 1: Generate Supabase types**

Run:
```bash
cd learn
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/types/database.ts
```

**Step 2: Create app-level types**

Create `learn/src/lib/types/index.ts`:
```typescript
export type ModuleTier = "base" | "premium";
export type SubscriptionPlan = "base" | "base_promo";
export type SubscriptionStatus = "active" | "cancelled" | "expired";
export type LessonStatus = "not_started" | "in_progress" | "done";
export type BlockType = "text" | "formula" | "image" | "task" | "video";
export type TaskType = "single_choice" | "multiple_choice" | "numeric_input" | "equation_balance";

export interface Module {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  tier: ModuleTier;
  price: number | null;
  order_index: number;
  is_published: boolean;
  created_at: string;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  order_index: number;
  duration_minutes: number | null;
  is_published: boolean;
  created_at: string;
  content_blocks?: ContentBlock[];
}

export interface ContentBlock {
  id: string;
  lesson_id: string;
  type: BlockType;
  content: Record<string, unknown>;
  order_index: number;
  created_at: string;
  task?: Task;
}

export interface Task {
  id: string;
  content_block_id: string;
  type: TaskType;
  question: string;
  explanation: string | null;
  difficulty: number;
  points: number;
  created_at: string;
  options?: TaskOption[];
}

export interface TaskOption {
  id: string;
  task_id: string;
  text: string;
  is_correct: boolean;
  order_index: number;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "student" | "admin";
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string;
  yandex_pay_id: string | null;
  created_at: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discount_plan: string;
  free_months: number;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  status: LessonStatus;
  completed_at: string | null;
  updated_at: string;
}

export interface TaskAttempt {
  id: string;
  user_id: string;
  task_id: string;
  answer: Record<string, unknown>;
  is_correct: boolean;
  points_earned: number;
  attempted_at: string;
}

export interface Achievement {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  condition: Record<string, unknown>;
  points: number;
}

export interface Streak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  updated_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  current_streak: number;
}

// XP calculation constants
export const XP_MULTIPLIERS = {
  FIRST_ATTEMPT: 1.0,
  SECOND_ATTEMPT: 0.5,
  THIRD_PLUS_ATTEMPT: 0.25,
} as const;

export const XP_BONUSES = {
  LESSON_COMPLETE: 20,
  MODULE_COMPLETE: 100,
  STREAK_DAILY: 5, // multiplied by current_streak
} as const;

export const DIFFICULTY_POINTS: Record<number, number> = {
  1: 10,
  2: 20,
  3: 35,
  4: 50,
  5: 75,
};
```

**Step 3: Commit**

```bash
git add learn/src/lib/types/
git commit -m "feat(learn): add TypeScript types and XP constants"
```

---

## Phase 2: Auth & Layout

### Task 7: Shared UI components

**Files:**
- Create: `learn/src/components/ui/Button.tsx`
- Create: `learn/src/components/ui/Input.tsx`
- Create: `learn/src/components/ui/Card.tsx`
- Create: `learn/src/components/ui/Badge.tsx`
- Create: `learn/src/components/ui/ProgressBar.tsx`

**Step 1: Create Button**

Create `learn/src/components/ui/Button.tsx`:
```tsx
import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center font-medium transition-all",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-white hover:opacity-90":
              variant === "primary",
            "bg-bg-light text-text-dark border border-border hover:bg-gray-100":
              variant === "secondary",
            "text-text-secondary hover:text-text-dark hover:bg-bg-light":
              variant === "ghost",
          },
          {
            "text-sm px-4 py-2 rounded-xl": size === "sm",
            "text-base px-6 py-3 rounded-2xl": size === "md",
            "text-lg px-8 py-4 rounded-3xl": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
```

**Step 2: Create Input**

Create `learn/src/components/ui/Input.tsx`:
```tsx
import { clsx } from "clsx";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-text-dark mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={clsx(
            "w-full px-4 py-3 rounded-2xl border bg-white text-text-dark",
            "placeholder:text-text-secondary/50",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            "transition-all",
            error ? "border-red-400" : "border-border",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
```

**Step 3: Create Card**

Create `learn/src/components/ui/Card.tsx`:
```tsx
import { clsx } from "clsx";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export function Card({ className, glass, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-border p-6",
        glass
          ? "bg-white/60 backdrop-blur-md"
          : "bg-white",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

**Step 4: Create Badge**

Create `learn/src/components/ui/Badge.tsx`:
```tsx
import { clsx } from "clsx";

interface BadgeProps {
  variant?: "base" | "premium" | "streak" | "xp";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "base", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium",
        {
          "bg-primary/10 text-primary": variant === "base",
          "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-white":
            variant === "premium",
          "bg-orange-100 text-orange-700": variant === "streak",
          "bg-green-100 text-green-700": variant === "xp",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
```

**Step 5: Create ProgressBar**

Create `learn/src/components/ui/ProgressBar.tsx`:
```tsx
import { clsx } from "clsx";

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  size?: "sm" | "md";
}

export function ProgressBar({ value, className, size = "md" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={clsx(
        "w-full bg-bg-light rounded-full overflow-hidden",
        size === "sm" ? "h-2" : "h-3",
        className
      )}
    >
      <div
        className="h-full bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end rounded-full transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add learn/src/components/ui/
git commit -m "feat(learn): add shared UI components (Button, Input, Card, Badge, ProgressBar)"
```

---

### Task 8: App layout and navigation

**Files:**
- Create: `learn/src/components/layout/Header.tsx`
- Create: `learn/src/components/layout/Footer.tsx`
- Create: `learn/src/app/layout.tsx` (modify)
- Create: `learn/src/app/(public)/layout.tsx`
- Create: `learn/src/app/(learn)/layout.tsx`
- Create: `learn/src/app/(admin)/layout.tsx`

**Step 1: Create Header**

Create `learn/src/components/layout/Header.tsx`:
```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-primary">
          XimiLearn
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/modules" className="text-text-secondary hover:text-text-dark transition-colors">
            Модули
          </Link>
          <Link href="/pricing" className="text-text-secondary hover:text-text-dark transition-colors">
            Тарифы
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="text-text-secondary hover:text-text-dark transition-colors">
                Мой прогресс
              </Link>
              <Link href="/leaderboard" className="text-text-secondary hover:text-text-dark transition-colors">
                Рейтинг
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="sm">Профиль</Button>
              </Link>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Войти</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```

**Step 2: Create Footer**

Create `learn/src/components/layout/Footer.tsx`:
```tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-white py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 text-center text-text-secondary text-sm">
        <p>&copy; {new Date().getFullYear()} Ximi4ka. Все права защищены.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="https://ximi4ka.ru" className="hover:text-primary transition-colors">
            ximi4ka.ru
          </Link>
        </div>
      </div>
    </footer>
  );
}
```

**Step 3: Update root layout**

Modify `learn/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XimiLearn — Химия для школьников",
  description: "Образовательная платформа по химии от Ximi4ka. Теория, реакции, задачи из школьной программы.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="font-sans text-text-dark bg-white min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
```

**Step 4: Create public layout**

Create `learn/src/app/(public)/layout.tsx`:
```tsx
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
```

**Step 5: Create learn layout (ЛК)**

Create `learn/src/app/(learn)/layout.tsx`:
```tsx
import { Header } from "@/components/layout/Header";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 bg-bg-light">{children}</main>
    </>
  );
}
```

**Step 6: Create admin layout**

Create `learn/src/app/(admin)/layout.tsx`:
```tsx
import Link from "next/link";

const adminNav = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/modules", label: "Модули" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/users", label: "Ученики" },
  { href: "/admin/achievements", label: "Достижения" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-text-dark text-white p-6">
        <Link href="/admin" className="text-xl font-bold text-primary mb-8 block">
          XimiLearn Admin
        </Link>
        <nav className="space-y-2">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 bg-bg-light p-8">{children}</main>
    </div>
  );
}
```

**Step 7: Commit**

```bash
git add learn/src/components/layout/ learn/src/app/
git commit -m "feat(learn): add layouts (public, learn, admin) with header and footer"
```

---

### Task 9: Auth pages (login, register, forgot password)

**Files:**
- Create: `learn/src/app/(auth)/login/page.tsx`
- Create: `learn/src/app/(auth)/register/page.tsx`
- Create: `learn/src/app/(auth)/forgot-password/page.tsx`
- Create: `learn/src/app/(auth)/layout.tsx`
- Create: `learn/src/app/auth/callback/route.ts`

**Step 1: Create auth layout**

Create `learn/src/app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

**Step 2: Create login page**

Create `learn/src/app/(auth)/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Неверный email или пароль");
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <Card glass>
      <h1 className="text-2xl font-bold text-center mb-6">Вход в XimiLearn</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Input
          id="password"
          label="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Введите пароль"
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm text-text-secondary">
        <Link href="/forgot-password" className="hover:text-primary transition-colors">
          Забыли пароль?
        </Link>
        <span className="mx-2">|</span>
        <Link href="/register" className="hover:text-primary transition-colors">
          Регистрация
        </Link>
      </div>
    </Card>
  );
}
```

**Step 3: Create register page**

Create `learn/src/app/(auth)/register/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If promo code provided, activate it via API
    if (promoCode.trim()) {
      await fetch("/api/promo/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim() }),
      });
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <Card glass>
        <h1 className="text-2xl font-bold text-center mb-4">Проверьте почту</h1>
        <p className="text-text-secondary text-center">
          Мы отправили ссылку для подтверждения на <strong>{email}</strong>
        </p>
      </Card>
    );
  }

  return (
    <Card glass>
      <h1 className="text-2xl font-bold text-center mb-6">Регистрация</h1>
      <form onSubmit={handleRegister} className="space-y-4">
        <Input
          id="displayName"
          label="Имя"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Как вас зовут?"
          required
        />
        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Input
          id="password"
          label="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Минимум 6 символов"
          minLength={6}
          required
        />
        <Input
          id="promoCode"
          label="Промокод (необязательно)"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          placeholder="XIMI-XXXX-XXXX"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Регистрация..." : "Зарегистрироваться"}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm text-text-secondary">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Войти
        </Link>
      </div>
    </Card>
  );
}
```

**Step 4: Create forgot password page**

Create `learn/src/app/(auth)/forgot-password/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <Card glass>
        <h1 className="text-2xl font-bold text-center mb-4">Письмо отправлено</h1>
        <p className="text-text-secondary text-center">
          Если аккаунт с email <strong>{email}</strong> существует, мы отправили ссылку для сброса пароля.
        </p>
      </Card>
    );
  }

  return (
    <Card glass>
      <h1 className="text-2xl font-bold text-center mb-6">Восстановление пароля</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Отправка..." : "Отправить ссылку"}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm text-text-secondary">
        <Link href="/login" className="text-primary hover:underline">
          Вернуться к входу
        </Link>
      </div>
    </Card>
  );
}
```

**Step 5: Create auth callback route**

Create `learn/src/app/auth/callback/route.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

**Step 6: Commit**

```bash
git add learn/src/app/\(auth\)/ learn/src/app/auth/
git commit -m "feat(learn): add auth pages (login, register, forgot password, callback)"
```

---

## Phase 3: Public Pages & Content Display

### Task 10: Landing page

**Files:**
- Create: `learn/src/app/(public)/page.tsx`

**Step 1: Create landing page**

Create `learn/src/app/(public)/page.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const features = [
  {
    title: "Теория",
    description: "Атомистика, элементы, вещества — понятно и с примерами",
    icon: "📖",
  },
  {
    title: "Реакции",
    description: "Все реакции из школьной программы с пошаговым разбором",
    icon: "⚗️",
  },
  {
    title: "Задачи",
    description: "Тренажёр задач с мгновенной проверкой и подсказками",
    icon: "🧮",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="py-20 px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-text-dark mb-6">
          Химия — это{" "}
          <span className="bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end bg-clip-text text-transparent">
            просто
          </span>
        </h1>
        <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-8">
          Интерактивная платформа для изучения химии. Теория, реакции и задачи из школьной программы.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/register">
            <Button size="lg">Начать бесплатно</Button>
          </Link>
          <Link href="/modules">
            <Button variant="secondary" size="lg">Смотреть модули</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-bg-light">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} glass className="text-center">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-text-secondary">{f.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">Тарифы</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="text-left">
              <h3 className="text-xl font-bold mb-2">Подписка</h3>
              <p className="text-3xl font-bold text-primary mb-1">999 ₽<span className="text-base text-text-secondary">/мес</span></p>
              <p className="text-sm text-text-secondary mb-4">Доступ ко всем базовым модулям</p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>✓ Все базовые модули</li>
                <li>✓ Задачи с проверкой</li>
                <li>✓ Прогресс и достижения</li>
                <li>✓ Рейтинг учеников</li>
              </ul>
            </Card>
            <Card className="text-left border-primary border-2">
              <h3 className="text-xl font-bold mb-2">С набором Ximi4ka</h3>
              <p className="text-3xl font-bold text-primary mb-1">499 ₽<span className="text-base text-text-secondary">/мес</span></p>
              <p className="text-sm text-text-secondary mb-4">Промокод в каждом наборе</p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>✓ Всё из подписки</li>
                <li>✓ 1 месяц бесплатно</li>
                <li>✓ Скидка 50%</li>
              </ul>
            </Card>
          </div>
          <Link href="/pricing" className="inline-block mt-6">
            <Button variant="ghost">Подробнее о тарифах →</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add learn/src/app/\(public\)/page.tsx
git commit -m "feat(learn): add landing page with hero, features, and pricing preview"
```

---

### Task 11: Modules catalog page

**Files:**
- Create: `learn/src/app/(public)/modules/page.tsx`
- Create: `learn/src/components/modules/ModuleCard.tsx`

**Step 1: Create ModuleCard component**

Create `learn/src/components/modules/ModuleCard.tsx`:
```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Module } from "@/lib/types";

interface ModuleCardProps {
  module: Module;
}

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <Link href={`/modules/${module.slug}`}>
      <Card className="hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer h-full">
        {module.cover_image_url && (
          <div className="aspect-video rounded-2xl overflow-hidden mb-4 bg-bg-light">
            <img
              src={module.cover_image_url}
              alt={module.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={module.tier === "premium" ? "premium" : "base"}>
            {module.tier === "premium" ? "Продвинутый" : "Базовый"}
          </Badge>
          {module.tier === "premium" && module.price && (
            <span className="text-sm text-text-secondary">{module.price} ₽</span>
          )}
        </div>
        <h3 className="text-lg font-bold mb-1">{module.title}</h3>
        <p className="text-sm text-text-secondary line-clamp-2">{module.description}</p>
      </Card>
    </Link>
  );
}
```

**Step 2: Create modules catalog page**

Create `learn/src/app/(public)/modules/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { ModuleCard } from "@/components/modules/ModuleCard";
import type { Module } from "@/lib/types";

export const metadata = {
  title: "Модули — XimiLearn",
  description: "Каталог учебных модулей по химии",
};

export default async function ModulesPage() {
  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("*")
    .eq("is_published", true)
    .order("order_index");

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Модули</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(modules as Module[] | null)?.map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </div>
      {(!modules || modules.length === 0) && (
        <p className="text-text-secondary text-center py-12">
          Модули скоро появятся. Следите за обновлениями!
        </p>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add learn/src/app/\(public\)/modules/ learn/src/components/modules/
git commit -m "feat(learn): add modules catalog page with ModuleCard component"
```

---

### Task 12: Module detail page + lesson preview

**Files:**
- Create: `learn/src/app/(public)/modules/[slug]/page.tsx`
- Create: `learn/src/app/(public)/modules/[slug]/[lesson]/page.tsx`
- Create: `learn/src/components/content/ContentBlockRenderer.tsx`
- Create: `learn/src/components/content/FormulaBlock.tsx`

**Step 1: Create FormulaBlock**

Create `learn/src/components/content/FormulaBlock.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface FormulaBlockProps {
  latex: string;
  displayMode?: boolean;
}

export function FormulaBlock({ latex, displayMode = true }: FormulaBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      katex.render(latex, ref.current, {
        displayMode,
        throwOnError: false,
        trust: true,
        macros: {
          "\\ce": "\\text{#1}", // simplified; use mhchem extension for full support
        },
      });
    }
  }, [latex, displayMode]);

  return <div ref={ref} className="my-4 text-center overflow-x-auto" />;
}
```

**Step 2: Create ContentBlockRenderer**

Create `learn/src/components/content/ContentBlockRenderer.tsx`:
```tsx
import { FormulaBlock } from "./FormulaBlock";
import type { ContentBlock } from "@/lib/types";

interface ContentBlockRendererProps {
  block: ContentBlock;
  isPreview?: boolean;
}

export function ContentBlockRenderer({ block, isPreview }: ContentBlockRendererProps) {
  const content = block.content as Record<string, string>;

  switch (block.type) {
    case "text":
      return (
        <div
          className="prose prose-sm max-w-none text-text-dark"
          dangerouslySetInnerHTML={{ __html: content.html || "" }}
        />
      );

    case "formula":
      return <FormulaBlock latex={content.latex || ""} />;

    case "image":
      return (
        <figure className="my-4">
          <img
            src={content.url}
            alt={content.caption || ""}
            className="rounded-2xl max-w-full mx-auto"
          />
          {content.caption && (
            <figcaption className="text-center text-sm text-text-secondary mt-2">
              {content.caption}
            </figcaption>
          )}
        </figure>
      );

    case "task":
      if (isPreview) {
        return (
          <div className="my-4 p-4 bg-primary/5 rounded-2xl border border-primary/20">
            <p className="text-sm text-primary font-medium">Задача доступна после авторизации</p>
          </div>
        );
      }
      return null; // TaskBlock will be rendered separately in learn route

    case "video":
      return content.url ? (
        <div className="my-4 aspect-video rounded-2xl overflow-hidden">
          <iframe
            src={content.url}
            className="w-full h-full"
            allowFullScreen
          />
        </div>
      ) : null;

    default:
      return null;
  }
}
```

**Step 3: Create module detail page**

Create `learn/src/app/(public)/modules/[slug]/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Module, Lesson } from "@/lib/types";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props) {
  const supabase = await createClient();
  const { data: module } = await supabase
    .from("modules")
    .select("title, description")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .single();

  if (!module) return { title: "Модуль не найден" };
  return { title: `${module.title} — XimiLearn`, description: module.description };
}

export default async function ModuleDetailPage({ params }: Props) {
  const supabase = await createClient();

  const { data: module } = await supabase
    .from("modules")
    .select("*, lessons(*)")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .single();

  if (!module) notFound();

  const m = module as Module & { lessons: Lesson[] };
  const lessons = (m.lessons || [])
    .filter((l) => l.is_published)
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Badge variant={m.tier === "premium" ? "premium" : "base"} className="mb-3">
          {m.tier === "premium" ? "Продвинутый" : "Базовый"}
        </Badge>
        <h1 className="text-3xl font-bold mb-4">{m.title}</h1>
        <p className="text-text-secondary text-lg">{m.description}</p>
      </div>

      <div className="space-y-3 mb-8">
        <h2 className="text-xl font-bold">Уроки ({lessons.length})</h2>
        {lessons.map((lesson, i) => (
          <Link key={lesson.id} href={`/modules/${m.slug}/${lesson.slug}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
              <span className="text-2xl font-bold text-primary/30">{i + 1}</span>
              <div>
                <h3 className="font-medium">{lesson.title}</h3>
                {lesson.duration_minutes && (
                  <p className="text-sm text-text-secondary">{lesson.duration_minutes} мин</p>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="text-center">
        {m.tier === "premium" ? (
          <Link href={`/checkout/module/${m.id}`}>
            <Button size="lg">Купить за {m.price} ₽</Button>
          </Link>
        ) : (
          <Link href="/pricing">
            <Button size="lg">Оформить подписку</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Create lesson preview page (public, with blur)**

Create `learn/src/app/(public)/modules/[slug]/[lesson]/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ContentBlockRenderer } from "@/components/content/ContentBlockRenderer";
import type { ContentBlock } from "@/lib/types";

interface Props {
  params: { slug: string; lesson: string };
}

export default async function LessonPreviewPage({ params }: Props) {
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*, content_blocks(*), modules!inner(slug)")
    .eq("slug", params.lesson)
    .eq("modules.slug", params.slug)
    .eq("is_published", true)
    .single();

  if (!lesson) notFound();

  const blocks = ((lesson.content_blocks || []) as ContentBlock[])
    .sort((a, b) => a.order_index - b.order_index);

  const previewBlocks = blocks.slice(0, 3);
  const hasMore = blocks.length > 3;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">{lesson.title}</h1>

      <div className="space-y-6">
        {previewBlocks.map((block) => (
          <ContentBlockRenderer key={block.id} block={block} isPreview />
        ))}
      </div>

      {hasMore && (
        <div className="relative mt-8">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white z-10" />
          <div className="blur-sm opacity-50 pointer-events-none">
            {blocks.slice(3, 5).map((block) => (
              <ContentBlockRenderer key={block.id} block={block} isPreview />
            ))}
          </div>
          <div className="relative z-20 text-center py-12">
            <p className="text-lg text-text-secondary mb-4">
              Чтобы продолжить, оформите подписку
            </p>
            <Link href="/register">
              <Button size="lg">Зарегистрироваться</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add learn/src/app/\(public\)/modules/ learn/src/components/content/
git commit -m "feat(learn): add module detail, lesson preview with blur paywall, content renderers"
```

---

## Phase 4: Learning Experience

### Task 13: Dashboard page

**Files:**
- Create: `learn/src/app/(learn)/dashboard/page.tsx`
- Create: `learn/src/lib/queries/progress.ts`

**Step 1: Create progress queries**

Create `learn/src/lib/queries/progress.ts`:
```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export async function getUserStats(supabase: SupabaseClient, userId: string) {
  const [
    { data: streak },
    { count: totalAttempts },
    { count: correctAttempts },
    { data: totalXpData },
    { data: achievements },
    { data: recentProgress },
  ] = await Promise.all([
    supabase.from("streaks").select("*").eq("user_id", userId).single(),
    supabase.from("task_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("task_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_correct", true),
    supabase.from("task_attempts").select("points_earned").eq("user_id", userId),
    supabase.from("user_achievements").select("*, achievements(*)").eq("user_id", userId).order("earned_at", { ascending: false }).limit(5),
    supabase.from("lesson_progress").select("*, lessons(title, modules(title, slug))").eq("user_id", userId).order("updated_at", { ascending: false }).limit(5),
  ]);

  const totalXp = totalXpData?.reduce((sum, a) => sum + a.points_earned, 0) ?? 0;

  return {
    streak: streak ?? { current_streak: 0, longest_streak: 0 },
    totalAttempts: totalAttempts ?? 0,
    correctAttempts: correctAttempts ?? 0,
    totalXp,
    recentAchievements: achievements ?? [],
    recentProgress: recentProgress ?? [],
  };
}
```

**Step 2: Create dashboard page**

Create `learn/src/app/(learn)/dashboard/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getUserStats } from "@/lib/queries/progress";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const stats = await getUserStats(supabase, user.id);
  const accuracy = stats.totalAttempts > 0
    ? Math.round((stats.correctAttempts / stats.totalAttempts) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Мой прогресс</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary">{stats.totalXp}</p>
          <p className="text-sm text-text-secondary">XP</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-orange-500">{stats.streak.current_streak}</p>
          <p className="text-sm text-text-secondary">дней подряд</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-green-600">{stats.correctAttempts}</p>
          <p className="text-sm text-text-secondary">решено задач</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-text-dark">{accuracy}%</p>
          <p className="text-sm text-text-secondary">точность</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent achievements */}
        <Card>
          <h2 className="text-lg font-bold mb-4">Последние достижения</h2>
          {stats.recentAchievements.length === 0 ? (
            <p className="text-text-secondary text-sm">Пока нет достижений. Решайте задачи!</p>
          ) : (
            <div className="space-y-3">
              {stats.recentAchievements.map((ua: any) => (
                <div key={ua.id} className="flex items-center gap-3">
                  <span className="text-2xl">{ua.achievements?.icon_url || "🏆"}</span>
                  <div>
                    <p className="font-medium text-sm">{ua.achievements?.title}</p>
                    <p className="text-xs text-text-secondary">{ua.achievements?.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/achievements" className="text-primary text-sm hover:underline mt-4 block">
            Все достижения →
          </Link>
        </Card>

        {/* Continue learning */}
        <Card>
          <h2 className="text-lg font-bold mb-4">Продолжить</h2>
          {stats.recentProgress.length === 0 ? (
            <p className="text-text-secondary text-sm">
              Начните с{" "}
              <Link href="/modules" className="text-primary hover:underline">каталога модулей</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentProgress.map((lp: any) => (
                <Link
                  key={lp.id}
                  href={`/learn/${lp.lessons?.modules?.slug}`}
                  className="block p-3 rounded-xl hover:bg-bg-light transition-colors"
                >
                  <p className="font-medium text-sm">{lp.lessons?.title}</p>
                  <p className="text-xs text-text-secondary">{lp.lessons?.modules?.title}</p>
                  <Badge variant={lp.status === "done" ? "xp" : "base"} className="mt-1">
                    {lp.status === "done" ? "Пройден" : "В процессе"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add learn/src/app/\(learn\)/dashboard/ learn/src/lib/queries/
git commit -m "feat(learn): add dashboard page with XP, streak, achievements stats"
```

---

### Task 14: Lesson viewer with interactive tasks

**Files:**
- Create: `learn/src/app/(learn)/learn/[slug]/page.tsx`
- Create: `learn/src/app/(learn)/learn/[slug]/[lesson]/page.tsx`
- Create: `learn/src/components/content/TaskBlock.tsx`
- Create: `learn/src/app/api/tasks/attempt/route.ts`
- Create: `learn/src/lib/services/access.ts`

**Step 1: Create access control service**

Create `learn/src/lib/services/access.ts`:
```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export async function canAccessModule(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
  moduleTier: string
): Promise<boolean> {
  if (moduleTier === "base") {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();
    return !!sub;
  }

  if (moduleTier === "premium") {
    const { data: purchase } = await supabase
      .from("module_purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("module_id", moduleId)
      .single();
    return !!purchase;
  }

  return false;
}
```

**Step 2: Create TaskBlock component**

Create `learn/src/components/content/TaskBlock.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Task, TaskOption } from "@/lib/types";

interface TaskBlockProps {
  task: Task & { options: TaskOption[] };
}

export function TaskBlock({ task }: TaskBlockProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [numericAnswer, setNumericAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ is_correct: boolean; points_earned: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    let answer: Record<string, unknown>;

    if (task.type === "numeric_input") {
      answer = { value: parseFloat(numericAnswer) };
    } else {
      answer = { selected: selectedIds };
    }

    const res = await fetch("/api/tasks/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: task.id, answer }),
    });

    const data = await res.json();
    setResult(data);
    setSubmitted(true);
    setLoading(false);
  }

  function toggleOption(id: string) {
    if (task.type === "single_choice") {
      setSelectedIds([id]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  }

  const difficultyStars = "★".repeat(task.difficulty) + "☆".repeat(5 - task.difficulty);

  return (
    <Card className="my-6 border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-primary">Задача • {task.points} XP</span>
        <span className="text-xs text-text-secondary">{difficultyStars}</span>
      </div>

      <p className="font-medium mb-4">{task.question}</p>

      {(task.type === "single_choice" || task.type === "multiple_choice") && (
        <div className="space-y-2 mb-4">
          {task.options
            .sort((a, b) => a.order_index - b.order_index)
            .map((opt) => {
              const isSelected = selectedIds.includes(opt.id);
              const showCorrect = submitted && opt.is_correct;
              const showWrong = submitted && isSelected && !opt.is_correct;

              return (
                <button
                  key={opt.id}
                  onClick={() => !submitted && toggleOption(opt.id)}
                  disabled={submitted}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    showCorrect
                      ? "border-green-400 bg-green-50"
                      : showWrong
                      ? "border-red-400 bg-red-50"
                      : isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {opt.text}
                </button>
              );
            })}
        </div>
      )}

      {task.type === "numeric_input" && (
        <input
          type="number"
          value={numericAnswer}
          onChange={(e) => setNumericAnswer(e.target.value)}
          disabled={submitted}
          placeholder="Введите ответ"
          className="w-full p-3 rounded-xl border border-border mb-4 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}

      {!submitted && (
        <Button
          onClick={handleSubmit}
          disabled={loading || (task.type === "numeric_input" ? !numericAnswer : selectedIds.length === 0)}
          size="sm"
        >
          {loading ? "Проверяем..." : "Проверить"}
        </Button>
      )}

      {submitted && result && (
        <div className={`mt-4 p-4 rounded-xl ${result.is_correct ? "bg-green-50" : "bg-red-50"}`}>
          <p className="font-medium">
            {result.is_correct ? `✓ Правильно! +${result.points_earned} XP` : "✗ Неправильно"}
          </p>
          {task.explanation && (
            <p className="text-sm text-text-secondary mt-2">{task.explanation}</p>
          )}
          {!result.is_correct && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setSubmitted(false);
                setResult(null);
                setSelectedIds([]);
                setNumericAnswer("");
              }}
            >
              Попробовать ещё раз
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
```

**Step 3: Create task attempt API**

Create `learn/src/app/api/tasks/attempt/route.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { XP_MULTIPLIERS } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task_id, answer } = await request.json();

  // Get task with options
  const { data: task } = await supabase
    .from("tasks")
    .select("*, task_options(*)")
    .eq("id", task_id)
    .single();

  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Check answer
  let is_correct = false;
  if (task.type === "single_choice" || task.type === "multiple_choice") {
    const correctIds = task.task_options
      .filter((o: any) => o.is_correct)
      .map((o: any) => o.id)
      .sort();
    const selectedIds = (answer.selected as string[]).sort();
    is_correct = JSON.stringify(correctIds) === JSON.stringify(selectedIds);
  } else if (task.type === "numeric_input") {
    // Check if numeric answer matches any correct option
    const correctValues = task.task_options
      .filter((o: any) => o.is_correct)
      .map((o: any) => parseFloat(o.text));
    is_correct = correctValues.includes(answer.value);
  }

  // Count previous attempts for XP multiplier
  const { count: attemptCount } = await supabase
    .from("task_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("task_id", task_id);

  let multiplier = XP_MULTIPLIERS.FIRST_ATTEMPT;
  if (attemptCount === 1) multiplier = XP_MULTIPLIERS.SECOND_ATTEMPT;
  else if ((attemptCount ?? 0) >= 2) multiplier = XP_MULTIPLIERS.THIRD_PLUS_ATTEMPT;

  const points_earned = is_correct ? Math.round(task.points * multiplier) : 0;

  // Save attempt
  await supabase.from("task_attempts").insert({
    user_id: user.id,
    task_id,
    answer,
    is_correct,
    points_earned,
  });

  // Update streak
  const today = new Date().toISOString().split("T")[0];
  const { data: streak } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (streak) {
    const lastDate = streak.last_activity_date;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    if (lastDate !== today) {
      const newStreak = lastDate === yesterday ? streak.current_streak + 1 : 1;
      await supabase
        .from("streaks")
        .update({
          current_streak: newStreak,
          longest_streak: Math.max(newStreak, streak.longest_streak),
          last_activity_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }
  } else {
    await supabase.from("streaks").insert({
      user_id: user.id,
      current_streak: 1,
      longest_streak: 1,
      last_activity_date: today,
    });
  }

  return NextResponse.json({ is_correct, points_earned });
}
```

**Step 4: Create module learning page (lesson list with progress)**

Create `learn/src/app/(learn)/learn/[slug]/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { canAccessModule } from "@/lib/services/access";

interface Props {
  params: { slug: string };
}

export default async function LearnModulePage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: module } = await supabase
    .from("modules")
    .select("*, lessons(*)")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .single();

  if (!module) notFound();

  const hasAccess = await canAccessModule(supabase, user.id, module.id, module.tier);
  if (!hasAccess) redirect(`/modules/${params.slug}`);

  const lessons = (module.lessons || [])
    .filter((l: any) => l.is_published)
    .sort((a: any, b: any) => a.order_index - b.order_index);

  // Get progress for all lessons
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status")
    .eq("user_id", user.id)
    .in("lesson_id", lessons.map((l: any) => l.id));

  const progressMap = new Map(progress?.map((p) => [p.lesson_id, p.status]) ?? []);
  const completedCount = progress?.filter((p) => p.status === "done").length ?? 0;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">{module.title}</h1>
      <div className="flex items-center gap-3 mb-6">
        <ProgressBar value={progressPercent} className="flex-1" />
        <span className="text-sm text-text-secondary">{progressPercent}%</span>
      </div>

      <div className="space-y-3">
        {lessons.map((lesson: any, i: number) => {
          const status = progressMap.get(lesson.id) ?? "not_started";
          return (
            <Link key={lesson.id} href={`/learn/${params.slug}/${lesson.slug}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
                <span className={`text-2xl font-bold ${status === "done" ? "text-green-500" : "text-primary/30"}`}>
                  {status === "done" ? "✓" : i + 1}
                </span>
                <div className="flex-1">
                  <h3 className="font-medium">{lesson.title}</h3>
                  {lesson.duration_minutes && (
                    <p className="text-sm text-text-secondary">{lesson.duration_minutes} мин</p>
                  )}
                </div>
                <Badge variant={status === "done" ? "xp" : status === "in_progress" ? "base" : "streak"}>
                  {status === "done" ? "Пройден" : status === "in_progress" ? "В процессе" : "Не начат"}
                </Badge>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 5: Create lesson learning page (full content + tasks)**

Create `learn/src/app/(learn)/learn/[slug]/[lesson]/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ContentBlockRenderer } from "@/components/content/ContentBlockRenderer";
import { TaskBlock } from "@/components/content/TaskBlock";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { canAccessModule } from "@/lib/services/access";
import type { ContentBlock, Task, TaskOption } from "@/lib/types";

interface Props {
  params: { slug: string; lesson: string };
}

export default async function LessonPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*, modules!inner(id, slug, tier, title), content_blocks(*, tasks(*, task_options(*)))")
    .eq("slug", params.lesson)
    .eq("modules.slug", params.slug)
    .single();

  if (!lesson) notFound();

  const module = (lesson as any).modules;
  const hasAccess = await canAccessModule(supabase, user.id, module.id, module.tier);
  if (!hasAccess) redirect(`/modules/${params.slug}`);

  // Mark as in_progress
  await supabase.from("lesson_progress").upsert(
    { user_id: user.id, lesson_id: lesson.id, status: "in_progress", updated_at: new Date().toISOString() },
    { onConflict: "user_id,lesson_id" }
  );

  const blocks = ((lesson.content_blocks || []) as (ContentBlock & { tasks: (Task & { task_options: TaskOption[] })[] })[])
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <p className="text-sm text-text-secondary mb-2">
        <Link href={`/learn/${params.slug}`} className="hover:text-primary">
          ← {module.title}
        </Link>
      </p>
      <h1 className="text-2xl font-bold mb-8">{lesson.title}</h1>

      <div className="space-y-6">
        {blocks.map((block) => {
          if (block.type === "task" && block.tasks?.[0]) {
            const task = block.tasks[0];
            return <TaskBlock key={block.id} task={{ ...task, options: task.task_options }} />;
          }
          return <ContentBlockRenderer key={block.id} block={block} />;
        })}
      </div>

      <div className="mt-12 text-center">
        <form action={`/api/lessons/${lesson.id}/complete`} method="POST">
          <Button type="submit" size="lg">Урок пройден ✓</Button>
        </form>
      </div>
    </div>
  );
}
```

**Step 6: Create lesson complete API**

Create `learn/src/app/api/lessons/[id]/complete/route.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { XP_BONUSES } from "@/lib/types";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Mark lesson as done
  await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: params.id,
      status: "done",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );

  // Award lesson completion XP via a task_attempt entry (bonus)
  await supabase.from("task_attempts").insert({
    user_id: user.id,
    task_id: params.id, // use lesson id as placeholder
    answer: { type: "lesson_complete" },
    is_correct: true,
    points_earned: XP_BONUSES.LESSON_COMPLETE,
  });

  // Check if all lessons in module are done
  const { data: lesson } = await supabase
    .from("lessons")
    .select("module_id")
    .eq("id", params.id)
    .single();

  if (lesson) {
    const { data: allLessons } = await supabase
      .from("lessons")
      .select("id")
      .eq("module_id", lesson.module_id)
      .eq("is_published", true);

    const { data: completedLessons } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .eq("status", "done")
      .in("lesson_id", (allLessons ?? []).map((l) => l.id));

    if (allLessons && completedLessons && completedLessons.length >= allLessons.length) {
      // Award module completion bonus
      await supabase.from("task_attempts").insert({
        user_id: user.id,
        task_id: lesson.module_id,
        answer: { type: "module_complete" },
        is_correct: true,
        points_earned: XP_BONUSES.MODULE_COMPLETE,
      });
    }
  }

  // Get module slug for redirect
  const { data: lessonWithModule } = await supabase
    .from("lessons")
    .select("modules(slug)")
    .eq("id", params.id)
    .single();

  const moduleSlug = (lessonWithModule as any)?.modules?.slug ?? "";
  redirect(`/learn/${moduleSlug}`);
}
```

**Step 7: Commit**

```bash
git add learn/src/app/\(learn\)/learn/ learn/src/components/content/TaskBlock.tsx learn/src/app/api/ learn/src/lib/services/
git commit -m "feat(learn): add lesson viewer with interactive tasks, XP, streak tracking"
```

---

## Phase 5: Gamification & Social

### Task 15: Achievements and leaderboard pages

**Files:**
- Create: `learn/src/app/(learn)/achievements/page.tsx`
- Create: `learn/src/app/(learn)/leaderboard/page.tsx`
- Create: `learn/src/app/api/leaderboard/refresh/route.ts`

These pages query `achievements`, `user_achievements`, and the materialized views.
Implementation follows the same patterns as Tasks 10-14 — server components with Supabase queries.

**Step 1: Create achievements page**

Create `learn/src/app/(learn)/achievements/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";

export default async function AchievementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: allAchievements }, { data: userAchievements }] = await Promise.all([
    supabase.from("achievements").select("*").order("points"),
    supabase.from("user_achievements").select("achievement_id, earned_at").eq("user_id", user.id),
  ]);

  const earnedIds = new Set(userAchievements?.map((ua) => ua.achievement_id));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Достижения</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {allAchievements?.map((a) => {
          const earned = earnedIds.has(a.id);
          return (
            <Card key={a.id} className={`text-center ${earned ? "" : "opacity-40 grayscale"}`}>
              <div className="text-3xl mb-2">{a.icon_url || "🏆"}</div>
              <h3 className="font-bold text-sm">{a.title}</h3>
              <p className="text-xs text-text-secondary mt-1">{a.description}</p>
              <p className="text-xs text-primary mt-2">{a.points} XP</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Create leaderboard page**

Create `learn/src/app/(learn)/leaderboard/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Use service role for materialized view access
  const { data: weekly } = await supabase
    .from("leaderboard_weekly")
    .select("*")
    .order("weekly_xp", { ascending: false })
    .limit(50);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Рейтинг учеников</h1>

      <div className="space-y-2">
        {weekly?.map((entry, i) => {
          const isMe = entry.user_id === user.id;
          return (
            <Card key={entry.user_id} className={`flex items-center gap-4 py-3 ${isMe ? "border-primary border-2" : ""}`}>
              <span className={`text-lg font-bold w-8 text-center ${i < 3 ? "text-primary" : "text-text-secondary"}`}>
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {entry.display_name || "Ученик"} {isMe && "(вы)"}
                </p>
              </div>
              <Badge variant="streak">{entry.current_streak} дн.</Badge>
              <Badge variant="xp">{entry.weekly_xp} XP</Badge>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add learn/src/app/\(learn\)/achievements/ learn/src/app/\(learn\)/leaderboard/
git commit -m "feat(learn): add achievements and leaderboard pages"
```

---

## Phase 6: Payments

### Task 16: Pricing page and YandexPay integration

**Files:**
- Create: `learn/src/app/(public)/pricing/page.tsx`
- Create: `learn/src/app/api/payments/create/route.ts`
- Create: `learn/src/app/api/payments/webhook/route.ts`
- Create: `learn/src/app/api/payments/create-module/route.ts`
- Create: `learn/src/app/api/promo/activate/route.ts`
- Create: `learn/src/lib/services/yandex-pay.ts`

Implementation details for YandexPay depend on their API docs. The key flows:

1. **Subscription create** → generate YandexPay payment link → redirect user
2. **Webhook handler** → validate signature → update `subscriptions` table
3. **Module purchase** → similar flow → insert into `module_purchases`
4. **Promo activation** → validate code → mark used → create subscription with `base_promo` plan

**Step 1: Create pricing page (static content)**

Create `learn/src/app/(public)/pricing/page.tsx` with subscription tiers and premium modules list (fetched from DB).

**Step 2: Create YandexPay service** with `createPayment()`, `verifyWebhook()` functions.

**Step 3: Create API routes** for payment creation, webhook handling, promo code activation.

**Step 4: Commit**

```bash
git add learn/src/app/\(public\)/pricing/ learn/src/app/api/payments/ learn/src/app/api/promo/ learn/src/lib/services/yandex-pay.ts
git commit -m "feat(learn): add pricing page and YandexPay payment integration"
```

---

## Phase 7: Admin Panel

### Task 17: Admin dashboard and module management

**Files:**
- Create: `learn/src/app/(admin)/admin/page.tsx`
- Create: `learn/src/app/(admin)/admin/modules/page.tsx`
- Create: `learn/src/app/(admin)/admin/modules/[id]/page.tsx`
- Create: `learn/src/app/api/admin/modules/route.ts`

Admin CRUD for modules with drag-n-drop sorting via @dnd-kit.

**Step 1: Create admin dashboard** — stats cards (total students, active subs, revenue, new signups).

**Step 2: Create modules list** — sortable table, create/edit/delete, publish toggle.

**Step 3: Create module editor** — form for title, slug, description, tier, price, cover image upload.

**Step 4: Create API routes** for module CRUD.

**Step 5: Commit**

```bash
git commit -m "feat(learn): add admin dashboard and module management"
```

---

### Task 18: Block-based lesson editor (Tiptap)

**Files:**
- Create: `learn/src/app/(admin)/admin/modules/[id]/[lesson]/page.tsx`
- Create: `learn/src/components/admin/BlockEditor.tsx`
- Create: `learn/src/components/admin/blocks/TextBlockEditor.tsx`
- Create: `learn/src/components/admin/blocks/FormulaBlockEditor.tsx`
- Create: `learn/src/components/admin/blocks/ImageBlockEditor.tsx`
- Create: `learn/src/components/admin/blocks/TaskBlockEditor.tsx`
- Create: `learn/src/app/api/admin/lessons/[id]/blocks/route.ts`

**Key components:**

1. **BlockEditor** — main container with @dnd-kit sortable list, "Add block" button with type selector
2. **TextBlockEditor** — Tiptap rich-text editor instance
3. **FormulaBlockEditor** — LaTeX textarea + live KaTeX preview
4. **ImageBlockEditor** — upload to Supabase Storage + caption input
5. **TaskBlockEditor** — task type selector, question input, options builder, correct answer toggle, difficulty slider

Each block saves independently via API. Drag-n-drop updates `order_index`.

**Step 1-5: Implement each editor component**

**Step 6: Commit**

```bash
git commit -m "feat(learn): add block-based lesson editor with Tiptap, formulas, and task builder"
```

---

### Task 19: Promo code management

**Files:**
- Create: `learn/src/app/(admin)/admin/promo/page.tsx`
- Create: `learn/src/app/api/admin/promo/generate/route.ts`
- Create: `learn/src/app/api/admin/promo/export/route.ts`

**Step 1: Create promo management page** — generate batch form, table of codes with status/usage, CSV export button.

**Step 2: Create generate API** — creates N codes with format `XIMI-XXXX-XXXX` (random alphanumeric).

**Step 3: Create export API** — returns CSV of codes.

**Step 4: Commit**

```bash
git commit -m "feat(learn): add promo code generation and management"
```

---

### Task 20: User management and achievement management

**Files:**
- Create: `learn/src/app/(admin)/admin/users/page.tsx`
- Create: `learn/src/app/(admin)/admin/achievements/page.tsx`

**Step 1: Create users list** — table with email, plan, status, XP, registration date, filters.

**Step 2: Create achievements management** — CRUD for achievements with condition builder (JSON).

**Step 3: Commit**

```bash
git commit -m "feat(learn): add admin user and achievement management"
```

---

## Phase 8: Profile & Polish

### Task 21: Profile page with subscription management

**Files:**
- Create: `learn/src/app/(learn)/profile/page.tsx`
- Create: `learn/src/app/api/auth/logout/route.ts`

Profile page: edit display_name, view/cancel subscription, activate promo code, logout.

---

### Task 22: Seed achievements data

**Files:**
- Create: `learn/supabase/seeds/achievements.sql`

Insert the 9 MVP achievements defined in the design doc.

---

### Task 23: Deploy to Vercel

**Steps:**
1. Create Vercel project linked to repo
2. Set environment variables (Supabase URL/keys, YandexPay credentials)
3. Configure custom domain `learn.ximi4ka.ru`
4. Deploy and verify

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-6 | Project setup, Supabase schema, types |
| 2 | 7-9 | UI components, layouts, auth |
| 3 | 10-12 | Landing, modules catalog, lesson preview |
| 4 | 13-14 | Dashboard, lesson viewer, tasks |
| 5 | 15 | Achievements, leaderboard |
| 6 | 16 | Payments (YandexPay, promo) |
| 7 | 17-20 | Admin panel (editor, promo, users) |
| 8 | 21-23 | Profile, seed data, deploy |

Total: **23 tasks**, estimated **3-5 days** of focused development.
