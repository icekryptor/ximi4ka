import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AdminRow, StatusPill } from "@/components/admin/AdminRow";
import { ChevronRight } from "lucide-react";
import type { Module } from "@/lib/types";

export default async function AdminModulesPage() {
  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("*, lessons(id)")
    .order("order_index");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Модули</h1>
        <Link href="/admin/modules/new">
          <Button size="sm">+ Новый модуль</Button>
        </Link>
      </div>

      <div className="space-y-2">
        {(modules as (Module & { lessons: { id: string }[] })[] | null)?.map((m) => (
          <Link key={m.id} href={`/admin/modules/${m.id}`} className="block">
            <AdminRow>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-text-primary truncate">{m.title}</h3>
                <p className="text-xs text-text-muted">{m.lessons?.length ?? 0} уроков</p>
              </div>
              <StatusPill tone={m.tier === "premium" ? "primary" : "neutral"}>
                {m.tier === "premium" ? `Премиум · ${m.price} ₽` : "Базовый"}
              </StatusPill>
              <StatusPill tone={m.is_published ? "success" : "warning"}>
                {m.is_published ? "Опубликован" : "Черновик"}
              </StatusPill>
              <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
            </AdminRow>
          </Link>
        ))}
        {(!modules || modules.length === 0) && (
          <p className="text-text-secondary text-center py-8">Нет модулей. Создайте первый!</p>
        )}
      </div>
    </div>
  );
}
