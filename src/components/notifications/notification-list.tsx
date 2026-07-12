"use client";

import Link from "next/link";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/shared/locale-provider";
import { DateDisplay } from "@/components/shared/date-display";
import { renderNotification, type NotificationRecord } from "@/lib/notifications/render";

interface Props {
  variant?: "dropdown" | "page";
  initialFilter?: "all" | "unread";
  pageSize?: number;
  onItemClick?: () => void;
}

interface NotificationsPage {
  notifications: NotificationRecord[];
  nextCursor: string | null;
}

export function NotificationList({
  variant = "page",
  initialFilter = "all",
  pageSize = 20,
  onItemClick,
}: Props) {
  const { messages } = useI18n();
  const t = messages.notifications;
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<"all" | "unread">(initialFilter);

  const query = useInfiniteQuery<NotificationsPage>({
    queryKey: ["notifications", filter],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filter === "unread") params.set("unreadOnly", "1");
      params.set("limit", String(pageSize));
      if (pageParam) params.set("cursor", pageParam as string);
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error(t.inbox.loadFailed);
      return res.json();
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: variant === "dropdown" ? 30_000 : false,
    refetchOnWindowFocus: true,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.notifications) ?? [],
    [query.data]
  );

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await fetch(`/api/notifications/mark-all-read`, { method: "POST" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2 text-[length:var(--text-xs)]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded px-2 py-1 ${filter === "all" ? "bg-[var(--color-bg-hover)] font-medium" : "text-[var(--color-text-secondary)]"}`}
          >
            {t.inbox.filterAll}
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded px-2 py-1 ${filter === "unread" ? "bg-[var(--color-bg-hover)] font-medium" : "text-[var(--color-text-secondary)]"}`}
          >
            {t.inbox.filterUnread}
          </button>
        </div>
        <button
          type="button"
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending}
          className="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
        >
          {t.inbox.markAllRead}
        </button>
      </div>

      <ul className="flex flex-col">
        {query.isLoading && items.length === 0 && (
          <li className="px-3 py-6 text-center text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
            {t.inbox.loading}
          </li>
        )}
        {!query.isLoading && items.length === 0 && (
          <li className="px-3 py-6 text-center text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
            {t.inbox.empty}
          </li>
        )}
        {items.map((n) => {
          const rendered = renderNotification(n, messages);
          const isRead = (n as unknown as { isRead?: boolean }).isRead ?? false;
          const createdAt = (n as unknown as { createdAt?: string }).createdAt;
          const itemInner = (
            <div className="flex items-start gap-2 px-3 py-2 text-[length:var(--text-xs)] leading-5 hover:bg-[var(--color-bg-hover)]">
              <span
                aria-hidden
                className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  isRead ? "bg-transparent" : "bg-[var(--color-accent)]"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className={`break-words ${isRead ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-primary)]"}`}>
                  {rendered.text}
                </div>
                <div className="mt-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)]">
                  {createdAt ? <DateDisplay date={createdAt} format="compact" /> : null}
                </div>
              </div>
            </div>
          );

          const onClick = () => {
            if (!isRead) markRead.mutate(n.id);
            onItemClick?.();
          };

          const canOpenInPlace =
            n.scope === "work_item" && !rendered.isOrphan && n.workItem?.id;

          const handleInPlaceClick = (event: React.MouseEvent) => {
            if (!canOpenInPlace) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            const params = new URLSearchParams(searchParams?.toString() ?? "");
            params.set("task", n.workItem!.id);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            onClick();
          };

          return (
            <li key={n.id}>
              {rendered.href && !rendered.isOrphan ? (
                <Link
                  href={rendered.href}
                  onClick={canOpenInPlace ? handleInPlaceClick : onClick}
                  className="block"
                >
                  {itemInner}
                </Link>
              ) : (
                <button type="button" onClick={onClick} className="block w-full text-left">
                  {itemInner}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {query.hasNextPage && (
        <div className="border-t border-[var(--color-border)] px-3 py-2 text-center">
          <button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            {t.inbox.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
