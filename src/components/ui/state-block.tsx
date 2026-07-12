import { type ReactNode } from "react";
import { EmptyInboxIcon, ErrorIcon, InfoIcon } from "@/components/task/task-icons";
import { cn } from "@/lib/utils";

type StateBlockVariant = "loading" | "empty" | "error";

interface StateBlockProps {
  variant: StateBlockVariant;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function StateBlock({ variant, title, description, action, className }: StateBlockProps) {
  const isError = variant === "error";

  return (
    <div
      role={isError ? "alert" : undefined}
      aria-busy={variant === "loading" ? true : undefined}
      className={cn(
        "rounded-[var(--radius-md)] px-3 py-6 text-center text-[length:var(--text-xs)]",
        variant === "loading" && "border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
        variant === "empty" && "border border-dashed border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]",
        isError && "border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[var(--color-danger-light)] text-[var(--color-danger)]",
        className,
      )}
    >
      {variant === "loading" ? (
        <div className="mx-auto flex max-w-36 flex-col items-center gap-2">
          <span className="h-2 w-28 animate-pulse rounded-[var(--radius-full)] bg-[var(--color-bg-tertiary)]" />
          <span className="h-2 w-20 animate-pulse rounded-[var(--radius-full)] bg-[var(--color-bg-tertiary)]" />
        </div>
      ) : (
        <span className="mx-auto mb-2 inline-flex h-8 w-8 items-center justify-center text-[var(--color-text-tertiary)]">
          {isError ? <ErrorIcon className="h-6 w-6 text-[var(--color-danger)]" /> : <EmptyInboxIcon className="h-6 w-6" />}
        </span>
      )}
      <div className={cn("font-medium", isError ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]")}>
        {title}
      </div>
      {description && (
        <div className="mt-1 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
          {description}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
      {variant === "loading" && (
        <InfoIcon className="sr-only" aria-label={typeof title === "string" ? title : undefined} />
      )}
    </div>
  );
}
