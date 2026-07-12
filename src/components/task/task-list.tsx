"use client";

import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { UserName } from "@/components/user/user-name";
import { DateDisplay } from "@/components/shared/date-display";
import { TaskCommentCountButton } from "@/components/task/task-comment-count-button";
import { TaskEmptyState } from "@/components/task/task-empty-state";
import { TaskInlineDateEditor } from "@/components/task/task-inline-date-editor";
import { SubtaskDisclosure } from "@/components/task/subtask-disclosure";
import { TaskTitleHighlight } from "@/components/task/task-title-highlight";
import { CreatedAtIcon, DragHandleIcon, DueDateIcon, StartDateIcon, UpdatedAtIcon } from "@/components/task/task-icons";
import { TaskSelectionCheckbox } from "@/components/task/task-selection-checkbox";
import { useRangeSelection } from "@/components/task/use-range-selection";
import { useI18n } from "@/components/shared/locale-provider";
import { useParentingDragHandlers } from "@/hooks/use-parenting-drag-handlers";
import { toDateInputValue } from "@/lib/date";
import {
  getAllowedStatusesForIssueType,
  getAllowedTransitionTargets,
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
import type { TaskWorkspaceColumn } from "@/lib/task-column-model";
import type { TaskGroupSection } from "@/components/task/task-group-model";
import { findReferenceOption } from "@/lib/reference-options";

const isReadOnlyDemo = process.env.NEXT_PUBLIC_DEMO_READ_ONLY === "true";

interface TaskListProps {
  tasks: WorkItemWithRelations[];
  statuses: StatusOption[];
  issueTypes: IssueTypeOption[];
  issueTypesByProjectId?: Record<string, IssueTypeOption[]>;
  allowedStatusIdsByIssueType?: Record<string, string[]>;
  transitionsByIssueType?: TransitionsByIssueType;
  onUpdate?: (id: string, data: WorkItemUpdate) => void;
  onSelect?: (task: WorkItemWithRelations) => void;
  onCommentClick?: (task: WorkItemWithRelations) => void;
  onContextMenu?: (task: WorkItemWithRelations, e: React.MouseEvent) => void;
  groups?: TaskGroupSection[];
  columns?: TaskWorkspaceColumn[];
  fieldVisibility?: TaskFieldVisibility;
  hierarchyDepthById?: Map<string, number>;
  splitHierarchy?: boolean;
  hasChildrenIds?: Set<string>;
  allChildCountById?: Map<string, number>;
  childProgressById?: Map<string, TaskSubtaskProgress>;
  collapsedIds?: Set<string>;
  onToggleCollapse?: (id: string) => void;
  projectMembersByProjectId?: Map<string, UserOption[]>;
  highlightQuery?: string;
  workspaceFields?: WorkspaceField[];
  visibleCustomFieldIds?: Set<string>;
  canEditByProjectId?: Record<string, boolean>;
  selectedIds?: Set<string>;
  onToggleManySelected?: (ids: string[], selected: boolean) => void;
  onSelectAllVisible?: (selected: boolean) => void;
  getSelectionAnchorId?: () => string | null;
  setSelectionAnchorId?: (id: string | null) => void;
}

interface MobileFieldToken {
  text: string;
  color?: string | null;
}

const MOBILE_META_GAP_PX = 4;
const MOBILE_META_TOKEN_CLASS = "inline-flex min-w-0 max-w-[8.5rem] items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-1.5 py-0.5 sm:max-w-[10rem]";
const MOBILE_META_OVERFLOW_CLASS = "shrink-0 rounded-full bg-[var(--color-accent-light)] px-1.5 py-0.5 text-[var(--color-accent)]";

export function TaskList({
  tasks,
  statuses,
  issueTypes,
  issueTypesByProjectId = {},
  allowedStatusIdsByIssueType = {},
  transitionsByIssueType = {},
  onUpdate,
  onSelect,
  onCommentClick,
  onContextMenu,
  groups,
  columns,
  fieldVisibility,
  hierarchyDepthById,
  splitHierarchy = false,
  hasChildrenIds,
  allChildCountById,
  childProgressById,
  collapsedIds,
  onToggleCollapse,
  projectMembersByProjectId,
  highlightQuery,
  workspaceFields,
  visibleCustomFieldIds,
  canEditByProjectId,
  selectedIds,
  onToggleManySelected,
  onSelectAllVisible,
  getSelectionAnchorId,
  setSelectionAnchorId,
}: TaskListProps) {
  const {
    draggingId,
    dropTargetId,
    showRootDropHint,
    rowProps,
    containerProps,
    shouldSuppressClick,
  } = useParentingDragHandlers(tasks, onUpdate);
  const editableTriggerClassName = "p-0.5 hover:border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]";
  const { messages } = useI18n();
  const unassignedLabel = messages.taskCommon.unassignedLabel;
  const expandLabel = messages.taskCommon.expandLabel;
  const collapseLabel = messages.taskCommon.collapseLabel;
  const childLabel = messages.taskCommon.childLabel;
  const dragHandleLabel = messages.taskCommon.dragHandleLabel;
  const selectionEnabled = !isReadOnlyDemo && Boolean(selectedIds && onToggleManySelected && onSelectAllVisible);
  const groupingActive = Boolean(groups && groups.length > 0);
  const selectedVisibleCount = selectionEnabled ? tasks.filter((task) => selectedIds?.has(task.id)).length : 0;
  const allVisibleSelected = selectionEnabled && tasks.length > 0 && selectedVisibleCount === tasks.length;
  const someVisibleSelected = selectionEnabled && selectedVisibleCount > 0 && selectedVisibleCount < tasks.length;
  const orderedIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const handleToggleManySelected = useCallback((ids: string[], selected: boolean) => {
    onToggleManySelected?.(ids, selected);
  }, [onToggleManySelected]);
  const handleRangeToggle = useRangeSelection({
    orderedIds,
    onToggleMany: handleToggleManySelected,
    getAnchorId: getSelectionAnchorId,
    setAnchorId: setSelectionAnchorId,
  });
  const displayRows = groupingActive && groups
    ? groups.flatMap((section) => [
        { kind: "group" as const, section },
        ...section.tasks.map((task) => ({ kind: "task" as const, task, groupKey: section.key })),
      ])
    : tasks.map((task) => ({ kind: "task" as const, task, groupKey: null }));

  // childMap은 child count 표시 용도로만 유지 (순환 참조 감지는 useParentingDragHandlers 내부에서 처리)
  const childMap = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.parentId) {
      const siblings = childMap.get(task.parentId) ?? [];
      siblings.push(task.id);
      childMap.set(task.parentId, siblings);
    }
  }

  function DateMeta({
    date,
    label,
    icon,
    className,
    dateOnly = false,
  }: {
    date?: string | null;
    label: string;
    icon: ReactNode;
    className?: string;
    dateOnly?: boolean;
  }) {
    return (
      <span className={cn("items-center gap-1 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)] shrink-0", className)}>
        <span aria-hidden="true" className="text-[var(--color-text-tertiary)]">
          {icon}
        </span>
        <span className="sr-only">{label}</span>
        {date ? <DateDisplay date={date} format="compact" dateOnly={dateOnly} /> : <span>{label}</span>}
      </span>
    );
  }

  if (tasks.length === 0) {
    return (
      <TaskEmptyState
        title={messages.taskViews.emptyTitle}
        description={messages.taskViews.emptyDescription}
        className="border-none bg-transparent py-16"
      />
    );
  }

  const getStatusOptionsForTask = (task: WorkItemWithRelations) =>
    getAllowedTransitionTargets(
      task.issueTypeId,
      task.statusId,
      getAllowedStatusesForIssueType(task.issueTypeId, statuses, allowedStatusIdsByIssueType),
      transitionsByIssueType,
    )
      .map((s) => ({ value: s.id, label: s.name, color: s.color }));
  const getIssueTypeOptionsForTask = (task: WorkItemWithRelations) => {
    const scopedIssueTypes = task.projectId ? issueTypesByProjectId[task.projectId] ?? [] : issueTypes;
    const next = [...scopedIssueTypes];

    if (!next.some((issueType) => issueType.id === task.issueTypeId)) {
      const currentIssueType = issueTypes.find((issueType) => issueType.id === task.issueTypeId);
      if (currentIssueType) next.push(currentIssueType);
    }

    return next.map((t) => ({ value: t.id, label: t.name, color: t.color }));
  };

  const legacyCustomColumns = (workspaceFields ?? []).filter(
    (field) => !field.isSystem && (visibleCustomFieldIds?.has(field.id) ?? false),
  );
  const customColumns = columns
    ? columns.map((column) => column.kind === "custom" ? column.field ?? null : null).filter((field): field is WorkspaceField => Boolean(field))
    : legacyCustomColumns;
  const canEdit = (task: WorkItemWithRelations, schemaKey: string | null) =>
    canEditTaskField(task, schemaKey, workspaceFields, canEditByProjectId);
  const buildMobileFieldTokens = (
    task: WorkItemWithRelations,
    childCount: number,
    commentCount: number,
  ): MobileFieldToken[] => {
    if (columns) {
      return columns.map((column): MobileFieldToken | null => {
        if (column.kind === "custom") {
          const field = column.field;
          if (!field || !isFieldInTaskSchema(field, task)) return null;
          const raw = getTaskCustomFieldValue(task, field);
          const text = formatCustomFieldText(field, raw);
          if (!text) return null;
          const option = field.key === "priority" && typeof raw === "string"
            ? findReferenceOption(field.options, raw)
            : null;
          return { text: `${field.name}: ${text}`, color: option?.color };
        }

        switch (column.id) {
          case "issueKey":
            return { text: task.issueKey };
          case "status":
            return { text: task.status.name, color: task.status.color };
          case "issueType":
            return { text: task.issueType.name, color: task.issueType.color };
          case "assignee":
            return { text: task.assignee?.name ?? unassignedLabel };
          case "startDate":
            return toDateInputValue(task.startDate) ? { text: toDateInputValue(task.startDate)! } : null;
          case "dueDate":
            return toDateInputValue(task.dueDate) ? { text: toDateInputValue(task.dueDate)! } : null;
          case "createdAt":
            return toDateInputValue(task.createdAt) ? { text: toDateInputValue(task.createdAt)! } : null;
          case "updatedAt":
            return toDateInputValue(task.updatedAt) ? { text: toDateInputValue(task.updatedAt)! } : null;
          case "childCount":
            return !splitHierarchy && childCount > 0 ? { text: `${childLabel} ${childCount}` } : null;
          case "commentCount":
            return commentCount > 0 ? { text: `# ${commentCount}` } : null;
          default:
            return null;
        }
      }).filter((value): value is MobileFieldToken => Boolean(value));
    }

    return [
      fieldVisibility?.issueKey !== false ? { text: task.issueKey } : null,
      fieldVisibility?.status !== false ? { text: task.status.name, color: task.status.color } : null,
      fieldVisibility?.issueType !== false ? { text: task.issueType.name, color: task.issueType.color } : null,
      fieldVisibility?.assignee !== false ? { text: task.assignee?.name ?? unassignedLabel } : null,
      fieldVisibility?.startDate !== false ? (toDateInputValue(task.startDate) ? { text: toDateInputValue(task.startDate)! } : null) : null,
      fieldVisibility?.dueDate !== false ? (toDateInputValue(task.dueDate) ? { text: toDateInputValue(task.dueDate)! } : null) : null,
      fieldVisibility?.createdAt !== false ? (toDateInputValue(task.createdAt) ? { text: toDateInputValue(task.createdAt)! } : null) : null,
      fieldVisibility?.updatedAt !== false ? (toDateInputValue(task.updatedAt) ? { text: toDateInputValue(task.updatedAt)! } : null) : null,
      fieldVisibility?.childCount !== false && !splitHierarchy && childCount > 0 ? { text: `${childLabel} ${childCount}` } : null,
      fieldVisibility?.commentCount !== false && commentCount > 0 ? { text: `# ${commentCount}` } : null,
      ...customColumns.map((field) => {
        if (!isFieldInTaskSchema(field, task)) return null;
        const text = formatCustomFieldText(field, getTaskCustomFieldValue(task, field));
        return text ? { text: `${field.name}: ${text}` } : null;
      }),
    ].filter((value): value is MobileFieldToken => Boolean(value));
  };

  return (
    <div
      className={cn(
        "space-y-0.5 min-h-[44px] rounded-[var(--radius-md)] p-0.5 transition-all",
        showRootDropHint && !groupingActive && "outline outline-2 outline-dashed outline-[var(--color-accent)] bg-[var(--color-accent-light)]/10"
      )}
      {...(!isReadOnlyDemo && !groupingActive ? containerProps() : {})}
    >
      {selectionEnabled && (
        <label
          className="flex min-h-9 items-center gap-2 rounded-[var(--radius-md)] px-2 text-[length:var(--text-xs)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
          onClick={(event) => event.stopPropagation()}
        >
          <TaskSelectionCheckbox
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected}
            aria-label={messages.taskWorkspace.bulkBar.selectAllVisible}
            onChange={(checked) => onSelectAllVisible?.(checked)}
          />
          <span>{messages.taskWorkspace.bulkBar.selectAllVisible}</span>
        </label>
      )}
      {showRootDropHint && !groupingActive && (
        <div className="py-1 text-center text-[length:var(--text-2xs)] font-medium text-[var(--color-accent)] animate-pulse pointer-events-none">
          {messages.taskViews.dropToRoot}
        </div>
      )}
      {displayRows.map((row) => {
        if (row.kind === "group") {
          return (
            <div
              key={`group-${row.section.key}`}
              className="flex min-h-9 items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]"
            >
              <span className="min-w-0 truncate">{row.section.label}</span>
              <span className="shrink-0 rounded-full bg-[var(--color-bg-primary)] px-1.5 py-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)]">
                {messages.taskWorkspace.groupCount.replace("{count}", String(row.section.tasks.length))}
              </span>
            </div>
          );
        }
        const task = row.task;
        const depth = splitHierarchy ? 0 : (hierarchyDepthById?.get(task.id) ?? 0);
        const hasChildren = !splitHierarchy && !groupingActive && !!hasChildrenIds?.has(task.id);
        const isDragging = draggingId === task.id;
        const isDropTarget = dropTargetId === task.id;
        const {
          onDragStart: handleRowDragStart,
          onDragEnd: handleRowDragEnd,
          onDragOver: handleRowDragOver,
          onDragLeave: handleRowDragLeave,
          onDrop: handleRowDrop,
        } = rowProps(task.id);
        const childCount = allChildCountById?.get(task.id) ?? childMap.get(task.id)?.length ?? 0;
        const childProgress = childProgressById?.get(task.id) ?? { done: 0, total: childCount };
        const showHierarchyAffordance = !splitHierarchy && !groupingActive && (hasChildren || depth > 0);
        const commentCount = task.commentCount ?? task.comments?.length ?? 0;
        const assigneeOptions = [
          { value: "", label: unassignedLabel },
          ...((projectMembersByProjectId?.get(task.projectId ?? "") ?? []).map((member) => ({
            value: member.id,
            label: member.name,
          }))),
        ];
        const mobileFieldTokens = buildMobileFieldTokens(task, childCount, commentCount);

        return (
          <div
            key={row.groupKey ? `${row.groupKey}-${task.id}` : task.id}
            className={cn(
              "relative flex min-h-[52px] min-w-0 items-stretch gap-2 rounded-[var(--radius-md)] bg-transparent py-2 pl-1 pr-2 transition-all select-none lg:min-h-[40px] lg:items-center lg:py-1 lg:pl-2",
              isDragging
                ? "scale-[0.98] opacity-40 outline outline-1 outline-dashed outline-[var(--color-border)]"
                : "hover:bg-[var(--color-bg-hover)]",
              isDropTarget && "bg-[var(--color-accent-light)] shadow-md outline outline-2 outline-[var(--color-accent)]"
            )}
            onClick={() => { if (shouldSuppressClick()) return; onSelect?.(task); }}
            onContextMenu={isReadOnlyDemo ? undefined : (e) => onContextMenu?.(task, e)}
            onDragOver={isReadOnlyDemo || groupingActive ? undefined : handleRowDragOver}
            onDragLeave={isReadOnlyDemo || groupingActive ? undefined : handleRowDragLeave}
            onDrop={isReadOnlyDemo || groupingActive ? undefined : handleRowDrop}
          >
            {selectionEnabled && (
              <div className="flex w-7 shrink-0 items-center justify-center">
                <TaskSelectionCheckbox
                  checked={Boolean(selectedIds?.has(task.id))}
                  aria-label={`${messages.taskWorkspace.bulkBar.selectRow} ${task.issueKey}`}
                  onChange={(checked, meta) => handleRangeToggle(task.id, checked, meta.shiftKey)}
                />
              </div>
            )}
            {/* Drag handle — 행 좌측 고정 폭, 자식 태스크도 동일 위치에서 잡을 수 있도록 depth 들여쓰기보다 먼저 배치 */}
            {!isReadOnlyDemo && !groupingActive ? (
              <span
                draggable
                role="button"
                aria-label={dragHandleLabel}
                aria-roledescription="draggable"
                onDragStart={handleRowDragStart}
                onDragEnd={handleRowDragEnd}
                className={cn(
                  "flex w-7 shrink-0 items-center justify-center text-[length:var(--text-sm)] leading-none text-[var(--color-text-tertiary)] transition-colors lg:w-4 lg:text-[length:var(--text-2xs)]",
                  isDragging ? "cursor-grabbing" : "cursor-grab hover:text-[var(--color-text-primary)]"
                )}
              >
                <DragHandleIcon className="h-4 w-4" />
              </span>
            ) : (
              <span aria-hidden="true" className="w-2 shrink-0 lg:w-1" />
            )}
            <div
              className="flex min-w-0 flex-1 items-stretch gap-1.5 lg:items-center"
              style={{ paddingLeft: `${depth * 0.4}rem` }}
            >
            {/* Drop-target accent bar */}
            {isDropTarget && (
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-md)] bg-[var(--color-accent)]" />
            )}
            {showHierarchyAffordance && (
              <div className="flex items-center gap-1 shrink-0 self-start pt-0.5 lg:self-auto lg:pt-0">
                {hasChildren ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <SubtaskDisclosure
                      collapsed={collapsedIds?.has(task.id)}
                      done={childProgress.done}
                      total={childProgress.total}
                      compact
                      expandLabel={expandLabel}
                      collapseLabel={collapseLabel}
                      onToggle={() => onToggleCollapse?.(task.id)}
                    />
                  </div>
                ) : null}
                {depth > 0 && (
                  <span aria-hidden="true" className="flex w-2 justify-center text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)]">
                    └
                  </span>
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-col gap-1 lg:hidden">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(task);
                  }}
                  className="min-w-0 overflow-hidden text-left text-[length:var(--text-lg)] font-medium leading-5 text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                >
                  <span className="block truncate">
                    <TaskTitleHighlight text={task.title} query={highlightQuery} />
                  </span>
                </button>

                <TaskListMobileMeta taskId={task.id} tokens={mobileFieldTokens} />
              </div>

              <div className="hidden min-w-0 items-center gap-1.5 lg:flex">
                {fieldVisibility?.status !== false && (
                  <div onClick={(e) => e.stopPropagation()}>
                    {canEdit(task, "status") ? (
                      <Combobox
                        options={getStatusOptionsForTask(task)}
                        value={task.statusId}
                        onChange={(statusId) => onUpdate?.(task.id, { statusId })}
                        triggerClassName={editableTriggerClassName}
                        renderTrigger={(opt) => (
                          <Badge color={opt?.color ?? task.status.color} className="px-2 py-0.5 text-[length:var(--text-2xs)]">
                            {opt?.label ?? task.status.name}
                          </Badge>
                        )}
                      />
                    ) : (
                      <Badge color={task.status.color} className="px-2 py-0.5 text-[length:var(--text-2xs)]">{task.status.name}</Badge>
                    )}
                  </div>
                )}

                {fieldVisibility?.issueKey !== false && (
                  <span className="min-w-9 shrink-0 text-[length:var(--text-2xs)] font-medium text-[var(--color-text-tertiary)]">
                    {task.issueKey}
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(task);
                  }}
                  className="min-w-0 flex-1 overflow-hidden text-left text-[length:var(--text-sm)] leading-4 text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                >
                  <span className="block truncate">
                    <TaskTitleHighlight text={task.title} query={highlightQuery} />
                  </span>
                </button>

                {fieldVisibility?.commentCount !== false && (
                  <TaskCommentCountButton
                    count={commentCount}
                    onClick={() => onCommentClick?.(task)}
                    className="shrink-0"
                  />
                )}

                {fieldVisibility?.issueType !== false && (
                  <div onClick={(e) => e.stopPropagation()}>
                    {canEdit(task, null) ? (
                      <Combobox
                        options={getIssueTypeOptionsForTask(task)}
                        value={task.issueTypeId}
                        onChange={(issueTypeId) => onUpdate?.(task.id, { issueTypeId })}
                        triggerClassName={editableTriggerClassName}
                        renderTrigger={(opt) => (
                          <Badge color={opt?.color ?? task.issueType.color ?? undefined} className="px-2 py-0.5 text-[length:var(--text-2xs)]">
                            {opt?.label ?? task.issueType.name}
                          </Badge>
                        )}
                      />
                    ) : (
                      <Badge color={task.issueType.color ?? undefined} className="px-2 py-0.5 text-[length:var(--text-2xs)]">{task.issueType.name}</Badge>
                    )}
                  </div>
                )}

                {fieldVisibility?.assignee !== false && (
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    {canEdit(task, "assignee") ? (
                      <Combobox
                        options={assigneeOptions}
                        value={task.assignee?.id ?? ""}
                        onChange={(assigneeId) => onUpdate?.(task.id, { assigneeId })}
                        dropdownWidth="w-64"
                        triggerClassName={editableTriggerClassName}
                        renderTrigger={() => (
                          <span className="inline-flex max-w-[180px] items-center px-1.5 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]">
                            {task.assignee ? (
                              <UserName user={task.assignee} withAvatar avatarSize="xs" labelClassName="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]" />
                            ) : (
                              <span className="truncate">{unassignedLabel}</span>
                            )}
                          </span>
                        )}
                      />
                    ) : (
                      <span className="inline-flex max-w-[180px] items-center px-1.5 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]">
                        {task.assignee ? (
                          <UserName user={task.assignee} withAvatar avatarSize="xs" labelClassName="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]" />
                        ) : (
                          <span className="truncate">{unassignedLabel}</span>
                        )}
                      </span>
                    )}
                  </div>
                )}

                {fieldVisibility?.startDate !== false && (
                  canEdit(task, "start_date") ? (
                    <TaskInlineDateEditor
                      value={toDateInputValue(task.startDate) || null}
                      onChange={(value) => onUpdate?.(task.id, { startDate: value })}
                      className="hidden shrink-0 lg:inline-block"
                      triggerClassName={editableTriggerClassName}
                      renderTrigger={(value) => (
                        <DateMeta
                          date={value}
                          label={messages.taskWorkspace.fieldLabels.startDate}
                          icon={<StartDateIcon className="h-3.5 w-3.5" />}
                          dateOnly
                          className="inline-flex"
                        />
                      )}
                    />
                  ) : (
                    <DateMeta
                      date={toDateInputValue(task.startDate) || null}
                      label={messages.taskWorkspace.fieldLabels.startDate}
                      icon={<StartDateIcon className="h-3.5 w-3.5" />}
                      dateOnly
                      className="hidden shrink-0 lg:inline-flex"
                    />
                  )
                )}

                {fieldVisibility?.dueDate !== false && (
                  canEdit(task, "due_date") ? (
                    <TaskInlineDateEditor
                      value={toDateInputValue(task.dueDate) || null}
                      onChange={(value) => onUpdate?.(task.id, { dueDate: value })}
                      className="hidden shrink-0 lg:inline-block"
                      triggerClassName={editableTriggerClassName}
                      renderTrigger={(value) => (
                        <DateMeta
                          date={value}
                          label={messages.taskWorkspace.filterFields.dueDate}
                          icon={<DueDateIcon className="h-3.5 w-3.5" />}
                          dateOnly
                          className="inline-flex"
                        />
                      )}
                    />
                  ) : (
                    <DateMeta
                      date={toDateInputValue(task.dueDate) || null}
                      label={messages.taskWorkspace.filterFields.dueDate}
                      icon={<DueDateIcon className="h-3.5 w-3.5" />}
                      dateOnly
                      className="hidden shrink-0 lg:inline-flex"
                    />
                  )
                )}

                {fieldVisibility?.createdAt !== false && (
                  <DateMeta
                    date={task.createdAt}
                    label={messages.taskWorkspace.fieldLabels.createdAt}
                    icon={<CreatedAtIcon className="h-3.5 w-3.5" />}
                    className="hidden lg:inline-flex"
                  />
                )}

                {fieldVisibility?.updatedAt !== false && (
                  <DateMeta
                    date={task.updatedAt}
                    label={messages.taskWorkspace.fieldLabels.updatedAt}
                    icon={<UpdatedAtIcon className="h-3.5 w-3.5" />}
                    className="hidden xl:inline-flex"
                  />
                )}

                {customColumns.map((field) => {
                  if (!isFieldInTaskSchema(field, task)) return null;
                  const raw = getTaskCustomFieldValue(task, field);
                  const text = formatCustomFieldText(field, raw);
                  if (!text) return null;
                  if (field.key === "priority" && typeof raw === "string") {
                    const option = findReferenceOption(field.options, raw);
                    return (
                      <Badge
                        key={field.id}
                        color={option?.color ?? undefined}
                        className="hidden shrink-0 px-2 py-0.5 text-[length:var(--text-2xs)] lg:inline-flex"
                      >
                        {text}
                      </Badge>
                    );
                  }
                  return (
                    <span
                      key={field.id}
                      className="hidden shrink-0 items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] lg:inline-flex"
                      title={`${field.name}: ${text}`}
                    >
                      <span className="max-w-[10rem] truncate">{text}</span>
                    </span>
                  );
                })}
              </div>
            </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskListMobileMeta({
  taskId,
  tokens,
}: {
  taskId: string;
  tokens: MobileFieldToken[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tokens.length);

  useLayoutEffect(() => {
    if (tokens.length === 0) return;

    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const calculateVisibleCount = () => {
      const availableWidth = container.clientWidth;
      const tokenNodes = Array.from(measure.querySelectorAll<HTMLElement>("[data-token-chip='true']"));
      const overflowNode = measure.querySelector<HTMLElement>("[data-overflow-chip='true']");

      if (!availableWidth || tokenNodes.length === 0) {
        setVisibleCount(tokens.length);
        return;
      }

      const tokenWidths = tokenNodes.map((node) => Math.ceil(node.offsetWidth));
      const overflowWidth = Math.ceil(overflowNode?.offsetWidth ?? 0);
      const totalWidth = tokenWidths.reduce(
        (sum, width, index) => sum + width + (index > 0 ? MOBILE_META_GAP_PX : 0),
        0,
      );

      if (totalWidth <= availableWidth) {
        setVisibleCount(tokens.length);
        return;
      }

      let nextVisibleCount = 0;
      let usedWidth = 0;

      for (let index = 0; index < tokenWidths.length; index += 1) {
        const gapWidth = index > 0 ? MOBILE_META_GAP_PX : 0;
        const remainingCount = tokenWidths.length - index - 1;
        const overflowReserve = remainingCount > 0 ? overflowWidth + MOBILE_META_GAP_PX : 0;
        const nextWidth = usedWidth + gapWidth + tokenWidths[index];

        if (nextWidth + overflowReserve > availableWidth) break;

        usedWidth = nextWidth;
        nextVisibleCount = index + 1;
      }

      setVisibleCount(Math.max(nextVisibleCount, 1));
    };

    const frameId = window.requestAnimationFrame(calculateVisibleCount);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => calculateVisibleCount())
        : null;

    resizeObserver?.observe(container);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [tokens]);

  if (tokens.length === 0) return null;

  const safeVisibleCount = Math.min(visibleCount, tokens.length);
  const visibleTokens = tokens.slice(0, safeVisibleCount);
  const overflowCount = Math.max(tokens.length - safeVisibleCount, 0);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-[length:var(--text-2xs)] leading-4 text-[var(--color-text-tertiary)]"
      >
        {visibleTokens.map((token, index) => (
          <span
            key={`${taskId}-${token.text}-${index}`}
            className={MOBILE_META_TOKEN_CLASS}
            title={token.text}
          >
            {token.color && (
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: token.color }}
              />
            )}
            <span className="truncate">{token.text}</span>
          </span>
        ))}
        {overflowCount > 0 && (
          <span className={MOBILE_META_OVERFLOW_CLASS}>
            +{overflowCount}
          </span>
        )}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0"
      >
        <div
          ref={measureRef}
          className="flex items-center gap-1 whitespace-nowrap text-[length:var(--text-2xs)] leading-4"
        >
          {tokens.map((token, index) => (
            <span
              key={`${taskId}-measure-${token.text}-${index}`}
              data-token-chip="true"
              className={MOBILE_META_TOKEN_CLASS}
            >
              {token.color && (
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: token.color }}
                />
              )}
              <span className="truncate">{token.text}</span>
            </span>
          ))}
          <span data-overflow-chip="true" className={MOBILE_META_OVERFLOW_CLASS}>
            +{Math.max(tokens.length - 1, 1)}
          </span>
        </div>
      </div>
    </div>
  );
}
