import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*, subscriptions(plan, status)")
    .order("created_at", { ascending: false });

  // Get XP for each user
  const { data: xpData } = await supabase
    .from("task_attempts")
    .select("user_id, points_earned");

  const xpMap = new Map<string, number>();
  xpData?.forEach((a) => {
    xpMap.set(a.user_id, (xpMap.get(a.user_id) ?? 0) + a.points_earned);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ученики</h1>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary border-b border-border">
                <th className="pb-3 pr-4">Имя</th>
                <th className="pb-3 pr-4">Роль</th>
                <th className="pb-3 pr-4">Подписка</th>
                <th className="pb-3 pr-4">XP</th>
                <th className="pb-3">Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u: any) => {
                const sub = u.subscriptions?.[0];
                return (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium">{u.display_name || "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={u.role === "admin" ? "premium" : "base"}>
                        {u.role === "admin" ? "Админ" : "Ученик"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {sub ? (
                        <Badge variant={sub.status === "active" ? "xp" : "streak"}>
                          {sub.plan} • {sub.status === "active" ? "Активна" : "Неактивна"}
                        </Badge>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-medium text-primary">
                      {xpMap.get(u.id) ?? 0}
                    </td>
                    <td className="py-3 text-text-secondary">
                      {new Date(u.created_at).toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
