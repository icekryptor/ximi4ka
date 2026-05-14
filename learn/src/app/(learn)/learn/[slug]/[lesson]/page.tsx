import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ContentBlockRenderer } from "@/components/content/ContentBlockRenderer";
import { TaskBlock } from "@/components/content/TaskBlock";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { canAccessModule } from "@/lib/services/access";
import type { ContentBlock, Task, TaskOption } from "@/lib/types";

interface Props {
  params: { slug: string; lesson: string };
}

export default async function LessonPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*, modules!inner(id, slug, tier, title), content_blocks(*, tasks(*, task_options(*)))")
    .eq("slug", params.lesson)
    .eq("modules.slug", params.slug)
    .single();

  if (!lesson) notFound();

  const lessonModule = (lesson as any).modules;
  const hasAccess = await canAccessModule(supabase, user.id, lessonModule.id, lessonModule.tier);
  if (!hasAccess) redirect(`/modules/${params.slug}`);

  // Mark as in_progress
  await supabase.from("lesson_progress").upsert(
    { user_id: user.id, lesson_id: lesson.id, status: "in_progress", updated_at: new Date().toISOString() },
    { onConflict: "user_id,lesson_id" }
  );

  const blocks = ((lesson.content_blocks || []) as (ContentBlock & { tasks: (Task & { task_options: TaskOption[] })[] })[])
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Dark breadcrumb — outside the white panel */}
      <p className="text-sm text-dark-text-secondary mb-2">
        <Link href={`/learn/${params.slug}`} className="hover:text-primary transition-colors">
          &larr; {lessonModule.title}
        </Link>
      </p>
      <h1 className="text-2xl font-bold mb-8 text-dark-text">{lesson.title}</h1>

      {/* Light content panel — preserves readability for lesson body */}
      <div className="max-w-3xl mx-auto bg-white/95 backdrop-blur-sm rounded-3xl p-6 md:p-10 text-text-primary space-y-6">
        {blocks.map((block) => {
          if (block.type === "task" && block.tasks?.[0]) {
            const task = block.tasks[0];
            return <TaskBlock key={block.id} task={{ ...task, options: task.task_options }} />;
          }
          return <ContentBlockRenderer key={block.id} block={block} />;
        })}
      </div>

      <div className="mt-12 text-center">
        <Link href={`/api/lessons/${lesson.id}/complete`}>
          <Button theme="dark" size="lg">Урок пройден ✓</Button>
        </Link>
      </div>
    </div>
  );
}
