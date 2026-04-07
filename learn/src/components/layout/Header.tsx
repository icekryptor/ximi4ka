import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-primary">
          XimiLearn
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/modules" className="text-text-secondary hover:text-text-dark transition-colors">
            Модули
          </Link>
          <Link href="/pricing" className="text-text-secondary hover:text-text-dark transition-colors">
            Тарифы
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="text-text-secondary hover:text-text-dark transition-colors">
                Мой прогресс
              </Link>
              <Link href="/leaderboard" className="text-text-secondary hover:text-text-dark transition-colors">
                Рейтинг
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="sm">Профиль</Button>
              </Link>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Войти</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
