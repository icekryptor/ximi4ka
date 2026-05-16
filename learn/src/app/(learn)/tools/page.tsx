import { hasActiveAccess } from "@/lib/access";
import Link from "next/link";
import { Beaker, Atom, Table, Lock } from "lucide-react";

interface ToolCard {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const TOOLS: ToolCard[] = [
  {
    href: "/tools/lab",
    icon: <Beaker className="w-8 h-8 text-primary" />,
    title: "Тренажёр ОГЭ",
    description: "Интерактивный симулятор химических реакций для подготовки к ОГЭ",
  },
  {
    href: "/tools/periodic",
    icon: <Atom className="w-8 h-8 text-primary" />,
    title: "Таблица Менделеева",
    description: "Интерактивная периодическая таблица с подробными карточками элементов",
  },
  {
    href: "/tools/solubility",
    icon: <Table className="w-8 h-8 text-primary" />,
    title: "Таблица растворимости",
    description: "Справочная таблица растворимости солей, кислот и оснований",
  },
];

export default async function ToolsPage() {
  const { hasAccess } = await hasActiveAccess();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2 text-dark-text font-display">
        Инструменты
      </h1>
      <p className="text-dark-text-secondary mb-8">
        Интерактивные справочники и тренажёры для подготовки к ОГЭ по химии
      </p>

      {!hasAccess && (
        <div className="flex items-center gap-4 p-5 mb-8 rounded-2xl bg-primary/10 border border-primary/20">
          <Lock className="w-6 h-6 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-dark-text">
              Инструменты доступны при наличии активного доступа
            </p>
            <p className="text-sm text-dark-text-secondary mt-0.5">
              Получите доступ к лабораториям, таблицам и тренажёрам с набором для ОГЭ
            </p>
          </div>
          <Link
            href="/pricing"
            className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors whitespace-nowrap"
          >
            Купить набор для ОГЭ &rarr;
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
        {TOOLS.map((tool) => {
          const inner = (
            <div
              className={[
                "p-6 rounded-2xl border border-white/[0.08] bg-dark-surface transition-colors",
                hasAccess
                  ? "hover:bg-dark-surface-hover hover:border-primary/20 cursor-pointer"
                  : "opacity-60 cursor-not-allowed",
              ].join(" ")}
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                {tool.icon}
              </div>
              <h2 className="text-lg font-bold text-dark-text mb-1">{tool.title}</h2>
              <p className="text-sm text-dark-text-secondary leading-relaxed">
                {tool.description}
              </p>
            </div>
          );

          if (!hasAccess) {
            return (
              <div key={tool.href} className="block" aria-disabled>
                {inner}
              </div>
            );
          }

          return (
            <Link key={tool.href} href={tool.href} className="block">
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
