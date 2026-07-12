"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/shared/locale-provider";
import { DateDisplay } from "@/components/shared/date-display";
import { ChevronLeftIcon } from "@/components/task/task-icons";
import { StateBlock } from "@/components/ui/state-block";
import { cn } from "@/lib/utils";

interface Props {
  projectKey: string;
  checklistId: string;
  runId: string;
  currentUserId: string;
  canManage: boolean;
}

interface UserRef {
  id: string;
  name: string;
  email: string;
}

interface RunItem {
  id: string;
  content: string;
  sortOrder: number;
  groupName: string | null;
  groupSortOrder: number | null;
  checked: boolean;
  checkedAt: string | null;
  checkedBy: UserRef | null;
}

interface RunEvent {
  id: string;
  action: "START" | "CHECK" | "UNCHECK" | "COMPLETE" | "CANCEL" | "ITEM_EDIT";
  itemId: string | null;
  payload: string | null;
  createdAt: string;
  actor: UserRef;
}

interface RunDetail {
  id: string;
  checklistId: string;
  status: "RUNNING" | "COMPLETED" | "CANCELED";
  startedAt: string;
  completedAt: string | null;
  startedBy: UserRef;
  completedBy: UserRef | null;
  checklist: { id: string; title: string; description: string | null; projectId: string };
  items: RunItem[];
  events: RunEvent[];
}

const DEBOUNCE_MS = 1500;

interface RunBucket {
  groupKey: string;
  groupName: string | null;
  groupSortOrder: number;
  items: RunItem[];
}

// Bucket items by groupName/groupSortOrder. Ungrouped items live in a sentinel
// bucket pinned to the bottom (groupSortOrder = MAX_SAFE_INTEGER).
function bucketRunItems(items: RunItem[]): RunBucket[] {
  const map = new Map<string, RunBucket>();
  for (const it of items) {
    const key = it.groupName ?? "__ungrouped__";
    if (!map.has(key)) {
      map.set(key, {
        groupKey: key,
        groupName: it.groupName,
        groupSortOrder: it.groupSortOrder ?? Number.MAX_SAFE_INTEGER,
        items: [],
      });
    }
    map.get(key)!.items.push(it);
  }
  for (const b of map.values()) {
    b.items.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return Array.from(map.values()).sort((a, b) => a.groupSortOrder - b.groupSortOrder);
}

export function ChecklistRun({ projectKey, checklistId, runId, currentUserId, canManage }: Props) {
  const { messages } = useI18n();
  const t = messages.checklist.run;
  const qc = useQueryClient();

  const detail = useQuery<{ run: RunDetail }>({
    queryKey: ["run", projectKey, checklistId, runId],
    queryFn: async () => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/runs/${runId}`,
      );
      if (!res.ok) throw new Error(t.loadFailed);
      return res.json();
    },
    refetchInterval: 10_000,
  });

  // Local optimistic state for items so debounced toggles feel instant.
  const [localChecks, setLocalChecks] = useState<Record<string, boolean>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timersRef = debounceTimers;
    return () => {
      for (const t of Object.values(timersRef.current)) clearTimeout(t);
    };
  }, []);

  const toggleMutation = useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/runs/${runId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ checked }),
        },
      );
      if (!res.ok) throw new Error(t.toggleFailed);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["run", projectKey, checklistId, runId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/runs/${runId}/complete`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(t.completeFailed);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["run", projectKey, checklistId, runId] });
      qc.invalidateQueries({ queryKey: ["checklist", projectKey, checklistId] });
      qc.invalidateQueries({ queryKey: ["checklists", projectKey] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/runs/${runId}/cancel`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(t.cancelFailed);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["run", projectKey, checklistId, runId] });
      qc.invalidateQueries({ queryKey: ["checklist", projectKey, checklistId] });
      qc.invalidateQueries({ queryKey: ["checklists", projectKey] });
    },
  });

  const handleToggle = (item: RunItem) => {
    const current = localChecks[item.id] ?? item.checked;
    const next = !current;
    setLocalChecks((prev) => ({ ...prev, [item.id]: next }));

    const existing = debounceTimers.current[item.id];
    if (existing) clearTimeout(existing);

    debounceTimers.current[item.id] = setTimeout(() => {
      delete debounceTimers.current[item.id];
      toggleMutation.mutate({ itemId: item.id, checked: next });
    }, DEBOUNCE_MS);
  };

  const checkedCount = useMemo(() => {
    if (!detail.data) return 0;
    return detail.data.run.items.filter((it) => localChecks[it.id] ?? it.checked).length;
  }, [detail.data, localChecks]);

  // Build a quick lookup table to back the timeline display when an event's
  // payload is missing (older 0.29.0 events had no itemContent payload).
  const itemContentById = useMemo(() => {
    const out = new Map<string, string>();
    if (detail.data) {
      for (const it of detail.data.run.items) out.set(it.id, it.content);
    }
    return out;
  }, [detail.data]);

  const buckets = useMemo(
    () => (detail.data ? bucketRunItems(detail.data.run.items) : []),
    [detail.data],
  );

  if (detail.isLoading) {
    return (
      <StateBlock variant="loading" title={messages.notifications.inbox.loading} className="m-6" />
    );
  }
  if (detail.isError || !detail.data) {
    return <StateBlock variant="error" title={t.loadFailed} className="m-6" />;
  }

  const r = detail.data.run;
  const isReadOnly = r.status !== "RUNNING";
  const total = r.items.length;
  const canCancel = canManage || r.startedBy.id === currentUserId;
  const canComplete = canManage || r.startedBy.id === currentUserId;

  return (
    <div className="space-y-2">
      <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] p-3">
        <Link
          href={`/projects/${projectKey}/checklists/${checklistId}`}
          className="inline-flex items-center gap-1 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          {t.backToMaster}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[length:var(--text-xl)] font-semibold text-[var(--color-text-primary)]">
              {t.headerTitle.replace("{title}", r.checklist.title)}
            </h1>
            <div className="mt-1 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
              {r.status === "COMPLETED" && r.completedBy ? (
                <RenderTimeUserText template={t.completedAt} actor={r.completedBy.name} when={r.completedAt!} />
              ) : r.status === "CANCELED" && r.completedBy ? (
                <RenderTimeUserText template={t.canceledAt} actor={r.completedBy.name} when={r.completedAt!} />
              ) : (
                <RenderTimeUserText template={t.startedAt} actor={r.startedBy.name} when={r.startedAt} />
              )}
            </div>
            <div className="mt-2 text-[length:var(--text-xs)] font-medium text-[var(--color-text-primary)]">
              {t.progressLabel.replace("{checked}", String(checkedCount)).replace("{total}", String(total))}
            </div>
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              {canComplete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t.completeConfirm)) completeMutation.mutate();
                  }}
                  disabled={completeMutation.isPending}
                  className="rounded-[var(--radius-md)] bg-[var(--color-success)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-white hover:opacity-90"
                >
                  {completeMutation.isPending ? t.completing : t.completeButton}
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t.cancelConfirm)) cancelMutation.mutate();
                  }}
                  disabled={cancelMutation.isPending}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)]"
                >
                  {cancelMutation.isPending ? t.canceling : t.cancelButton}
                </button>
              )}
            </div>
          )}
        </div>
        {isReadOnly && (
          <div className="mt-2 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">{t.readOnlyHint}</div>
        )}
      </div>

      {/*
        items column gets `self-start` so the activity column is free to grow
        without dragging the items panel taller. min-height 0 lets nested
        overflow play nicely with the grid.
      */}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] p-3 lg:self-start">
          {buckets.length === 0 ? (
            <p className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{t.itemsEmpty}</p>
          ) : (
            <div className="space-y-3">
              {buckets.map((bucket) => (
                <div key={bucket.groupKey} className="space-y-1">
                  <div className="text-[length:var(--text-2xs)] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    {bucket.groupName ?? t.ungroupedLabel}
                  </div>
                  <ul>
                    {bucket.items.map((item) => {
                      const effectiveChecked = localChecks[item.id] ?? item.checked;
                      return (
                        <li key={item.id} className="flex items-start gap-3 py-2">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={effectiveChecked}
                            aria-label={t.checkAria}
                            onClick={() => !isReadOnly && handleToggle(item)}
                            disabled={isReadOnly}
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-md)] border transition-colors",
                              effectiveChecked
                                ? "border-[var(--color-success)] bg-[var(--color-success)] text-white"
                                : "border-[var(--color-border)] hover:border-[var(--color-accent)]",
                            )}
                          >
                            {effectiveChecked && (
                              <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
                                <path d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z" />
                              </svg>
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "text-[length:var(--text-sm)]",
                                effectiveChecked && "text-[var(--color-text-tertiary)] line-through",
                              )}
                            >
                              {item.content}
                            </div>
                            {item.checked && item.checkedBy && item.checkedAt && (
                              <div className="mt-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                                {t.checkedBy
                                  .replace("{actor}", item.checkedBy.name)
                                  .replace("{when}", "")}
                                <DateDisplay date={item.checkedAt} format="short" />
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <RunTimeline events={r.events} itemContentById={itemContentById} />
      </div>
    </div>
  );
}

function RenderTimeUserText({ template, actor, when }: { template: string; actor: string; when: string }) {
  const parts = template.split("{when}");
  const front = parts[0]?.replace("{actor}", actor) ?? "";
  const back = parts[1] ?? "";
  return (
    <>
      {front}
      <DateDisplay date={when} format="short" />
      {back}
    </>
  );
}

function RunTimeline({
  events,
  itemContentById,
}: {
  events: RunEvent[];
  itemContentById: Map<string, string>;
}) {
  const { messages } = useI18n();
  const t = messages.checklist.run;

  const grouped = useMemo(() => {
    const out = new Map<string, RunEvent[]>();
    for (const e of events) {
      const d = new Date(e.createdAt);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = out.get(ymd) ?? [];
      arr.push(e);
      out.set(ymd, arr);
    }
    return Array.from(out.entries());
  }, [events]);

  return (
    <aside className="rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] p-3 lg:max-h-[calc(100vh-160px)] lg:self-start lg:overflow-auto">
      <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">{t.timelineHeading}</h2>
      {events.length === 0 ? (
        <p className="mt-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{t.timelineEmpty}</p>
      ) : (
        <div className="mt-3 space-y-4">
          {grouped.map(([ymd, list]) => (
            <div key={ymd}>
              <div className="sticky top-0 z-10 -mx-3 mb-1 bg-[var(--color-bg-primary)] px-3 py-1 text-[length:var(--text-3xs)] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                {ymd}
              </div>
              <ol className="relative ml-2 space-y-2 border-l border-[var(--color-border)] pl-3">
                {list.map((e) => (
                  <TimelineItem key={e.id} event={e} itemContentById={itemContentById} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

const ACTION_COLOR: Record<RunEvent["action"], string> = {
  START: "bg-[var(--color-accent)]",
  CHECK: "bg-[var(--color-success)]",
  UNCHECK: "bg-[var(--color-text-tertiary)]",
  COMPLETE: "bg-[var(--color-success)]",
  CANCEL: "bg-[var(--color-danger)]",
  ITEM_EDIT: "bg-[var(--color-warning)]",
};

function TimelineItem({
  event,
  itemContentById,
}: {
  event: RunEvent;
  itemContentById: Map<string, string>;
}) {
  const { messages } = useI18n();
  const t = messages.checklist.run;
  const actions = t.timelineActions;

  // Resolve the item label with two fallbacks so older 0.29.0 events that
  // didn't write a payload still render with the actual item text:
  //   1. payload.itemContent (current behaviour)
  //   2. cross-reference run items via event.itemId
  let itemContent = "";
  if (event.payload) {
    try {
      const parsed = JSON.parse(event.payload);
      if (typeof parsed?.itemContent === "string") itemContent = parsed.itemContent;
    } catch {
      // ignore
    }
  }
  if (!itemContent && event.itemId) {
    itemContent = itemContentById.get(event.itemId) ?? "";
  }

  const tmpl = actions[event.action] ?? "";
  // The template carries its own quoting/brackets per locale (e.g. `"{item}"`
  // in English, `「{item}」` in Japanese). Substitute the raw content; the
  // fallback `unknownItem` keeps the wrapper from collapsing to `""` when
  // the source item was deleted before we started snapshotting payloads.
  const display = itemContent || (t.unknownItem ?? "");
  const text = tmpl.replace("{item}", display);

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[15px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--color-bg-primary)]",
          ACTION_COLOR[event.action],
        )}
      />
      <div className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
        <span className="font-medium">{event.actor.name}</span>{" "}
        <span className="text-[var(--color-text-secondary)]">{text}</span>
      </div>
      <div className="text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)]">
        <DateDisplay date={event.createdAt} format="short" />
      </div>
    </li>
  );
}
