"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { cn } from "@/lib/utils";

interface InlineTextEditProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}

/**
 * Click-to-edit inline text field.
 * Shows plain text; on click switches to an <input>.
 * Saves on blur or Enter, cancels on Escape.
 */
export function InlineTextEdit({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
  allowEmpty = false,
}: InlineTextEditProps) {
  const { messages } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select the input when editing starts (DOM side-effect only)
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if ((allowEmpty || trimmed) && trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
          if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-bg-primary)] px-1.5 py-0.5 text-sm text-[var(--color-text-primary)] outline-none",
          inputClassName
        )}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setDraft(value);
          setEditing(true);
        }
      }}
      title={messages.commonUi.inlineEditHint}
      className={cn(
        "cursor-pointer rounded-[var(--radius-sm)] px-1 -mx-1 hover:bg-[var(--color-bg-hover)] transition-colors",
        className
      )}
    >
      {value || placeholder || "-"}
    </span>
  );
}
