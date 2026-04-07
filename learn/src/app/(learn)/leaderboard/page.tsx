import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: weekly } = await supabase
    .from("leaderboard_weekly")
    .select("*")
    .order("weekly_xp", { ascending: false })
    .limit(50);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Рейтинг учеников</h1>

      <div className="space-y-2">
        {weekly?.map((entry, i) => {
          const isMe = entry.user_id === user.id;
          return (
            <Card key={entry.user_id} className={`flex items-center gap-4 py-3 ${isMe ? "border-primary border-2" : ""}`}>
              <span className={`text-lg font-bold w-8 text-center ${i < 3 ? "text-primary" : "text-text-secondary"}`}>
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {entry.display_name || "Ученик"} {isMe && "(вы)"}
                </p>
              </div>
              <Badge variant="streak">{entry.current_streak} дн.</Badge>
              <Badge variant="xp">{entry.weekly_xp} XP</Badge>
            </Card>
          );
        })}
        {(!weekly || weekly.length === 0) && (
          <p className="text-text-secondary text-center py-8">Пока нет данных. Будьте первым!</p>
        )}
      </div>
    </div>
  );
}
