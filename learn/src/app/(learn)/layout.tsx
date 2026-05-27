import { ReactNode } from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { ProfilePreview } from "@/components/layout/ProfilePreview";
import { MobileNav } from "@/components/layout/MobileNav";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" className="min-h-screen flex flex-col bg-dark-base text-dark-text">
      <header className="sticky top-0 z-50 bg-dark-base/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 group flex-shrink-0">
            <FlaskConical className="w-6 h-6 text-primary" />
            <span className="font-display text-xl font-bold text-dark-text">
              XimiLearn
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm flex-1 justify-center">
            <Link href="/dashboard" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Главная
            </Link>
            <Link href="/learn/oge" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              ОГЭ
            </Link>
            <Link href="/tools" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Тренажёры
            </Link>
            <Link href="/leaderboard" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Рейтинг
            </Link>
          </nav>
          <div data-tour="profile" className="flex items-center gap-2">
            <ProfilePreview theme="dark" />
            <MobileNav />
          </div>
        </div>
      </header>
      {/* max-w-none overrides the 1200px fallback in critical CSS (src/app/layout.tsx).
          Trainers like /tools/lab need the full viewport width — bottles and the
          workspace grid look cramped at 1200px on a 1920px+ desktop. The critical
          rule still kicks in for guest pages where it's a sane default. */}
      <main className="flex-1 max-w-none w-full">{children}</main>
      {/* Compact dark footer — legal access from any platform page.
          Full requisites live in public Footer; here we keep it minimal so it
          doesn't compete with the learning UI. */}
      <footer className="mt-auto border-t border-white/[0.06] bg-dark-base">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-dark-text-muted">
          <p>© 2026 ИП Аистов В.А. · ИНН 431401950080</p>
          <nav className="flex items-center gap-4">
            <Link
              href="/policy"
              className="hover:text-dark-text transition-colors"
            >
              Политика конфиденциальности
            </Link>
            <Link
              href="/oferta"
              className="hover:text-dark-text transition-colors"
            >
              Оферта
            </Link>
            <Link
              href="/support"
              className="hover:text-dark-text transition-colors"
            >
              Помощь
            </Link>
            <a
              href="mailto:info@ximi4ka.ru"
              className="hover:text-dark-text transition-colors"
            >
              info@ximi4ka.ru
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
