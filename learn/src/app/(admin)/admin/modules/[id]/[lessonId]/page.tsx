"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BlockEditor } from "@/components/admin/BlockEditor";

interface Props {
  params: { id: string; lessonId: string };
}

export default function AdminLessonEditorPage({ params }: Props) {
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("lessons")
        .select("*, content_blocks(*, tasks(*, task_options(*)))")
        .eq("id", params.lessonId)
        .single();
      setLesson(data);
      setLoading(false);
    }
    load();
  }, [params.lessonId]);

  async function togglePublish() {
    if (!lesson) return;
    await supabase
      .from("lessons")
      .update({ is_published: !lesson.is_published })
      .eq("id", lesson.id);
    setLesson({ ...lesson, is_published: !lesson.is_published });
  }

  if (loading) return <p className="text-text-secondary">Загрузка...</p>;
  if (!lesson) return <p className="text-text-secondary">Урок не найден</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push(`/admin/modules/${params.id}`)} className="text-sm text-text-secondary hover:text-primary mb-1 block">
            ← Назад к модулю
          </button>
          <h1 className="text-2xl font-bold">{lesson.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={togglePublish}>
            {lesson.is_published ? "Снять с публикации" : "Опубликовать"}
          </Button>
          <Badge variant={lesson.is_published ? "xp" : "streak"}>
            {lesson.is_published ? "Опубликован" : "Черновик"}
          </Badge>
        </div>
      </div>

      <BlockEditor lessonId={lesson.id} initialBlocks={lesson.content_blocks || []} />
    </div>
  );
}
