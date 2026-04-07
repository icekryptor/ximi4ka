"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface ImageBlockEditorProps {
  content: { url?: string; caption?: string };
  lessonId: string;
  onSave: (content: Record<string, unknown>) => void;
  onDelete: () => void;
}

export function ImageBlockEditor({ content, lessonId, onSave }: ImageBlockEditorProps) {
  const [url, setUrl] = useState(content.url || "");
  const [caption, setCaption] = useState(content.caption || "");
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `lessons/${lessonId}/${Date.now()}.${ext}`;

    const { data } = await supabase.storage
      .from("content-images")
      .upload(path, file);

    if (data) {
      const { data: publicUrl } = supabase.storage.from("content-images").getPublicUrl(path);
      setUrl(publicUrl.publicUrl);
      setDirty(true);
    }
    setUploading(false);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-text-dark mb-1">Изображение</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="text-sm text-text-secondary"
        />
        {uploading && <p className="text-xs text-text-secondary mt-1">Загрузка...</p>}
      </div>
      {url && (
        <img src={url} alt={caption} className="max-h-48 rounded-xl" />
      )}
      <Input
        id="caption"
        label="Подпись"
        value={caption}
        onChange={(e) => { setCaption(e.target.value); setDirty(true); }}
        placeholder="Подпись к изображению"
      />
      {dirty && (
        <Button size="sm" onClick={() => { onSave({ url, caption }); setDirty(false); }}>
          Сохранить
        </Button>
      )}
    </div>
  );
}
