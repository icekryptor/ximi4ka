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
