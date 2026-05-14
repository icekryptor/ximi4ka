import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getUserStats } from "@/lib/queries/progress";
import Link from "next/link";
import { Star, Flame, CheckCircle2, Target, Award, BookOpen, Calendar } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const stats = await getUserStats(supabase, user.id);
  const accuracy = stats.totalAttempts > 0
    ? Math.round((stats.correctAttempts / stats.totalAttempts) * 100)
    : 0;

  // Fetch user's kit-based access (user_modules) for OGE module
  const { data: myUserModules } = await supabase
    .from("user_modules")
    .select("expires_at, source, modules(id, slug, title, description, is_oge)")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false });

  const hasAnyAccess = (myUserModules?.length ?? 0) > 0;
  const oldestExpiry = myUserModules?.[myUserModules.length - 1]?.expires_at;
  const expiresInDays = oldestExpiry
    ? Math.ceil((new Date(oldestExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2 text-dark-text">Мой прогресс</h1>
      <p className="text-dark-text-secondary mb-8">Продолжайте учиться и набирайте опыт</p>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card theme="dark" hover className="p-6 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Star className="w-6 h-6 text-primary" />
          </div>
          <p className="font-mono text-3xl font-bold text-primary text-glow-purple tabular-nums">
            {stats.totalXp}
          </p>
          <p className="text-sm text-dark-text-muted mt-1">XP</p>
        </Card>

        <Card theme="dark" hover className="p-6 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Flame className="w-6 h-6 text-primary animate-streak-fire" />
          </div>
          <p className="font-mono text-3xl font-bold text-primary text-glow-purple tabular-nums">
            {stats.streak.current_streak}
          </p>
          <p className="text-sm text-dark-text-muted mt-1">дней подряд</p>
        </Card>

        <Card theme="dark" hover className="p-6 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-primary" />
          </div>
          <p className="font-mono text-3xl font-bold text-primary text-glow-purple tabular-nums">
            {stats.correctAttempts}
          </p>
          <p className="text-sm text-dark-text-muted mt-1">решено задач</p>
        </Card>

        <Card theme="dark" hover className="p-6 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <p className="font-mono text-3xl font-bold text-primary text-glow-purple tabular-nums">
            {accuracy}%
          </p>
          <p className="text-sm text-dark-text-muted mt-1">точность</p>
        </Card>
      </div>

      {/* Мои модули — kit-based access (e.g. OGE) */}
      {hasAnyAccess && myUserModules && myUserModules.length > 0 && (
        <div className="mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-bold text-dark-text">Мои модули</h2>
            {expiresInDays !== null && (
              <span className="inline-flex items-center gap-1 text-xs text-dark-text-muted">
                <Calendar className="w-3 h-3" />
                Доступ ещё {expiresInDays} дн.
              </span>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {myUserModules.map((um: any) => {
              const m = um.modules;
              if (!m) return null;
              return (
                <Link key={m.id} href={`/learn/${m.slug}`}>
                  <Card theme="dark" hover className="p-5 h-full">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-dark-text">{m.title}</h3>
                        {m.description && (
                          <p className="text-xs text-dark-text-muted line-clamp-2 mt-1">{m.description}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent achievements */}
        <Card theme="dark" glass className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-dark-text">Последние достижения</h2>
          </div>
          {stats.recentAchievements.length === 0 ? (
            <p className="text-dark-text-muted text-sm">Пока нет достижений. Решайте задачи!</p>
          ) : (
            <div className="space-y-3">
              {stats.recentAchievements.map((ua: any) => (
                <div key={ua.id} className="flex items-center gap-3">
                  <span className="text-2xl">{ua.achievements?.icon_url || "🏆"}</span>
                  <div>
                    <p className="font-medium text-sm text-dark-text">{ua.achievements?.title}</p>
                    <p className="text-xs text-dark-text-muted">{ua.achievements?.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/achievements" className="text-primary text-sm hover:underline mt-4 block">
            Все достижения &rarr;
          </Link>
        </Card>

        {/* Continue learning */}
        <Card theme="dark" glass className="p-6">
          <h2 className="text-lg font-bold mb-4 text-dark-text">Продолжить</h2>
          {stats.recentProgress.length === 0 ? (
            <p className="text-dark-text-muted text-sm">
              Начните с{" "}
              <Link href="/modules" className="text-primary hover:underline">каталога модулей</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentProgress.map((lp: any) => (
                <Link
                  key={lp.id}
                  href={`/learn/${lp.lessons?.modules?.slug}`}
                  className="block p-3 rounded-xl hover:bg-dark-surface-hover transition-colors"
                >
                  <p className="font-medium text-sm text-dark-text">{lp.lessons?.title}</p>
                  <p className="text-xs text-dark-text-muted">{lp.lessons?.modules?.title}</p>
                  <Badge theme="dark" variant={lp.status === "done" ? "xp" : "default"} className="mt-1">
                    {lp.status === "done" ? "Пройден" : "В процессе"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
