"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

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
      <h1 className="text-2xl font-bold mb-6">Промокоды</h1>

      <Card className="mb-6">
        <div className="flex items-end gap-4">
          <Input
            id="count"
            label="Количество"
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-32"
          />
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Генерация..." : "Сгенерировать"}
          </Button>
          <Button variant="secondary" onClick={exportCSV}>
            Экспорт CSV
          </Button>
        </div>
        <p className="text-sm text-text-secondary mt-3">
          Всего: {codes.length} | Использовано: {usedCount} | Доступно: {codes.length - usedCount}
        </p>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary border-b border-border">
                <th className="pb-3 pr-4">Код</th>
                <th className="pb-3 pr-4">Статус</th>
                <th className="pb-3 pr-4">Использован</th>
                <th className="pb-3">Дата создания</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-mono font-medium">{c.code}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={c.is_used ? "streak" : "xp"}>
                      {c.is_used ? "Использован" : "Доступен"}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-text-secondary">
                    {c.profiles?.display_name ?? "—"}
                  </td>
                  <td className="py-3 text-text-secondary">
                    {new Date(c.created_at).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <p className="text-text-secondary text-center py-4">Загрузка...</p>}
      </Card>
    </div>
  );
}
