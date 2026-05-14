"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { XPPopup } from "@/components/ui/XPPopup";
import confetti from "canvas-confetti";
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
  const [shaking, setShaking] = useState(false);
  const [showXP, setShowXP] = useState(false);

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
    if (data.is_correct) {
      setShowXP(true);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#836efe", "#c856ff", "#ad7afe", "#9d8aff", "#8d67ff"],
      });
    } else {
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
    }
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

  const difficultyStars = "★".repeat(task.difficulty) + "☆".repeat(5 - task.difficulty);

  return (
    <Card className={`my-6 border-primary/20 bg-primary/5 ${shaking ? "animate-shake" : ""}`}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-primary">Задача &bull; {task.points} XP</span>
          <span className="text-xs text-text-secondary">{difficultyStars}</span>
        </div>

        <p className="font-medium mb-4 text-text-primary">{task.question}</p>

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
                    className={`w-full text-left p-3 rounded-xl border transition-all text-text-primary ${
                      showCorrect
                        ? "border-success bg-success/10"
                        : showWrong
                        ? "border-error bg-error/10"
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
            className="w-full p-3 rounded-xl border border-border mb-4 focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-primary bg-white"
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
          <div className={`mt-4 p-4 rounded-xl ${result.is_correct ? "bg-success/10 border border-success/20" : "bg-error/10 border border-error/20"}`}>
            <p className="font-medium text-text-primary">
              {result.is_correct ? `✓ Правильно! +${result.points_earned} XP` : "✗ Неправильно"}
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
      </div>

      <XPPopup
        amount={result?.points_earned ?? 0}
        show={showXP}
        onComplete={() => setShowXP(false)}
      />
    </Card>
  );
}
