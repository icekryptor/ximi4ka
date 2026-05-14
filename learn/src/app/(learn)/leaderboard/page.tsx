import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Trophy } from "lucide-react";

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
      <h1 className="text-2xl font-bold mb-2 text-dark-text">Рейтинг учеников</h1>
      <p className="text-dark-text-secondary mb-8">Еженедельная таблица лидеров</p>

      {/* Top-3 podium */}
      {weekly && weekly.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* 2nd place */}
          <Card theme="dark" glass className="p-5 text-center shadow-glow-purple order-1">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <p className="font-mono text-2xl font-bold text-primary tabular-nums">2</p>
            <p className="text-sm font-medium text-dark-text mt-1 truncate">
              {weekly[1]?.display_name || "Ученик"}
              {weekly[1]?.user_id === user.id && " (вы)"}
            </p>
            <p className="font-mono text-xs text-dark-text-muted tabular-nums mt-1">
              {weekly[1]?.weekly_xp} XP
            </p>
          </Card>

          {/* 1st place — slightly larger */}
          <Card theme="dark" glass className="p-6 text-center shadow-glow-purple order-2 -mt-3">
            <div className="w-14 h-14 bg-primary/15 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-7 h-7 text-primary" />
            </div>
            <p className="font-mono text-3xl font-bold text-primary text-glow-purple tabular-nums">1</p>
            <p className="text-sm font-bold text-dark-text mt-1 truncate">
              {weekly[0]?.display_name || "Ученик"}
              {weekly[0]?.user_id === user.id && " (вы)"}
            </p>
            <p className="font-mono text-xs text-dark-text-muted tabular-nums mt-1">
              {weekly[0]?.weekly_xp} XP
            </p>
          </Card>

          {/* 3rd place */}
          <Card theme="dark" glass className="p-5 text-center shadow-glow-purple order-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <p className="font-mono text-2xl font-bold text-primary tabular-nums">3</p>
            <p className="text-sm font-medium text-dark-text mt-1 truncate">
              {weekly[2]?.display_name || "Ученик"}
              {weekly[2]?.user_id === user.id && " (вы)"}
            </p>
            <p className="font-mono text-xs text-dark-text-muted tabular-nums mt-1">
              {weekly[2]?.weekly_xp} XP
            </p>
          </Card>
        </div>
      )}

      {/* Full rankings list */}
      <div className="space-y-2">
        {weekly?.map((entry, i) => {
          const isMe = entry.user_id === user.id;

          return (
            <Card
              key={entry.user_id}
              theme="dark"
              className={`flex items-center gap-4 px-4 py-3 ${
                isMe ? "border-primary/40" : ""
              }`}
            >
              <span className={`font-mono text-lg font-bold w-8 text-center tabular-nums ${
                i < 3 ? "text-primary text-glow-purple" : "text-dark-text-muted"
              }`}>
                {i < 3 ? <Trophy className="w-5 h-5 text-primary mx-auto" /> : i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-sm text-dark-text">
                  {entry.display_name || "Ученик"}{isMe && <span className="text-primary ml-1">(вы)</span>}
                </p>
              </div>
              <Badge theme="dark" variant="streak">{entry.current_streak} дн.</Badge>
              <Badge theme="dark" variant="xp">{entry.weekly_xp} XP</Badge>
            </Card>
          );
        })}
        {(!weekly || weekly.length === 0) && (
          <p className="text-dark-text-muted text-center py-8">Пока нет данных. Будьте первым!</p>
        )}
      </div>
    </div>
  );
}
