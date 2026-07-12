"use client";

import { useEffect } from "react";
import { CloseIcon } from "@/components/task/task-icons";
import { taskToolSidePanelClass } from "@/components/task/bulk-edit-side-panel";
import { useI18n } from "@/components/shared/locale-provider";
import type { TaskGroupOption } from "@/components/task/task-group-model";
import { cn } from "@/lib/utils";

interface TaskGroupPanelProps {
  options: TaskGroupOption[];
  groupBy: string | null;
  onGroupChange: (groupBy: string | null) => void;
  onClose: () => void;
}

export function TaskGroupPanel({
  options,
  groupBy,
  onGroupChange,
  onClose,
}: TaskGroupPanelProps) {
  const { messages } = useI18n();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <aside className={taskToolSidePanelClass} aria-label={messages.taskWorkspace.group}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">
        <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
          {messages.taskWorkspace.group}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          aria-label={messages.common.close}
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
        <button
          type="button"
          className={cn(
            "flex min-h-9 w-full items-center rounded-[var(--radius-sm)] px-2 text-left text-[length:var(--text-xs)] transition-colors hover:bg-[var(--color-bg-hover)]",
            groupBy === null
              ? "font-medium text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)]",
          )}
          onClick={() => onGroupChange(null)}
          aria-pressed={groupBy === null}
        >
          {messages.taskWorkspace.groupPanel.none}
        </button>

        {options.length === 0 ? (
          <p className="px-2 py-2 text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">
            {messages.taskWorkspace.groupPanel.empty}
          </p>
        ) : (
          options.map((option) => {
            const active = groupBy === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "flex min-h-9 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 text-left text-[length:var(--text-xs)] transition-colors hover:bg-[var(--color-bg-hover)]",
                  active
                    ? "font-medium text-[var(--color-accent)]"
                    : "text-[var(--color-text-primary)]",
                )}
                onClick={() => onGroupChange(active ? null : option.id)}
                aria-pressed={active}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {option.kind === "custom" && (
                  <span className="shrink-0 rounded-full bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[length:var(--text-3xs)] uppercase text-[var(--color-text-tertiary)]">
                    {messages.taskWorkspace.groupPanel.customBadge}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
