import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { canAccessModule } from "@/lib/services/access";
import { BookOpen, CheckCircle2 } from "lucide-react";

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
      <Link
        href="/dashboard"
        className="text-sm text-dark-text-secondary hover:text-dark-text transition-colors mb-4 block"
      >
        &larr; Назад
      </Link>

      <h1 className="text-2xl font-bold mb-2 text-dark-text">{module.title}</h1>

      <div className="flex items-center gap-3 mb-2">
        <ProgressBar theme="dark" value={progressPercent} className="flex-1" />
        <span className="font-mono text-sm text-dark-text-secondary tabular-nums">{progressPercent}%</span>
      </div>
      <p className="text-sm text-dark-text-muted mb-8">
        {completedCount} из {lessons.length} уроков пройдено
      </p>

      <div className="space-y-3">
        {lessons.map((lesson: any, _i: number) => {
          const status = progressMap.get(lesson.id) ?? "not_started";
          const isDone = status === "done";
          const isInProgress = status === "in_progress";

          return (
            <Link key={lesson.id} href={`/learn/${params.slug}/${lesson.slug}`}>
              <Card
                theme="dark"
                hover
                className="flex items-center gap-4 px-5 py-4 cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isDone ? "bg-success-dark/10" : "bg-primary/10"
                }`}>
                  {isDone
                    ? <CheckCircle2 className="w-5 h-5 text-success-dark" />
                    : <BookOpen className="w-5 h-5 text-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-dark-text truncate">{lesson.title}</h3>
                  {lesson.duration_minutes && (
                    <p className="text-sm text-dark-text-muted">{lesson.duration_minutes} мин</p>
                  )}
                </div>
                <Badge
                  theme="dark"
                  variant={isDone ? "xp" : isInProgress ? "streak" : "default"}
                >
                  {isDone ? "Пройден" : isInProgress ? "В процессе" : "Не начат"}
                </Badge>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
