"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/shared/locale-provider";
import { DateDisplay } from "@/components/shared/date-display";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeftIcon, DragHandleIcon } from "@/components/task/task-icons";
import { StateBlock } from "@/components/ui/state-block";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
  projectKey: string;
  checklistId: string;
  canEdit: boolean;
  canDelete: boolean;
  canStart: boolean;
}

interface UserRef {
  id: string;
  name: string;
  email: string;
}

interface ItemRow {
  id: string;
  content: string;
  sortOrder: number;
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GroupRow {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface RunSummary {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  startedBy: UserRef;
  completedBy: UserRef | null;
  checkedCount: number;
  totalCount: number;
}

interface ChecklistDetail {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserRef;
  items: ItemRow[];
  groups: GroupRow[];
  runs: Array<{
    id: string;
    status: string;
    startedAt: string;
    startedBy: UserRef;
  }>;
}

type TabKey = "items" | "history";

export function ChecklistDetail({ projectKey, checklistId, canEdit, canDelete, canStart }: Props) {
  const { messages } = useI18n();
  const t = messages.checklist.detail;
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("items");

  const detail = useQuery<{ checklist: ChecklistDetail }>({
    queryKey: ["checklist", projectKey, checklistId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectKey}/checklists/${checklistId}`);
      if (!res.ok) throw new Error(t.loadFailed);
      return res.json();
    },
  });

  const runningRun = detail.data?.checklist.runs[0];

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/runs`,
        { method: "POST" },
      );
      if (res.status === 409) {
        const body = await res.json();
        throw new Error(t.conflictRunning.replace("{name}", body?.startedBy?.name ?? ""));
      }
      if (!res.ok) throw new Error(t.startFailed);
      return res.json() as Promise<{ runId: string }>;
    },
    onSuccess: (data) => {
      toast(t.startSuccess, { type: "success" });
      router.push(`/projects/${projectKey}/checklists/${checklistId}/runs/${data.runId}`);
    },
    onError: (error) => {
      toast(errorMessage(error, t.startFailed), { type: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(t.deleteFailed);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists", projectKey] });
      toast(t.deleteSuccess, { type: "success" });
      router.push(`/projects/${projectKey}/checklists`);
    },
    onError: (error) => {
      toast(errorMessage(error, t.deleteFailed), { type: "error" });
    },
  });

  if (detail.isLoading) {
    return (
      <StateBlock variant="loading" title={messages.notifications.inbox.loading} className="m-6" />
    );
  }
  if (detail.isError || !detail.data) {
    return <StateBlock variant="error" title={t.loadFailed} className="m-6" />;
  }

  const c = detail.data.checklist;

  return (
    <div className="space-y-2">
      <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] p-3">
        <Link
          href={`/projects/${projectKey}/checklists`}
          className="inline-flex items-center gap-1 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          {t.backToHub}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[length:var(--text-xl)] font-semibold text-[var(--color-text-primary)]">{c.title}</h1>
            {c.description && (
              <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{c.description}</p>
            )}
            <div className="mt-2 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
              {c.createdBy.name} · <DateDisplay date={c.createdAt} format="compact" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {runningRun ? (
              <Link
                href={`/projects/${projectKey}/checklists/${checklistId}/runs/${runningRun.id}`}
                className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-white hover:opacity-90"
              >
                {t.openRun}
              </Link>
            ) : (
              canStart && (
                <button
                  type="button"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending || c.items.length === 0}
                  className={cn(
                    "rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-white hover:opacity-90",
                    (startMutation.isPending || c.items.length === 0) && "opacity-50",
                  )}
                >
                  {startMutation.isPending ? t.starting : t.startButton}
                </button>
              )
            )}
            {canDelete && !runningRun && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(t.deleteConfirm.replace("{title}", c.title))) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)]"
              >
                {t.deleteButton}
              </button>
            )}
          </div>
        </div>
        {startMutation.isError && (
          <div className="mt-2 text-[length:var(--text-xs)] text-[var(--color-danger)]">
            {(startMutation.error as Error).message}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
        <TabButton active={tab === "items"} onClick={() => setTab("items")}>
          {t.tabItems}
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          {t.tabHistory}
        </TabButton>
      </div>

      {tab === "items" && (
        <ItemsTab
          projectKey={projectKey}
          checklistId={checklistId}
          items={c.items}
          groups={c.groups}
          canEdit={canEdit && !runningRun}
          locked={Boolean(runningRun)}
        />
      )}

      {tab === "history" && (
        <HistoryTab projectKey={projectKey} checklistId={checklistId} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 px-3 py-2 text-[length:var(--text-sm)] font-medium transition-colors",
        active
          ? "border-[var(--color-accent)] text-[var(--color-accent)]"
          : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
      )}
    >
      {children}
    </button>
  );
}

interface ItemsTabProps {
  projectKey: string;
  checklistId: string;
  items: ItemRow[];
  groups: GroupRow[];
  canEdit: boolean;
  locked: boolean;
}

interface BucketRow {
  groupId: string | null;
  groupName: string | null;
  groupSortOrder: number;
  items: ItemRow[];
}

function buildBuckets(items: ItemRow[], groups: GroupRow[]): BucketRow[] {
  const root: BucketRow = {
    groupId: null,
    groupName: null,
    groupSortOrder: Number.MAX_SAFE_INTEGER,
    items: [],
  };
  const buckets = new Map<string, BucketRow>();
  for (const g of groups) {
    buckets.set(g.id, {
      groupId: g.id,
      groupName: g.name,
      groupSortOrder: g.sortOrder,
      items: [],
    });
  }
  for (const it of items) {
    const target = it.groupId ? buckets.get(it.groupId) : null;
    (target ?? root).items.push(it);
  }
  for (const b of buckets.values()) b.items.sort((a, b) => a.sortOrder - b.sortOrder);
  root.items.sort((a, b) => a.sortOrder - b.sortOrder);
  // Re-sort buckets to match latest group order, ungrouped pinned at the end.
  const sortedGroups = Array.from(buckets.values()).sort((a, b) => a.groupSortOrder - b.groupSortOrder);
  return [...sortedGroups, root];
}

interface DropTarget {
  bucketId: string | "root";
  itemId: string | null;
  position: "before" | "after" | "inside";
}

interface GroupDropTarget {
  groupId: string;
  position: "before" | "after";
}

function ItemsTab({ projectKey, checklistId, items, groups, canEdit, locked }: ItemsTabProps) {
  const { messages } = useI18n();
  const t = messages.checklist.detail;
  const qc = useQueryClient();
  const { toast } = useToast();
  const buckets = useMemo(() => buildBuckets(items, groups), [items, groups]);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [groupDropTarget, setGroupDropTarget] = useState<GroupDropTarget | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["checklist", projectKey, checklistId] });

  const itemCreate = useMutation({
    mutationFn: async (input: { content: string; groupId: string | null }) => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: input.content, groupId: input.groupId }),
        },
      );
      if (!res.ok) throw new Error(t.itemCreateFailed);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast(t.itemCreateSuccess, { type: "success" });
    },
    onError: (error) => {
      toast(errorMessage(error, t.itemCreateFailed), { type: "error" });
    },
  });

  const itemPatch = useMutation({
    mutationFn: async (input: { id: string; content?: string; groupId?: string | null; sortOrder?: number }) => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/items/${input.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            content: input.content,
            groupId: input.groupId,
            sortOrder: input.sortOrder,
          }),
        },
      );
      if (!res.ok) throw new Error(t.itemUpdateFailed);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast(t.itemUpdateSuccess, { type: "success" });
    },
    onError: (error) => {
      toast(errorMessage(error, t.itemUpdateFailed), { type: "error" });
    },
  });

  const itemDelete = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/items/${itemId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(t.itemDeleteFailed);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast(t.itemDeleteSuccess, { type: "success" });
    },
    onError: (error) => {
      toast(errorMessage(error, t.itemDeleteFailed), { type: "error" });
    },
  });

  const itemsBulkOrder = useMutation({
    mutationFn: async (
      payload: Array<{ id: string; groupId: string | null; sortOrder: number }>,
    ) => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/items/order`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: payload }),
        },
      );
      if (!res.ok) throw new Error(t.itemsReorderFailed);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast(t.itemsReorderSuccess, { type: "success" });
    },
    onError: (error) => {
      toast(errorMessage(error, t.itemsReorderFailed), { type: "error" });
    },
  });

  const groupCreate = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/groups`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      if (!res.ok) throw new Error(t.groupCreateFailed);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast(t.groupCreateSuccess, { type: "success" });
    },
    onError: (error) => {
      toast(errorMessage(error, t.groupCreateFailed), { type: "error" });
    },
  });

  const groupRename = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/groups/${input.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: input.name }),
        },
      );
      if (!res.ok) throw new Error(t.groupRenameFailed);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast(t.groupRenameSuccess, { type: "success" });
    },
    onError: (error) => {
      toast(errorMessage(error, t.groupRenameFailed), { type: "error" });
    },
  });

  const groupDelete = useMutation({
    mutationFn: async (groupId: string) => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/groups/${groupId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(t.groupDeleteFailed);
      return res.json();
    },
    onSuccess: (_data, groupId) => {
      setCollapsedGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
      invalidate();
      toast(t.groupDeleteSuccess, { type: "success" });
    },
    onError: (error) => {
      toast(errorMessage(error, t.groupDeleteFailed), { type: "error" });
    },
  });

  const groupsBulkOrder = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/groups/order`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids }),
        },
      );
      if (!res.ok) throw new Error(t.groupReorderFailed);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast(t.groupReorderSuccess, { type: "success" });
    },
    onError: (error) => {
      toast(errorMessage(error, t.groupReorderFailed), { type: "error" });
    },
  });

  // ---- DnD logic --------------------------------------------------------
  // Compute the target index inside a bucket for a "before"/"after" drop on a
  // sibling. The dragged item is excluded so the math doesn't shift by one
  // when reordering within the same bucket.
  function computeDropMutations(
    target: DropTarget,
    draggedId: string,
  ): Array<{ id: string; groupId: string | null; sortOrder: number }> | null {
    const flatItems = items;
    const dragged = flatItems.find((it) => it.id === draggedId);
    if (!dragged) return null;

    const targetGroupId = target.bucketId === "root" ? null : target.bucketId;
    const siblings = flatItems
      .filter((it) => (it.groupId ?? null) === targetGroupId && it.id !== draggedId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    let insertAt = siblings.length;
    if (target.itemId && target.position !== "inside") {
      const anchorIdx = siblings.findIndex((it) => it.id === target.itemId);
      insertAt =
        anchorIdx < 0
          ? siblings.length
          : target.position === "before"
            ? anchorIdx
            : anchorIdx + 1;
    } else if (target.position === "inside") {
      insertAt = siblings.length;
    }

    const next = [...siblings];
    next.splice(insertAt, 0, { ...dragged, groupId: targetGroupId });

    const updates: Array<{ id: string; groupId: string | null; sortOrder: number }> = [];
    next.forEach((it, idx) => {
      const wasGroupId = it.id === draggedId ? dragged.groupId ?? null : it.groupId ?? null;
      const wasOrder = it.id === draggedId ? dragged.sortOrder : it.sortOrder;
      const nextGroupId = targetGroupId;
      if (wasGroupId !== nextGroupId || wasOrder !== idx) {
        updates.push({ id: it.id, groupId: nextGroupId, sortOrder: idx });
      }
    });
    return updates;
  }

  const performDrop = (draggedId: string, target: DropTarget) => {
    const updates = computeDropMutations(target, draggedId);
    if (!updates || updates.length === 0) return;
    itemsBulkOrder.mutate(updates);
  };

  const performGroupDrop = (draggedGroupId: string, target: GroupDropTarget) => {
    const orderedIds = buckets
      .filter((bucket) => bucket.groupId !== null)
      .map((bucket) => bucket.groupId!);
    const next = orderedIds.filter((id) => id !== draggedGroupId);
    const targetIndex = next.indexOf(target.groupId);
    if (targetIndex < 0) return;
    const insertAt = target.position === "before" ? targetIndex : targetIndex + 1;
    next.splice(insertAt, 0, draggedGroupId);
    if (next.join("\u0000") === orderedIds.join("\u0000")) return;
    groupsBulkOrder.mutate(next);
  };

  const toggleBucket = (bucketKey: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(bucketKey)) {
        next.delete(bucketKey);
      } else {
        next.add(bucketKey);
      }
      return next;
    });
  };

  // ---- New-item input handling -----------------------------------------
  const [draftPerBucket, setDraftPerBucket] = useState<Record<string, string>>({});
  const setDraft = (key: string, value: string) =>
    setDraftPerBucket((prev) => ({ ...prev, [key]: value }));

  const submitDraft = (groupId: string | null) => {
    const key = groupId ?? "__root__";
    const value = (draftPerBucket[key] ?? "").trim();
    if (!value) return;
    setDraft(key, "");
    itemCreate.mutate({ content: value, groupId });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
          {t.itemsHeading}
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              const name = window.prompt(t.groupCreatePrompt);
              if (name && name.trim()) groupCreate.mutate(name.trim());
            }}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1 text-[length:var(--text-2xs)] hover:bg-[var(--color-bg-hover)]"
          >
            {t.groupAddButton}
          </button>
        )}
      </div>

      {locked && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]">
          {t.lockedHint}
        </div>
      )}

      <div className="space-y-2">
        {buckets.map((bucket) => {
          const bucketKey = bucket.groupId ?? "__root__";
          return (
            <BucketBlock
              key={bucketKey}
              bucket={bucket}
              canEdit={canEdit}
              collapsed={collapsedGroupIds.has(bucketKey)}
              draggingId={draggingId}
              dropTarget={dropTarget}
              draggingGroupId={draggingGroupId}
              groupDropTarget={groupDropTarget}
              setDropTarget={setDropTarget}
              setDraggingId={setDraggingId}
              setDraggingGroupId={setDraggingGroupId}
              setGroupDropTarget={setGroupDropTarget}
              onDrop={performDrop}
              onGroupDrop={performGroupDrop}
              onToggleCollapse={() => toggleBucket(bucketKey)}
              onItemPatch={(input) => itemPatch.mutate(input)}
              onItemDelete={(itemId) => itemDelete.mutate(itemId)}
              onGroupRename={(name) => bucket.groupId && groupRename.mutate({ id: bucket.groupId, name })}
              onGroupDelete={() => bucket.groupId && groupDelete.mutate(bucket.groupId)}
              draft={draftPerBucket[bucketKey] ?? ""}
              onDraftChange={(v) => setDraft(bucketKey, v)}
              onDraftSubmit={() => submitDraft(bucket.groupId)}
            />
          );
        })}
      </div>

      {items.length === 0 && groups.length === 0 && (
        <p className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{t.itemsEmpty}</p>
      )}
    </div>
  );
}

interface BucketBlockProps {
  bucket: BucketRow;
  canEdit: boolean;
  collapsed: boolean;
  draggingId: string | null;
  dropTarget: DropTarget | null;
  draggingGroupId: string | null;
  groupDropTarget: GroupDropTarget | null;
  setDraggingId: (id: string | null) => void;
  setDropTarget: (target: DropTarget | null) => void;
  setDraggingGroupId: (id: string | null) => void;
  setGroupDropTarget: (target: GroupDropTarget | null) => void;
  onDrop: (draggedId: string, target: DropTarget) => void;
  onGroupDrop: (draggedGroupId: string, target: GroupDropTarget) => void;
  onToggleCollapse: () => void;
  onItemPatch: (input: { id: string; content?: string; groupId?: string | null; sortOrder?: number }) => void;
  onItemDelete: (itemId: string) => void;
  onGroupRename: (name: string) => void;
  onGroupDelete: () => void;
  draft: string;
  onDraftChange: (next: string) => void;
  onDraftSubmit: () => void;
}

function BucketBlock(props: BucketBlockProps) {
  const {
    bucket,
    canEdit,
    collapsed,
    draggingId,
    dropTarget,
    draggingGroupId,
    groupDropTarget,
    setDraggingId,
    setDropTarget,
    setDraggingGroupId,
    setGroupDropTarget,
    onDrop,
    onGroupDrop,
    onToggleCollapse,
    onItemPatch,
    onItemDelete,
    onGroupRename,
    onGroupDelete,
    draft,
    onDraftChange,
    onDraftSubmit,
  } = props;
  const { messages } = useI18n();
  const t = messages.checklist.detail;
  const isRoot = bucket.groupId === null;
  const bucketKey = bucket.groupId ?? "__root__";
  const bodyId = `checklist-bucket-${bucketKey}`;

  const headerActive =
    dropTarget?.bucketId === (isRoot ? "root" : bucket.groupId) &&
    dropTarget?.position === "inside" &&
    dropTarget?.itemId === null;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)]",
        "relative",
        headerActive && "ring-1 ring-[var(--color-accent)]",
      )}
      onDragOver={(e) => {
        if (canEdit && draggingGroupId) {
          if (!isRoot && draggingGroupId !== bucket.groupId) {
            e.preventDefault();
            setGroupDropTarget({
              groupId: bucket.groupId!,
              position: computeGroupPosition(e),
            });
          } else {
            setGroupDropTarget(null);
          }
          return;
        }
        if (!canEdit || !draggingId || collapsed) return;
        // Empty bucket / between rows → drop "inside" puts the item at the end.
        if (bucket.items.length === 0) {
          e.preventDefault();
          setDropTarget({
            bucketId: isRoot ? "root" : bucket.groupId!,
            itemId: null,
            position: "inside",
          });
        }
      }}
      onDrop={(e) => {
        if (canEdit && draggingGroupId && !isRoot && groupDropTarget?.groupId === bucket.groupId) {
          e.preventDefault();
          onGroupDrop(draggingGroupId, groupDropTarget);
          setDraggingGroupId(null);
          setGroupDropTarget(null);
          return;
        }
        if (!canEdit || !draggingId || collapsed || bucket.items.length !== 0) return;
        e.preventDefault();
        onDrop(draggingId, {
          bucketId: isRoot ? "root" : bucket.groupId!,
          itemId: null,
          position: "inside",
        });
        setDraggingId(null);
        setDropTarget(null);
      }}
    >
      {groupDropTarget?.groupId === bucket.groupId && groupDropTarget.position === "before" && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[var(--color-accent)]" />
      )}
      {groupDropTarget?.groupId === bucket.groupId && groupDropTarget.position === "after" && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[var(--color-accent)]" />
      )}
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2",
          isRoot && "bg-[var(--color-bg-secondary)]",
        )}
      >
        <div className="flex min-w-0 items-center gap-2 text-[length:var(--text-xs)] font-semibold text-[var(--color-text-primary)]">
          {canEdit && !isRoot && (
            <button
              type="button"
              draggable
              aria-label={t.groupReorderHandle}
              title={t.groupReorderHandle}
              onDragStart={(e) => {
                setDraggingId(null);
                setDropTarget(null);
                setDraggingGroupId(bucket.groupId!);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", bucket.groupId!);
              }}
              onDragEnd={() => {
                setDraggingGroupId(null);
                setGroupDropTarget(null);
              }}
              className="inline-flex h-6 w-6 cursor-grab select-none items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] active:cursor-grabbing"
            >
              <GripDotsIcon />
            </button>
          )}
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            aria-label={collapsed ? t.expandGroup : t.collapseGroup}
            title={collapsed ? t.expandGroup : t.collapseGroup}
            onClick={onToggleCollapse}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          >
            <ChevronIcon direction={collapsed ? "right" : "down"} />
          </button>
          {isRoot ? (
            <span className="truncate text-[var(--color-text-secondary)]">{t.rootBucketLabel}</span>
          ) : (
            <span className="truncate">{bucket.groupName}</span>
          )}
          <span className="text-[length:var(--text-3xs)] font-normal text-[var(--color-text-tertiary)]">
            {bucket.items.length}
          </span>
        </div>
        {canEdit && !isRoot && (
          <div className="flex items-center gap-1 text-[length:var(--text-2xs)]">
            <button
              type="button"
              onClick={() => {
                const name = window.prompt(t.groupRenamePrompt, bucket.groupName ?? "");
                if (name && name.trim()) onGroupRename(name.trim());
              }}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {t.groupRenameButton}
            </button>
            <span className="text-[var(--color-text-tertiary)]">·</span>
            <button
              type="button"
              onClick={() => {
                if (confirm(t.groupDeleteConfirm.replace("{name}", bucket.groupName ?? ""))) {
                  onGroupDelete();
                }
              }}
              className="text-[var(--color-danger)] hover:underline"
            >
              {t.groupDeleteButton}
            </button>
          </div>
        )}
      </div>

      <div id={bodyId} hidden={collapsed}>
        <ul>
          {bucket.items.map((item) => (
            <ItemRowView
              key={item.id}
              bucket={bucket}
              item={item}
              canEdit={canEdit}
              draggingId={draggingId}
              dropTarget={dropTarget}
              setDraggingId={setDraggingId}
              setDropTarget={setDropTarget}
              onDrop={onDrop}
              onItemPatch={onItemPatch}
              onItemDelete={onItemDelete}
            />
          ))}
        </ul>

        {canEdit && (
          <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-2">
            <span className="text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">+</span>
            <input
              type="text"
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  onDraftSubmit();
                }
              }}
              placeholder={t.itemPlaceholder}
              className="flex-1 rounded-[var(--radius-md)] border border-transparent bg-transparent px-2 py-1 text-[length:var(--text-sm)] text-[var(--color-text-primary)] focus:border-[var(--color-border)] focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function computeGroupPosition(e: React.DragEvent<HTMLElement>): "before" | "after" {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  return y < rect.height * 0.5 ? "before" : "after";
}

function GripDotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <circle cx="6" cy="4" r="1" />
      <circle cx="10" cy="4" r="1" />
      <circle cx="6" cy="8" r="1" />
      <circle cx="10" cy="8" r="1" />
      <circle cx="6" cy="12" r="1" />
      <circle cx="10" cy="12" r="1" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "down" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "down" ? <path d="M4 6l4 4 4-4" /> : <path d="M6 4l4 4-4 4" />}
    </svg>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface ItemRowViewProps {
  bucket: BucketRow;
  item: ItemRow;
  canEdit: boolean;
  draggingId: string | null;
  dropTarget: DropTarget | null;
  setDraggingId: (id: string | null) => void;
  setDropTarget: (target: DropTarget | null) => void;
  onDrop: (draggedId: string, target: DropTarget) => void;
  onItemPatch: (input: { id: string; content?: string; groupId?: string | null; sortOrder?: number }) => void;
  onItemDelete: (itemId: string) => void;
}

function ItemRowView({
  bucket,
  item,
  canEdit,
  draggingId,
  dropTarget,
  setDraggingId,
  setDropTarget,
  onDrop,
  onItemPatch,
  onItemDelete,
}: ItemRowViewProps) {
  const { messages } = useI18n();
  const t = messages.checklist.detail;
  const [editing, setEditing] = useState(false);
  const [draft, setDraftValue] = useState(item.content);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = () => {
    setDraftValue(item.content);
    setEditing(true);
  };

  const isBeingDragged = draggingId === item.id;
  const dropPos =
    dropTarget?.bucketId === (bucket.groupId ?? "root") && dropTarget?.itemId === item.id
      ? dropTarget.position
      : null;

  const computePosition = (e: React.DragEvent<HTMLLIElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < rect.height * 0.4) return "before" as const;
    return "after" as const;
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.content) {
      onItemPatch({ id: item.id, content: trimmed });
    }
    setEditing(false);
  };

  return (
    <li
      className={cn(
        "relative flex items-start gap-2 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]",
        isBeingDragged && "opacity-40",
      )}
      draggable={canEdit}
      onDragStart={(e) => {
        if (!canEdit) return;
        setDraggingId(item.id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
      }}
      onDragEnd={() => {
        setDraggingId(null);
        setDropTarget(null);
      }}
      onDragOver={(e) => {
        if (!draggingId || draggingId === item.id) return;
        e.preventDefault();
        setDropTarget({
          bucketId: bucket.groupId ?? "root",
          itemId: item.id,
          position: computePosition(e),
        });
      }}
      onDrop={(e) => {
        if (!draggingId || draggingId === item.id) return;
        e.preventDefault();
        onDrop(draggingId, {
          bucketId: bucket.groupId ?? "root",
          itemId: item.id,
          position: computePosition(e),
        });
        setDraggingId(null);
        setDropTarget(null);
      }}
    >
      {dropPos === "before" && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[var(--color-accent)]" />
      )}
      {dropPos === "after" && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[var(--color-accent)]" />
      )}

      {canEdit && (
        <span
          className="mt-0.5 cursor-grab select-none text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] active:cursor-grabbing"
          aria-hidden="true"
        >
          <DragHandleIcon className="h-4 w-4" />
        </span>
      )}

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraftValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-[length:var(--text-sm)]"
        />
      ) : (
        <button
          type="button"
          onClick={() => canEdit && startEdit()}
          className={cn("flex-1 cursor-text text-left", !canEdit && "cursor-default")}
        >
          {item.content}
        </button>
      )}

      {canEdit && !editing && (
        <button
          type="button"
          onClick={() => {
            if (confirm(t.itemDeleteConfirm)) onItemDelete(item.id);
          }}
          className="text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
        >
          {t.removeItem}
        </button>
      )}
    </li>
  );
}

interface CalendarDay {
  date: string;
  total: number;
  completed: number;
  canceled: number;
  running: number;
}

interface HistoryTabProps {
  projectKey: string;
  checklistId: string;
}

function HistoryTab({ projectKey, checklistId }: HistoryTabProps) {
  const { messages } = useI18n();
  const t = messages.checklist.detail;
  const [selected, setSelected] = useState<string | null>(null);

  const calendar = useQuery<{ days: CalendarDay[] }>({
    queryKey: ["checklist-calendar", projectKey, checklistId],
    queryFn: async () => {
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/runs/calendar`,
      );
      if (!res.ok) throw new Error(messages.errors.failedToLoad);
      return res.json();
    },
  });

  const markedSet = useMemo(
    () => new Set(calendar.data?.days.map((d) => d.date) ?? []),
    [calendar.data],
  );

  const runs = useQuery<{ runs: Array<RunSummary> }>({
    queryKey: ["checklist-runs", projectKey, checklistId, selected],
    queryFn: async () => {
      if (!selected) return { runs: [] };
      const fromIso = `${selected}T00:00:00`;
      const toIso = `${selected}T23:59:59.999`;
      const res = await fetch(
        `/api/projects/${projectKey}/checklists/${checklistId}/runs?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      );
      if (!res.ok) throw new Error(messages.errors.failedToLoad);
      return res.json();
    },
    enabled: Boolean(selected),
  });

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px_1fr]">
      <div>
        <Calendar
          value={selected}
          onSelect={(d) => setSelected(d)}
          markedDates={markedSet}
          disableFuture
        />
      </div>
      <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] p-3">
        <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
          {t.historyHeading}
        </h2>
        {!selected && (
          <p className="mt-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
            {t.historyDateNone}
          </p>
        )}
        {selected && runs.data && runs.data.runs.length === 0 && (
          <p className="mt-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{t.historyEmpty}</p>
        )}
        {selected && runs.data && runs.data.runs.length > 0 && (
          <ul className="mt-3">
            {runs.data.runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/projects/${projectKey}/checklists/${checklistId}/runs/${r.id}`}
                  className="flex items-center justify-between gap-2 py-2 text-[length:var(--text-xs)] hover:bg-[var(--color-bg-hover)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[var(--color-text-primary)]">
                      <DateDisplay date={r.startedAt} format="short" /> · {r.startedBy.name}
                    </div>
                    <div className="mt-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                      {r.checkedCount}/{r.totalCount}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!calendar.data?.days.length && (
          <p className="mt-3 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
            {t.historyEmptyAll}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { messages } = useI18n();
  const t = messages.checklist.detail;
  const map: Record<string, { label: string; cls: string }> = {
    RUNNING: {
      label: t.statusRunning,
      cls: "bg-[var(--color-accent-light)] text-[var(--color-accent)]",
    },
    COMPLETED: {
      label: t.statusCompleted,
      cls: "bg-[var(--color-success-light)] text-[var(--color-success)]",
    },
    CANCELED: {
      label: t.statusCanceled,
      cls: "bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]",
    },
  };
  const v = map[status] ?? map.CANCELED;
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[length:var(--text-3xs)] font-medium", v.cls)}>
      {v.label}
    </span>
  );
}
