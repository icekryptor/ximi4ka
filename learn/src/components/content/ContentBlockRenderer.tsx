import { FormulaBlock } from "./FormulaBlock";
import type { ContentBlock } from "@/lib/types";

interface ContentBlockRendererProps {
  block: ContentBlock;
  isPreview?: boolean;
}

export function ContentBlockRenderer({ block, isPreview }: ContentBlockRendererProps) {
  const content = block.content as Record<string, string>;

  switch (block.type) {
    case "text":
      return (
        <div
          className="prose prose-sm max-w-none text-text-dark"
          dangerouslySetInnerHTML={{ __html: content.html || "" }}
        />
      );
    case "formula":
      return <FormulaBlock latex={content.latex || ""} />;
    case "image":
      return (
        <figure className="my-4">
          <img src={content.url} alt={content.caption || ""} className="rounded-2xl max-w-full mx-auto" />
          {content.caption && (
            <figcaption className="text-center text-sm text-text-secondary mt-2">{content.caption}</figcaption>
          )}
        </figure>
      );
    case "task":
      if (isPreview) {
        return (
          <div className="my-4 p-4 bg-primary/5 rounded-2xl border border-primary/20">
            <p className="text-sm text-primary font-medium">Задача доступна после авторизации</p>
          </div>
        );
      }
      return null;
    case "video":
      return content.url ? (
        <div className="my-4 aspect-video rounded-2xl overflow-hidden">
          <iframe src={content.url} className="w-full h-full" allowFullScreen />
        </div>
      ) : null;
    default:
      return null;
  }
}
