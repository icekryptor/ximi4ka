import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <FlaskConical className="w-6 h-6 text-primary group-hover:rotate-12 transition-transform" />
          <span className="font-display text-xl font-bold text-text-primary">
            XimiLearn
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link
            href="/modules"
            className="text-text-secondary hover:text-primary transition-colors"
          >
            Модули
          </Link>
          <Link
            href="/pricing"
            className="text-text-secondary hover:text-primary transition-colors"
          >
            Тарифы
          </Link>
          {user && (
            <>
              <Link
                href="/dashboard"
                className="text-text-secondary hover:text-primary transition-colors"
              >
                Мой прогресс
              </Link>
              <Link
                href="/leaderboard"
                className="text-text-secondary hover:text-primary transition-colors"
              >
                Рейтинг
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/profile"
              className="text-sm font-semibold text-white px-5 py-2 rounded-full bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:shadow-glow-purple transition-shadow"
            >
              Профиль
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="text-sm font-semibold text-white px-5 py-2 rounded-full bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:shadow-glow-purple transition-shadow"
              >
                Начать
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
