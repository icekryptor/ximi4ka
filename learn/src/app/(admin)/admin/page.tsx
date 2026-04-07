import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: activeSubs },
    { count: totalModules },
    { count: totalLessons },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("modules").select("*", { count: "exact", head: true }),
    supabase.from("lessons").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Учеников", value: totalUsers ?? 0, color: "text-primary" },
    { label: "Активных подписок", value: activeSubs ?? 0, color: "text-green-600" },
    { label: "Модулей", value: totalModules ?? 0, color: "text-text-dark" },
    { label: "Уроков", value: totalLessons ?? 0, color: "text-text-dark" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Дашборд</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-text-secondary mt-1">{s.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
