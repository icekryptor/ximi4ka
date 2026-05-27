import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.text();
  const data = JSON.parse(body);

  // TODO: Verify webhook signature
  // const signature = request.headers.get("x-yandex-pay-signature") ?? "";
  // if (!verifyWebhookSignature(body, signature)) {
  //   return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  // }

  const supabase = await createClient();
  const metadata = data.metadata || {};

  if (data.status === "succeeded") {
    if (metadata.type === "subscription") {
      // Period drives expiry: yearly → +12 mo, monthly → +1 mo.
      // Falls back to monthly for legacy payloads w/o `period` metadata.
      const period = metadata.period === "yearly" ? "yearly" : "monthly";
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + (period === "yearly" ? 12 : 1));

      await supabase.from("subscriptions").insert({
        user_id: metadata.user_id,
        plan: metadata.plan || "base",
        status: "active",
        expires_at: expiresAt.toISOString(),
        yandex_pay_id: data.payment_id,
        base_amount: metadata.base_amount != null ? Number(metadata.base_amount) : null,
        discount_pct: metadata.discount_pct != null ? Number(metadata.discount_pct) : 0,
        rank_at_purchase: metadata.rank_at_purchase ?? null,
      });
    } else if (metadata.type === "module_purchase") {
      await supabase.from("module_purchases").insert({
        user_id: metadata.user_id,
        module_id: metadata.module_id,
        price_paid: data.amount?.value || 0,
        yandex_pay_id: data.payment_id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
