import Link from "next/link";
import {
  Atom,
  TestTube,
  Beaker,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";

export default function HomePage() {
  return (
    <main className="flex-1">
      {/* HERO */}
      <section className="bg-hero-light relative">
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
          <h1 className="font-display text-5xl md:text-7xl font-bold text-text-primary leading-tight tracking-tight text-balance">
            Химия — это{" "}
            <span className="text-shimmer animate-shimmer">просто</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-text-secondary max-w-2xl mx-auto text-pretty">
            Интерактивная платформа для изучения химии. Теория, реакции и задачи из школьной программы.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" glow>
                Начать бесплатно
              </Button>
            </Link>
            <Link href="/modules">
              <Button size="lg" variant="secondary">
                Смотреть модули
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-bg-secondary py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-text-primary text-center mb-14">
            Всё, что нужно для химии
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Atom, title: "Теория", desc: "Атомистика, элементы, вещества — понятно и с примерами" },
              { icon: Beaker, title: "Реакции", desc: "Все реакции из школьной программы с пошаговым разбором" },
              { icon: TestTube, title: "Задачи", desc: "Тренажёр задач с мгновенной проверкой и подсказками" },
            ].map((f, i) => (
              <AnimateOnScroll key={f.title} delay={i * 100}>
                <Card hover className="p-8 h-full">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                    <f.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-text-primary mb-2">
                    {f.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed">{f.desc}</p>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-text-primary text-center mb-14">
            Тарифы
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card hover className="p-8">
              <h3 className="font-display text-2xl font-bold text-text-primary mb-2">
                Подписка
              </h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-primary tabular-nums">
                  990
                </span>
                <span className="text-text-secondary">₽/мес</span>
              </div>
              <ul className="space-y-2 text-text-secondary">
                <li>✓ Все базовые модули</li>
                <li>✓ Задачи с проверкой</li>
                <li>✓ Прогресс и достижения</li>
                <li>✓ Рейтинг учеников</li>
              </ul>
            </Card>

            <Card glass hover className="p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end shadow-glow-purple">
                  <Sparkles className="w-3 h-3" />
                  С набором
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold text-text-primary mb-2">
                С набором Ximi4ka
              </h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-primary tabular-nums">
                  499
                </span>
                <span className="text-text-secondary">₽/мес</span>
              </div>
              <p className="text-sm text-text-muted mb-3">Промокод в каждом наборе</p>
              <ul className="space-y-2 text-text-secondary">
                <li>✓ Всё из подписки</li>
                <li>✓ 1 месяц бесплатно</li>
                <li>✓ Скидка 50%</li>
              </ul>
            </Card>
          </div>

          <div className="text-center mt-10">
            <Link
              href="/pricing"
              className="text-primary font-medium hover:text-primary-hover transition-colors"
            >
              Подробнее о тарифах →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
