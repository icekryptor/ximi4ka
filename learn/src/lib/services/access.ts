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
