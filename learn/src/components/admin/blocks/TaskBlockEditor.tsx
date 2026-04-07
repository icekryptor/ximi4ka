"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Task, TaskOption, TaskType } from "@/lib/types";

interface TaskBlockEditorProps {
  blockId: string;
  task?: Task & { task_options?: TaskOption[] };
  onSave: (content: Record<string, unknown>) => void;
  onDelete: () => void;
}

const taskTypes: { value: TaskType; label: string }[] = [
  { value: "single_choice", label: "Выбор одного" },
  { value: "multiple_choice", label: "Выбор нескольких" },
  { value: "numeric_input", label: "Числовой ввод" },
];

export function TaskBlockEditor({ blockId, task: initialTask }: TaskBlockEditorProps) {
  const [taskType, setTaskType] = useState<TaskType>(initialTask?.type || "single_choice");
  const [question, setQuestion] = useState(initialTask?.question || "");
  const [explanation, setExplanation] = useState(initialTask?.explanation || "");
  const [difficulty, setDifficulty] = useState(initialTask?.difficulty || 1);
  const [points, setPoints] = useState(initialTask?.points || 10);
  const [options, setOptions] = useState<{ text: string; is_correct: boolean }[]>(
    initialTask?.task_options?.map((o) => ({ text: o.text, is_correct: o.is_correct })) || [
      { text: "", is_correct: false },
      { text: "", is_correct: false },
    ]
  );
  const [saving, setSaving] = useState(false);
  const [taskId, setTaskId] = useState(initialTask?.id);
  const supabase = createClient();

  function addOption() {
    setOptions([...options, { text: "", is_correct: false }]);
  }

  function removeOption(index: number) {
    setOptions(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, field: "text" | "is_correct", value: string | boolean) {
    const updated = [...options];
    if (field === "is_correct" && taskType === "single_choice") {
      updated.forEach((o) => (o.is_correct = false));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;
    setOptions(updated);
  }

  async function handleSave() {
    setSaving(true);

    if (taskId) {
      // Update existing
      await supabase.from("tasks").update({ type: taskType, question, explanation, difficulty, points }).eq("id", taskId);
      await supabase.from("task_options").delete().eq("task_id", taskId);
      await supabase.from("task_options").insert(
        options.map((o, i) => ({ task_id: taskId, text: o.text, is_correct: o.is_correct, order_index: i }))
      );
    } else {
      // Create new
      const { data: newTask } = await supabase
        .from("tasks")
        .insert({ content_block_id: blockId, type: taskType, question, explanation, difficulty, points })
        .select()
        .single();

      if (newTask) {
        setTaskId(newTask.id);
        await supabase.from("task_options").insert(
          options.map((o, i) => ({ task_id: newTask.id, text: o.text, is_correct: o.is_correct, order_index: i }))
        );
      }
    }

    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-dark mb-1">Тип задачи</label>
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as TaskType)}
          className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-dark"
        >
          {taskTypes.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-dark mb-1">Вопрос</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          rows={2}
        />
      </div>

      {(taskType === "single_choice" || taskType === "multiple_choice") && (
        <div>
          <label className="block text-sm font-medium text-text-dark mb-2">Варианты ответов</label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                type={taskType === "single_choice" ? "radio" : "checkbox"}
                checked={opt.is_correct}
                onChange={(e) => updateOption(i, "is_correct", e.target.checked)}
                className="accent-primary"
              />
              <input
                value={opt.text}
                onChange={(e) => updateOption(i, "text", e.target.value)}
                placeholder={`Вариант ${i + 1}`}
                className="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
              )}
            </div>
          ))}
          <button onClick={addOption} className="text-sm text-primary hover:underline">+ Добавить вариант</button>
        </div>
      )}

      {taskType === "numeric_input" && (
        <div>
          <label className="block text-sm font-medium text-text-dark mb-2">Правильный ответ (число)</label>
          <input
            value={options[0]?.text || ""}
            onChange={(e) => {
              setOptions([{ text: e.target.value, is_correct: true }]);
            }}
            type="number"
            placeholder="Правильный числовой ответ"
            className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Сложность (1-5)</label>
          <input
            type="range"
            min={1}
            max={5}
            value={difficulty}
            onChange={(e) => setDifficulty(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-xs text-text-secondary text-center">{"★".repeat(difficulty)}{"☆".repeat(5 - difficulty)}</p>
        </div>
        <Input id="points" label="Баллы (XP)" type="number" value={String(points)} onChange={(e) => setPoints(parseInt(e.target.value) || 10)} />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-dark mb-1">Пояснение (после ответа)</label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          rows={2}
          placeholder="Объяснение правильного ответа..."
        />
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm">
        {saving ? "Сохранение..." : taskId ? "Обновить задачу" : "Создать задачу"}
      </Button>
    </div>
  );
}
