"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { getHTMLFromFragment } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Underline } from "@tiptap/extension-underline";
import { Table as TiptapTable } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Markdown } from "tiptap-markdown";
import type { Editor } from "@tiptap/react";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createIssueMentionExtension,
  createMentionExtension,
} from "./mention-extension";
import {
  MarkdownSourceEditor,
  type MarkdownSourceEditorHandle,
} from "./markdown-source-editor";
import { cn } from "@/lib/utils";

export type RichTextVariant = "full" | "compact";

export interface RichTextToolbarLabels {
  heading1: string;
  heading2: string;
  heading3: string;
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  code: string;
  bulletList: string;
  orderedList: string;
  taskList: string;
  blockquote: string;
  codeBlock: string;
  horizontalRule: string;
  link: string;
  linkPrompt: string;
  insertTable: string;
  markdownMode: string;
  richMode: string;
  editorModeLabel: string;
  addRowAfter: string;
  addRowBefore: string;
  addColumnAfter: string;
  addColumnBefore: string;
  deleteRow: string;
  deleteColumn: string;
  deleteTable: string;
  mentionUser?: string;
  mentionIssue?: string;
  mentionEmptyUser?: string;
  mentionEmptyIssue?: string;
}

export interface RichTextEditorProps {
  projectKey: string;
  value: string;
  onChange: (markdown: string) => void;
  variant?: RichTextVariant;
  placeholder?: string;
  toolbarLabels: RichTextToolbarLabels;
  onUploadFile?: (file: File) => Promise<void>;
  onSubmit?: () => void;
  mentionEnabled?: boolean;
  lookupPath?: string;
  issueLookupPath?: string;
  autoFocus?: boolean;
  minHeight?: string;
  editorRef?: (editor: Editor | null) => void;
}

interface MarkdownTableState {
  inTable?: boolean;
  write: (value: string) => void;
  ensureNewLine: () => void;
  closeBlock: (node: ProseMirrorNode) => void;
  renderInline: (node: ProseMirrorNode) => void;
}

const MarkdownSafeTable = TiptapTable.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownTableState, node: ProseMirrorNode) {
          if (!isGfmTableSerializable(node)) {
            serializeTableAsHtml(state, node);
            return;
          }
          serializeGfmTable(state, node);
        },
        parse: {},
      },
    };
  },
});

function childNodes(node: ProseMirrorNode): ProseMirrorNode[] {
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => children.push(child));
  return children;
}

function hasSpan(node: ProseMirrorNode): boolean {
  return Number(node.attrs.colspan ?? 1) > 1 || Number(node.attrs.rowspan ?? 1) > 1;
}

function hasSinglePlainParagraph(cell: ProseMirrorNode): boolean {
  return cell.childCount === 1 && cell.firstChild?.type.name === "paragraph";
}

function isGfmTableSerializable(node: ProseMirrorNode): boolean {
  const rows = childNodes(node);
  const firstRow = rows[0];
  if (!firstRow) return true;
  const bodyRows = rows.slice(1);

  if (
    childNodes(firstRow).some(
      (cell) => cell.type.name !== "tableHeader" || hasSpan(cell) || !hasSinglePlainParagraph(cell)
    )
  ) {
    return false;
  }

  return !bodyRows.some((row) =>
    childNodes(row).some(
      (cell) => cell.type.name === "tableHeader" || hasSpan(cell) || !hasSinglePlainParagraph(cell)
    )
  );
}

function serializeGfmTable(state: MarkdownTableState, node: ProseMirrorNode) {
  state.inTable = true;
  node.forEach((row, _rowOffset, rowIndex) => {
    state.write("| ");
    row.forEach((cell, _cellOffset, cellIndex) => {
      if (cellIndex) state.write(" | ");
      const cellContent = cell.firstChild;
      if (cellContent?.textContent.trim()) state.renderInline(cellContent);
    });
    state.write(" |");
    state.ensureNewLine();
    if (!rowIndex) {
      const delimiterRow = Array.from({ length: row.childCount }).map(() => "---").join(" | ");
      state.write(`| ${delimiterRow} |`);
      state.ensureNewLine();
    }
  });
  state.closeBlock(node);
  state.inTable = false;
}

function serializeTableAsHtml(state: MarkdownTableState, node: ProseMirrorNode) {
  const html = getHTMLFromFragment(Fragment.from(node), node.type.schema);
  state.write(`\n${html}\n`);
  state.closeBlock(node);
}

// Insert a suggestion trigger char, prepending a space if the cursor sits
// immediately after a non-whitespace character. Otherwise the @tiptap/suggestion
// plugin's `allowedPrefixes: [' ']` rejects the trigger.
function insertTrigger(editor: Editor, trigger: string) {
  editor.commands.focus();
  const { state, dispatch } = editor.view;
  const { from, to } = state.selection;
  const before = from > 0 ? state.doc.textBetween(Math.max(0, from - 1), from, "\n", "\0") : "";
  const needsSpace = before !== "" && !/\s/.test(before);
  const text = needsSpace ? ` ${trigger}` : trigger;
  dispatch(state.tr.insertText(text, from, to));
}

export function RichTextEditor({
  projectKey,
  value,
  onChange,
  variant = "full",
  placeholder,
  toolbarLabels,
  onUploadFile,
  onSubmit,
  mentionEnabled = true,
  lookupPath,
  issueLookupPath,
  autoFocus,
  minHeight,
  editorRef,
}: RichTextEditorProps) {
  const tb = toolbarLabels;
  const isFull = variant === "full";
  const resolvedLookup = lookupPath ?? `/api/projects/${projectKey}/members-lookup`;
  const resolvedIssueLookup = issueLookupPath ?? `/api/projects/${projectKey}/work-items-lookup`;

  const [mode, setMode] = useState<"rich" | "source">("rich");
  const sourceRef = useRef<MarkdownSourceEditorHandle | null>(null);

  const lookupBuilders = useMemo(
    () => ({
      user: (q: string) => `${resolvedLookup}?q=${encodeURIComponent(q)}`,
      issue: (q: string) => `${resolvedIssueLookup}?q=${encodeURIComponent(q)}`,
    }),
    [resolvedLookup, resolvedIssueLookup]
  );

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: isFull ? { levels: [1, 2, 3] } : false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ...(isFull
        ? [
            Image.configure({ inline: false, allowBase64: false }),
            MarkdownSafeTable.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
          ]
        : []),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Markdown.configure({ html: true, linkify: true, breaks: true, tightLists: true }),
      ...(mentionEnabled
        ? [
            createMentionExtension({
              lookupUrl: (q) => `${resolvedLookup}?q=${encodeURIComponent(q)}`,
              emptyMessage: tb.mentionEmptyUser,
            }),
            createIssueMentionExtension({
              lookupUrl: (q) => `${resolvedIssueLookup}?q=${encodeURIComponent(q)}`,
              emptyMessage: tb.mentionEmptyIssue,
            }),
          ]
        : []),
    ],
    [
      isFull,
      placeholder,
      mentionEnabled,
      resolvedLookup,
      resolvedIssueLookup,
      tb.mentionEmptyUser,
      tb.mentionEmptyIssue,
    ]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value,
    // tiptap treats `autofocus: undefined` as truthy (its check is
    // `!== false && !== null`), which calls view.focus() and scrolls
    // the contentEditable into view. Force an explicit false fallback.
    autofocus: autoFocus ?? false,
    editorProps: {
      attributes: {
        class: `rich-text-prose max-w-none focus:outline-none px-3 py-2 ${
          isFull ? "" : "text-[length:var(--text-sm)]"
        }`,
        style: minHeight ? `min-height:${minHeight};` : isFull ? "min-height:400px;" : "min-height:72px;",
      },
      handlePaste(view, event) {
        if (!onUploadFile) return false;
        const files = event.clipboardData?.files;
        if (files && files.length > 0) {
          event.preventDefault();
          for (const file of Array.from(files)) void onUploadFile(file);
          return true;
        }
        return false;
      },
      handleDrop(view, event) {
        if (!onUploadFile) return false;
        const files = (event as DragEvent).dataTransfer?.files;
        if (files && files.length > 0) {
          event.preventDefault();
          for (const file of Array.from(files)) void onUploadFile(file);
          return true;
        }
        return false;
      },
      handleKeyDown(_view, event) {
        if (
          onSubmit &&
          event.key === "Enter" &&
          (event.metaKey || event.ctrlKey) &&
          !event.shiftKey
        ) {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
      const md = storage.markdown?.getMarkdown?.() ?? editor.getText();
      onChange(md);
    },
  });

  useEffect(() => {
    editorRef?.(editor ?? null);
    return () => editorRef?.(null);
  }, [editor, editorRef]);

  // 외부 컨트롤러가 value 를 빈 문자열로 리셋한 경우(예: 댓글 등록 후 setDraft(""))
  // ProseMirror doc 도 비움. tiptap 의 useEditor 는 mount 시에만 content 를 적용하므로
  // 이 동기화가 없으면 입력창이 시각적으로 잔류한다.
  // 사용자 타이핑 중에는 value !== "" 이므로 cursor 손실 없음. emitUpdate=false 로 onUpdate 재진입 차단.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if ((value ?? "") !== "") return;
    const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
    const currentMd = (storage.markdown?.getMarkdown?.() ?? editor.getText() ?? "").trim();
    if (currentMd === "") return;
    editor.commands.setContent("", { emitUpdate: false });
  }, [value, editor]);

  const switchMode = (target: "rich" | "source") => {
    if (target === mode) return;
    // source → rich: re-parse the edited markdown back into the Tiptap doc.
    if (target === "rich" && editor && !editor.isDestroyed) {
      editor.commands.setContent(value);
    }
    setMode(target);
  };

  const insertMention = (ch: string) => {
    if (mode === "rich") {
      if (editor) insertTrigger(editor, ch);
    } else {
      sourceRef.current?.insertMentionTrigger(ch);
    }
  };

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
      {editor && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-border)] px-2 py-1 text-[length:var(--text-xs)]">
          {mode === "rich" && (
            <>
              {isFull && (
                <>
                  <Btn label="H1" title={tb.heading1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} />
                  <Btn label="H2" title={tb.heading2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} />
                  <Btn label="H3" title={tb.heading3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} />
                  <Sep />
                </>
              )}
              <Btn label="B" bold title={tb.bold} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} />
              <Btn label="I" italic title={tb.italic} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} />
              <Btn label="U" underline title={tb.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} />
              <Btn label="S" strike title={tb.strike} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} />
              <Btn label="`code`" title={tb.code} onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} />
              <Sep />
              <Btn label="•" title={tb.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} />
              <Btn label="1." title={tb.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} />
              <Btn label="☐" title={tb.taskList} onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} />
              <Btn label="❝" title={tb.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} />
              <Btn label="</>" title={tb.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} />
              {isFull && <Btn label="―" title={tb.horizontalRule} onClick={() => editor.chain().focus().setHorizontalRule().run()} />}
              <Sep />
              <Btn
                label="🔗"
                title={tb.link}
                onClick={() => {
                  const prev = editor.getAttributes("link").href as string | undefined;
                  const url = window.prompt(tb.linkPrompt, prev ?? "https://");
                  if (url === null) return;
                  if (url === "") {
                    editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  } else {
                    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                  }
                }}
                active={editor.isActive("link")}
              />
            </>
          )}
          {mentionEnabled && (
            <>
              {mode === "rich" && <Sep />}
              <Btn label="@" title={tb.mentionUser ?? "Mention user"} onClick={() => insertMention("@")} runOnMouseDown />
              <Btn label="#" title={tb.mentionIssue ?? "Mention issue"} onClick={() => insertMention("#")} runOnMouseDown />
            </>
          )}
          {isFull && mode === "rich" && (
            <>
              <Sep />
              <Btn
                label="Tbl"
                title={tb.insertTable}
                onClick={() =>
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                }
              />
              {editor.isActive("table") && (
                <>
                  <Btn label="Row+" title={tb.addRowAfter} onClick={() => editor.chain().focus().addRowAfter().run()} />
                  <Btn label="+Row" title={tb.addRowBefore} onClick={() => editor.chain().focus().addRowBefore().run()} />
                  <Btn label="Col+" title={tb.addColumnAfter} onClick={() => editor.chain().focus().addColumnAfter().run()} />
                  <Btn label="+Col" title={tb.addColumnBefore} onClick={() => editor.chain().focus().addColumnBefore().run()} />
                  <Btn label="Row-" title={tb.deleteRow} onClick={() => editor.chain().focus().deleteRow().run()} />
                  <Btn label="Col-" title={tb.deleteColumn} onClick={() => editor.chain().focus().deleteColumn().run()} />
                  <Btn label="Del" title={tb.deleteTable} onClick={() => editor.chain().focus().deleteTable().run()} />
                </>
              )}
            </>
          )}
          <div
            role="group"
            aria-label={tb.editorModeLabel}
            className="ml-auto inline-flex h-7 shrink-0 items-center rounded-full bg-[var(--color-bg-secondary)] p-0.5"
          >
            <ModeSegment
              icon="Aa"
              label={tb.richMode}
              active={mode === "rich"}
              onClick={() => switchMode("rich")}
            />
            <ModeSegment
              icon="Md"
              label={tb.markdownMode}
              active={mode === "source"}
              onClick={() => switchMode("source")}
            />
          </div>
        </div>
      )}
      {mode === "source" ? (
        <MarkdownSourceEditor
          ref={sourceRef}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={minHeight}
          compact={!isFull}
          autoFocus={autoFocus}
          onUploadFile={onUploadFile}
          onSubmit={onSubmit}
          mentionEnabled={mentionEnabled}
          userLookupUrl={lookupBuilders.user}
          issueLookupUrl={lookupBuilders.issue}
          emptyUser={tb.mentionEmptyUser}
          emptyIssue={tb.mentionEmptyIssue}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />;
}

// One segment of the WYSIWYG ↔ Markdown mode switch. Both segments stay visible
// so the current mode (highlighted) and the alternative (the click target) are
// always legible — a clearer affordance than a single label-flipping toggle.
function ModeSegment({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[length:var(--text-2xs)] leading-none transition-colors",
        active
          ? "bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-[var(--shadow-xs)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      )}
    >
      <span aria-hidden className="font-semibold">
        {icon}
      </span>
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function Btn({
  label,
  onClick,
  active,
  title,
  bold,
  italic,
  underline,
  strike,
  runOnMouseDown,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  title?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  runOnMouseDown?: boolean;
}) {
  const handledMouseDown = useRef(false);

  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        if (runOnMouseDown) {
          handledMouseDown.current = true;
          onClick();
        }
      }}
      onClick={() => {
        if (handledMouseDown.current) {
          handledMouseDown.current = false;
          return;
        }
        onClick();
      }}
      title={title ?? label}
      aria-label={title ?? label}
      className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded px-1.5 text-[length:var(--text-xs)] md:h-7 md:min-w-[28px] ${
        active ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]" : "hover:bg-[var(--color-bg-hover)]"
      } ${bold ? "font-bold" : ""} ${italic ? "italic" : ""} ${underline ? "underline" : ""} ${strike ? "line-through" : ""}`}
    >
      {label}
    </button>
  );
}
