import Link from "next/link";
import { FlaskConical, ArrowRight } from "lucide-react";
import { getCachedUser } from "@/lib/supabase/server";
import { ProfilePreview } from "@/components/layout/ProfilePreview";

// Public landing header for learn.ximi4ka.ru.
//
// Design rule (per user, 2026-05-19): navbar links go to the *external* marketing
// site ximi4ka.ru (где продаются наборы и живёт компания). The only platform CTA
// is the prominent "Перейти в платформу" button on the right — it leads to
// /dashboard. This eliminates the previous confusion where some links went to
// internal /modules /pricing and others to /dashboard /leaderboard.
//
// For not-logged-in users, /dashboard route is gated by middleware and will
// redirect to /login — so the button still works as "enter the platform" even
// before sign-up.

const EXTERNAL_LINKS: { href: string; label: string }[] = [
  { href: "https://ximi4ka.ru", label: "Главная" },
  { href: "https://ximi4ka.ru/shop", label: "Наборы" },
  { href: "https://ximi4ka.ru/about", label: "О нас" },
  { href: "https://ximi4ka.ru/contacts", label: "Контакты" },
];

export default async function Header() {
  const user = await getCachedUser();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
          <FlaskConical className="w-6 h-6 text-primary group-hover:rotate-12 transition-transform" />
          <span className="font-display text-xl font-bold text-text-primary">
            XimiLearn
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {EXTERNAL_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              // External — open in same tab so the user can navigate back via
              // browser back button. (No target=_blank: would create orphan tabs.)
              className="text-text-secondary hover:text-primary transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Always-visible platform CTA. Logged-in users → straight to
              /dashboard. Logged-out users → middleware redirects /dashboard to
              /login, so the button still acts as "enter the platform". */}
          <Link
            href="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-white px-5 py-2 rounded-full bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:shadow-glow-purple transition-shadow"
          >
            Перейти в платформу
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          {user && <ProfilePreview theme="light" />}
        </div>
      </div>
    </header>
  );
}
