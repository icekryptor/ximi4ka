"use client";

import { useState, useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/Button";

interface FormulaBlockEditorProps {
  content: { latex?: string };
  onSave: (content: Record<string, unknown>) => void;
  onDelete: () => void;
}

export function FormulaBlockEditor({ content, onSave }: FormulaBlockEditorProps) {
  const [latex, setLatex] = useState(content.latex || "");
  const [dirty, setDirty] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewRef.current && latex) {
      try {
        katex.render(latex, previewRef.current, { displayMode: true, throwOnError: false });
      } catch {
        previewRef.current.textContent = "Ошибка формулы";
      }
    }
  }, [latex]);

  return (
    <div>
      <textarea
        value={latex}
        onChange={(e) => { setLatex(e.target.value); setDirty(true); }}
        placeholder="LaTeX формула, например: \ce{H2O} или \frac{1}{2}"
        className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-dark font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        rows={3}
      />
      {latex && (
        <div className="mt-2 p-4 bg-bg-light rounded-xl">
          <p className="text-xs text-text-secondary mb-1">Превью:</p>
          <div ref={previewRef} className="text-center overflow-x-auto" />
        </div>
      )}
      {dirty && (
        <Button size="sm" className="mt-2" onClick={() => { onSave({ latex }); setDirty(false); }}>
          Сохранить
        </Button>
      )}
    </div>
  );
}
