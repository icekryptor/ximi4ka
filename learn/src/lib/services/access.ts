import { SupabaseClient } from "@supabase/supabase-js";

export async function canAccessModule(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
  moduleTier: string
): Promise<boolean> {
  if (moduleTier === "base") {
    // 1. Kit-based access via user_modules (OGE kit, etc.)
    const { data: kitModule } = await supabase
      .from("user_modules")
      .select("id")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (kitModule) return true;

    // 2. Legacy subscription (paid / promo)
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

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
