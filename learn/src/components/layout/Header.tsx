import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { PixelIcon } from "@/components/ui/PixelIcon";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 bg-bg-dark/80 backdrop-blur-xl border-b border-white/5 shadow-glass">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary hover:text-glow-purple transition-all">
          <PixelIcon name="flask" size={24} className="text-primary" />
          XimiLearn
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/modules" className="text-gray-400 hover:text-primary transition-colors">
            Модули
          </Link>
          <Link href="/pricing" className="text-gray-400 hover:text-primary transition-colors">
            Тарифы
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="text-gray-400 hover:text-primary transition-colors">
                Мой прогресс
              </Link>
              <Link href="/leaderboard" className="text-gray-400 hover:text-primary transition-colors">
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
