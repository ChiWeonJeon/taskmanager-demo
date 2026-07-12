"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { EyeIcon } from "@/components/task/task-icons";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { TaskWatchersSection } from "@/components/task/task-watchers-section";

interface WatcherUser {
  id: string;
  name: string;
  email: string;
}
interface WatcherItem {
  id: string;
  user: WatcherUser;
  source: string;
  addedBy: WatcherUser | null;
  createdAt: string;
}
interface WatchersResponse {
  watchers: WatcherItem[];
  isWatching: boolean;
}

interface Props {
  workItemId: string;
  projectKey: string | null;
}

export function TaskWatchersButton({ workItemId, projectKey }: Props) {
  const { messages } = useI18n();
  const t = messages.notifications.watchers;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

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

  // Lightweight count query — same cache key as TaskWatchersSection,
  // so opening the popover doesn't refetch.
  const query = useQuery<WatchersResponse>({
    queryKey: ["work-item-watchers", workItemId],
    queryFn: async () => {
      const res = await fetch(`/api/work-items/${workItemId}/watchers`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const count = query.data?.watchers.length ?? 0;
  const isWatching = query.data?.isWatching ?? false;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t.title}
        aria-label={t.title}
        className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-[length:var(--text-xs)] font-medium transition-colors ${
          isWatching
            ? "text-[var(--color-accent)] hover:bg-[var(--color-accent-light)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
        }`}
      >
        <EyeIcon className="h-4 w-4" />
        <span className="hidden md:inline">{t.title}</span>
        <span className="tabular-nums text-[length:var(--text-2xs)]">{count}</span>
      </button>
      <FloatingPortal
        open={open}
        anchorRef={buttonRef}
        floatingRef={popoverRef}
        placement="bottom"
        align="end"
        offset={4}
        preferredWidth={300}
        maxHeight={520}
        zIndex={130}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 shadow-[var(--shadow-md)]"
      >
          <TaskWatchersSection
            workItemId={workItemId}
            projectKey={projectKey}
            showHeader={false}
          />
      </FloatingPortal>
    </div>
  );
}
