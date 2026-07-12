"use client";

import { cn } from "@/lib/utils";

interface SubtaskDisclosureProps {
  collapsed?: boolean;
  done: number;
  total: number;
  compact?: boolean;
  expandLabel: string;
  collapseLabel: string;
  onToggle?: () => void;
}

export function SubtaskDisclosure({
  collapsed = false,
  done,
  total,
  compact = false,
  expandLabel,
  collapseLabel,
  onToggle,
}: SubtaskDisclosureProps) {
  if (total <= 0) return null;

  const progress = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  const complete = done >= total;

  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={collapsed ? expandLabel : collapseLabel}
      data-subtask-disclosure="true"
      data-subtask-collapsed={collapsed ? "true" : "false"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle?.();
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border text-[length:var(--text-2xs)] font-semibold leading-none transition-colors",
        "border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
        collapsed && "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]",
        compact ? "h-5 w-12 justify-center gap-0.5 px-1" : "h-6 px-2"
      )}
    >
      <svg
        aria-hidden="true"
        className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "transition-transform duration-200", !collapsed && "rotate-90")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
      {!compact && (
        <svg
          aria-hidden="true"
          className="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 5v8a3 3 0 0 0 3 3h11" />
          <path d="m14 11 5 5-5 5" />
        </svg>
      )}
      <span className={cn("tabular-nums", compact && "min-w-5 text-center")}>{done}/{total}</span>
      {!compact && (
        <span className="h-1 w-8 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
          <span
            className={cn("block h-full rounded-full", complete ? "bg-[var(--color-success)]" : "bg-[var(--color-accent)]")}
            style={{ width: `${progress}%` }}
          />
        </span>
      )}
    </button>
  );
}
