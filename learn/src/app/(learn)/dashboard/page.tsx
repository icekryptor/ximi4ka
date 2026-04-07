import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getUserStats } from "@/lib/queries/progress";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const stats = await getUserStats(supabase, user.id);
  const accuracy = stats.totalAttempts > 0
    ? Math.round((stats.correctAttempts / stats.totalAttempts) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Мой прогресс</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="text-center">
          <p className="text-3xl font-bold text-primary">{stats.totalXp}</p>
          <p className="text-sm text-text-secondary">XP</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-orange-500">{stats.streak.current_streak}</p>
          <p className="text-sm text-text-secondary">дней подряд</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-green-600">{stats.correctAttempts}</p>
          <p className="text-sm text-text-secondary">решено задач</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-text-dark">{accuracy}%</p>
          <p className="text-sm text-text-secondary">точность</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent achievements */}
        <Card>
          <h2 className="text-lg font-bold mb-4">Последние достижения</h2>
          {stats.recentAchievements.length === 0 ? (
            <p className="text-text-secondary text-sm">Пока нет достижений. Решайте задачи!</p>
          ) : (
            <div className="space-y-3">
              {stats.recentAchievements.map((ua: any) => (
                <div key={ua.id} className="flex items-center gap-3">
                  <span className="text-2xl">{ua.achievements?.icon_url || "\uD83C\uDFC6"}</span>
                  <div>
                    <p className="font-medium text-sm">{ua.achievements?.title}</p>
                    <p className="text-xs text-text-secondary">{ua.achievements?.description}</p>
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
        <Card>
          <h2 className="text-lg font-bold mb-4">Продолжить</h2>
          {stats.recentProgress.length === 0 ? (
            <p className="text-text-secondary text-sm">
              Начните с{" "}
              <Link href="/modules" className="text-primary hover:underline">каталога модулей</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentProgress.map((lp: any) => (
                <Link
                  key={lp.id}
                  href={`/learn/${lp.lessons?.modules?.slug}`}
                  className="block p-3 rounded-xl hover:bg-bg-light transition-colors"
                >
                  <p className="font-medium text-sm">{lp.lessons?.title}</p>
                  <p className="text-xs text-text-secondary">{lp.lessons?.modules?.title}</p>
                  <Badge variant={lp.status === "done" ? "xp" : "base"} className="mt-1">
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
