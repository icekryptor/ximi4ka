import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Module } from "@/lib/types";

export const metadata = {
  title: "Тарифы — XimiLearn",
  description: "Подписка и модули для изучения химии",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: premiumModules } = await supabase
    .from("modules")
    .select("id, title, slug, price, description")
    .eq("tier", "premium")
    .eq("is_published", true)
    .order("order_index");

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-14">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-text-primary mb-3">
          Тарифы
        </h1>
        <p className="text-text-secondary text-lg">Выберите подходящий вариант</p>
      </div>

      {/* Subscription tiers */}
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-20">
        <Card hover className="p-8">
          <h3 className="font-display text-2xl font-bold text-text-primary mb-2">Подписка</h3>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-bold text-primary tabular-nums">999</span>
            <span className="text-text-secondary">₽/мес</span>
          </div>
          <p className="text-sm text-text-muted mb-6">Все базовые модули</p>
          <ul className="space-y-3 text-text-secondary mb-8">
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span> Все базовые модули
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span> Интерактивные задачи
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span> Прогресс и достижения
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span> Рейтинг учеников
            </li>
          </ul>
          <Link href="/checkout/subscription">
            <Button className="w-full">Оформить подписку</Button>
          </Link>
        </Card>

        <Card glass hover className="p-8 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end shadow-glow-purple whitespace-nowrap">
              <Sparkles className="w-3 h-3" />
              С набором Ximi4ka
            </span>
          </div>
          <h3 className="font-display text-2xl font-bold text-text-primary mb-2 mt-2">
            Подписка со скидкой
          </h3>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-bold text-primary tabular-nums">499</span>
            <span className="text-text-secondary">₽/мес</span>
          </div>
          <p className="text-sm text-text-muted mb-6">Промокод в каждом наборе</p>
          <ul className="space-y-3 text-text-secondary mb-8">
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span> Всё из обычной подписки
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span> 1 месяц бесплатно
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">✓</span> Скидка 50% навсегда
            </li>
          </ul>
          <Link href="/register">
            <Button className="w-full">Активировать промокод</Button>
          </Link>
        </Card>
      </div>

      {/* Premium modules */}
      {premiumModules && premiumModules.length > 0 && (
        <>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary text-center mb-8">
            Продвинутые модули
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(premiumModules as Module[]).map((m) => (
              <Card key={m.id} hover className="p-6">
                <h3 className="font-display font-bold text-text-primary mb-1">{m.title}</h3>
                <p className="text-sm text-text-secondary mb-4 line-clamp-2">{m.description}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-primary">{m.price} ₽</p>
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
