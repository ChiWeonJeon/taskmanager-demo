"use client";

import { useMemo, useRef, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { DateDisplay } from "@/components/shared/date-display";
import { TaskCommentCountButton } from "@/components/task/task-comment-count-button";
import { TaskEmptyState } from "@/components/task/task-empty-state";
import { TaskInlineDateEditor } from "@/components/task/task-inline-date-editor";
import { SubtaskDisclosure } from "@/components/task/subtask-disclosure";
import { TaskTitleHighlight } from "@/components/task/task-title-highlight";
import { ArrowUpIcon, DotsHorizontalIcon, DueDateIcon, StartDateIcon } from "@/components/task/task-icons";
import { useI18n } from "@/components/shared/locale-provider";
import { useToast } from "@/lib/toast";
import { useDragSuppressClick } from "@/hooks/use-drag-suppress-click";
import { toDateInputValue } from "@/lib/date";
import {
  getAllowedStatusesForIssueType,
  getAllowedTransitionTargets,
  isStatusTransitionAllowed,
  type TransitionsByIssueType,
} from "@/lib/task-status";
import { cn } from "@/lib/utils";
import {
  WorkItemWithRelations,
  StatusOption,
  IssueTypeOption,
  WorkItemUpdate,
  TaskFieldVisibility,
  TaskSubtaskProgress,
  UserOption,
} from "@/components/task/types";
import {
  canEditTaskField,
  formatCustomFieldText,
  getTaskCustomFieldValue,
  isFieldInTaskSchema,
  type WorkspaceField,
} from "@/lib/workspace-field-model";

interface TaskKanbanProps {
  tasks: WorkItemWithRelations[];
  statuses: StatusOption[];
  issueTypes: IssueTypeOption[];
  issueTypesByProjectId?: Record<string, IssueTypeOption[]>;
  allowedStatusIdsByIssueType?: Record<string, string[]>;
  transitionsByIssueType?: TransitionsByIssueType;
  disableIssueTypeEdit?: boolean;
  onUpdate?: (id: string, data: WorkItemUpdate) => void;
  onSelect?: (task: WorkItemWithRelations) => void;
  onCommentClick?: (task: WorkItemWithRelations) => void;
  onContextMenu?: (task: WorkItemWithRelations, e: React.MouseEvent) => void;
  fieldVisibility?: TaskFieldVisibility;
  hierarchyDepthById?: Map<string, number>;
  splitHierarchy?: boolean;
  hasChildrenIds?: Set<string>;
  childProgressById?: Map<string, TaskSubtaskProgress>;
  collapsedIds?: Set<string>;
  onToggleCollapse?: (id: string) => void;
  projectMembersByProjectId?: Map<string, UserOption[]>;
  highlightQuery?: string;
  isFullscreen?: boolean;
  workspaceFields?: WorkspaceField[];
  visibleCustomFieldIds?: Set<string>;
  canEditByProjectId?: Record<string, boolean>;
}

const CATEGORY_ORDER = ["TODO", "IN_PROGRESS", "DONE"] as const;

export function TaskKanban({
  tasks,
  statuses,
  issueTypes,
  issueTypesByProjectId = {},
  allowedStatusIdsByIssueType = {},
  transitionsByIssueType = {},
  disableIssueTypeEdit = false,
  onUpdate,
  onSelect,
  onCommentClick,
  onContextMenu,
  fieldVisibility,
  hierarchyDepthById,
  splitHierarchy = false,
  hasChildrenIds,
  childProgressById,
  collapsedIds,
  onToggleCollapse,
  projectMembersByProjectId,
  highlightQuery,
  isFullscreen = false,
  workspaceFields,
  visibleCustomFieldIds,
  canEditByProjectId,
}: TaskKanbanProps) {
  const { messages } = useI18n();
  const { toast } = useToast();
  const categoryLabels = useMemo<Record<string, string>>(() => ({
    TODO: messages.taskCommon.kanbanColumns.TODO,
    IN_PROGRESS: messages.taskCommon.kanbanColumns.IN_PROGRESS,
    DONE: messages.taskCommon.kanbanColumns.DONE,
  }), [messages]);
  const unassignedLabel = messages.taskCommon.unassignedLabel;
  const expandLabel = messages.taskCommon.expandLabel;
  const collapseLabel = messages.taskCommon.collapseLabel;
  const createdLabel = messages.taskCommon.createdLabel;
  const updatedLabel = messages.taskCommon.updatedLabel;
  const emptyColumnLabel = messages.taskCommon.emptyColumnLabel;
  const dragHandleLabel = messages.taskCommon.dragHandleLabel;
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null);
  const draggedTaskId = useRef<string | null>(null);
  const { notifyDragEnded, shouldSuppressClick } = useDragSuppressClick();
  const editableTriggerClassName = "p-0.5 hover:border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]";

  // Build childMap for circular reference check and child count display
  const childMap = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.parentId) {
      const siblings = childMap.get(task.parentId) ?? [];
      siblings.push(task.id);
      childMap.set(task.parentId, siblings);
    }
  }
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const rootTaskById = useMemo(() => {
    const cache = new Map<string, WorkItemWithRelations>();

    const resolveRoot = (task: WorkItemWithRelations) => {
      if (cache.has(task.id)) return cache.get(task.id)!;

      let current = task;
      const seen = new Set<string>([task.id]);
      while (current.parentId && taskById.has(current.parentId) && !seen.has(current.parentId)) {
        seen.add(current.parentId);
        current = taskById.get(current.parentId)!;
      }

      cache.set(task.id, current);
      return current;
    };

    for (const task of tasks) {
      resolveRoot(task);
    }

    return cache;
  }, [tasks, taskById]);

  function getDescendantIds(taskId: string): Set<string> {
    const result = new Set<string>();
    const queue = [taskId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const childId of childMap.get(id) ?? []) {
        result.add(childId);
        queue.push(childId);
      }
    }
    return result;
  }

  const grouped = useMemo(() => CATEGORY_ORDER.map((category) => ({
    category,
    items: tasks.filter((task) => {
      const groupingTask = splitHierarchy ? task : (rootTaskById.get(task.id) ?? task);
      return groupingTask.status.category === category;
    }),
  })), [tasks, splitHierarchy, rootTaskById]);

  const getIssueTypeOptionsForTask = (task: WorkItemWithRelations) => {
    const scopedIssueTypes = task.projectId ? issueTypesByProjectId[task.projectId] ?? [] : issueTypes;
    const next = [...scopedIssueTypes];

    if (!next.some((issueType) => issueType.id === task.issueTypeId)) {
      const currentIssueType = issueTypes.find((issueType) => issueType.id === task.issueTypeId);
      if (currentIssueType) next.push(currentIssueType);
    }

    return next.map((t) => ({ value: t.id, label: t.name, color: t.color }));
  };
  const getStatusOptionsForTask = (task: WorkItemWithRelations) =>
    getAllowedTransitionTargets(
      task.issueTypeId,
      task.statusId,
      getAllowedStatusesForIssueType(task.issueTypeId, statuses, allowedStatusIdsByIssueType),
      transitionsByIssueType,
    ).map((status) => ({ value: status.id, label: status.name, color: status.color }));

  const customColumns = (workspaceFields ?? []).filter(
    (field) => !field.isSystem && (visibleCustomFieldIds?.has(field.id) ?? false),
  );
  const canEdit = (task: WorkItemWithRelations, schemaKey: string | null) =>
    canEditTaskField(task, schemaKey, workspaceFields, canEditByProjectId);

  function handleDragStart(e: React.DragEvent, taskId: string) {
    draggedTaskId.current = taskId;
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    draggedTaskId.current = null;
    setDraggingId(null);
    setDragOverCategory(null);
    setDropTargetCardId(null);
    notifyDragEnded();
  }

  // Column handlers ??status change (fires only when NOT over a card due to stopPropagation)
  function handleColumnDragOver(e: React.DragEvent, category: string) {
    // 자식 태스크도 컬럼 이동(statusId 변경)을 허용 — v0.22.3에서 parentId 차단 가드 제거
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCategory(category);
  }

  function handleColumnDragLeave() {
    setDragOverCategory(null);
  }

  function handleColumnDrop(e: React.DragEvent, category: string) {
    e.preventDefault();
    setDragOverCategory(null);
    // Ignore if a card is targeted (card's onDrop handles that)
    if (dropTargetCardId) return;
    const taskId = draggedTaskId.current;
    draggedTaskId.current = null;
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    // 자식 태스크도 컬럼 이동(statusId 변경)을 허용 — v0.22.3에서 parentId 차단 가드 제거
    if (!task || task.status.category === category) return;
    const targetStatus = getAllowedStatusesForIssueType(
      task.issueTypeId,
      statuses,
      allowedStatusIdsByIssueType,
    ).find((status) => status.category === category);
    if (!targetStatus) {
      toast(messages.taskCommon.statusNotAllowedForType, { type: "error" });
      return;
    }
    if (!isStatusTransitionAllowed(task.issueTypeId, task.statusId, targetStatus.id, transitionsByIssueType)) {
      toast(messages.taskCommon.statusTransitionBlocked, { type: "error" });
      return;
    }
    onUpdate?.(taskId, { statusId: targetStatus.id });
  }

  // Card handlers ??hierarchy change
  function handleCardDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation(); // Prevent column from receiving this event
    const sourceId = draggedTaskId.current;
    if (!sourceId || sourceId === targetId) return;
    if (getDescendantIds(sourceId).has(targetId)) {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    const sourceTask = tasks.find((t) => t.id === sourceId);
    if (sourceTask?.parentId === targetId) {
      setDropTargetCardId(null);
      setDragOverCategory(null);
      return;
    }
    e.dataTransfer.dropEffect = "move";
    setDropTargetCardId(targetId);
    setDragOverCategory(null); // Clear column highlight when hovering over a card
  }

  function handleCardDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggedTaskId.current;
    if (!sourceId || sourceId === targetId) {
      setDropTargetCardId(null);
      return;
    }
    if (getDescendantIds(sourceId).has(targetId)) {
      setDropTargetCardId(null);
      return;
    }
    onUpdate?.(sourceId, { parentId: targetId });
    draggedTaskId.current = null;
    setDraggingId(null);
    setDropTargetCardId(null);
    notifyDragEnded();
  }

  if (tasks.length === 0) {
    return (
      <TaskEmptyState
        title={messages.taskViews.emptyTitle}
        description={messages.taskViews.emptyDescription}
        className="py-14"
      />
    );
  }

  return (
    <div
      className="grid min-h-0 grid-cols-1 gap-2 md:h-full md:grid-cols-3 md:gap-3"
      data-fullscreen={isFullscreen ? "true" : "false"}
    >
      {grouped.map((group) => (
        <div
          key={group.category}
          className={cn(
            "flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] transition-colors",
            dragOverCategory === group.category && !dropTargetCardId
              ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]"
              : ""
          )}
          onDragOver={(e) => handleColumnDragOver(e, group.category)}
          onDragLeave={handleColumnDragLeave}
          onDrop={(e) => handleColumnDrop(e, group.category)}
        >
          <h3 className="flex shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface-sticky)] px-2.5 py-2 text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-primary)] sm:text-[length:var(--text-xs)]">
            {categoryLabels[group.category]}
            <span className="ml-1.5 text-[length:var(--text-2xs)] font-normal text-[var(--color-text-tertiary)]">
              {group.items.length}
            </span>
          </h3>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-1.5 sm:p-2">
            {group.items.map((task) => {
              const isDragging = draggingId === task.id;
              const isDropTarget = dropTargetCardId === task.id;
              const parentTask = !splitHierarchy && task.parentId ? taskById.get(task.parentId) : null;
              const childCount = !splitHierarchy ? (childMap.get(task.id)?.length ?? 0) : 0;
              const childProgress = childProgressById?.get(task.id) ?? { done: 0, total: childCount };
              const depth = splitHierarchy ? 0 : (hierarchyDepthById?.get(task.id) ?? 0);
              const assigneeOptions = [
                { value: "", label: unassignedLabel },
                ...((projectMembersByProjectId?.get(task.projectId ?? "") ?? []).map((member) => ({
                  value: member.id,
                  label: member.name,
                }))),
              ];
              return (
                <div
                  key={task.id}
                  onDragOver={(e) => handleCardDragOver(e, task.id)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      if (dropTargetCardId === task.id) setDropTargetCardId(null);
                    }
                  }}
                  onDrop={(e) => handleCardDrop(e, task.id)}
                  style={{ marginLeft: depth > 0 ? `${depth * 0.55}rem` : undefined }}
                  className={cn(
                    "group relative min-w-0 overflow-hidden rounded-[var(--radius-sm)] border bg-[var(--color-bg-secondary)] transition-all select-none",
                    isDragging
                      ? "opacity-40 border-dashed border-[var(--color-border)] scale-[0.97] shadow-2xl"
                      : "hover:border-[var(--color-accent)]",
                    isDropTarget && "border-2 border-[var(--color-accent)] bg-[var(--color-accent-light)] shadow-md"
                  )}
                  onClick={() => { if (shouldSuppressClick()) return; onSelect?.(task); }}
                  onContextMenu={(e) => onContextMenu?.(task, e)}
                >
                  {/* Drag bar — 카드 상단 전폭, 호버 시 강조. 유일한 draggable source */}
                  <span
                    draggable
                    role="button"
                    aria-label={dragHandleLabel}
                    aria-roledescription="draggable"
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "block h-3 w-full select-none text-center text-[length:var(--text-3xs)] leading-[0.75rem] tracking-[0.2em] text-[var(--color-text-tertiary)] border-b border-transparent transition-colors",
                      isDragging
                        ? "cursor-grabbing bg-[var(--color-bg-tertiary)] border-[var(--color-border)]"
                        : "cursor-grab hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border)] hover:text-[var(--color-text-secondary)]"
                    )}
                  >
                    <DotsHorizontalIcon className="mx-auto h-4 w-4" />
                  </span>

                  <div className="p-1.5 sm:p-2">
                  {/* Drop-target accent bar */}
                  {isDropTarget && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-sm)] bg-[var(--color-accent)]" />
                  )}

                  {/* Parent breadcrumb */}
                  {parentTask && (
                    <p className="mb-1 flex min-w-0 items-center gap-0.5 overflow-hidden text-[length:var(--text-3xs)] text-[var(--color-accent)] sm:text-xs">
                      <ArrowUpIcon className="h-3 w-3 shrink-0" />
                      <span className="shrink-0 font-medium">{parentTask.issueKey}</span>
                      <span className="truncate">{parentTask.title}</span>
                    </p>
                  )}

                  {/* Issue key + collapse toggle + count badges */}
                  <div className="mb-1 flex min-w-0 items-center justify-between gap-1">
                    {fieldVisibility?.issueKey !== false && (
                      <p className="truncate text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] sm:text-xs">{task.issueKey}</p>
                    )}
                    <div className="ml-auto flex min-w-0 items-center gap-1">
                      {!splitHierarchy && fieldVisibility?.childCount !== false && (hasChildrenIds?.has(task.id) || childCount > 0) && (
                        <SubtaskDisclosure
                          collapsed={collapsedIds?.has(task.id)}
                          done={childProgress.done}
                          total={childProgress.total}
                          compact
                          expandLabel={expandLabel}
                          collapseLabel={collapseLabel}
                          onToggle={() => onToggleCollapse?.(task.id)}
                        />
                      )}
                      {fieldVisibility?.commentCount !== false && (
                        <TaskCommentCountButton
                          count={task.commentCount ?? task.comments?.length ?? 0}
                          onClick={() => onCommentClick?.(task)}
                        />
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect?.(task);
                    }}
                    className="mb-1 block w-full min-w-0 overflow-hidden text-left text-[length:var(--text-2xs)] leading-4 text-[var(--color-text-primary)] hover:text-[var(--color-accent)] sm:text-[length:var(--text-xs)]"
                  >
                    <span className="line-clamp-2 break-all">
                      <TaskTitleHighlight text={task.title} query={highlightQuery} />
                    </span>
                  </button>

                  <div className="flex min-w-0 flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {fieldVisibility?.status !== false && (
                      canEdit(task, "status") ? (
                        <Combobox
                          options={getStatusOptionsForTask(task)}
                          value={task.statusId}
                          onChange={(statusId) => onUpdate?.(task.id, { statusId })}
                          triggerClassName={editableTriggerClassName}
                          renderTrigger={(opt) => (
                            <Badge color={opt?.color ?? task.status.color} className="max-w-full px-1.5 py-0.5 text-[length:var(--text-3xs)] sm:px-2 sm:text-[length:var(--text-2xs)]">
                              {opt?.label ?? task.status.name}
                            </Badge>
                          )}
                        />
                      ) : (
                        <Badge color={task.status.color} className="max-w-full px-1.5 py-0.5 text-[length:var(--text-3xs)] sm:px-2 sm:text-[length:var(--text-2xs)]">
                          {task.status.name}
                        </Badge>
                      )
                    )}
                    {fieldVisibility?.issueType !== false && (
                      disableIssueTypeEdit || !canEdit(task, null) ? (
                        <Badge color={task.issueType.color ?? undefined} className="max-w-full px-1.5 py-0.5 text-[length:var(--text-3xs)] sm:px-2 sm:text-[length:var(--text-2xs)]">
                          {task.issueType.name}
                        </Badge>
                      ) : (
                        <Combobox
                          options={getIssueTypeOptionsForTask(task)}
                          value={task.issueTypeId}
                          onChange={(issueTypeId) => onUpdate?.(task.id, { issueTypeId })}
                          triggerClassName={editableTriggerClassName}
                          renderTrigger={(opt) => (
                            <Badge color={opt?.color ?? task.issueType.color ?? undefined} className="max-w-full px-1.5 py-0.5 text-[length:var(--text-3xs)] sm:px-2 sm:text-[length:var(--text-2xs)]">
                              {opt?.label ?? task.issueType.name}
                            </Badge>
                          )}
                        />
                      )
                    )}
                    {fieldVisibility?.assignee !== false && (
                      canEdit(task, "assignee") ? (
                        <Combobox
                          options={assigneeOptions}
                          value={task.assignee?.id ?? ""}
                          onChange={(assigneeId) => onUpdate?.(task.id, { assigneeId })}
                          dropdownWidth="w-64"
                          triggerClassName={editableTriggerClassName}
                          renderTrigger={(option) => (
                            <span className="inline-flex max-w-[140px] px-1.5 py-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-secondary)] sm:max-w-[180px] sm:text-[length:var(--text-2xs)]">
                              <span className="truncate">{option?.label ?? task.assignee?.name ?? unassignedLabel}</span>
                            </span>
                          )}
                        />
                      ) : (
                        <span className="inline-flex max-w-[140px] px-1.5 py-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-secondary)] sm:max-w-[180px] sm:text-[length:var(--text-2xs)]">
                          <span className="truncate">{task.assignee?.name ?? unassignedLabel}</span>
                        </span>
                      )
                    )}
                  </div>

                  {(fieldVisibility?.startDate !== false || fieldVisibility?.dueDate !== false || fieldVisibility?.createdAt !== false || fieldVisibility?.updatedAt !== false) && (
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] sm:mt-2 sm:gap-x-3 sm:text-[length:var(--text-2xs)]">
                      {fieldVisibility?.startDate !== false && (
                        canEdit(task, "start_date") ? (
                          <TaskInlineDateEditor
                            value={toDateInputValue(task.startDate) || null}
                            onChange={(value) => onUpdate?.(task.id, { startDate: value })}
                            triggerClassName={editableTriggerClassName}
                            renderTrigger={(value) => (
                              <span className="inline-flex max-w-full items-center gap-1 px-1 py-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] sm:px-1.5 sm:text-[length:var(--text-2xs)]">
                                <StartDateIcon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                                {value ? <DateDisplay date={value} format="compact" dateOnly /> : <span>{messages.taskWorkspace.fieldLabels.startDate}</span>}
                              </span>
                            )}
                          />
                        ) : (
                          toDateInputValue(task.startDate) ? (
                            <span className="inline-flex max-w-full items-center gap-1 px-1 py-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] sm:px-1.5 sm:text-[length:var(--text-2xs)]">
                              <StartDateIcon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                              <DateDisplay date={toDateInputValue(task.startDate)!} format="compact" dateOnly />
                            </span>
                          ) : null
                        )
                      )}
                      {fieldVisibility?.dueDate !== false && (
                        canEdit(task, "due_date") ? (
                          <TaskInlineDateEditor
                            value={toDateInputValue(task.dueDate) || null}
                            onChange={(value) => onUpdate?.(task.id, { dueDate: value })}
                            triggerClassName={editableTriggerClassName}
                            renderTrigger={(value) => (
                              <span className="inline-flex max-w-full items-center gap-1 px-1 py-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] sm:px-1.5 sm:text-[length:var(--text-2xs)]">
                                <DueDateIcon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                                {value ? <DateDisplay date={value} format="compact" dateOnly /> : <span>{messages.taskWorkspace.fieldLabels.dueDate}</span>}
                              </span>
                            )}
                          />
                        ) : (
                          toDateInputValue(task.dueDate) ? (
                            <span className="inline-flex max-w-full items-center gap-1 px-1 py-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] sm:px-1.5 sm:text-[length:var(--text-2xs)]">
                              <DueDateIcon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                              <DateDisplay date={toDateInputValue(task.dueDate)!} format="compact" dateOnly />
                            </span>
                          ) : null
                        )
                      )}
                      {fieldVisibility?.createdAt !== false && (
                        <span className="truncate">
                          {createdLabel} <DateDisplay date={task.createdAt} format="compact" />
                        </span>
                      )}
                      {fieldVisibility?.updatedAt !== false && (
                        <span className="truncate">
                          {updatedLabel} <DateDisplay date={task.updatedAt} format="compact" />
                        </span>
                      )}
                    </div>
                  )}
                  {customColumns.length > 0 && (
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
                      {customColumns.map((field) => {
                        if (!isFieldInTaskSchema(field, task)) return null;
                        const text = formatCustomFieldText(field, getTaskCustomFieldValue(task, field));
                        if (!text) return null;
                        return (
                          <span
                            key={field.id}
                            className="inline-flex max-w-full items-center rounded-full bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-secondary)] sm:text-[length:var(--text-2xs)]"
                            title={`${field.name}: ${text}`}
                          >
                            <span className="max-w-[9rem] truncate">{text}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}

            {group.items.length === 0 && (
              <p className="text-xs text-[var(--color-text-tertiary)] py-4 text-center">{emptyColumnLabel}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
