import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

const XP_PER_CORRECT = 20;

// Award XP for solving a Задание-23 task in the OGE lab tool.
// Same-origin iframe request — uses session cookies.
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { task_target?: string; difficulty?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { error } = await supabase.from("task_attempts").insert({
    user_id: user.id,
    task_id: null,
    answer: { source: "lab", task_target: body.task_target ?? null },
    is_correct: true,
    points_earned: XP_PER_CORRECT,
    source: "tool_lab",
    tool_meta: {
      task_target: body.task_target ?? null,
      difficulty: body.difficulty ?? null,
    },
  });

  if (error) {
    console.error("lab-xp insert failed:", error);
    return NextResponse.json({ error: "Failed to record XP" }, { status: 500 });
  }

  return NextResponse.json({ success: true, xp_awarded: XP_PER_CORRECT });
}
