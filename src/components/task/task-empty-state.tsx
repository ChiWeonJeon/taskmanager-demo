"use client";

import type { ReactNode } from "react";
import { EmptyInboxIcon } from "@/components/task/task-icons";
import { cn } from "@/lib/utils";

interface TaskEmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}

export function TaskEmptyState({ title, description, icon, className }: TaskEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-5 py-12 text-center",
        className
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-bg-primary)] text-[var(--color-text-tertiary)] shadow-sm">
        {icon ?? <EmptyInboxIcon className="h-5 w-5" />}
      </span>
      <p className="mt-3 text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-[var(--color-text-secondary)]">{description}</p>}
    </div>
  );
}
