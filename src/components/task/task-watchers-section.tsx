"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/shared/locale-provider";
import { CloseIcon, EyeIcon } from "@/components/task/task-icons";
import { FloatingPortal } from "@/components/ui/floating-portal";

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

interface Member {
  id: string;
  name: string;
  email: string;
}

interface Props {
  workItemId: string;
  projectKey: string | null;
  showHeader?: boolean;
}

export function TaskWatchersSection({ workItemId, projectKey, showHeader = true }: Props) {
  const { messages } = useI18n();
  const t = messages.notifications.watchers;
  const qc = useQueryClient();
  const { data: session } = useSession();
  const meId = session?.user?.id ?? null;

  const query = useQuery<WatchersResponse>({
    queryKey: ["work-item-watchers", workItemId],
    queryFn: async () => {
      const res = await fetch(`/api/work-items/${workItemId}/watchers`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const toggleSelf = useMutation({
    mutationFn: async (watching: boolean) => {
      if (watching) {
        await fetch(`/api/work-items/${workItemId}/watchers/me`, { method: "DELETE" });
      } else {
        await fetch(`/api/work-items/${workItemId}/watchers`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-item-watchers", workItemId] }),
  });

  const addOther = useMutation({
    mutationFn: async (userId: string) => {
      await fetch(`/api/work-items/${workItemId}/watchers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-item-watchers", workItemId] }),
  });

  const removeOther = useMutation({
    mutationFn: async (userId: string) => {
      await fetch(`/api/work-items/${workItemId}/watchers/${userId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-item-watchers", workItemId] }),
  });

  const watchers = query.data?.watchers ?? [];
  const isWatching = query.data?.isWatching ?? false;
  const sourceLabels = t.source as Record<string, string>;

  // Add-watcher member picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const pickerButtonRef = useRef<HTMLButtonElement | null>(null);
  const pickerPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (pickerPanelRef.current?.contains(target)) return;
      setPickerOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  const membersQuery = useQuery<{ members: Member[] }>({
    queryKey: ["project-members-lookup", projectKey, q],
    enabled: pickerOpen && Boolean(projectKey),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectKey}/members-lookup?q=${encodeURIComponent(q)}`);
      if (!res.ok) return { members: [] };
      return res.json();
    },
  });

  const watchedUserIds = new Set(watchers.map((w) => w.user.id));
  const candidates = (membersQuery.data?.members ?? []).filter((m) => !watchedUserIds.has(m.id));

  return (
    <section className="flex flex-col gap-2">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
            {t.title}{" "}
            <span className="text-[length:var(--text-2xs)] font-normal text-[var(--color-text-tertiary)]">
              ({watchers.length})
            </span>
          </h3>
          <button
            type="button"
            onClick={() => toggleSelf.mutate(isWatching)}
            disabled={toggleSelf.isPending}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 text-[length:var(--text-2xs)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
          >
            <EyeIcon className="h-4 w-4" />
            {isWatching ? t.unwatchButton : t.watchButton}
          </button>
        </div>
      )}
      {!showHeader && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => toggleSelf.mutate(isWatching)}
            disabled={toggleSelf.isPending}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 text-[length:var(--text-2xs)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
          >
            <EyeIcon className="h-4 w-4" />
            {isWatching ? t.unwatchButton : t.watchButton}
          </button>
        </div>
      )}

      {watchers.length === 0 ? (
        <div className="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]">{t.empty}</div>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {watchers.map((w) => {
            const canRemove =
              Boolean(projectKey) && (w.user.id === meId || w.addedBy?.id === meId);
            const sourceLabel = sourceLabels[w.source] ?? w.source;
            const addedByTooltip = w.addedBy && w.addedBy.id !== w.user.id
              ? t.addedByTooltip.replace("{name}", w.addedBy.name)
              : null;
            const tooltip = addedByTooltip
              ? `${sourceLabel} · ${addedByTooltip}`
              : sourceLabel;
            return (
              <li
                key={w.id}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-0.5 pl-2 pr-1 text-[length:var(--text-2xs)]"
                title={tooltip}
              >
                <span className="text-[var(--color-text-primary)]">
                  {w.user.id === meId ? t.you : w.user.name}
                </span>
                <span className="text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)]">
                  · {sourceLabels[w.source] ?? w.source}
                </span>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => removeOther.mutate(w.user.id)}
                    disabled={removeOther.isPending}
                    aria-label={t.remove}
                    className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-danger)]"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {projectKey && (
        <div ref={pickerRef} className="relative">
          <button
            ref={pickerButtonRef}
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-[var(--color-border)] px-2 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            + {t.addWatcher}
          </button>
          <FloatingPortal
            open={pickerOpen}
            anchorRef={pickerButtonRef}
            floatingRef={pickerPanelRef}
            placement="bottom"
            align="start"
            offset={4}
            preferredWidth={240}
            maxHeight={360}
            zIndex={140}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-md)]"
          >
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.addWatcherPlaceholder}
                className="w-full rounded-t-md border-b border-[var(--color-border)] bg-transparent px-2 py-1.5 text-[length:var(--text-xs)] outline-none placeholder:text-[var(--color-text-tertiary)]"
              />
              <ul className="max-h-[240px] overflow-y-auto py-1">
                {candidates.length === 0 && (
                  <li className="px-3 py-1.5 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]">
                    {t.addWatcherEmpty}
                  </li>
                )}
                {candidates.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addOther.mutate(m.id);
                        setPickerOpen(false);
                        setQ("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[length:var(--text-xs)] hover:bg-[var(--color-bg-hover)]"
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="text-[var(--color-text-secondary)]">
                        @{m.email.split("@")[0]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
          </FloatingPortal>
        </div>
      )}
    </section>
  );
}
