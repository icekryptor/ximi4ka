import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createPayment } from "@/lib/services/yandex-pay";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await request.json();

  // Check if user has a promo code
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("used_by", user.id)
    .single();

  const amount = promo ? 499 : 999;
  const subscriptionPlan = promo ? "base_promo" : "base";

  try {
    const payment = await createPayment({
      amount,
      description: `Подписка XimiLearn — ${amount} ₽/мес`,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`,
      metadata: {
        user_id: user.id,
        type: "subscription",
        plan: subscriptionPlan,
      },
    });

    return NextResponse.json({ payment_url: payment.confirmation_url });
  } catch {
    return NextResponse.json({ error: "Payment creation failed" }, { status: 500 });
  }
}
