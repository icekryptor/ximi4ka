"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

interface Props {
  params: { id: string };
}

export default function NewLessonPage({ params }: Props) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function generateSlug(text: string) {
    return text
      .toLowerCase()
      .replace(/[а-яё]/g, (char) => {
        const map: Record<string, string> = {
          а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
          з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
          п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
          ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
        };
        return map[char] || char;
      })
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.from("lessons").insert({
      module_id: params.id,
      title,
      slug: generateSlug(title),
      duration_minutes: duration ? parseInt(duration) : null,
      is_published: false,
      order_index: 0,
    }).select().single();

    if (!error && data) {
      router.push(`/admin/modules/${params.id}/${data.id}`);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-text-primary">Новый урок</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="title" label="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Input id="duration" label="Длительность (мин)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <Button type="submit" disabled={loading}>
            {loading ? "Создание..." : "Создать урок"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
