"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Task, TaskOption } from "@/lib/types";

interface TaskBlockProps {
  task: Task & { options: TaskOption[] };
}

export function TaskBlock({ task }: TaskBlockProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [numericAnswer, setNumericAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ is_correct: boolean; points_earned: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    let answer: Record<string, unknown>;

    if (task.type === "numeric_input") {
      answer = { value: parseFloat(numericAnswer) };
    } else {
      answer = { selected: selectedIds };
    }

    const res = await fetch("/api/tasks/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: task.id, answer }),
    });

    const data = await res.json();
    setResult(data);
    setSubmitted(true);
    setLoading(false);
  }

  function toggleOption(id: string) {
    if (task.type === "single_choice") {
      setSelectedIds([id]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  }

  const difficultyStars = "\u2605".repeat(task.difficulty) + "\u2606".repeat(5 - task.difficulty);

  return (
    <Card className="my-6 border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-primary">Задача &bull; {task.points} XP</span>
        <span className="text-xs text-text-secondary">{difficultyStars}</span>
      </div>

      <p className="font-medium mb-4">{task.question}</p>

      {(task.type === "single_choice" || task.type === "multiple_choice") && (
        <div className="space-y-2 mb-4">
          {task.options
            .sort((a, b) => a.order_index - b.order_index)
            .map((opt) => {
              const isSelected = selectedIds.includes(opt.id);
              const showCorrect = submitted && opt.is_correct;
              const showWrong = submitted && isSelected && !opt.is_correct;

              return (
                <button
                  key={opt.id}
                  onClick={() => !submitted && toggleOption(opt.id)}
                  disabled={submitted}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    showCorrect
                      ? "border-green-400 bg-green-50"
                      : showWrong
                      ? "border-red-400 bg-red-50"
                      : isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {opt.text}
                </button>
              );
            })}
        </div>
      )}

      {task.type === "numeric_input" && (
        <input
          type="number"
          value={numericAnswer}
          onChange={(e) => setNumericAnswer(e.target.value)}
          disabled={submitted}
          placeholder="Введите ответ"
          className="w-full p-3 rounded-xl border border-border mb-4 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}

      {!submitted && (
        <Button
          onClick={handleSubmit}
          disabled={loading || (task.type === "numeric_input" ? !numericAnswer : selectedIds.length === 0)}
          size="sm"
        >
          {loading ? "Проверяем..." : "Проверить"}
        </Button>
      )}

      {submitted && result && (
        <div className={`mt-4 p-4 rounded-xl ${result.is_correct ? "bg-green-50" : "bg-red-50"}`}>
          <p className="font-medium">
            {result.is_correct ? `\u2713 Правильно! +${result.points_earned} XP` : "\u2717 Неправильно"}
          </p>
          {task.explanation && (
            <p className="text-sm text-text-secondary mt-2">{task.explanation}</p>
          )}
          {!result.is_correct && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setSubmitted(false);
                setResult(null);
                setSelectedIds([]);
                setNumericAnswer("");
              }}
            >
              Попробовать ещё раз
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
