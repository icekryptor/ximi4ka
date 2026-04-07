import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

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

  // Get module slug for redirect
  const { data: lesson } = await supabase
    .from("lessons")
    .select("module_id, modules(slug)")
    .eq("id", params.id)
    .single();

  const moduleSlug = (lesson as any)?.modules?.slug ?? "";
  return NextResponse.redirect(new URL(`/learn/${moduleSlug}`, request.url));
}
