import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PixelIcon } from "@/components/ui/PixelIcon";

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
          const neonColor = i === 0 ? "magenta" as const : i === 1 ? "cyan" as const : i === 2 ? "lime" as const : undefined;

          return (
            <Card
              key={entry.user_id}
              neon={isMe ? "purple" : neonColor}
              glass={i < 3}
              className={`flex items-center gap-4 py-3 ${i < 3 ? "scale-[1.01]" : ""}`}
            >
              <span className={`text-lg font-bold font-mono w-8 text-center ${
                i === 0 ? "text-neon-magenta text-glow-magenta" :
                i === 1 ? "text-neon-cyan text-glow-cyan" :
                i === 2 ? "text-neon-lime text-glow-lime" :
                "text-gray-400"
              }`}>
                {i < 3 ? <PixelIcon name="trophy" size={20} className="mx-auto" /> : i + 1}
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
          <p className="text-gray-400 text-center py-8">Пока нет данных. Будьте первым!</p>
        )}
      </div>
    </div>
  );
}
