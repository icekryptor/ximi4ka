import { createClient, getCachedUser } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: batch } = await supabase
    .from("kit_batches")
    .select("*, modules(title, slug)")
    .eq("id", id)
    .single();
  if (!batch) notFound();

  const { data: creds } = await supabase
    .from("kit_credentials")
    .select("id, login, activated_at, last_login_at, is_disabled, supabase_user_id")
    .eq("batch_id", id)
    .order("login");

  // Get current emails for activated users via service-role client
  const activatedUserIds =
    creds?.filter((c) => c.activated_at && c.supabase_user_id).map((c) => c.supabase_user_id) ?? [];
  const emails: Record<string, string> = {};

  if (activatedUserIds.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
      authUsers?.users.forEach((u) => {
        if (activatedUserIds.includes(u.id)) {
          emails[u.id] = u.email ?? "";
        }
      });
    } catch {
      // Service-role unavailable — email column will show "—"
    }
  }

  const activatedCount = creds?.filter((c) => c.activated_at).length ?? 0;

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/kits" className="text-sm text-text-secondary hover:text-primary mb-2 block">
          ← Все партии
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">{batch.name}</h1>
        <p className="text-sm text-text-secondary mt-1">
          {(batch.modules as any)?.title ?? "—"} &middot; {batch.count} кодов &middot;{" "}
          {batch.duration_days} дней
        </p>
      </div>

      <div className="flex items-center gap-6 mb-6">
        <p className="text-sm">
          <strong className="text-text-primary">{activatedCount}</strong>{" "}
          <span className="text-text-secondary">из</span>{" "}
          <strong className="text-text-primary">{batch.count}</strong>{" "}
          <span className="text-text-secondary">активировано</span>
        </p>
        <a
          href={`/api/admin/kits/${id}/csv`}
          className="inline-block px-4 py-2 rounded-full bg-primary text-white text-sm hover:opacity-90 transition-opacity"
        >
          Скачать CSV (только не активированные)
        </a>
        <Link
          href={`/admin/kits/${id}/print?filter=unassigned`}
          target="_blank"
          className="inline-block px-4 py-2 rounded-full bg-bg-secondary text-text-primary border border-border text-sm hover:bg-bg-tertiary transition-colors"
        >
          📄 PDF этикеток 58×40
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-text-secondary text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left p-3">Логин</th>
              <th className="text-left p-3">Активирован</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Last login</th>
            </tr>
          </thead>
          <tbody>
            {(creds ?? []).map((c) => {
              const email = c.supabase_user_id ? (emails[c.supabase_user_id] ?? "") : "";
              const showEmail = email && !email.endsWith("@kits.ximi4ka.ru") ? email : "—";
              return (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 font-mono text-text-primary">{c.login}</td>
                  <td className="p-3 text-text-secondary">
                    {c.activated_at
                      ? new Date(c.activated_at).toLocaleDateString("ru-RU")
                      : "—"}
                  </td>
                  <td className="p-3 text-text-secondary">{showEmail}</td>
                  <td className="p-3 text-text-secondary">
                    {c.last_login_at
                      ? new Date(c.last_login_at).toLocaleDateString("ru-RU")
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {(creds ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-text-secondary">
                  Нет учётных данных в этой партии.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
