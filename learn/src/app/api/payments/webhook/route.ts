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
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await supabase.from("subscriptions").insert({
        user_id: metadata.user_id,
        plan: metadata.plan || "base",
        status: "active",
        expires_at: expiresAt.toISOString(),
        yandex_pay_id: data.payment_id,
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
