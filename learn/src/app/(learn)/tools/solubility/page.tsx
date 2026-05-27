import { hasActiveAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SolubilityTablePage() {
  const { hasAccess } = await hasActiveAccess();
  if (!hasAccess) redirect("/tools");

  return (
    <div className="max-w-screen-2xl mx-auto py-4 md:py-6 px-3 md:px-10">
      <div className="flex items-center gap-2 text-sm text-dark-text-secondary mb-4">
        <Link href="/tools" className="hover:text-dark-text transition-colors">
          Инструменты
        </Link>
        <span>/</span>
        <span className="text-dark-text">Таблица растворимости</span>
      </div>

      <h1 className="text-2xl font-bold text-dark-text mb-5 font-display">
        Таблица растворимости
      </h1>

      <iframe
        src="/tools/solubility.html"
        title="Таблица растворимости веществ"
        className="w-full rounded-2xl border border-white/[0.08] bg-white"
        style={{ height: "calc(100dvh - 200px)" }}
        allowFullScreen
      />
    </div>
  );
}
