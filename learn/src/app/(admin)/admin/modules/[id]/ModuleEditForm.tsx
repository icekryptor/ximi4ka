"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Module } from "@/lib/types";

export function ModuleEditForm({ module }: { module: Module }) {
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description ?? "");
  const [isPublished, setIsPublished] = useState(module.is_published);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("modules")
      .update({ title, description, is_published: isPublished })
      .eq("id", module.id);
    setLoading(false);
    router.refresh();
  }

  async function handleTogglePublish() {
    const supabase = createClient();
    const newState = !isPublished;
    await supabase.from("modules").update({ is_published: newState }).eq("id", module.id);
    setIsPublished(newState);
    router.refresh();
  }

  return (
    <Card>
      <h2 className="text-lg font-bold mb-4">Настройки модуля</h2>
      <div className="space-y-4">
        <Input id="title" label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-border bg-white text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={3}
          />
        </div>
        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? "Сохранение..." : "Сохранить"}
        </Button>
        <Button variant="secondary" onClick={handleTogglePublish} className="w-full">
          {isPublished ? "Снять с публикации" : "Опубликовать"}
        </Button>
      </div>
    </Card>
  );
}
