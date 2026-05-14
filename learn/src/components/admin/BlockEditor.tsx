"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextBlockEditor } from "./blocks/TextBlockEditor";
import { FormulaBlockEditor } from "./blocks/FormulaBlockEditor";
import { ImageBlockEditor } from "./blocks/ImageBlockEditor";
import { TaskBlockEditor } from "./blocks/TaskBlockEditor";
interface BlockEditorProps {
  lessonId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialBlocks: any[];
}

const blockTypes = [
  { type: "text", label: "Текст" },
  { type: "formula", label: "Формула" },
  { type: "image", label: "Изображение" },
  { type: "task", label: "Задача" },
];

export function BlockEditor({ lessonId, initialBlocks }: BlockEditorProps) {
  const [blocks, setBlocks] = useState(
    [...initialBlocks].sort((a, b) => a.order_index - b.order_index)
  );
  const supabase = createClient();

  async function addBlock(type: string) {
    const newBlock = {
      lesson_id: lessonId,
      type,
      content: type === "text" ? { html: "" } : type === "formula" ? { latex: "" } : type === "image" ? { url: "", caption: "" } : {},
      order_index: blocks.length,
    };

    const { data } = await supabase
      .from("content_blocks")
      .insert(newBlock)
      .select()
      .single();

    if (data) {
      setBlocks([...blocks, data]);
    }
  }

  async function updateBlock(blockId: string, content: Record<string, unknown>) {
    await supabase
      .from("content_blocks")
      .update({ content })
      .eq("id", blockId);

    setBlocks(blocks.map((b) => (b.id === blockId ? { ...b, content } : b)));
  }

  async function deleteBlock(blockId: string) {
    await supabase.from("content_blocks").delete().eq("id", blockId);
    setBlocks(blocks.filter((b) => b.id !== blockId));
  }

  async function moveBlock(index: number, direction: "up" | "down") {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === blocks.length - 1)
    )
      return;

    const newBlocks = [...blocks];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[swapIndex]] = [newBlocks[swapIndex], newBlocks[index]];

    // Update order_index for both blocks
    const updates = newBlocks.map((b, i) => ({ ...b, order_index: i }));
    setBlocks(updates);

    await Promise.all(
      updates.map((b) =>
        supabase.from("content_blocks").update({ order_index: b.order_index }).eq("id", b.id)
      )
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderBlockEditor(block: any, _index: number) {
    const common = {
      onSave: (content: Record<string, unknown>) => updateBlock(block.id, content),
      onDelete: () => deleteBlock(block.id),
    };

    switch (block.type) {
      case "text":
        return <TextBlockEditor key={block.id} content={block.content} {...common} />;
      case "formula":
        return <FormulaBlockEditor key={block.id} content={block.content} {...common} />;
      case "image":
        return <ImageBlockEditor key={block.id} content={block.content} lessonId={lessonId} {...common} />;
      case "task":
        return <TaskBlockEditor key={block.id} blockId={block.id} task={block.tasks?.[0]} {...common} />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <Card key={block.id} className="relative">
          <div className="flex items-center justify-between mb-3 text-xs text-text-secondary">
            <span className="uppercase font-medium">
              {block.type === "text" ? "Текст" : block.type === "formula" ? "Формула" : block.type === "image" ? "Изображение" : "Задача"}
            </span>
            <div className="flex gap-1">
              <button onClick={() => moveBlock(i, "up")} disabled={i === 0} className="px-2 py-1 hover:bg-bg-tertiary rounded disabled:opacity-30">↑</button>
              <button onClick={() => moveBlock(i, "down")} disabled={i === blocks.length - 1} className="px-2 py-1 hover:bg-bg-tertiary rounded disabled:opacity-30">↓</button>
              <button onClick={() => deleteBlock(block.id)} className="px-2 py-1 hover:bg-red-50 text-red-500 rounded">✕</button>
            </div>
          </div>
          {renderBlockEditor(block, i)}
        </Card>
      ))}

      <div className="flex gap-2 justify-center py-4">
        {blockTypes.map((bt) => (
          <Button key={bt.type} variant="secondary" size="sm" onClick={() => addBlock(bt.type)}>
            + {bt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
