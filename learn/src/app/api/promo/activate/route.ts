import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await request.json();

  // Find promo code
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("is_used", false)
    .single();

  if (!promo) {
    return NextResponse.json({ error: "Промокод не найден или уже использован" }, { status: 404 });
  }

  // Mark as used
  await supabase
    .from("promo_codes")
    .update({ is_used: true, used_by: user.id, used_at: new Date().toISOString() })
    .eq("id", promo.id);

  // Create free subscription (1 month free)
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + promo.free_months);

  await supabase.from("subscriptions").insert({
    user_id: user.id,
    plan: "base_promo",
    status: "active",
    expires_at: expiresAt.toISOString(),
  });

  return NextResponse.json({ success: true, plan: "base_promo", free_months: promo.free_months });
}
