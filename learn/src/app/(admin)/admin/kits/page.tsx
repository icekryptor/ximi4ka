import Link from "next/link";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function KitsPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: batches } = await supabase
    .from("kit_batches")
    .select("id, name, count, duration_days, created_at, modules(slug, title)")
    .order("created_at", { ascending: false });

  // Fetch activation counts for all batches in one query
  const counts: Record<string, number> = {};
  if (batches && batches.length > 0) {
    const ids = batches.map((b) => b.id);
    const { data: cred } = await supabase
      .from("kit_credentials")
      .select("batch_id, activated_at")
      .in("batch_id", ids);
    if (cred) {
      cred.forEach((c) => {
        if (c.activated_at) {
          counts[c.batch_id] = (counts[c.batch_id] ?? 0) + 1;
        }
      });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-text-primary">Партии наборов</h1>

      <div className="bg-bg-secondary border border-border rounded-2xl p-4 mb-6 text-sm text-text-secondary">
        Новые партии создаются через CLI:
        <code className="ml-2 px-2 py-0.5 bg-white rounded font-mono">
          npx tsx scripts/generate-kit-batch.ts --help
        </code>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-text-secondary text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left p-3">Партия</th>
              <th className="text-left p-3">Модуль</th>
              <th className="text-left p-3">Создан</th>
              <th className="text-left p-3">Активировано</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(batches ?? []).map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="p-3 text-text-primary font-medium">{b.name}</td>
                <td className="p-3 text-text-secondary">
                  {(b as any).modules?.title ?? "—"}
                </td>
                <td className="p-3 text-text-secondary">
                  {new Date(b.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td className="p-3">
                  {counts[b.id] ?? 0} / {b.count}
                </td>
                <td className="p-3">
                  <Link href={`/admin/kits/${b.id}`} className="text-primary hover:underline">
                    →
                  </Link>
                </td>
              </tr>
            ))}
            {(batches ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-secondary">
                  Нет партий. Создайте первую через CLI.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
