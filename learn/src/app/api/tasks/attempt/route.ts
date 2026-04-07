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
      .filter((o: { is_correct: boolean }) => o.is_correct)
      .map((o: { id: string }) => o.id)
      .sort();
    const selectedIds = (answer.selected as string[]).sort();
    is_correct = JSON.stringify(correctIds) === JSON.stringify(selectedIds);
  } else if (task.type === "numeric_input") {
    const correctValues = task.task_options
      .filter((o: { is_correct: boolean }) => o.is_correct)
      .map((o: { text: string }) => parseFloat(o.text));
    is_correct = correctValues.includes(answer.value);
  }

  // Count previous attempts for XP multiplier
  const { count: attemptCount } = await supabase
    .from("task_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("task_id", task_id);

  let multiplier: number = XP_MULTIPLIERS.FIRST_ATTEMPT;
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
