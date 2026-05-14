import { ReactNode } from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" className="min-h-screen flex flex-col bg-dark-base text-dark-text">
      <header className="sticky top-0 z-50 bg-dark-base/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <FlaskConical className="w-6 h-6 text-primary" />
            <span className="font-display text-xl font-bold text-dark-text">
              XimiLearn
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Главная
            </Link>
            <Link href="/learn" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Учиться
            </Link>
            <Link href="/leaderboard" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Рейтинг
            </Link>
            <Link href="/profile" className="text-dark-text-secondary hover:text-dark-text transition-colors">
              Профиль
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
