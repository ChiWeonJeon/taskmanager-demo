"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { useI18n } from "@/components/shared/locale-provider";
import { cn } from "@/lib/utils";

interface TaskInlineDateEditorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  renderTrigger: (value: string | null, open: boolean) => React.ReactNode;
  className?: string;
  triggerClassName?: string;
  dropdownWidth?: string;
}

function openNativeDatePicker(event: React.MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
  input.showPicker?.();
}

export function TaskInlineDateEditor({
  value,
  onChange,
  renderTrigger,
  className,
  triggerClassName,
  dropdownWidth = "w-[240px]",
}: TaskInlineDateEditorProps) {
  const normalizedValue = value ?? "";
  const { messages } = useI18n();
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(normalizedValue);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      (inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null)?.showPicker?.();
    }, 10);

    return () => window.clearTimeout(timeoutId);
  }, [normalizedValue, open]);

  useEffect(() => {
    if (!open) return;

    function handleClose(event: MouseEvent) {
      if (triggerRef.current?.contains(event.target as Node)) return;
      if (dropdownRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClose);

    return () => document.removeEventListener("mousedown", handleClose);
  }, [open]);

  const applyChange = useCallback(() => {
    const nextValue = draftValue || null;
    if (nextValue !== value) {
      onChange(nextValue);
    }
    setOpen(false);
  }, [draftValue, onChange, value]);

  const clearValue = useCallback(() => {
    if (value !== null) {
      onChange(null);
    }
    setOpen(false);
  }, [onChange, value]);

  const openEditor = useCallback(() => {
    setDraftValue(normalizedValue);
    setOpen(true);
  }, [normalizedValue]);

  const dropdown = (
    <FloatingPortal
      open={open}
      anchorRef={triggerRef}
      floatingRef={dropdownRef}
      placement="bottom"
      align="start"
      offset={4}
      zIndex={130}
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 shadow-[var(--shadow-md)]",
        dropdownWidth
      )}
    >
            <div className="space-y-2">
              <Input
                ref={inputRef}
                type="date"
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                onClick={openNativeDatePicker}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyChange();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                  }
                }}
                className="h-8 text-[length:var(--text-xs)]"
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearValue}
                  disabled={!value}
                >
                  {messages.taskInlineDateEditor.clear}
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    {messages.taskInlineDateEditor.cancel}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={applyChange}
                    disabled={draftValue === normalizedValue}
                  >
                    {messages.taskInlineDateEditor.confirm}
                  </Button>
                </div>
              </div>
            </div>
    </FloatingPortal>
  );

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (open) {
            setOpen(false);
            return;
          }
          openEditor();
        }}
        className={cn(
          "inline-flex max-w-full items-center rounded-[var(--radius-sm)] border border-transparent transition-colors focus-visible:border-[var(--color-accent)] focus-visible:bg-[var(--color-accent)]/8 focus-visible:outline-none",
          triggerClassName
        )}
      >
        {renderTrigger(value, open)}
      </button>

      {dropdown}
    </div>
  );
}
