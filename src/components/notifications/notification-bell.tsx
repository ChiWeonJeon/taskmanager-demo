"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { BellIcon } from "@/components/task/task-icons";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { NotificationList } from "./notification-list";

interface NotificationBellProps {
  compact?: boolean;
}

// Rendered with `next/dynamic({ ssr: false })` from the sidebar, so this
// component only runs on the client. `document.body` is always available.
export function NotificationBell({ compact = false }: NotificationBellProps = {}) {
  const { messages } = useI18n();
  const t = messages.notifications;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const countQuery = useQuery<{ count: number }>({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count");
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const count = countQuery.data?.count ?? 0;
  const badge = count > 99 ? "99+" : count > 0 ? String(count) : null;

  const popover = (
    <FloatingPortal
      open={open}
      anchorRef={buttonRef}
      floatingRef={popoverRef}
      placement="top"
      align="start"
      offset={8}
      preferredWidth={360}
      maxHeight={520}
      zIndex={130}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-md)]"
    >
          <NotificationList variant="dropdown" pageSize={20} onItemClick={() => setOpen(false)} />
          <div className="border-t border-[var(--color-border)] px-3 py-2 text-right">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {t.inbox.seeAll}
            </Link>
          </div>
    </FloatingPortal>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.bell.label}
        title={t.bell.title}
        className={
          compact
            ? "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            : "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
        }
      >
        <BellIcon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[length:var(--text-3xs)] font-semibold text-white">
            {badge}
          </span>
        )}
      </button>
      {popover}
    </div>
  );
}
