import { SupabaseClient } from "@supabase/supabase-js";

export async function canAccessModule(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
  moduleTier: string
): Promise<boolean> {
  if (moduleTier === "base") {
    // 1. Kit-based access via user_modules (OGE kit, etc.)
    // Any active user_modules row grants access to all base-tier modules.
    const { data: kitModules } = await supabase
      .from("user_modules")
      .select("module_id")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (kitModules && kitModules.length > 0) return true;

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
