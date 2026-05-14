import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
        <h1 className="text-2xl font-bold">Модули</h1>
        <Link href="/admin/modules/new">
          <Button size="sm">+ Новый модуль</Button>
        </Link>
      </div>

      <div className="space-y-3">
        {(modules as (Module & { lessons: { id: string }[] })[] | null)?.map((m) => (
          <Link key={m.id} href={`/admin/modules/${m.id}`}>
            <Card className="flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex-1">
                <h3 className="font-bold">{m.title}</h3>
                <p className="text-sm text-text-secondary">{m.lessons?.length ?? 0} уроков</p>
              </div>
              <Badge variant={m.tier === "premium" ? "premium" : "default"}>
                {m.tier === "premium" ? `Премиум • ${m.price} ₽` : "Базовый"}
              </Badge>
              <Badge variant={m.is_published ? "xp" : "streak"}>
                {m.is_published ? "Опубликован" : "Черновик"}
              </Badge>
            </Card>
          </Link>
        ))}
        {(!modules || modules.length === 0) && (
          <p className="text-text-secondary text-center py-8">Нет модулей. Создайте первый!</p>
        )}
      </div>
    </div>
  );
}
