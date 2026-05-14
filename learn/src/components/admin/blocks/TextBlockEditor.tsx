"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface TextBlockEditorProps {
  content: { html?: string };
  onSave: (content: Record<string, unknown>) => void;
  onDelete: () => void;
}

export function TextBlockEditor({ content, onSave }: TextBlockEditorProps) {
  const [html, setHtml] = useState(content.html || "");
  const [dirty, setDirty] = useState(false);

  return (
    <div>
      <textarea
        value={html}
        onChange={(e) => { setHtml(e.target.value); setDirty(true); }}
        placeholder="HTML-контент блока..."
        className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        rows={6}
      />
      {dirty && (
        <Button size="sm" className="mt-2" onClick={() => { onSave({ html }); setDirty(false); }}>
          Сохранить
        </Button>
      )}
    </div>
  );
}
