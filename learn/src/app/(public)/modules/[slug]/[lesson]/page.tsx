import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ContentBlockRenderer } from "@/components/content/ContentBlockRenderer";
import type { ContentBlock } from "@/lib/types";

interface Props {
  params: { slug: string; lesson: string };
}

export default async function LessonPreviewPage({ params }: Props) {
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*, content_blocks(*), modules!inner(slug)")
    .eq("slug", params.lesson)
    .eq("modules.slug", params.slug)
    .eq("is_published", true)
    .single();

  if (!lesson) notFound();

  const blocks = ((lesson.content_blocks || []) as ContentBlock[])
    .sort((a, b) => a.order_index - b.order_index);

  const previewBlocks = blocks.slice(0, 3);
  const hasMore = blocks.length > 3;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">{lesson.title}</h1>

      <div className="space-y-6">
        {previewBlocks.map((block) => (
          <ContentBlockRenderer key={block.id} block={block} isPreview />
        ))}
      </div>

      {hasMore && (
        <div className="relative mt-8">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white z-10" />
          <div className="blur-sm opacity-50 pointer-events-none">
            {blocks.slice(3, 5).map((block) => (
              <ContentBlockRenderer key={block.id} block={block} isPreview />
            ))}
          </div>
          <div className="relative z-20 text-center py-12">
            <p className="text-lg text-text-secondary mb-4">
              Чтобы продолжить, оформите подписку
            </p>
            <Link href="/register">
              <Button size="lg">Зарегистрироваться</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
