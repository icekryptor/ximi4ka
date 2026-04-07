import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { canAccessModule } from "@/lib/services/access";

interface Props {
  params: { slug: string };
}

export default async function LearnModulePage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: module } = await supabase
    .from("modules")
    .select("*, lessons(*)")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .single();

  if (!module) notFound();

  const hasAccess = await canAccessModule(supabase, user.id, module.id, module.tier);
  if (!hasAccess) redirect(`/modules/${params.slug}`);

  const lessons = (module.lessons || [])
    .filter((l: any) => l.is_published)
    .sort((a: any, b: any) => a.order_index - b.order_index);

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status")
    .eq("user_id", user.id)
    .in("lesson_id", lessons.map((l: any) => l.id));

  const progressMap = new Map(progress?.map((p) => [p.lesson_id, p.status]) ?? []);
  const completedCount = progress?.filter((p) => p.status === "done").length ?? 0;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">{module.title}</h1>
      <div className="flex items-center gap-3 mb-6">
        <ProgressBar value={progressPercent} className="flex-1" />
        <span className="text-sm text-text-secondary">{progressPercent}%</span>
      </div>

      <div className="space-y-3">
        {lessons.map((lesson: any, i: number) => {
          const status = progressMap.get(lesson.id) ?? "not_started";
          return (
            <Link key={lesson.id} href={`/learn/${params.slug}/${lesson.slug}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
                <span className={`text-2xl font-bold ${status === "done" ? "text-green-500" : "text-primary/30"}`}>
                  {status === "done" ? "\u2713" : i + 1}
                </span>
                <div className="flex-1">
                  <h3 className="font-medium">{lesson.title}</h3>
                  {lesson.duration_minutes && (
                    <p className="text-sm text-text-secondary">{lesson.duration_minutes} мин</p>
                  )}
                </div>
                <Badge variant={status === "done" ? "xp" : status === "in_progress" ? "base" : "streak"}>
                  {status === "done" ? "Пройден" : status === "in_progress" ? "В процессе" : "Не начат"}
                </Badge>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
