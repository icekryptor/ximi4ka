import { adminClient } from "@/lib/kit-assignment";
import Link from "next/link";

export default async function AdminDashboardPage() {
  // Use service-role admin client — bypasses RLS so we see real totals
  // (the previous anon client returned 1 for `Активных kit-доступов` because
  // the admin's RLS view only includes their own user_modules row).
  const admin = adminClient();
  const now = new Date();
  const todayStartIso = now.toISOString().slice(0, 10) + "T00:00:00Z";
  const weekAgoIso = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthAgoIso = new Date(now.getTime() - 30 * 86400000).toISOString();
  const nowIso = now.toISOString();

  const [
    profilesRes,
    kitsRes,
    { count: activeSubs },
    { count: totalBatches },
    { count: ordersInWork },
  ] = await Promise.all([
    // ALL profiles (with display_name to distinguish "real" students)
    admin
      .from("profiles")
      .select("id, display_name, avatar_url, role, created_at")
      .order("created_at", { ascending: false }),
    // ALL kit_credentials — used both for activation stats AND for figuring
    // out which profiles are pre-generated pool slots vs real students.
    admin
      .from("kit_credentials")
      .select("supabase_user_id, login, activated_at, assigned_at, assigned_name")
      .order("activated_at", { ascending: false, nullsFirst: false }),
    admin.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active").gt("expires_at", nowIso),
    admin.from("kit_batches").select("*", { count: "exact", head: true }),
    admin.from("kit_orders").select("*", { count: "exact", head: true }).in("status", ["paid", "shipped"]),
  ]);

  type Profile = {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
    created_at: string;
  };
  type Kit = {
    supabase_user_id: string;
    login: string;
    activated_at: string | null;
    assigned_at: string | null;
    assigned_name: string | null;
  };

  const profiles = (profilesRes.data ?? []) as Profile[];
  const kits = (kitsRes.data ?? []) as Kit[];

  // ============ Compute real student counts ============
  // The naive `profiles.count` was 177 because EVERY kit_credential creates a
  // pre-generated auth.users row at batch-generation time — most of them are
  // empty slots awaiting purchase. Real students = activated kit users +
  // non-kit profiles (registered via /register form), excluding admins.
  const kitByUserId = new Map<string, Kit>();
  for (const k of kits) kitByUserId.set(k.supabase_user_id, k);

  const realStudents = profiles.filter((p) => {
    if (p.role === "admin") return false;
    const kit = kitByUserId.get(p.id);
    if (kit) {
      // Kit user — counts only if they actually scanned/typed the credentials
      return !!kit.activated_at;
    }
    // Non-kit profile (registered via /register or external signup)
    return true;
  });

  // Activation timing
  const todayStart = new Date(todayStartIso).getTime();
  const weekAgo = new Date(weekAgoIso).getTime();
  const activatedKits = kits.filter((k) => k.activated_at);
  const activatedToday = activatedKits.filter((k) => new Date(k.activated_at!).getTime() >= todayStart).length;
  const activatedWeek = activatedKits.filter((k) => new Date(k.activated_at!).getTime() >= weekAgo).length;

  // Kit pool segmentation
  const kitPoolUnsold = kits.filter((k) => !k.assigned_at).length;
  const kitSoldUnactivated = kits.filter((k) => k.assigned_at && !k.activated_at).length;

  // Daily activations for the 30-day chart
  const days: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    days.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const k of kits) {
    if (!k.activated_at) continue;
    if (new Date(k.activated_at).getTime() < new Date(monthAgoIso).getTime()) continue;
    const key = k.activated_at.slice(0, 10);
    const bucket = byDate.get(key);
    if (bucket) bucket.count++;
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  // Recent signups — only REAL students (exclude pool + admins)
  const recentRealSignups = realStudents.slice(0, 8);
  // Recent kit activations
  const recentActivations = activatedKits.slice(0, 8);

  const stats = [
    { label: "Учеников", value: realStudents.length, sub: `+${kitSoldUnactivated} ждут активации` },
    { label: "Активаций кит-кодов · 7 дн", value: activatedWeek, sub: `сегодня ${activatedToday}` },
    { label: "Активных подписок", value: activeSubs ?? 0 },
    { label: "Партий наборов", value: totalBatches ?? 0 },
    { label: "Заказов в работе", value: ordersInWork ?? 0, sub: "оплачены или в пути" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1 text-text-primary">Дашборд</h1>
      <p className="text-xs text-text-secondary mb-6">
        Цифры считаются по реальным ученикам (без пустых слотов в кит-пуле).
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-border p-4 text-center">
            <p className="text-3xl font-bold text-primary tabular-nums">{s.value}</p>
            <p className="text-xs text-text-secondary mt-1">{s.label}</p>
            {s.sub && <p className="text-[10px] text-text-muted mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Kit-pool inventory mini-line — answers "сколько ещё могу продать" */}
      <div className="rounded-xl bg-bg-secondary border border-border px-4 py-2.5 mb-8 text-xs text-text-secondary flex flex-wrap gap-x-4 gap-y-1">
        <span>🎟️ Кит-пул:</span>
        <span><b className="text-text-primary tabular-nums">{kitPoolUnsold}</b> готовы к продаже</span>
        <span><b className="text-text-primary tabular-nums">{kitSoldUnactivated}</b> в коробках, ждут активации</span>
        <span><b className="text-text-primary tabular-nums">{activatedKits.length}</b> активированы</span>
        <span className="opacity-60">всего {kits.length}</span>
      </div>

      <div className="rounded-2xl bg-white border border-border p-5 mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Активации kit-кодов за 30 дней
        </h2>
        <div className="flex items-end gap-1 h-24">
          {days.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.count}`}
              className="flex-1 rounded-t bg-primary/30 hover:bg-primary transition-colors"
              style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-text-muted mt-2">
          <span>{days[0].date}</span>
          <span>{days[days.length - 1].date}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-border p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-1">Свежие регистрации</h2>
          <p className="text-[11px] text-text-muted mb-3">
            Только реальные ученики (пул кит-кодов скрыт)
          </p>
          {recentRealSignups.length === 0 ? (
            <p className="text-sm text-text-muted">Пока пусто.</p>
          ) : (
            <ul className="space-y-2">
              {recentRealSignups.map((u) => {
                const isKit = kitByUserId.has(u.id);
                return (
                  <li key={u.id} className="flex items-center gap-3 text-sm">
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-gradient-start to-primary-gradient-end text-white text-[10px] font-bold flex items-center justify-center">
                        {(u.display_name ?? "?").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="flex-1 truncate text-text-primary">{u.display_name ?? "Без имени"}</span>
                    {isKit && <span className="text-[9px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">kit</span>}
                    <span className="text-xs text-text-muted">{new Date(u.created_at).toLocaleDateString("ru-RU")}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Свежие активации kit-кодов</h2>
            <Link href="/admin/kits" className="text-xs text-primary">Все партии →</Link>
          </div>
          {recentActivations.length === 0 ? (
            <p className="text-sm text-text-muted">Пока никто не активировал коды.</p>
          ) : (
            <ul className="space-y-2">
              {recentActivations.map((c) => (
                <li key={c.login} className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-text-secondary">{c.login}</span>
                  <span className="flex-1 truncate text-text-primary">{c.assigned_name ?? "—"}</span>
                  <span className="text-xs text-text-muted">{c.activated_at ? new Date(c.activated_at).toLocaleDateString("ru-RU") : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
