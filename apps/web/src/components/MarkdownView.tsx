import { marked } from "marked";
import { cn } from "@/lib/utils";

interface MarkdownViewProps {
  content: string;
  compact?: boolean;
  className?: string;
}

export function MarkdownView({ content, compact, className }: MarkdownViewProps) {
  const html = content ? marked.parse(content) : "";

  if (!html) return null;

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none",
        compact && "prose-xs prose-compact text-slate-500 leading-snug",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html as string }}
    />
  );
}
