import { createClient, getCachedUser } from "@/lib/supabase/server";

export type AccessSource = "kit" | "paid" | "admin" | "subscription";

export interface AccessResult {
  authed: boolean;
  hasAccess: boolean;
  source?: AccessSource;
}

/**
 * Unified access gate for any protected content behind an active subscription.
 *
 * Priority:
 * 1. user_modules (kit-based access, e.g. OGE kit QR code)
 * 2. subscriptions (legacy paid/promo subscription)
 *
 * Returns { authed: false, hasAccess: false } when no session exists.
 */
export async function hasActiveAccess(): Promise<AccessResult> {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    return { authed: false, hasAccess: false };
  }

  // 1. Kit-based access via user_modules (any active row grants access)
  const { data: kitModules } = await supabase
    .from("user_modules")
    .select("module_id")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (kitModules && kitModules.length > 0) {
    return { authed: true, hasAccess: true, source: "kit" };
  }

  // 2. Legacy subscription (paid / promo)
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sub) {
    return { authed: true, hasAccess: true, source: "subscription" };
  }

  return { authed: true, hasAccess: false };
}
