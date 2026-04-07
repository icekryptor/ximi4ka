import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";

export default async function AchievementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: allAchievements }, { data: userAchievements }] = await Promise.all([
    supabase.from("achievements").select("*").order("points"),
    supabase.from("user_achievements").select("achievement_id, earned_at").eq("user_id", user.id),
  ]);

  const earnedIds = new Set(userAchievements?.map((ua) => ua.achievement_id));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Достижения</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {allAchievements?.map((a) => {
          const earned = earnedIds.has(a.id);
          return (
            <Card key={a.id} className={`text-center ${earned ? "" : "opacity-40 grayscale"}`}>
              <div className="text-3xl mb-2">{a.icon_url || "🏆"}</div>
              <h3 className="font-bold text-sm">{a.title}</h3>
              <p className="text-xs text-text-secondary mt-1">{a.description}</p>
              <p className="text-xs text-primary mt-2">{a.points} XP</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
