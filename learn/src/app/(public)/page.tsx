import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";

const features = [
  {
    title: "Теория",
    description: "Атомистика, элементы, вещества — понятно и с примерами",
    icon: "flask" as const,
  },
  {
    title: "Реакции",
    description: "Все реакции из школьной программы с пошаговым разбором",
    icon: "atom" as const,
  },
  {
    title: "Задачи",
    description: "Тренажёр задач с мгновенной проверкой и подсказками",
    icon: "potion" as const,
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 px-4 text-center overflow-hidden">
        {/* Radial gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(131,110,254,0.2)_0%,transparent_70%)]" />

        {/* Floating pixel-art decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <PixelIcon name="flask" size={48} className="absolute top-[15%] left-[10%] text-primary/30 animate-float" />
          <PixelIcon name="atom" size={36} className="absolute top-[25%] right-[15%] text-neon-cyan/30 animate-float-slow" />
          <PixelIcon name="molecule" size={40} className="absolute bottom-[20%] left-[20%] text-neon-magenta/30 animate-float-fast" />
          <PixelIcon name="star" size={32} className="absolute top-[60%] right-[10%] text-neon-lime/30 animate-float" />
          <PixelIcon name="potion" size={44} className="absolute bottom-[30%] right-[25%] text-primary/25 animate-float-slow" />
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-100 mb-6">
            Химия — это{" "}
            <span className="text-shimmer animate-shimmer">
              просто
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Интерактивная платформа для изучения химии. Теория, реакции и задачи из школьной программы.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg" glow>Начать бесплатно</Button>
            </Link>
            <Link href="/modules">
              <Button variant="secondary" size="lg">Смотреть модули</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <AnimateOnScroll key={f.title} animation="fade-in-up" delay={i * 100}>
              <Card glass className="text-center h-full">
                <div className="mb-4 flex justify-center">
                  <PixelIcon name={f.icon} size={48} className="text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-gray-400">{f.description}</p>
              </Card>
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">Тарифы</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <AnimateOnScroll animation="fade-in-up" delay={0}>
              <Card glass className="text-left h-full">
                <h3 className="text-xl font-bold mb-2">Подписка</h3>
                <p className="text-3xl font-bold font-mono text-primary text-glow-purple mb-1">
                  999 ₽<span className="text-base font-sans text-gray-400">/мес</span>
                </p>
                <p className="text-sm text-gray-400 mb-4">Доступ ко всем базовым модулям</p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>✓ Все базовые модули</li>
                  <li>✓ Задачи с проверкой</li>
                  <li>✓ Прогресс и достижения</li>
                  <li>✓ Рейтинг учеников</li>
                </ul>
              </Card>
            </AnimateOnScroll>
            <AnimateOnScroll animation="fade-in-up" delay={100}>
              <Card neon="purple" glass className="text-left h-full">
                <h3 className="text-xl font-bold mb-2">С набором Ximi4ka</h3>
                <p className="text-3xl font-bold font-mono text-primary text-glow-purple mb-1">
                  499 ₽<span className="text-base font-sans text-gray-400">/мес</span>
                </p>
                <p className="text-sm text-gray-400 mb-4">Промокод в каждом наборе</p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>✓ Всё из подписки</li>
                  <li>✓ 1 месяц бесплатно</li>
                  <li>✓ Скидка 50%</li>
                </ul>
              </Card>
            </AnimateOnScroll>
          </div>
          <Link href="/pricing" className="inline-block mt-6">
            <Button variant="ghost">Подробнее о тарифах →</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
