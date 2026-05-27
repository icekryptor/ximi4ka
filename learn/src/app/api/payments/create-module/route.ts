import { createClient, getCachedUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createPayment } from "@/lib/services/yandex-pay";

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { module_id } = await request.json();

  const { data: module } = await supabase
    .from("modules")
    .select("id, title, price")
    .eq("id", module_id)
    .eq("tier", "premium")
    .single();

  if (!module || !module.price) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  // Check if already purchased
  const { data: existing } = await supabase
    .from("module_purchases")
    .select("id")
    .eq("user_id", user.id)
    .eq("module_id", module_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Already purchased" }, { status: 400 });
  }

  try {
    const payment = await createPayment({
      amount: module.price,
      description: `Модуль: ${module.title}`,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/learn/${module_id}?payment=success`,
      metadata: {
        user_id: user.id,
        type: "module_purchase",
        module_id: module.id,
      },
    });

    return NextResponse.json({ payment_url: payment.confirmation_url });
  } catch {
    return NextResponse.json({ error: "Payment creation failed" }, { status: 500 });
  }
}
