import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FlaskConical, Lock, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { canAccessModule } from "@/lib/services/access";
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

  const isPremium = m.tier === "premium";

  // Check if user already has access
  const { data: { user } } = await supabase.auth.getUser();
  const hasAccess = user ? await canAccessModule(supabase, user.id, m.id, m.tier) : false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      {/* Module hero */}
      <Card className="p-8 mb-8">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={isPremium ? "premium" : "default"}>
                {isPremium ? "Продвинутый" : "Базовый"}
              </Badge>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">
              {m.title}
            </h1>
            <p className="text-text-secondary text-lg leading-relaxed">{m.description}</p>
          </div>
        </div>
      </Card>

      {/* Lessons list */}
      <div className="mb-8">
        <h2 className="font-display text-xl font-bold text-text-primary mb-4">
          Уроки ({lessons.length})
        </h2>
        <div className="space-y-3">
          {lessons.map((lesson, i) => {
            const lessonHref = hasAccess
              ? `/learn/${m.slug}/${lesson.slug}`
              : `/modules/${m.slug}/${lesson.slug}`;
            return (
              <Link key={lesson.id} href={lessonHref}>
                <Card
                  hover
                  className="p-5 cursor-pointer flex items-center gap-4 group"
                >
                  <span className="text-2xl font-bold text-primary/30 font-display tabular-nums w-8 flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary group-hover:text-primary transition-colors">
                      {lesson.title}
                    </h3>
                    {lesson.duration_minutes && (
                      <p className="text-sm text-text-muted">{lesson.duration_minutes} мин</p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors flex-shrink-0" />
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        {hasAccess ? (
          <Link href={`/learn/${m.slug}`}>
            <Button size="lg" glow>
              <BookOpen className="w-4 h-4 mr-2" />
              Перейти к обучению
            </Button>
          </Link>
        ) : isPremium ? (
          <Link href={`/checkout/module/${m.id}`}>
            <Button size="lg" glow>
              <Lock className="w-4 h-4 mr-2" />
              Купить за {m.price} ₽
            </Button>
          </Link>
        ) : (
          <Link href="/pricing">
            <Button size="lg" glow>
              Оформить подписку
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
