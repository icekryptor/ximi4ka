import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  FlaskConical,
  Beaker,
  TestTube,
  Atom,
  Zap,
  Package,
  GraduationCap,
  Mail,
  Phone,
  Send,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";

// Kits catalog (source: ximi4ka.ru product pages, fetched 2026-05-20).
// Prices may drift — update from /tproduct/{slug} if you change packaging.
type KitCard = {
  icon: typeof FlaskConical;
  title: string;
  desc: string;
  price: number;
  oldPrice: number;
  url: string;
  badge?: string;
};
const KITS: KitCard[] = [
  {
    icon: GraduationCap,
    title: "Набор для ОГЭ",
    desc: "31 реактив для подготовки к экзамену + год доступа к онлайн-тренажёру ОГЭ в подарок.",
    price: 3490,
    oldPrice: 6000,
    badge: "Хит для 9-классника",
    // Sold directly on our site (Этап 1 — другие наборы пока через Tilda)
    url: "/kits/oge",
  },
  {
    icon: FlaskConical,
    title: "Химичка 3.0",
    desc: "Основной набор: 161 опыт, подробная методичка, лабораторное оборудование. Возраст 10–18 лет.",
    price: 3299,
    oldPrice: 3500,
    url: "https://ximi4ka.ru/tproduct/279167718312-himichka-30",
  },
  {
    icon: TestTube,
    title: "Мини-Химичка",
    desc: "Стартовый набор с минимальным комплектом посуды и реактивов. Совместим с «Химичкой 3.0».",
    price: 1799,
    oldPrice: 1800,
    url: "https://ximi4ka.ru/tproduct/342501029362-mini-himichka",
  },
  {
    icon: Zap,
    title: "Электрохимичка",
    desc: "Электролиз и окислительно-восстановительные реакции для продвинутых юных химиков.",
    price: 3299,
    oldPrice: 3400,
    url: "https://ximi4ka.ru/tproduct/635072078342-elektrohimichka",
  },
  {
    icon: Package,
    title: "Все три набора",
    desc: "Комбо: «Химичка 3.0» + «Мини-Химичка» + «Электрохимичка». Максимальная скидка.",
    price: 6499,
    oldPrice: 7000,
    badge: "Самое выгодное",
    url: "https://ximi4ka.ru/tproduct/984926446832-vse-tri-nabora",
  },
] as const;

const FAQ = [
  {
    q: "Что входит в подписку?",
    a: "Подписка даёт доступ ко всем базовым модулям платформы: теория по школьной программе, разбор реакций, тренажёры и тесты по ОГЭ. Продвинутые модули (например, олимпиадные задачи) покупаются отдельно.",
  },
  {
    q: "Как активировать набор?",
    a: "В каждом наборе есть карточка с QR-кодом и логином/паролем. Отсканируй QR — попадёшь на платформу с уже активированным доступом. Альтернативно — введи логин и пароль вручную на странице входа.",
  },
  {
    q: "Можно ли вернуть деньги?",
    a: "Да. До первого входа в платный раздел платформы — полный возврат в течение 10 рабочих дней. Подробности — в нашей публичной оферте.",
  },
  {
    q: "С какого возраста подходит?",
    a: "«Мини-Химичка» и «Химичка 3.0» — от 10 до 18 лет под присмотром взрослого. «Электрохимичка» — для тех, кто уже разобрался с базой (от 12 лет). Набор для ОГЭ — для 8–9 классов, готовящихся к экзамену.",
  },
] as const;

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
            Гибридное обучение химии: онлайн-уроки, реальные наборы для опытов и интерактивные тренажёры — всё в одной экосистеме.
          </p>
          <div className="mt-10 flex items-center justify-center">
            <Link href="/dashboard">
              <Button size="lg" glow>
                <span className="inline-flex items-center gap-2">
                  Перейти в платформу
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* О НАС */}
      <section id="about" className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                О нас
              </span>
              <h2 className="font-display text-3xl md:text-5xl font-bold text-text-primary mb-6">
                Химичка — новый способ учить химию
              </h2>
            </div>
          </AnimateOnScroll>
          <AnimateOnScroll delay={100}>
            <p className="text-lg md:text-xl text-text-secondary leading-relaxed text-pretty">
              <b className="text-text-primary">Химичка</b> — это образовательный бренд нового поколения,
              создающий <b className="text-text-primary">гибридный способ обучения</b>: онлайн-уроки,
              оффлайн-наборы для реальных опытов и платформа с интерактивными тренажёрами и тестами.
            </p>
          </AnimateOnScroll>
          <AnimateOnScroll delay={200}>
            <p className="mt-4 text-lg md:text-xl text-text-secondary leading-relaxed text-pretty">
              Наша миссия — сделать химию из скучного, сложного, теоретического предмета{" "}
              <b className="text-text-primary">практической, живой и творческой</b> для максимального
              количества людей всех возрастов.
            </p>
          </AnimateOnScroll>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Atom, label: "Теория", desc: "Учебные модули и разборы" },
              { icon: Beaker, label: "Практика", desc: "Реальные наборы для опытов" },
              { icon: TestTube, label: "Тренажёры", desc: "Тренировка и тесты ОГЭ" },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-sm">{b.label}</p>
                  <p className="text-xs text-text-secondary">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* НАБОРЫ */}
      <section id="kits" className="bg-bg-secondary py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Наборы
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-text-primary mb-3">
              Реальная химия в коробке
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Каждый набор — это методичка, реактивы, оборудование и доступ к онлайн-платформе.
              Ученик ставит опыты руками, теорию повторяет на тренажёрах.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {KITS.map((k, i) => (
              <AnimateOnScroll key={k.title} delay={i * 70}>
                <Card hover className="p-6 h-full flex flex-col relative">
                  {k.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end shadow-glow-purple whitespace-nowrap uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" />
                        {k.badge}
                      </span>
                    </div>
                  )}
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 mt-1">
                    <k.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-text-primary mb-2">
                    {k.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed mb-5 flex-1">
                    {k.desc}
                  </p>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-2xl font-bold text-primary tabular-nums">
                      {k.price.toLocaleString("ru-RU")}
                    </span>
                    <span className="text-sm text-text-secondary">₽</span>
                    {k.oldPrice > k.price && (
                      <span className="text-sm text-text-muted line-through tabular-nums">
                        {k.oldPrice.toLocaleString("ru-RU")} ₽
                      </span>
                    )}
                  </div>
                  {k.url.startsWith("/") ? (
                    <Link href={k.url} className="block">
                      <Button variant="primary" className="w-full">
                        Купить
                      </Button>
                    </Link>
                  ) : (
                    <a href={k.url} target="_blank" rel="noopener noreferrer" className="block">
                      <Button variant="secondary" className="w-full">
                        Купить на ximi4ka.ru
                      </Button>
                    </a>
                  )}
                </Card>
              </AnimateOnScroll>
            ))}
          </div>

          <div className="text-center mt-10">
            <a
              href="https://ximi4ka.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:text-primary-hover transition-colors inline-flex items-center gap-1.5"
            >
              Все наборы на ximi4ka.ru
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ОГЭ МОДУЛЬ — доступ */}
      <section id="oge-access" className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Модуль ОГЭ
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-text-primary mb-3">
              Подготовка к ОГЭ по химии
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Полная база заданий ФИПИ, контрольные тесты с таймером, разбор каждой реакции.
              Два способа получить доступ:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <Card hover className="p-8">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-text-primary mb-2">
                Доступ к модулю
              </h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-primary tabular-nums">349</span>
                <span className="text-text-secondary">₽ / год</span>
              </div>
              <ul className="space-y-2 text-sm text-text-secondary mb-6">
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> Все задания ФИПИ</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> Контрольные тесты с таймером</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> Разбор каждой реакции</li>
              </ul>
              <Link href="/dashboard">
                <Button className="w-full">Купить доступ</Button>
              </Link>
            </Card>

            <Card glass hover className="p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end shadow-glow-purple whitespace-nowrap">
                  <Sparkles className="w-3 h-3" />В комплекте
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 mt-1">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-text-primary mb-2">
                Бесплатно с набором ОГЭ
              </h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-primary">Бесплатно</span>
                <span className="text-sm text-text-secondary">на 1 год</span>
              </div>
              <ul className="space-y-2 text-sm text-text-secondary mb-6">
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> 31 реактив для практики</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> Год доступа к модулю в подарок</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> Активация по QR из коробки</li>
              </ul>
              <Link href="/kits/oge">
                <Button className="w-full">Купить набор ОГЭ</Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* ПОДПИСКА НА ПЛАТФОРМУ */}
      <section id="subscription" className="bg-bg-secondary py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Подписка
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-text-primary mb-3">
              Доступ ко всем базовым модулям
            </h2>
            <p className="text-text-secondary">
              Подписка открывает базовые модули. Продвинутые — отдельно.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <Card hover className="p-8 flex flex-col">
              <h3 className="font-display text-2xl font-bold text-text-primary mb-2">
                Месячная
              </h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-primary tabular-nums">299</span>
                <span className="text-text-secondary">₽/мес</span>
              </div>
              <ul className="space-y-2 text-text-secondary text-sm mb-6">
                <li>✓ Все базовые модули</li>
                <li>✓ Тренажёры и тесты ОГЭ</li>
                <li>✓ Прогресс и достижения</li>
                <li>✓ Отмена в любой момент</li>
              </ul>
              {/* CTA-кнопки на лендинге включаем флагом NEXT_PUBLIC_SHOW_PRICING_CTA.
                  Пока T-Bank не отлажен — держим скрытыми, чтобы случайные посетители
                  не нашли mock-pay. Тестируем через /admin/payments-test. */}
              {process.env.NEXT_PUBLIC_SHOW_PRICING_CTA === "true" && (
                <Link href="/checkout/subscription?period=monthly" className="mt-auto">
                  <Button variant="secondary" className="w-full">Оформить месячную</Button>
                </Link>
              )}
            </Card>

            <Card glass hover className="p-8 relative flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end shadow-glow-purple whitespace-nowrap">
                  <Sparkles className="w-3 h-3" />
                  Выгоднее на 28%
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold text-text-primary mb-2 mt-2">
                Годовая
              </h3>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-bold text-primary tabular-nums">2 590</span>
                <span className="text-text-secondary">₽/год</span>
              </div>
              <p className="text-sm text-text-muted mb-4">≈ 216 ₽/мес — экономия 998 ₽</p>
              <ul className="space-y-2 text-text-secondary text-sm mb-6">
                <li>✓ Всё из месячной</li>
                <li>✓ Целый учебный год</li>
                <li>✓ Один платёж — без перерывов</li>
              </ul>
              {process.env.NEXT_PUBLIC_SHOW_PRICING_CTA === "true" && (
                <Link href="/checkout/subscription?period=yearly" className="mt-auto">
                  <Button className="w-full" glow>Оформить годовую</Button>
                </Link>
              )}
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

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              FAQ
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-text-primary">
              Частые вопросы
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-border bg-white p-5 md:p-6 transition-all hover:border-primary/30 [&[open]]:border-primary/40"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
                  <span className="font-display text-base md:text-lg font-bold text-text-primary">
                    {item.q}
                  </span>
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary text-sm font-bold group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-text-secondary leading-relaxed text-[15px]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* КОНТАКТЫ */}
      <section id="contacts" className="bg-bg-secondary py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Контакты
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-text-primary mb-3">
              Свяжись с нами
            </h2>
            <p className="text-text-secondary">
              Отвечаем по будням в течение нескольких часов
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="mailto:info@ximi4ka.ru"
              className="group rounded-2xl border border-border bg-white p-6 hover:border-primary/40 hover:shadow-md transition-all flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-text-primary mb-1">Почта</p>
              <p className="text-sm text-primary">info@ximi4ka.ru</p>
            </a>

            <a
              href="tel:+79859938311"
              className="group rounded-2xl border border-border bg-white p-6 hover:border-primary/40 hover:shadow-md transition-all flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-text-primary mb-1">Телефон</p>
              <p className="text-sm text-primary tabular-nums">+7 985 993-83-11</p>
            </a>

            <a
              href="https://t.me/ximi4ka_support"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-border bg-white p-6 hover:border-primary/40 hover:shadow-md transition-all flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Send className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-text-primary mb-1">Telegram</p>
              <p className="text-sm text-primary">@ximi4ka_support</p>
            </a>
          </div>

          <p className="text-center text-xs text-text-muted mt-8">
            ИП Аистов Василий Андреевич · ИНН 431401950080 · ОГРНИП 319435000027879
          </p>
        </div>
      </section>
    </main>
  );
}
