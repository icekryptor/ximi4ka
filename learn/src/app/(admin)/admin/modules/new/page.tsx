"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function NewModulePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tier, setTier] = useState<"base" | "premium">("base");
  const [price, setPrice] = useState("");
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

    const { error } = await supabase.from("modules").insert({
      title,
      slug: generateSlug(title),
      description,
      tier,
      price: tier === "premium" ? parseFloat(price) : null,
      is_published: false,
      order_index: 0,
    });

    if (!error) {
      router.push("/admin/modules");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Новый модуль</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="title" label="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-border bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Тип</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as "base" | "premium")}
              className="w-full px-4 py-3 rounded-2xl border border-border bg-white text-text-primary"
            >
              <option value="base">Базовый</option>
              <option value="premium">Продвинутый (платный)</option>
            </select>
          </div>
          {tier === "premium" && (
            <Input id="price" label="Цена (₽)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Создание..." : "Создать модуль"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
