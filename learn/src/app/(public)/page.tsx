import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const features = [
  {
    title: "Теория",
    description: "Атомистика, элементы, вещества — понятно и с примерами",
    icon: "📖",
  },
  {
    title: "Реакции",
    description: "Все реакции из школьной программы с пошаговым разбором",
    icon: "⚗️",
  },
  {
    title: "Задачи",
    description: "Тренажёр задач с мгновенной проверкой и подсказками",
    icon: "🧮",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="py-20 px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-text-dark mb-6">
          Химия — это{" "}
          <span className="bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end bg-clip-text text-transparent">
            просто
          </span>
        </h1>
        <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-8">
          Интерактивная платформа для изучения химии. Теория, реакции и задачи из школьной программы.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/register">
            <Button size="lg">Начать бесплатно</Button>
          </Link>
          <Link href="/modules">
            <Button variant="secondary" size="lg">Смотреть модули</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-bg-light">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} glass className="text-center">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-text-secondary">{f.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">Тарифы</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="text-left">
              <h3 className="text-xl font-bold mb-2">Подписка</h3>
              <p className="text-3xl font-bold text-primary mb-1">999 ₽<span className="text-base text-text-secondary">/мес</span></p>
              <p className="text-sm text-text-secondary mb-4">Доступ ко всем базовым модулям</p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>✓ Все базовые модули</li>
                <li>✓ Задачи с проверкой</li>
                <li>✓ Прогресс и достижения</li>
                <li>✓ Рейтинг учеников</li>
              </ul>
            </Card>
            <Card className="text-left border-primary border-2">
              <h3 className="text-xl font-bold mb-2">С набором Ximi4ka</h3>
              <p className="text-3xl font-bold text-primary mb-1">499 ₽<span className="text-base text-text-secondary">/мес</span></p>
              <p className="text-sm text-text-secondary mb-4">Промокод в каждом наборе</p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>✓ Всё из подписки</li>
                <li>✓ 1 месяц бесплатно</li>
                <li>✓ Скидка 50%</li>
              </ul>
            </Card>
          </div>
          <Link href="/pricing" className="inline-block mt-6">
            <Button variant="ghost">Подробнее о тарифах →</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
