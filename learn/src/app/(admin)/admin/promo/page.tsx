"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/admin/AdminRow";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `XIMI-${part()}-${part()}`;
}

export default function AdminPromoPage() {
  const [codes, setCodes] = useState<any[]>([]);
  const [count, setCount] = useState("10");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadCodes();
  }, []);

  async function loadCodes() {
    const { data } = await supabase
      .from("promo_codes")
      .select("*, profiles:used_by(display_name)")
      .order("created_at", { ascending: false });
    setCodes(data ?? []);
    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    const n = parseInt(count) || 10;
    const newCodes = Array.from({ length: n }, () => ({
      code: generateCode(),
      discount_plan: "base_promo",
      free_months: 1,
      is_used: false,
    }));

    await supabase.from("promo_codes").insert(newCodes);
    await loadCodes();
    setGenerating(false);
  }

  function exportCSV() {
    const csv = "code,status,used_by,created_at\n" +
      codes.map((c) =>
        `${c.code},${c.is_used ? "used" : "available"},${c.profiles?.display_name ?? ""},${c.created_at}`
      ).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promo-codes-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  const usedCount = codes.filter((c) => c.is_used).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-text-primary">Промокоды</h1>

      <div className="rounded-2xl bg-white border border-border p-5 mb-6">
        <div className="flex items-end gap-3 flex-wrap">
          <Input
            id="count"
            label="Количество"
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-32"
          />
          <Button onClick={handleGenerate} disabled={generating} size="sm">
            {generating ? "Генерация..." : "Сгенерировать"}
          </Button>
          <Button variant="secondary" onClick={exportCSV} size="sm">
            Экспорт CSV
          </Button>
        </div>
        <p className="text-sm text-text-secondary mt-3">
          Всего: <strong className="text-text-primary">{codes.length}</strong> ·
          Использовано: <strong className="text-text-primary">{usedCount}</strong> ·
          Доступно: <strong className="text-text-primary">{codes.length - usedCount}</strong>
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary">
            <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-semibold">Код</th>
              <th className="px-4 py-3 font-semibold">Статус</th>
              <th className="px-4 py-3 font-semibold">Использован</th>
              <th className="px-4 py-3 font-semibold">Создан</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-t border-border/60 hover:bg-bg-tertiary transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-text-primary">{c.code}</td>
                <td className="px-4 py-3">
                  <StatusPill tone={c.is_used ? "neutral" : "success"}>
                    {c.is_used ? "Использован" : "Доступен"}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 text-text-secondary">{c.profiles?.display_name ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {new Date(c.created_at).toLocaleDateString("ru-RU")}
                </td>
              </tr>
            ))}
            {codes.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  Промокодов нет. Сгенерируй пачку выше.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  Загрузка...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
