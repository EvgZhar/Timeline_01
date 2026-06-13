import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { marked } from "marked";
import TurndownService from "turndown";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  hr: "---",
});

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxH?: string;
}

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onPointerDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "rounded p-1 hover:bg-slate-100",
        active ? "bg-slate-200 text-blue-600" : "text-slate-600",
      )}
    >
      {children}
    </button>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
  maxH,
}: MarkdownEditorProps) {
  const lastMdRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Введите описание…",
      }),
    ],
    onCreate: ({ editor }) => {
      const html = value ? marked.parse(value) : "";
      editor.commands.setContent(html);
      lastMdRef.current = value;
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = turndownService.turndown(html);
      lastMdRef.current = md;
      onChange(md);
    },
  });

  useEffect(() => {
    if (editor && value !== lastMdRef.current) {
      const html = value ? marked.parse(value) : "";
      editor.commands.setContent(html);
      lastMdRef.current = value;
    }
  }, [value, editor]);

  const h1 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 1 }).run(), [editor]);
  const h2 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const h3 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 3 }).run(), [editor]);
  const bold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const italic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const strike = useCallback(() => editor?.chain().focus().toggleStrike().run(), [editor]);
  const bulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const orderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
  const blockquote = useCallback(() => editor?.chain().focus().toggleBlockquote().run(), [editor]);
  const codeBlock = useCallback(() => editor?.chain().focus().toggleCodeBlock().run(), [editor]);
  const hr = useCallback(() => editor?.chain().focus().setHorizontalRule().run(), [editor]);

  return (
    <div className={cn("flex flex-col rounded border border-slate-300", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-1.5">
        <ToolbarButton onClick={h1} active={editor?.isActive("heading", { level: 1 })} title="Заголовок 1">
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={h2} active={editor?.isActive("heading", { level: 2 })} title="Заголовок 2">
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={h3} active={editor?.isActive("heading", { level: 3 })} title="Заголовок 3">
          <Heading3 size={16} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-slate-300" />
        <ToolbarButton onClick={bold} active={editor?.isActive("bold")} title="Полужирный">
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={italic} active={editor?.isActive("italic")} title="Курсив">
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={strike} active={editor?.isActive("strike")} title="Зачёркнутый">
          <Strikethrough size={16} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-slate-300" />
        <ToolbarButton onClick={bulletList} active={editor?.isActive("bulletList")} title="Маркированный список">
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={orderedList} active={editor?.isActive("orderedList")} title="Нумерованный список">
          <ListOrdered size={16} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-slate-300" />
        <ToolbarButton onClick={blockquote} active={editor?.isActive("blockquote")} title="Цитата">
          <Quote size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={codeBlock} active={editor?.isActive("codeBlock")} title="Блок кода">
          <Code size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={hr} title="Разделитель">
          <Minus size={16} />
        </ToolbarButton>
      </div>
      <div
        className={cn("overflow-y-auto p-2", !maxH && "min-h-[120px]")}
        style={maxH ? { maxHeight: maxH } : undefined}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
