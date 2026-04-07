"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Achievement } from "@/lib/types";

export default function AdminAchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [points, setPoints] = useState("0");
  const [conditionType, setConditionType] = useState("tasks_solved");
  const [conditionCount, setConditionCount] = useState("1");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data } = await supabase.from("achievements").select("*").order("points");
    setAchievements(data ?? []);
    setLoading(false);
  }

  function startEdit(a: Achievement) {
    setEditing(a);
    setTitle(a.title);
    setSlug(a.slug);
    setDescription(a.description ?? "");
    setIconUrl(a.icon_url ?? "");
    setPoints(String(a.points));
    const cond = a.condition as any;
    setConditionType(cond.type ?? "tasks_solved");
    setConditionCount(String(cond.count ?? 1));
  }

  function resetForm() {
    setEditing(null);
    setTitle(""); setSlug(""); setDescription(""); setIconUrl(""); setPoints("0");
    setConditionType("tasks_solved"); setConditionCount("1");
  }

  async function handleSave() {
    setSaving(true);
    const data = {
      title, slug, description, icon_url: iconUrl, points: parseInt(points),
      condition: { type: conditionType, count: parseInt(conditionCount) },
    };

    if (editing) {
      await supabase.from("achievements").update(data).eq("id", editing.id);
    } else {
      await supabase.from("achievements").insert(data);
    }

    resetForm();
    await loadData();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("achievements").delete().eq("id", id);
    await loadData();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Достижения</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="space-y-3">
              {achievements.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-bg-light">
                  <span className="text-2xl">{a.icon_url || "🏆"}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{a.title}</p>
                    <p className="text-xs text-text-secondary">{a.description}</p>
                    <p className="text-xs text-primary">{a.points} XP • {(a.condition as any).type}: {(a.condition as any).count}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>✎</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>✕</Button>
                </div>
              ))}
              {loading && <p className="text-text-secondary text-center py-4">Загрузка...</p>}
              {!loading && achievements.length === 0 && (
                <p className="text-text-secondary text-center py-4">Нет достижений</p>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-bold mb-4">{editing ? "Редактировать" : "Новое достижение"}</h2>
          <div className="space-y-3">
            <Input id="title" label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input id="slug" label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <Input id="desc" label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input id="icon" label="Иконка (emoji)" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="🧪" />
            <Input id="points" label="XP" type="number" value={points} onChange={(e) => setPoints(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-text-dark mb-1">Условие</label>
              <select value={conditionType} onChange={(e) => setConditionType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm mb-2">
                <option value="tasks_solved">Задач решено</option>
                <option value="streak_days">Дней streak</option>
                <option value="modules_completed">Модулей завершено</option>
                <option value="perfect_module">Модуль без ошибок</option>
              </select>
              <Input id="condCount" label="Количество" type="number" value={conditionCount} onChange={(e) => setConditionCount(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "..." : editing ? "Обновить" : "Создать"}
              </Button>
              {editing && <Button variant="secondary" onClick={resetForm}>Отмена</Button>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
