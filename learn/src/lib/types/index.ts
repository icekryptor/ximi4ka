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
  STREAK_DAILY: 5,
} as const;

export const DIFFICULTY_POINTS: Record<number, number> = {
  1: 10,
  2: 20,
  3: 35,
  4: 50,
  5: 75,
};
