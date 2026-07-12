"use client";

import {
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useDismissableLayer } from "@/components/ui/dismissable-layer";

interface DetailPanelShellProps {
  open: boolean;
  ariaLabel: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  color?: string | null;
  actions?: ReactNode;
  beforeInfo?: ReactNode;
  infoCards?: ReactNode;
  main: ReactNode;
  side: ReactNode;
  onClose: () => void;
  contentRef?: MutableRefObject<HTMLDivElement | null>;
}

interface DetailFieldRowProps {
  label: string;
  children: ReactNode;
  required?: boolean;
  align?: "center" | "start";
}

interface SectionCardProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

interface InfoCardProps {
  label: string;
  primary: ReactNode;
  secondary?: ReactNode;
}

export function DetailFieldRow({
  label,
  children,
  required = false,
  align = "center",
}: DetailFieldRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[88px_minmax(0,1fr)] gap-2 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-2 py-1.5",
        align === "start" ? "items-start" : "items-center"
      )}
    >
      <div
        className={cn(
          "flex min-h-7 items-center border-r border-[var(--color-border)] pr-2 text-[length:var(--text-2xs)] font-medium text-[var(--color-text-secondary)]",
          align === "start" && "pt-1"
        )}
      >
        <span>{label}</span>
        {required && <span className="ml-1 text-[var(--color-danger)]">*</span>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SectionCard({ title, children, action, className }: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 shadow-[var(--shadow-xs)]",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function InfoCard({ label, primary, secondary }: InfoCardProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-2 shadow-[var(--shadow-xs)]">
      <p className="text-[length:var(--text-3xs)] font-medium text-[var(--color-text-secondary)]">{label}</p>
      <div className="mt-1.5 min-w-0">
        <p className="truncate text-[length:var(--text-xs)] font-medium text-[var(--color-text-primary)]">{primary}</p>
        {secondary && (
          <div className="mt-0.5 truncate text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">{secondary}</div>
        )}
      </div>
    </div>
  );
}

export function DetailPanelShell({
  open,
  ariaLabel,
  eyebrow,
  title,
  color,
  actions,
  beforeInfo,
  infoCards,
  main,
  side,
  onClose,
  contentRef,
}: DetailPanelShellProps) {
  useDismissableLayer({ open, onDismiss: onClose });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[55] bg-black/20" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed inset-y-0 right-0 z-[60] flex h-full w-full max-w-[1120px] flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-md)]"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/95 backdrop-blur">
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-1">
              {eyebrow && (
                <div className="flex min-w-0 items-center gap-2 text-[length:var(--text-3xs)] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                  {color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
                  <span className="truncate">{eyebrow}</span>
                </div>
              )}
              {title}
            </div>
            {actions && <div className="flex items-center gap-1 pt-0.5">{actions}</div>}
          </div>
        </div>

        <div ref={contentRef} className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-6">
          <div className="space-y-4">
            {beforeInfo}
            {infoCards && <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{infoCards}</div>}
            <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
              <div className="min-w-0 space-y-4 order-2 xl:order-none">{main}</div>
              <div className="min-w-0 space-y-4 order-1 xl:order-none xl:sticky xl:top-4 xl:self-start">
                {side}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
