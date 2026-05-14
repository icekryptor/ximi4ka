import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ModuleEditForm } from "./ModuleEditForm";

interface Props {
  params: { id: string };
}

export default async function AdminModuleDetailPage({ params }: Props) {
  const supabase = await createClient();

  const { data: module } = await supabase
    .from("modules")
    .select("*, lessons(*)")
    .eq("id", params.id)
    .single();

  if (!module) notFound();

  const lessons = (module.lessons || []).sort((a: any, b: any) => a.order_index - b.order_index);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{module.title}</h1>
        <Badge variant={module.is_published ? "xp" : "streak"}>
          {module.is_published ? "Опубликован" : "Черновик"}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Уроки ({lessons.length})</h2>
              <Link href={`/admin/modules/${params.id}/lessons/new`}>
                <Button size="sm">+ Новый урок</Button>
              </Link>
            </div>
            <div className="space-y-2">
              {lessons.map((lesson: any, i: number) => (
                <Link key={lesson.id} href={`/admin/modules/${params.id}/${lesson.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-bg-tertiary transition-colors cursor-pointer">
                    <span className="text-sm font-bold text-primary/50 w-6">{i + 1}</span>
                    <span className="flex-1 font-medium text-sm">{lesson.title}</span>
                    <Badge variant={lesson.is_published ? "xp" : "streak"} className="text-xs">
                      {lesson.is_published ? "Опубл." : "Черновик"}
                    </Badge>
                  </div>
                </Link>
              ))}
              {lessons.length === 0 && (
                <p className="text-text-secondary text-sm text-center py-4">Нет уроков</p>
              )}
            </div>
          </Card>
        </div>

        <div>
          <ModuleEditForm module={module} />
        </div>
      </div>
    </div>
  );
}
