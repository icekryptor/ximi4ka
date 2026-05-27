import { hasActiveAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LabFrame } from "./LabFrame";

export default async function LabPage() {
  const { hasAccess } = await hasActiveAccess();
  if (!hasAccess) redirect("/tools");

  return (
    <div className="max-w-screen-2xl mx-auto py-4 md:py-6 px-3 md:px-10">
      <div className="flex items-center gap-2 text-sm text-dark-text-secondary mb-3 md:mb-4">
        <Link href="/tools" className="hover:text-dark-text transition-colors">
          Инструменты
        </Link>
        <span>/</span>
        <span className="text-dark-text">Тренажёр ОГЭ</span>
        <a
          href="/tools/oge-lab.html"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-dark-text-muted hover:text-dark-text transition-colors flex items-center gap-1"
          title="Если тренажёр не загружается — открой в новом окне"
        >
          ↗ Открыть в новом окне
        </a>
      </div>

      <h1 className="text-xl md:text-2xl font-bold text-dark-text mb-3 md:mb-5 font-display">
        Тренажёр ОГЭ
      </h1>

      <LabFrame />
    </div>
  );
}
