import { hasActiveAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function PeriodicTablePage() {
  const { hasAccess } = await hasActiveAccess();
  if (!hasAccess) redirect("/tools");

  return (
    <div className="py-4 md:py-6 px-3 md:px-10">
      <div className="flex items-center gap-2 text-sm text-dark-text-secondary mb-4">
        <Link href="/tools" className="hover:text-dark-text transition-colors">
          Инструменты
        </Link>
        <span>/</span>
        <span className="text-dark-text">Таблица Менделеева</span>
      </div>

      <h1 className="text-2xl font-bold text-dark-text mb-5 font-display">
        Таблица Менделеева
      </h1>

      <iframe
        src="/tools/periodic-table.html"
        title="Периодическая таблица Менделеева"
        className="w-full rounded-2xl border border-white/[0.08] bg-white"
        style={{ height: "calc(100vh - 200px)" }}
        allowFullScreen
      />
    </div>
  );
}
