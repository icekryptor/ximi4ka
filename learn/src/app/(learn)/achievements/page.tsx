import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Award } from "lucide-react";

export default async function AchievementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: allAchievements }, { data: userAchievements }] = await Promise.all([
    supabase.from("achievements").select("*").order("points"),
    supabase.from("user_achievements").select("achievement_id, earned_at").eq("user_id", user.id),
  ]);

  const earnedIds = new Set(userAchievements?.map((ua) => ua.achievement_id));
  const earnedCount = earnedIds.size;
  const totalCount = allAchievements?.length ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Award className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-dark-text">Достижения</h1>
      </div>
      <p className="text-dark-text-secondary mb-8">
        Получено: <span className="font-mono font-bold text-primary tabular-nums">{earnedCount}</span> из{" "}
        <span className="font-mono font-bold text-dark-text tabular-nums">{totalCount}</span>
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {allAchievements?.map((a) => {
          const earned = earnedIds.has(a.id);
          return (
            <Card
              key={a.id}
              theme="dark"
              className={`p-5 text-center ${earned ? "" : "opacity-40"}`}
            >
              <div className="text-3xl mb-2">{a.icon_url || "🏆"}</div>
              <h3 className="font-bold text-sm text-dark-text">{a.title}</h3>
              <p className="text-xs text-dark-text-muted mt-1">{a.description}</p>
              <p className="font-mono text-xs text-primary mt-2 tabular-nums">{a.points} XP</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
