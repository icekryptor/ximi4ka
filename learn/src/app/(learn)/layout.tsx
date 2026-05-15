import { ReactNode } from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { ProfilePreview } from "@/components/layout/ProfilePreview";

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
              Тулы
            </Link>
            <Link href="/leaderboard" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Рейтинг
            </Link>
          </nav>
          <ProfilePreview theme="dark" />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
