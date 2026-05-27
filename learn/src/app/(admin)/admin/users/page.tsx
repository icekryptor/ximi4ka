import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/admin/AdminRow";
import { getRankState } from "@/lib/ranks";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*, subscriptions(plan, status)")
    .order("created_at", { ascending: false });

  const { data: xpData } = await supabase
    .from("task_attempts")
    .select("user_id, points_earned");

  const xpMap = new Map<string, number>();
  xpData?.forEach((a) => {
    xpMap.set(a.user_id, (xpMap.get(a.user_id) ?? 0) + a.points_earned);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-text-primary">Ученики</h1>
      <div className="rounded-2xl bg-white border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary">
              <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 font-semibold">Имя</th>
                <th className="px-4 py-3 font-semibold">Роль</th>
                <th className="px-4 py-3 font-semibold">Подписка</th>
                <th className="px-4 py-3 font-semibold">XP</th>
                <th className="px-4 py-3 font-semibold">Ранг</th>
                <th className="px-4 py-3 font-semibold">Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u: { id: string; display_name: string | null; role: string; created_at: string; subscriptions?: { plan: string; status: string }[] }) => {
                const sub = u.subscriptions?.[0];
                const xp = xpMap.get(u.id) ?? 0;
                const { rank } = getRankState(xp);
                return (
                  <tr key={u.id} className="border-t border-border/60 hover:bg-bg-tertiary transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{u.display_name || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={u.role === "admin" ? "primary" : "neutral"}>
                        {u.role === "admin" ? "Админ" : "Ученик"}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      {sub ? (
                        <StatusPill tone={sub.status === "active" ? "success" : "neutral"}>
                          {sub.plan} · {sub.status === "active" ? "Активна" : sub.status}
                        </StatusPill>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-primary tabular-nums">{xp}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: `${rank.hex}1f`, color: rank.hex }}
                      >
                        {rank.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(u.created_at).toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                );
              })}
              {(!users || users.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    Учеников пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
