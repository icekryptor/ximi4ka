import { createClient, getCachedUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { adminClient } from "@/lib/kit-assignment";
import { getUserTotalXp } from "@/lib/user-rank";
import { getRankState, applyDiscount } from "@/lib/ranks";

// POST /api/payments/create
//
// Creates a subscription payment session.
//   1. Verify auth.
//   2. Compute price (base × rank-discount).
//   3. Insert pending row in `subscriptions` (status='pending').
//   4. Call current payment provider (mock by default — see PAYMENT_PROVIDER env).
//   5. Return { payment_url } so the client can redirect.
//
// The webhook at /api/payments/webhook/[provider] flips status=pending→active
// and sets expires_at. Until that fires, the user has no access (status='pending'
// is excluded from the `hasActiveAccess` query in src/lib/access.ts).
//
// Source of truth for pricing — keep in sync with /(public)/pricing/page.tsx.
const PRICE_MONTHLY = 299;
const PRICE_YEARLY = 2590;

type Period = "monthly" | "yearly";

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { period?: string; override_amount?: number } = {};
  try {
    body = await request.json();
  } catch {
    // Body optional — default to monthly
  }
  const period: Period = body.period === "yearly" ? "yearly" : "monthly";

  // Rank discount (gamification — read-only here, write-side lives in /lib/ranks)
  const totalXp = await getUserTotalXp(supabase, user.id);
  const { rank } = getRankState(totalXp);

  const baseAmount = period === "yearly" ? PRICE_YEARLY : PRICE_MONTHLY;
  let finalAmount = applyDiscount(baseAmount, rank.discountPct);
  const plan = period === "yearly" ? "base_yearly" : "base";
  const periodLabel = period === "yearly" ? "₽/год" : "₽/мес";

  // Admin-only override — used by /admin/payments-test to issue 1₽ test
  // transactions against the live T-Bank terminal. Validated server-side
  // against profiles.role so a normal user can't tamper with the body.
  if (typeof body.override_amount === "number" && body.override_amount > 0) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (prof?.role === "admin") {
      finalAmount = Math.round(body.override_amount);
    }
  }

  const provider = getPaymentProvider();
  const admin = adminClient();

  // 1) Insert pending subscription row. The expires_at is a placeholder
  //    (now()) — webhook overwrites it once paid. status='pending' keeps it
  //    out of access checks until then.
  const { data: sub, error: insertErr } = await admin
    .from("subscriptions")
    .insert({
      user_id: user.id,
      plan,
      period,
      status: "pending",
      base_amount: baseAmount,
      discount_pct: rank.discountPct,
      rank_at_purchase: rank.key,
      payment_provider: provider.name,
      // expires_at + started_at fall back to the column DEFAULT (now()), webhook
      // sets the real values on success.
    })
    .select("id")
    .single();

  if (insertErr || !sub) {
    console.error("[payments/create] insert failed:", insertErr);
    return NextResponse.json({ error: "Не удалось создать подписку" }, { status: 500 });
  }

  // 2) Open payment session at provider
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://learn.ximi4ka.ru";
  try {
    const payment = await provider.createPayment({
      amount: finalAmount,
      description: `Подписка XimiLearn — ${finalAmount} ${periodLabel} (${rank.name}, скидка ${rank.discountPct}%)`,
      // Distinct landing pages for the two outcomes — both pages know the
      // subscription_id via ?order_id and can render the right state.
      returnUrl: `${base}/checkout/subscription/success?order_id=${sub.id}`,
      failUrl: `${base}/checkout/subscription/fail?order_id=${sub.id}`,
      webhookUrl: `${base}/api/payments/webhook/${provider.name}`,
      orderId: sub.id,
      customerEmail: user.email ?? "no-email@ximi4ka.ru",
    });

    await admin
      .from("subscriptions")
      .update({ payment_id: payment.paymentId })
      .eq("id", sub.id);

    return NextResponse.json({
      subscription_id: sub.id,
      payment_url: payment.confirmationUrl,
    });
  } catch (e) {
    console.error("[payments/create] provider failed:", e);
    // Subscription stays pending — admin can manually mark, or user can retry.
    return NextResponse.json({ error: "Платёжный сервис недоступен. Попробуйте позже." }, { status: 502 });
  }
}
