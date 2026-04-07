import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Module, Lesson } from "@/lib/types";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props) {
  const supabase = await createClient();
  const { data: module } = await supabase
    .from("modules")
    .select("title, description")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .single();

  if (!module) return { title: "Модуль не найден" };
  return { title: `${module.title} — XimiLearn`, description: module.description };
}

export default async function ModuleDetailPage({ params }: Props) {
  const supabase = await createClient();

  const { data: module } = await supabase
    .from("modules")
    .select("*, lessons(*)")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .single();

  if (!module) notFound();

  const m = module as Module & { lessons: Lesson[] };
  const lessons = (m.lessons || [])
    .filter((l) => l.is_published)
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Badge variant={m.tier === "premium" ? "premium" : "base"} className="mb-3">
          {m.tier === "premium" ? "Продвинутый" : "Базовый"}
        </Badge>
        <h1 className="text-3xl font-bold mb-4">{m.title}</h1>
        <p className="text-text-secondary text-lg">{m.description}</p>
      </div>

      <div className="space-y-3 mb-8">
        <h2 className="text-xl font-bold">Уроки ({lessons.length})</h2>
        {lessons.map((lesson, i) => (
          <Link key={lesson.id} href={`/modules/${m.slug}/${lesson.slug}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
              <span className="text-2xl font-bold text-primary/30">{i + 1}</span>
              <div>
                <h3 className="font-medium">{lesson.title}</h3>
                {lesson.duration_minutes && (
                  <p className="text-sm text-text-secondary">{lesson.duration_minutes} мин</p>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="text-center">
        {m.tier === "premium" ? (
          <Link href={`/checkout/module/${m.id}`}>
            <Button size="lg">Купить за {m.price} ₽</Button>
          </Link>
        ) : (
          <Link href="/pricing">
            <Button size="lg">Оформить подписку</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
