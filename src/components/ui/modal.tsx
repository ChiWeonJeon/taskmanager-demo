"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/shared/locale-provider";
import { CloseIcon } from "@/components/task/task-icons";
import { useDismissableLayer } from "@/components/ui/dismissable-layer";
import { cn } from "@/lib/utils";

type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  className?: string;
  bodyClassName?: string;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  bodyClassName,
}: ModalProps) {
  const { messages } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useDismissableLayer({ open, onDismiss: onClose });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panel)?.focus();
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
      .filter((node) => node.offsetParent !== null);
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
      role="presentation"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "my-auto w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-lg)] outline-none",
          SIZE_CLASS[size],
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[length:var(--text-base)] font-semibold text-[var(--color-text-primary)]">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={messages.commonUi.modalCloseLabel}
            title={messages.commonUi.modalCloseLabel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        {children && <div className={cn("px-4 py-4", bodyClassName)}>{children}</div>}
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
