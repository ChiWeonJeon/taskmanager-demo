"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { MentionList, type MentionListHandle, type MentionUser } from "./mention-list";
import {
  IssueMentionList,
  type IssueMentionItem,
  type IssueMentionListHandle,
} from "./issue-mention-list";

export interface MarkdownSourceEditorHandle {
  insertMentionTrigger: (trigger: string) => void;
  focus: () => void;
}

type MentionType = "user" | "issue";

interface ActiveTrigger {
  type: MentionType;
  // [start, caret) is the range to replace on selection (includes trigger chars).
  start: number;
  query: string;
}

export interface MarkdownSourceEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: string;
  compact?: boolean;
  autoFocus?: boolean;
  onUploadFile?: (file: File) => Promise<void>;
  onSubmit?: () => void;
  mentionEnabled?: boolean;
  userLookupUrl?: (query: string) => string;
  issueLookupUrl?: (query: string) => string;
  emptyUser?: string;
  emptyIssue?: string;
}

// Detect an in-progress mention trigger immediately before the caret.
// Mirrors the tiptap @mention suggestion rules: a trigger only fires at the
// start of the text or after whitespace; `@`/`#` stop at whitespace.
function detectTrigger(text: string, caret: number): ActiveTrigger | null {
  const before = text.slice(0, caret);

  // User `@` / issue `#` — no whitespace in the query. The `(?:^|\s)` guard
  // means an `@` inside an existing `[@name](user:id)` link (preceded by `[`)
  // does not re-trigger.
  const m = /(^|\s)([@#])([^\s@#[\]()]*)$/.exec(before);
  if (m) {
    const triggerChar = m[2];
    const query = m[3];
    const start = caret - query.length - 1;
    return { type: triggerChar === "@" ? "user" : "issue", start, query };
  }

  return null;
}

function mentionMarkdown(type: MentionType, id: string, label: string): string {
  if (type === "user") return `[@${label}](user:${id})`;
  return `[#${label}](issue:${id})`;
}

export function insertMentionTriggerText(
  value: string,
  start: number,
  end: number,
  trigger: string
): { value: string; caret: number } {
  const needsSpace = start > 0 && !/\s/.test(value[start - 1] ?? "");
  const inserted = needsSpace ? ` ${trigger}` : trigger;
  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    caret: start + inserted.length,
  };
}

// Compute the pixel coordinates of `position` within a textarea by rendering a
// hidden mirror div with the same typography and measuring a marker span.
function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number
): { top: number; left: number; height: number } {
  const div = document.createElement("div");
  const style = window.getComputedStyle(textarea);
  const props = [
    "boxSizing",
    "width",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "textTransform",
    "wordSpacing",
    "tabSize",
  ] as const;
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.overflowWrap = "break-word";
  for (const p of props) {
    div.style[p] = style[p];
  }
  div.textContent = textarea.value.slice(0, position);
  const span = document.createElement("span");
  span.textContent = textarea.value.slice(position) || ".";
  div.appendChild(span);
  document.body.appendChild(div);
  const top = span.offsetTop - textarea.scrollTop;
  const left = span.offsetLeft - textarea.scrollLeft;
  const height = parseInt(style.lineHeight || style.fontSize || "16", 10) || 16;
  document.body.removeChild(div);
  return { top, left, height };
}

export const MarkdownSourceEditor = forwardRef<
  MarkdownSourceEditorHandle,
  MarkdownSourceEditorProps
>(function MarkdownSourceEditor(
  {
    value,
    onChange,
    placeholder,
    minHeight,
    compact,
    autoFocus,
    onUploadFile,
    onSubmit,
    mentionEnabled = true,
    userLookupUrl,
    issueLookupUrl,
    emptyUser,
    emptyIssue,
  },
  ref
) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<MentionListHandle | IssueMentionListHandle | null>(null);
  const [trigger, setTrigger] = useState<ActiveTrigger | null>(null);
  const [items, setItems] = useState<Array<MentionUser | IssueMentionItem>>([]);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const blurCloseTimer = useRef<number | null>(null);
  const reqIdRef = useRef(0);
  const triggerKeyRef = useRef("");

  const clearBlurCloseTimer = useCallback(() => {
    if (blurCloseTimer.current != null) {
      window.clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  }, []);

  const closePopup = useCallback(() => {
    reqIdRef.current += 1;
    triggerKeyRef.current = "";
    setTrigger(null);
    setItems([]);
    setCoords(null);
  }, []);

  useEffect(() => clearBlurCloseTimer, [clearBlurCloseTimer]);

  const refreshTrigger = useCallback(() => {
    const ta = taRef.current;
    if (!ta || !mentionEnabled) {
      closePopup();
      return;
    }
    const caret = ta.selectionStart ?? 0;
    if (ta.selectionStart !== ta.selectionEnd) {
      closePopup();
      return;
    }
    const detected = detectTrigger(ta.value, caret);
    if (!detected) {
      closePopup();
      return;
    }
    const triggerKey = `${detected.type}:${detected.start}:${detected.query}`;
    if (triggerKeyRef.current !== triggerKey) {
      triggerKeyRef.current = triggerKey;
      reqIdRef.current += 1;
      setItems([]);
    }
    setTrigger(detected);
    const c = getCaretCoordinates(ta, detected.start);
    const rect = ta.getBoundingClientRect();
    setCoords({
      x: rect.left + c.left,
      y: rect.top + c.top + c.height,
    });
  }, [mentionEnabled, closePopup]);

  useImperativeHandle(ref, () => ({
    insertMentionTrigger: (triggerText: string) => {
      const ta = taRef.current;
      if (!ta) return;
      const start = ta.selectionStart ?? value.length;
      const end = ta.selectionEnd ?? value.length;
      const next = insertMentionTriggerText(value, start, end, triggerText);
      pendingCaret.current = next.caret;
      clearBlurCloseTimer();
      onChange(next.value);
      requestAnimationFrame(() => {
        ta.focus();
        refreshTrigger();
      });
    },
    focus: () => taRef.current?.focus(),
  }));

  // Restore the caret after a controlled value update that we initiated
  // (mention insertion / programmatic insert), since React resets it to end.
  useLayoutEffect(() => {
    if (pendingCaret.current == null) return;
    const ta = taRef.current;
    if (ta) {
      const pos = pendingCaret.current;
      ta.setSelectionRange(pos, pos);
      requestAnimationFrame(refreshTrigger);
    }
    pendingCaret.current = null;
  }, [value, refreshTrigger]);

  // Fetch suggestions whenever the active trigger/query changes.
  useEffect(() => {
    if (!trigger) return;
    const reqId = ++reqIdRef.current;
    const run = async () => {
      try {
        let result: Array<MentionUser | IssueMentionItem> = [];
        if (trigger.type === "user" && userLookupUrl) {
          const res = await fetch(userLookupUrl(trigger.query));
          if (res.ok) {
            const data = (await res.json()) as { members?: MentionUser[] };
            result = (data.members ?? []).slice(0, 8);
          }
        } else if (trigger.type === "issue" && issueLookupUrl) {
          const res = await fetch(issueLookupUrl(trigger.query));
          if (res.ok) {
            const data = (await res.json()) as { items?: IssueMentionItem[] };
            result = (data.items ?? []).slice(0, 10);
          }
        }
        if (reqIdRef.current === reqId) setItems(result);
      } catch {
        if (reqIdRef.current === reqId) setItems([]);
      }
    };
    void run();
  }, [trigger, userLookupUrl, issueLookupUrl]);

  const commitMention = (item: { id: string; label: string }) => {
    const ta = taRef.current;
    if (!ta || !trigger) return;
    const md = mentionMarkdown(trigger.type, item.id, item.label);
    const caret = ta.selectionStart ?? value.length;
    const next = value.slice(0, trigger.start) + md + value.slice(caret);
    pendingCaret.current = trigger.start + md.length;
    onChange(next);
    closePopup();
    requestAnimationFrame(() => ta.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (trigger) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePopup();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        const handled = listRef.current?.onKeyDown({ event: e.nativeEvent });
        if (handled) {
          e.preventDefault();
          return;
        }
      }
    }
    if (onSubmit && e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleFiles = (files: FileList | null | undefined) => {
    if (!onUploadFile || !files || files.length === 0) return false;
    for (const file of Array.from(files)) void onUploadFile(file);
    return true;
  };

  const emptyFor = (t: MentionType) => (t === "user" ? emptyUser : emptyIssue);

  return (
    <>
      <textarea
        ref={taRef}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          // Defer so selectionStart reflects the post-input caret.
          requestAnimationFrame(refreshTrigger);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={refreshTrigger}
        onClick={refreshTrigger}
        onFocus={clearBlurCloseTimer}
        onBlur={() => {
          // Allow a mousedown selection on the popup to land first.
          blurCloseTimer.current = window.setTimeout(closePopup, 150);
        }}
        onPaste={(e) => {
          if (handleFiles(e.clipboardData?.files)) e.preventDefault();
        }}
        onDrop={(e) => {
          if (handleFiles(e.dataTransfer?.files)) e.preventDefault();
        }}
        className={`rich-text-md-source w-full resize-y bg-transparent px-3 py-2 font-mono focus:outline-none ${
          compact ? "text-[length:var(--text-xs)]" : "text-[length:var(--text-sm)]"
        }`}
        style={{ minHeight: minHeight ?? (compact ? "72px" : "400px") }}
      />
      {trigger && coords && (
        <FloatingPortal
          open
          anchorPoint={coords}
          placement="bottom"
          align="start"
          preferredWidth={280}
          maxHeight={320}
          zIndex={120}
          className="rich-text-mention-popup"
        >
          {trigger.type === "user" && (
            <MentionList
              ref={listRef as React.Ref<MentionListHandle>}
              items={items as MentionUser[]}
              command={commitMention}
              emptyMessage={emptyFor("user")}
            />
          )}
          {trigger.type === "issue" && (
            <IssueMentionList
              ref={listRef as React.Ref<IssueMentionListHandle>}
              items={items as IssueMentionItem[]}
              command={commitMention}
              emptyMessage={emptyFor("issue")}
            />
          )}
        </FloatingPortal>
      )}
    </>
  );
});
