import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center mb-2">Тарифы</h1>
      <p className="text-text-secondary text-center mb-12">Выберите подходящий вариант</p>

      {/* Subscription tiers */}
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16">
        <Card className="text-left">
          <h3 className="text-xl font-bold mb-2">Подписка</h3>
          <p className="text-4xl font-bold text-primary mb-1">
            999 ₽<span className="text-lg text-text-secondary font-normal">/мес</span>
          </p>
          <p className="text-sm text-text-secondary mb-6">Все базовые модули</p>
          <ul className="space-y-3 text-sm mb-8">
            <li className="flex gap-2"><span className="text-green-500">✓</span> Все базовые модули</li>
            <li className="flex gap-2"><span className="text-green-500">✓</span> Интерактивные задачи</li>
            <li className="flex gap-2"><span className="text-green-500">✓</span> Прогресс и достижения</li>
            <li className="flex gap-2"><span className="text-green-500">✓</span> Рейтинг учеников</li>
          </ul>
          <Link href="/checkout/subscription">
            <Button className="w-full">Оформить подписку</Button>
          </Link>
        </Card>

        <Card className="text-left border-primary border-2 relative">
          <div className="absolute -top-3 left-6">
            <Badge variant="premium">С набором Ximi4ka</Badge>
          </div>
          <h3 className="text-xl font-bold mb-2 mt-2">Подписка со скидкой</h3>
          <p className="text-4xl font-bold text-primary mb-1">
            499 ₽<span className="text-lg text-text-secondary font-normal">/мес</span>
          </p>
          <p className="text-sm text-text-secondary mb-6">Промокод в каждом наборе</p>
          <ul className="space-y-3 text-sm mb-8">
            <li className="flex gap-2"><span className="text-green-500">✓</span> Всё из обычной подписки</li>
            <li className="flex gap-2"><span className="text-green-500">✓</span> 1 месяц бесплатно</li>
            <li className="flex gap-2"><span className="text-green-500">✓</span> Скидка 50% навсегда</li>
          </ul>
          <Link href="/register">
            <Button className="w-full">Активировать промокод</Button>
          </Link>
        </Card>
      </div>

      {/* Premium modules */}
      {premiumModules && premiumModules.length > 0 && (
        <>
          <h2 className="text-2xl font-bold text-center mb-8">Продвинутые модули</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(premiumModules as Module[]).map((m) => (
              <Card key={m.id}>
                <h3 className="font-bold mb-1">{m.title}</h3>
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
