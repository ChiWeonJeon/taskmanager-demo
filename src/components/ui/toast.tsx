"use client";

import { useEffect, useState } from "react";
import { useToastStore, ToastItem, ToastType } from "@/lib/toast";
import { useI18n } from "@/components/shared/locale-provider";
import { CheckSmallIcon, CloseIcon, ErrorIcon, InfoIcon, WarningIcon } from "@/components/task/task-icons";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<
  ToastType,
  { Icon: typeof InfoIcon; iconColor: string; borderColor: string }
> = {
  info: {
    Icon: InfoIcon,
    iconColor: "text-[var(--color-accent)]",
    borderColor: "border-l-[var(--color-accent)]",
  },
  success: {
    Icon: CheckSmallIcon,
    iconColor: "text-[var(--color-success)]",
    borderColor: "border-l-[var(--color-success)]",
  },
  warning: {
    Icon: WarningIcon,
    iconColor: "text-[var(--color-warning)]",
    borderColor: "border-l-[var(--color-warning)]",
  },
  error: {
    Icon: ErrorIcon,
    iconColor: "text-[var(--color-danger)]",
    borderColor: "border-l-[var(--color-danger)]",
  },
};

function ToastCard({ toast }: { toast: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  const { messages } = useI18n();
  const [visible, setVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const { Icon, iconColor, borderColor } = TYPE_CONFIG[toast.type];

  return (
    <div
      role="alert"
      aria-live={toast.sticky ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] border-l-4 bg-[var(--color-bg-primary)] px-4 py-3 shadow-[var(--shadow-md)]",
        "transition-all duration-300 ease-out",
        borderColor,
        visible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
      )}
      style={{ minWidth: 260, maxWidth: 380 }}
    >
      {/* Type icon */}
      <span className={cn("mt-0.5 shrink-0", iconColor)}>
        <Icon className="h-4 w-4" />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="mb-0.5 text-sm font-semibold text-[var(--color-text-primary)]">
            {toast.title}
          </p>
        )}
        <p className="text-sm text-[var(--color-text-secondary)]">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => { toast.action!.onClick(); remove(toast.id); }}
            className="mt-1.5 text-xs font-semibold text-[var(--color-accent)] hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close button — sticky: always visible / temporary: visible on hover */}
      <button
        onClick={() => remove(toast.id)}
        aria-label={messages.commonUi.toastCloseLabel}
        className={cn(
          "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
          toast.sticky ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const { messages } = useI18n();

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2"
      aria-label={messages.commonUi.toastListLabel}
    >
      {toasts.map((t) => (
        <div key={t.id} className="group">
          <ToastCard toast={t} />
        </div>
      ))}
    </div>
  );
}
