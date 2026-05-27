import { createClient, getCachedUser } from "@/lib/supabase/server";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Module } from "@/lib/types";
import { getUserTotalXp } from "@/lib/user-rank";
import { getRankState, applyDiscount } from "@/lib/ranks";
import { Sparkles } from "lucide-react";

export const metadata = {
  title: "Тарифы — XimiLearn",
  description: "Подписка на базовые модули и отдельные продвинутые модули",
};

// Pricing (per user, 2026-05-20):
//   • Базовая подписка: 299 ₽/мес  ИЛИ  2 590 ₽/год
//   • Премиум-модули — отдельно (старая логика, тут уже работает)
//
// Rank discount system still applies to subscriptions (см. /lib/ranks).
const PRICE_MONTHLY = 299;
const PRICE_YEARLY = 2590;
const MONTHLY_EQUIV_YEARLY = Math.round(PRICE_YEARLY / 12);
const YEARLY_SAVINGS = PRICE_MONTHLY * 12 - PRICE_YEARLY;

export default async function PricingPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  let rankState = getRankState(0);
  if (user) {
    const totalXp = await getUserTotalXp(supabase, user.id);
    rankState = getRankState(totalXp);
  }
  const discount = rankState.rank.discountPct;
  const RankIcon = rankState.rank.Icon;

  const monthlyPrice = applyDiscount(PRICE_MONTHLY, discount);
  const yearlyPrice = applyDiscount(PRICE_YEARLY, discount);

  const { data: premiumModules } = await supabase
    .from("modules")
    .select("id, title, slug, price, description")
    .eq("tier", "premium")
    .eq("is_published", true)
    .order("order_index");

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-text-primary mb-3">
          Тарифы
        </h1>
        <p className="text-text-secondary text-lg">
          Подписка — все базовые модули. Продвинутые — отдельно.
        </p>
      </div>

      {/* Rank discount banner */}
      {discount > 0 && (
        <div
          className="rounded-2xl p-4 mb-10 flex items-center gap-3 border max-w-3xl mx-auto"
          style={{ background: `${rankState.rank.hex}1f`, borderColor: `${rankState.rank.hex}40` }}
        >
          <RankIcon className="w-6 h-6 flex-shrink-0" style={{ color: rankState.rank.hex }} />
          <div>
            <p className="text-sm text-text-primary">
              <strong>Твой ранг:</strong> {rankState.rank.name}
            </p>
            <p className="text-xs text-text-secondary">
              Действует скидка <strong>{discount}%</strong> на любую подписку. Применяется автоматически.
            </p>
          </div>
        </div>
      )}

      {/* Subscription tiers — monthly vs yearly */}
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-20">
        {/* Месячная */}
        <Card hover className="p-8">
          <h3 className="font-display text-2xl font-bold text-text-primary mb-2">Месячная</h3>
          <div className="flex items-baseline gap-2 mb-1">
            {discount > 0 ? (
              <>
                <span className="text-text-muted line-through text-lg tabular-nums">{PRICE_MONTHLY} ₽</span>
                <span className="text-4xl font-bold text-primary tabular-nums">{monthlyPrice}</span>
                <span className="text-text-secondary">₽/мес</span>
                <span className="text-xs text-primary font-semibold">−{discount}%</span>
              </>
            ) : (
              <>
                <span className="text-4xl font-bold text-primary tabular-nums">{PRICE_MONTHLY}</span>
                <span className="text-text-secondary">₽/мес</span>
              </>
            )}
          </div>
          <p className="text-sm text-text-muted mb-6">Гибкая оплата помесячно</p>
          <ul className="space-y-3 text-text-secondary mb-8">
            <li className="flex gap-2"><span className="text-primary font-bold">✓</span> Все базовые модули</li>
            <li className="flex gap-2"><span className="text-primary font-bold">✓</span> Тренажёры и тесты ОГЭ</li>
            <li className="flex gap-2"><span className="text-primary font-bold">✓</span> Прогресс и достижения</li>
            <li className="flex gap-2"><span className="text-primary font-bold">✓</span> Отмена в любой момент</li>
          </ul>
          <Link href="/checkout/subscription?period=monthly">
            <Button className="w-full">Оформить месячную</Button>
          </Link>
        </Card>

        {/* Годовая */}
        <Card glass hover className="p-8 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end shadow-glow-purple whitespace-nowrap">
              <Sparkles className="w-3 h-3" />
              Выгоднее на 28%
            </span>
          </div>
          <h3 className="font-display text-2xl font-bold text-text-primary mb-2 mt-2">Годовая</h3>
          <div className="flex items-baseline gap-2 mb-1">
            {discount > 0 ? (
              <>
                <span className="text-text-muted line-through text-lg tabular-nums">{PRICE_YEARLY} ₽</span>
                <span className="text-4xl font-bold text-primary tabular-nums">{yearlyPrice}</span>
                <span className="text-text-secondary">₽/год</span>
                <span className="text-xs text-primary font-semibold">−{discount}%</span>
              </>
            ) : (
              <>
                <span className="text-4xl font-bold text-primary tabular-nums">{PRICE_YEARLY.toLocaleString("ru-RU")}</span>
                <span className="text-text-secondary">₽/год</span>
              </>
            )}
          </div>
          <p className="text-sm text-text-muted mb-6">
            ≈ {MONTHLY_EQUIV_YEARLY} ₽/мес · экономия {YEARLY_SAVINGS} ₽
          </p>
          <ul className="space-y-3 text-text-secondary mb-8">
            <li className="flex gap-2"><span className="text-primary font-bold">✓</span> Всё из месячной</li>
            <li className="flex gap-2"><span className="text-primary font-bold">✓</span> Целый учебный год доступа</li>
            <li className="flex gap-2"><span className="text-primary font-bold">✓</span> Один платёж — без перерывов</li>
          </ul>
          <Link href="/checkout/subscription?period=yearly">
            <Button className="w-full">Оформить годовую</Button>
          </Link>
        </Card>
      </div>

      {/* Premium modules — sold separately */}
      {premiumModules && premiumModules.length > 0 && (
        <>
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary mb-2">
              Продвинутые модули
            </h2>
            <p className="text-sm text-text-secondary">
              Покупаются отдельно — не входят в базовую подписку
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(premiumModules as Module[]).map((m) => (
              <Card key={m.id} hover className="p-6">
                <h3 className="font-display font-bold text-text-primary mb-1">{m.title}</h3>
                <p className="text-sm text-text-secondary mb-4 line-clamp-2">{m.description}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-primary tabular-nums">{m.price} ₽</p>
                  <Link href={`/checkout/module/${m.id}`}>
                    <Button size="sm">Купить</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
