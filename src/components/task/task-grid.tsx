"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { DateDisplay } from "@/components/shared/date-display";
import { TaskCommentCountButton } from "@/components/task/task-comment-count-button";
import { TaskEmptyState } from "@/components/task/task-empty-state";
import { TaskInlineDateEditor } from "@/components/task/task-inline-date-editor";
import { SubtaskDisclosure } from "@/components/task/subtask-disclosure";
import { TaskTitleHighlight } from "@/components/task/task-title-highlight";
import { DragHandleIcon, DueDateIcon, SortAscendingIcon, SortDescendingIcon, SortIcon, StartDateIcon } from "@/components/task/task-icons";
import { TaskSelectionCheckbox } from "@/components/task/task-selection-checkbox";
import { useRangeSelection } from "@/components/task/use-range-selection";
import { useI18n } from "@/components/shared/locale-provider";
import { useParentingDragHandlers } from "@/hooks/use-parenting-drag-handlers";
import { toDateInputValue } from "@/lib/date";
import { findReferenceOption } from "@/lib/reference-options";
import {
  getAllowedStatusesForIssueType,
  getAllowedTransitionTargets,
  type TransitionsByIssueType,
} from "@/lib/task-status";
import { cn } from "@/lib/utils";

const DRAG_HANDLE_WIDTH = 24;
const SELECTION_COLUMN_WIDTH = 36;
import {
  WorkItemWithRelations,
  StatusOption,
  IssueTypeOption,
  WorkItemUpdate,
  DEFAULT_TASK_COLUMN_WIDTHS,
  TaskFieldVisibility,
  TaskColumnKey,
  TaskColumnWidths,
  TaskSubtaskProgress,
  UserOption,
} from "@/components/task/types";
import {
  canEditTaskField,
  getTaskCustomFieldValue,
  isDynamicWorkspaceField,
  isFieldInTaskSchema,
  type WorkspaceField,
} from "@/lib/workspace-field-model";
import type { TaskWorkspaceColumn } from "@/lib/task-column-model";
import type { TaskGroupSection } from "@/components/task/task-group-model";

// 그리드 시스템 컬럼 키 → 구성표 필드 key 매핑(셀 편집 게이팅용). issueType 은 필드가 아닌 유형 선택기.
const SYSTEM_CELL_SCHEMA_KEY: Record<string, string> = {
  status: "status",
  assignee: "assignee",
  startDate: "start_date",
  dueDate: "due_date",
};

interface TaskGridProps {
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
  groups?: TaskGroupSection[];
  columns?: TaskWorkspaceColumn[];
  fieldVisibility?: TaskFieldVisibility;
  columnWidths?: TaskColumnWidths;
  onColumnWidthChange?: (column: TaskColumnKey, width: number) => void;
  hierarchyDepthById?: Map<string, number>;
  splitHierarchy?: boolean;
  hasChildrenIds?: Set<string>;
  allChildCountById?: Map<string, number>;
  childProgressById?: Map<string, TaskSubtaskProgress>;
  collapsedIds?: Set<string>;
  onToggleCollapse?: (id: string) => void;
  projectMembersByProjectId?: Map<string, UserOption[]>;
  highlightQuery?: string;
  stickyTopOffset?: number;
  isFullscreen?: boolean;
  // 멀티뷰 구성표 모델(전체 필드, 시스템+커스텀). 셀 편집 게이팅·커스텀 컬럼 도출에 사용.
  workspaceFields?: WorkspaceField[];
  visibleCustomFieldIds?: Set<string>;
  canEditByProjectId?: Record<string, boolean>;
  selectedIds?: Set<string>;
  onToggleManySelected?: (ids: string[], selected: boolean) => void;
  onSelectAllVisible?: (selected: boolean) => void;
  getSelectionAnchorId?: () => string | null;
  setSelectionAnchorId?: (id: string | null) => void;
}

type SortColumn = TaskColumnKey;
type SortDir = "asc" | "desc";

function sortTasks(tasks: WorkItemWithRelations[], col: SortColumn, dir: SortDir) {
  return [...tasks].sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    if (col === "issueKey") { av = a.issueKey; bv = b.issueKey; }
    else if (col === "title") { av = a.title; bv = b.title; }
    else if (col === "issueType") { av = a.issueType.name; bv = b.issueType.name; }
    else if (col === "status") { av = a.status.name; bv = b.status.name; }
    else if (col === "assignee") { av = a.assignee?.name ?? ""; bv = b.assignee?.name ?? ""; }
    else if (col === "startDate") { av = a.startDate ?? ""; bv = b.startDate ?? ""; }
    else if (col === "dueDate") { av = a.dueDate ?? ""; bv = b.dueDate ?? ""; }
    else if (col === "createdAt") { av = a.createdAt; bv = b.createdAt; }
    else if (col === "updatedAt") { av = a.updatedAt; bv = b.updatedAt; }
    else if (col === "childCount") { av = tasks.filter((task) => task.parentId === a.id).length; bv = tasks.filter((task) => task.parentId === b.id).length; }
    else if (col === "commentCount") { av = a.commentCount ?? a.comments?.length ?? 0; bv = b.commentCount ?? b.comments?.length ?? 0; }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });
}

export function TaskGrid({
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
  groups,
  columns,
  fieldVisibility,
  columnWidths,
  onColumnWidthChange,
  hierarchyDepthById,
  splitHierarchy = false,
  hasChildrenIds,
  allChildCountById,
  childProgressById,
  collapsedIds,
  onToggleCollapse,
  projectMembersByProjectId,
  highlightQuery,
  isFullscreen = false,
  workspaceFields,
  visibleCustomFieldIds,
  canEditByProjectId,
  selectedIds,
  onToggleManySelected,
  onSelectAllVisible,
  getSelectionAnchorId,
  setSelectionAnchorId,
}: TaskGridProps) {
  const { messages } = useI18n();
  const unassignedLabel = messages.taskCommon.unassignedLabel;
  const expandLabel = messages.taskCommon.expandLabel;
  const collapseLabel = messages.taskCommon.collapseLabel;
  const rootDropHint = messages.taskCommon.rootDropHint;
  const resizeLabel = messages.taskCommon.resizeLabel;
  const dragHandleLabel = messages.taskCommon.dragHandleLabel;
  const [sortCol, setSortCol] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [resizeState, setResizeState] = useState<{ column: TaskColumnKey; originX: number; originWidth: number } | null>(null);
  const {
    draggingId,
    dropTargetId,
    showRootDropHint,
    rowProps,
    containerProps,
    shouldSuppressClick,
  } = useParentingDragHandlers(tasks, onUpdate);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const editableTriggerClassName = "p-0.5 hover:border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]";
  const selectionEnabled = Boolean(selectedIds && onToggleManySelected && onSelectAllVisible);
  const groupingActive = Boolean(groups && groups.length > 0);

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
    )
      .map((status) => ({ value: status.id, label: status.name, color: status.color }));

  const fieldNotInTypeLabel = messages.taskWorkspace.fieldNotInIssueType;
  const legacyCustomColumns = (workspaceFields ?? []).filter(
    (field) => isDynamicWorkspaceField(field) && (visibleCustomFieldIds?.has(field.id) ?? false),
  );
  const fallbackColumns: TaskWorkspaceColumn[] = [
    ...(fieldVisibility?.issueKey === false ? [] : [{ id: "issueKey", kind: "system" as const, visible: true }]),
    ...(fieldVisibility?.issueType === false ? [] : [{ id: "issueType", kind: "system" as const, visible: true }]),
    ...(fieldVisibility?.status === false ? [] : [{ id: "status", kind: "system" as const, visible: true }]),
    ...(fieldVisibility?.assignee === false ? [] : [{ id: "assignee", kind: "system" as const, visible: true }]),
    ...(fieldVisibility?.startDate === false ? [] : [{ id: "startDate", kind: "system" as const, visible: true }]),
    ...(fieldVisibility?.dueDate === false ? [] : [{ id: "dueDate", kind: "system" as const, visible: true }]),
    ...(fieldVisibility?.createdAt === false ? [] : [{ id: "createdAt", kind: "system" as const, visible: true }]),
    ...(fieldVisibility?.updatedAt === false ? [] : [{ id: "updatedAt", kind: "system" as const, visible: true }]),
    ...(fieldVisibility?.childCount === false ? [] : [{ id: "childCount", kind: "system" as const, visible: true }]),
    ...(fieldVisibility?.commentCount === false ? [] : [{ id: "commentCount", kind: "system" as const, visible: true }]),
    ...legacyCustomColumns.map((field) => ({ id: field.id, kind: "custom" as const, field, visible: true })),
  ];
  const visibleColumns = columns ?? fallbackColumns;
  const customColumnIds = new Set(visibleColumns.filter((column) => column.kind === "custom").map((column) => column.id));

  // 시스템 셀 게이팅(뷰 공용 헬퍼 위임). projectCanEdit: 필드가 아닌 동작(유형 선택)용.
  const projectCanEdit = (task: WorkItemWithRelations) =>
    canEditTaskField(task, null, workspaceFields, canEditByProjectId);
  const canEditSystemCell = (task: WorkItemWithRelations, columnKey: string) =>
    canEditTaskField(task, SYSTEM_CELL_SCHEMA_KEY[columnKey] ?? null, workspaceFields, canEditByProjectId);

  const renderCustomCellValue = (field: WorkspaceField, value: string | string[] | null) => {
    if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      return <span className="text-[var(--color-text-tertiary)]">—</span>;
    }
    if (Array.isArray(value)) {
      return (
        <span className="flex flex-wrap gap-1">
          {value.map((item) => {
            const option = findReferenceOption(field.options, item);
            return <Badge key={item} color={option?.color ?? undefined} className="px-1.5 py-0.5 text-[length:var(--text-2xs)]">{option?.label ?? item}</Badge>;
          })}
        </span>
      );
    }
    if (["SELECT", "REFERENCE", "OBJECT_REF", "ENTITY_REF", "USER"].includes(field.type)) {
      const option = findReferenceOption(field.options, value);
      return <Badge color={option?.color ?? undefined} className="px-1.5 py-0.5 text-[length:var(--text-2xs)]">{option?.label ?? value}</Badge>;
    }
    if (field.type === "DATE") {
      return <DateDisplay date={value} format="compact" dateOnly />;
    }
    return <span className="truncate">{value}</span>;
  };

  const getColumnLabel = (column: TaskWorkspaceColumn) => (
    column.kind === "custom"
      ? column.field?.name ?? column.id
      : messages.taskWorkspace.fieldLabels[column.id as keyof typeof messages.taskWorkspace.fieldLabels] ?? column.id
  );
  const resolvedColumns = visibleColumns.map((column) => ({
    ...column,
    col: column.id as TaskColumnKey,
    label: getColumnLabel(column),
    width: columnWidths?.[column.id] ?? DEFAULT_TASK_COLUMN_WIDTHS[column.id] ?? 120,
  }));
  const titleColumnWidth = columnWidths?.title ?? DEFAULT_TASK_COLUMN_WIDTHS.title;
  const tableWidth = (selectionEnabled ? SELECTION_COLUMN_WIDTH : 0) + DRAG_HANDLE_WIDTH + titleColumnWidth + resolvedColumns.reduce((sum, column) => sum + column.width, 0);

  // Column sort only available when hierarchy is split (otherwise maintain depth-first order).
  // Grouped grids keep the workspace-level sort so sections remain stable.
  const displayTasks = useMemo(
    () => (!groupingActive && sortCol && splitHierarchy) ? sortTasks(tasks, sortCol, sortDir) : tasks,
    [groupingActive, sortCol, sortDir, splitHierarchy, tasks],
  );
  const displayRows = useMemo(
    () => groupingActive && groups
      ? groups.flatMap((section) => [
          { kind: "group" as const, section },
          ...section.tasks.map((task) => ({ kind: "task" as const, task, groupKey: section.key })),
        ])
      : displayTasks.map((task) => ({ kind: "task" as const, task, groupKey: null })),
    [displayTasks, groupingActive, groups],
  );
  const groupHeaderColSpan = (selectionEnabled ? 1 : 0) + 2 + resolvedColumns.length;
  const orderedIds = useMemo(() => displayTasks.map((task) => task.id), [displayTasks]);
  const handleToggleManySelected = useCallback((ids: string[], selected: boolean) => {
    onToggleManySelected?.(ids, selected);
  }, [onToggleManySelected]);
  const handleRangeToggle = useRangeSelection({
    orderedIds,
    onToggleMany: handleToggleManySelected,
    getAnchorId: getSelectionAnchorId,
    setAnchorId: setSelectionAnchorId,
  });
  const selectedVisibleCount = selectionEnabled ? displayTasks.filter((task) => selectedIds?.has(task.id)).length : 0;
  const allVisibleSelected = selectionEnabled && displayTasks.length > 0 && selectedVisibleCount === displayTasks.length;
  const someVisibleSelected = selectionEnabled && selectedVisibleCount > 0 && selectedVisibleCount < displayTasks.length;

  useEffect(() => {
    if (!resizeState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = Math.max(72, resizeState.originWidth + event.clientX - resizeState.originX);
      onColumnWidthChange?.(resizeState.column, nextWidth);
    };

    const handlePointerUp = () => {
      setResizeState(null);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onColumnWidthChange, resizeState]);

  useEffect(() => {
    if (!headerScrollRef.current || !bodyScrollRef.current) return;
    headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
  }, [resolvedColumns.length, tableWidth]);

  if (tasks.length === 0) {
    return (
      <TaskEmptyState
        title={messages.taskViews.emptyTitle}
        description={messages.taskViews.emptyDescription}
        className="py-14"
      />
    );
  }

  function handleHeaderClick(col: SortColumn) {
    if (groupingActive) return;
    if (!splitHierarchy) return;
    if (customColumnIds.has(col)) return; // 커스텀 필드 컬럼은 정렬 미지원(v1)
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function sortIndicator(col: SortColumn) {
    if (groupingActive) return null;
    if (!splitHierarchy) return null;
    if (customColumnIds.has(col)) return null; // 커스텀 컬럼은 정렬 인디케이터 숨김
    if (sortCol !== col) return <SortIcon className="ml-1 h-3 w-3 opacity-30" />;
    return sortDir === "asc"
      ? <SortAscendingIcon className="ml-1 h-3 w-3" />
      : <SortDescendingIcon className="ml-1 h-3 w-3" />;
  }

  // childMap은 child count 표시 용도로만 유지 (순환 참조 감지는 useParentingDragHandlers 내부)
  const childMap = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.parentId) {
      const siblings = childMap.get(task.parentId) ?? [];
      siblings.push(task.id);
      childMap.set(task.parentId, siblings);
    }
  }

  function startColumnResize(event: React.PointerEvent, column: TaskColumnKey, width: number) {
    event.preventDefault();
    event.stopPropagation();
    setResizeState({
      column,
      originX: event.clientX,
      originWidth: width,
    });
  }

  function handleBodyScroll() {
    if (!headerScrollRef.current || !bodyScrollRef.current) return;
    headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
  }

  return (
    <div
      className={cn(
        "min-w-0 h-full flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] transition-all",
        showRootDropHint && !groupingActive && "outline outline-2 outline-dashed outline-[var(--color-accent)]"
      )}
      data-fullscreen={isFullscreen ? "true" : "false"}
      {...(!groupingActive ? containerProps() : {})}
    >
      {showRootDropHint && !groupingActive && (
        <div className="py-1 text-center text-[length:var(--text-2xs)] font-medium text-[var(--color-accent)] animate-pulse pointer-events-none">
          {rootDropHint}
        </div>
      )}
      <div
        ref={headerScrollRef}
        className="shrink-0 overflow-hidden rounded-t-[var(--radius-md)] border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
        data-task-grid-header="true"
      >
        <table className="text-[length:var(--text-xs)]" style={{ minWidth: `${tableWidth}px`, width: `${tableWidth}px`, tableLayout: "fixed" }}>
          <colgroup>
            {selectionEnabled && <col style={{ width: `${SELECTION_COLUMN_WIDTH}px` }} />}
            <col style={{ width: `${DRAG_HANDLE_WIDTH}px` }} />
            <col style={{ width: `${titleColumnWidth}px` }} />
            {resolvedColumns.map((column) => (
              <col key={column.col} style={{ width: `${column.width}px` }} />
            ))}
          </colgroup>
          <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
            <tr>
              {selectionEnabled && (
                <th
                  className="px-0 py-0 text-center"
                  style={{ width: `${SELECTION_COLUMN_WIDTH}px`, minWidth: `${SELECTION_COLUMN_WIDTH}px` }}
                >
                  <TaskSelectionCheckbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    aria-label={messages.taskWorkspace.bulkBar.selectAllVisible}
                    onChange={(checked) => onSelectAllVisible?.(checked)}
                  />
                </th>
              )}
              <th aria-hidden="true" style={{ width: `${DRAG_HANDLE_WIDTH}px`, minWidth: `${DRAG_HANDLE_WIDTH}px` }} />
              <th
                className={cn(
                  "relative px-2.5 py-1 text-left text-[length:var(--text-2xs)] font-medium select-none",
                  splitHierarchy ? "cursor-pointer hover:text-[var(--color-text-primary)]" : "cursor-default"
                )}
                style={{ width: `${titleColumnWidth}px`, minWidth: `${titleColumnWidth}px` }}
                onClick={() => handleHeaderClick("title")}
              >
                <div className="flex items-center">
                  <span>{messages.taskWorkspace.filterFields.title}</span>
                  {sortIndicator("title")}
                </div>
                <button
                  type="button"
                  aria-label={`${messages.taskWorkspace.filterFields.title} ${resizeLabel}`}
                  className="absolute inset-y-0 right-0 w-3 cursor-col-resize touch-none"
                  onPointerDown={(event) => startColumnResize(event, "title", titleColumnWidth)}
                >
                  <span className="absolute inset-y-2 right-1 w-px bg-[var(--color-border)]" />
                </button>
              </th>
              {resolvedColumns.map(({ col, label, width }) => (
                <th
                  key={col}
                  className={cn(
                    "relative px-2.5 py-1 text-left text-[length:var(--text-2xs)] font-medium select-none",
                    splitHierarchy ? "cursor-pointer hover:text-[var(--color-text-primary)]" : "cursor-default"
                  )}
                  style={{ width: `${width}px`, minWidth: `${width}px` }}
                  onClick={() => handleHeaderClick(col)}
                >
                  <div className="flex items-center">
                    <span>{label}</span>
                    {sortIndicator(col)}
                  </div>
                  <button
                    type="button"
                    aria-label={`${label} ${resizeLabel}`}
                    className="absolute inset-y-0 right-0 w-3 cursor-col-resize touch-none"
                    onPointerDown={(event) => startColumnResize(event, col, width)}
                  >
                    <span className="absolute inset-y-2 right-1 w-px bg-[var(--color-border)]" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      <div
        ref={bodyScrollRef}
        onScroll={handleBodyScroll}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-auto overscroll-x-contain rounded-b-[var(--radius-md)]"
        data-task-grid-body-scroll="true"
      >
        <table className="text-[length:var(--text-xs)]" style={{ minWidth: `${tableWidth}px`, width: `${tableWidth}px`, tableLayout: "fixed" }}>
          <colgroup>
            {selectionEnabled && <col style={{ width: `${SELECTION_COLUMN_WIDTH}px` }} />}
            <col style={{ width: `${DRAG_HANDLE_WIDTH}px` }} />
            <col style={{ width: `${titleColumnWidth}px` }} />
            {resolvedColumns.map((column) => (
              <col key={column.col} style={{ width: `${column.width}px` }} />
            ))}
          </colgroup>
          <tbody {...(!groupingActive ? containerProps() : {})}>
            {displayRows.map((row) => {
            if (row.kind === "group") {
              return (
                <tr key={`group-${row.section.key}`} className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/70">
                  <td colSpan={groupHeaderColSpan} className="px-3 py-2 text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">
                    <span className="inline-flex max-w-full items-center gap-2">
                      <span className="truncate">{row.section.label}</span>
                      <span className="rounded-full bg-[var(--color-bg-primary)] px-1.5 py-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)]">
                        {messages.taskWorkspace.groupCount.replace("{count}", String(row.section.tasks.length))}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            }
            const task = row.task;
            const depth = splitHierarchy ? 0 : (hierarchyDepthById?.get(task.id) ?? 0);
            const hasChildren = !splitHierarchy && !groupingActive && !!hasChildrenIds?.has(task.id);
            const childCount = allChildCountById?.get(task.id) ?? childMap.get(task.id)?.length ?? 0;
            const childProgress = childProgressById?.get(task.id) ?? { done: 0, total: childCount };
            const isDragging = draggingId === task.id;
            const isDropTarget = dropTargetId === task.id;
            const taskProjectId = task.projectId ?? task.project?.id ?? null;
            const projectMembers = taskProjectId ? (projectMembersByProjectId?.get(taskProjectId) ?? []) : [];
            const assigneeOptions = [
              { value: "", label: unassignedLabel },
              ...projectMembers.map((member) => ({
                value: member.id,
                label: member.name,
              })),
            ];
            const renderBodyCell = (column: (typeof resolvedColumns)[number]) => {
              if (column.kind === "custom") {
                const field = column.field;
                if (!field) return null;
                const inSchema = isFieldInTaskSchema(field, task);
                return (
                  <td
                    key={column.id}
                    className="truncate px-2.5 py-1.5 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]"
                    title={inSchema ? undefined : fieldNotInTypeLabel}
                  >
                    {inSchema
                      ? renderCustomCellValue(field, getTaskCustomFieldValue(task, field))
                      : <span className="text-[var(--color-text-tertiary)]">—</span>}
                  </td>
                );
              }

              switch (column.id) {
                case "issueKey":
                  return (
                    <td key={column.id} className="truncate px-2.5 py-1.5 text-[length:var(--text-2xs)] font-medium text-[var(--color-text-secondary)]">
                      {task.issueKey}
                    </td>
                  );
                case "issueType":
                  return (
                    <td key={column.id} className="px-2.5 py-1.5" onClick={(e) => e.stopPropagation()}>
                      {disableIssueTypeEdit || !projectCanEdit(task) ? (
                        <Badge color={task.issueType.color ?? undefined} className="px-2 py-0.5 text-[length:var(--text-2xs)]">
                          {task.issueType.name}
                        </Badge>
                      ) : (
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
                      )}
                    </td>
                  );
                case "status":
                  return (
                    <td key={column.id} className="px-2.5 py-1.5" onClick={(e) => e.stopPropagation()}>
                      {canEditSystemCell(task, "status") ? (
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
                    </td>
                  );
                case "assignee":
                  return (
                    <td key={column.id} className="truncate px-2.5 py-1.5 text-[var(--color-text-secondary)]" onClick={(e) => e.stopPropagation()}>
                      {canEditSystemCell(task, "assignee") && assigneeOptions.length > 0 ? (
                        <Combobox
                          options={assigneeOptions}
                          value={task.assignee?.id ?? ""}
                          onChange={(assigneeId) => onUpdate?.(task.id, { assigneeId })}
                          dropdownWidth="w-64"
                          triggerClassName={editableTriggerClassName}
                          renderTrigger={(opt) => (
                            <span className="inline-flex max-w-full px-2 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]">
                              <span className="truncate">{opt?.label ?? task.assignee?.name ?? unassignedLabel}</span>
                            </span>
                          )}
                        />
                      ) : (
                        <span>{task.assignee?.name ?? unassignedLabel}</span>
                      )}
                    </td>
                  );
                case "startDate":
                  return (
                    <td key={column.id} className="px-2.5 py-1.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]" onClick={(e) => e.stopPropagation()}>
                      {canEditSystemCell(task, "startDate") ? (
                        <TaskInlineDateEditor
                          value={toDateInputValue(task.startDate) || null}
                          onChange={(value) => onUpdate?.(task.id, { startDate: value })}
                          className="w-full"
                          triggerClassName={cn(editableTriggerClassName, "w-full")}
                          renderTrigger={(value) => (
                            <span className="inline-flex w-full items-center gap-1 px-1.5 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                              <StartDateIcon className="h-3.5 w-3.5 shrink-0" />
                              {value ? <DateDisplay date={value} format="compact" dateOnly /> : <span>{messages.taskWorkspace.fieldLabels.startDate}</span>}
                            </span>
                          )}
                        />
                      ) : (
                        <span className="inline-flex w-full items-center gap-1 px-1.5 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                          <StartDateIcon className="h-3.5 w-3.5 shrink-0" />
                          {toDateInputValue(task.startDate) ? <DateDisplay date={toDateInputValue(task.startDate)!} format="compact" dateOnly /> : <span>—</span>}
                        </span>
                      )}
                    </td>
                  );
                case "dueDate":
                  return (
                    <td key={column.id} className="px-2.5 py-1.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]" onClick={(e) => e.stopPropagation()}>
                      {canEditSystemCell(task, "dueDate") ? (
                        <TaskInlineDateEditor
                          value={toDateInputValue(task.dueDate) || null}
                          onChange={(value) => onUpdate?.(task.id, { dueDate: value })}
                          className="w-full"
                          triggerClassName={cn(editableTriggerClassName, "w-full")}
                          renderTrigger={(value) => (
                            <span className="inline-flex w-full items-center gap-1 px-1.5 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                              <DueDateIcon className="h-3.5 w-3.5 shrink-0" />
                              {value ? <DateDisplay date={value} format="compact" dateOnly /> : <span>{messages.taskWorkspace.fieldLabels.dueDate}</span>}
                            </span>
                          )}
                        />
                      ) : (
                        <span className="inline-flex w-full items-center gap-1 px-1.5 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                          <DueDateIcon className="h-3.5 w-3.5 shrink-0" />
                          {toDateInputValue(task.dueDate) ? <DateDisplay date={toDateInputValue(task.dueDate)!} format="compact" dateOnly /> : <span>—</span>}
                        </span>
                      )}
                    </td>
                  );
                case "createdAt":
                  return (
                    <td key={column.id} className="px-2.5 py-1.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                      <DateDisplay date={task.createdAt} format="compact" />
                    </td>
                  );
                case "updatedAt":
                  return (
                    <td key={column.id} className="px-2.5 py-1.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                      <DateDisplay date={task.updatedAt} format="compact" />
                    </td>
                  );
                case "childCount":
                  return (
                    <td key={column.id} className="px-2.5 py-1.5 text-[var(--color-text-tertiary)]">
                      <SubtaskDisclosure
                        collapsed={collapsedIds?.has(task.id)}
                        done={childProgress.done}
                        total={childProgress.total}
                        expandLabel={expandLabel}
                        collapseLabel={collapseLabel}
                        onToggle={() => onToggleCollapse?.(task.id)}
                      />
                    </td>
                  );
                case "commentCount":
                  return (
                    <td key={column.id} className="px-2.5 py-1.5 text-[var(--color-text-tertiary)]">
                      <TaskCommentCountButton
                        count={task.commentCount ?? task.comments?.length ?? 0}
                        onClick={() => onCommentClick?.(task)}
                      />
                    </td>
                  );
                default:
                  return null;
              }
            };
              const {
                onDragStart: handleRowDragStart,
                onDragEnd: handleRowDragEnd,
                onDragOver: handleRowDragOver,
                onDragLeave: handleRowDragLeave,
                onDrop: handleRowDrop,
              } = rowProps(task.id);
              return (
                <tr
                  key={row.groupKey ? `${row.groupKey}-${task.id}` : task.id}
                  className={cn(
                    "h-11 border-t border-[var(--color-border)] transition-all select-none",
                    isDragging
                      ? "opacity-40 border-dashed"
                      : "hover:bg-[var(--color-bg-hover)]",
                    isDropTarget && "border-2 border-[var(--color-accent)] bg-[var(--color-accent-light)]"
                  )}
                  onClick={() => { if (shouldSuppressClick()) return; onSelect?.(task); }}
                  onContextMenu={(e) => onContextMenu?.(task, e)}
                  onDragOver={groupingActive ? undefined : handleRowDragOver}
                  onDragLeave={groupingActive ? undefined : handleRowDragLeave}
                  onDrop={groupingActive ? undefined : handleRowDrop}
                >
                {selectionEnabled && (
                  <td
                    className="px-0 py-0 text-center align-middle"
                    style={{ width: `${SELECTION_COLUMN_WIDTH}px`, minWidth: `${SELECTION_COLUMN_WIDTH}px` }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <TaskSelectionCheckbox
                      checked={Boolean(selectedIds?.has(task.id))}
                      aria-label={`${messages.taskWorkspace.bulkBar.selectRow} ${task.issueKey}`}
                      onChange={(checked, meta) => handleRangeToggle(task.id, checked, meta.shiftKey)}
                    />
                  </td>
                )}
                <td
                  className="px-0 py-0 text-center align-middle"
                  style={{ width: `${DRAG_HANDLE_WIDTH}px`, minWidth: `${DRAG_HANDLE_WIDTH}px` }}
                >
                  {!groupingActive && (
                    <span
                      draggable
                      role="button"
                      aria-label={dragHandleLabel}
                      aria-roledescription="draggable"
                      onDragStart={handleRowDragStart}
                      onDragEnd={handleRowDragEnd}
                      className={cn(
                        "inline-flex h-full w-full items-center justify-center text-[length:var(--text-3xs)] leading-none text-[var(--color-text-tertiary)] transition-colors",
                        isDragging ? "cursor-grabbing" : "cursor-grab hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      <DragHandleIcon className="h-4 w-4" />
                    </span>
                  )}
                </td>
                <td className="overflow-hidden px-2.5 py-1.5 text-[var(--color-text-primary)]">
                  <div style={{ paddingLeft: `${depth * 0.4}rem` }} className="flex min-w-0 items-center gap-1 overflow-hidden">
                    {!splitHierarchy && !groupingActive && (
                      <div className="flex shrink-0 items-center gap-1">
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
                        ) : (
                          <span aria-hidden="true" className="w-12" />
                        )}
                        <span aria-hidden="true" className="flex w-2 justify-center text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)]">
                          {depth > 0 ? "└" : ""}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect?.(task);
                      }}
                      className="block min-w-0 truncate text-left text-[length:var(--text-xs)] leading-4 text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                    >
                      <span className="truncate">
                        <TaskTitleHighlight text={task.title} query={highlightQuery} />
                      </span>
                    </button>
                  </div>
                </td>
                {resolvedColumns.map((column) => renderBodyCell(column))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
