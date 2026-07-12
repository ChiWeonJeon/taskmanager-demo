"use client";

import { Fragment, MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { DateDisplay } from "@/components/shared/date-display";
import { useI18n } from "@/components/shared/locale-provider";
import { TaskCommentCountButton } from "@/components/task/task-comment-count-button";
import { TaskEmptyState } from "@/components/task/task-empty-state";
import { TaskInlineDateEditor } from "@/components/task/task-inline-date-editor";
import { SubtaskDisclosure } from "@/components/task/subtask-disclosure";
import { TaskTitleHighlight } from "@/components/task/task-title-highlight";
import { DragHandleIcon, DueDateIcon, StartDateIcon } from "@/components/task/task-icons";
import { formatDate, parseDateOnly, toDateInputValue } from "@/lib/date";
import {
  getAllowedStatusesForIssueType,
  getAllowedTransitionTargets,
  type TransitionsByIssueType,
} from "@/lib/task-status";
import { cn } from "@/lib/utils";
import { StatusOption, TaskColumnKey, TaskColumnWidths, TaskFieldVisibility, TaskSubtaskProgress, UserOption, WorkItemUpdate, WorkItemWithRelations } from "@/components/task/types";
import { useParentingDragHandlers } from "@/hooks/use-parenting-drag-handlers";

const GANTT_DRAG_HANDLE_WIDTH = 24;
const RANGE_HEADER_HEIGHT = 36;

type GanttDisplayUnit = "day" | "week" | "month" | "quarter";

interface TaskGanttProps {
  tasks: WorkItemWithRelations[];
  statuses: StatusOption[];
  allowedStatusIdsByIssueType?: Record<string, string[]>;
  transitionsByIssueType?: TransitionsByIssueType;
  onUpdate?: (id: string, data: WorkItemUpdate) => void;
  onSelect?: (task: WorkItemWithRelations) => void;
  onCommentClick?: (task: WorkItemWithRelations) => void;
  onContextMenu?: (task: WorkItemWithRelations, e: React.MouseEvent) => void;
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
  displayRangeStart?: string | null;
  displayRangeEnd?: string | null;
  displayUnit?: GanttDisplayUnit;
  isFullscreen?: boolean;
  projectMembersByProjectId?: Map<string, UserOption[]>;
  highlightQuery?: string;
  stickyTopOffset?: number;
}

interface TimelineCell {
  key: string;
  start: Date;
  end: Date;
  label: string;
  sublabel: string;
  isCurrent: boolean;
  isWeekend: boolean;
  isGroupStart: boolean;
  groupKey: string;
  groupLabel: string;
}

interface TimelineHeaderGroup {
  key: string;
  label: string;
  startOffset: number;
  span: number;
}

interface TaskSchedule {
  start: Date | null;
  end: Date | null;
}

interface TimelineBar {
  start: Date;
  end: Date;
  visibleStartOffset: number;
  visibleEndOffset: number;
}

interface TimelineMarker {
  date: Date;
  visibleOffset: number;
  kind: "start-only" | "end-only";
}

interface DragState {
  taskId: string;
  mode: "move" | "resize-start" | "resize-end";
  originClientX: number;
  originalStart: Date;
  originalEnd: Date;
  previewStart: Date;
  previewEnd: Date;
}

interface PaneResizeState {
  originClientX: number;
  originRatio: number;
}

interface GanttGridColumn {
  key: TaskColumnKey;
  label: string;
  width: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_HEIGHT = 44;
const HEADER_PRIMARY_HEIGHT = 28;
const HEADER_SECONDARY_HEIGHT = 30;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_HEADER_FORMATTER = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
const YEAR_HEADER_FORMATTER = new Intl.DateTimeFormat("ko-KR", { year: "numeric" });
const MIN_COLUMN_WIDTH = 72;

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

function startOfDay(date: Date) {
  const next = cloneDate(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = cloneDate(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  return next;
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getQuarter(date: Date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), (getQuarter(date) - 1) * 3, 1);
}

function endOfQuarter(date: Date) {
  const start = startOfQuarter(date);
  return new Date(start.getFullYear(), start.getMonth() + 3, 0);
}

function addMonthsClamped(date: Date, months: number) {
  const base = startOfDay(date);
  const firstOfTargetMonth = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const lastDay = new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth() + 1, 0).getDate();
  firstOfTargetMonth.setDate(Math.min(base.getDate(), lastDay));
  return firstOfTargetMonth;
}

function shiftDateByUnit(date: Date, unit: GanttDisplayUnit, amount: number) {
  if (amount === 0) return date;
  if (unit === "day") return addDays(date, amount);
  if (unit === "week") return addDays(date, amount * 7);
  if (unit === "month") return addMonthsClamped(date, amount);
  return addMonthsClamped(date, amount * 3);
}

function diffInCalendarDays(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS);
}

function resolveTimelineUnitWidth(unit: GanttDisplayUnit, totalUnits: number) {
  if (unit === "day") {
    if (totalUnits <= 21) return 44;
    if (totalUnits <= 45) return 36;
    if (totalUnits <= 90) return 28;
    return 22;
  }

  if (unit === "week") {
    if (totalUnits <= 8) return 112;
    if (totalUnits <= 16) return 96;
    return 84;
  }

  if (unit === "month") {
    if (totalUnits <= 6) return 132;
    if (totalUnits <= 12) return 112;
    return 96;
  }

  if (totalUnits <= 4) return 168;
  if (totalUnits <= 8) return 148;
  return 128;
}

function resolveTimelineRangeStart(date: Date, unit: GanttDisplayUnit) {
  if (unit === "day") return startOfDay(date);
  if (unit === "week") return startOfWeek(date);
  if (unit === "month") return startOfMonth(date);
  return startOfQuarter(date);
}

function resolveTimelineRangeEnd(date: Date, unit: GanttDisplayUnit) {
  if (unit === "day") return startOfDay(date);
  if (unit === "week") return endOfWeek(date);
  if (unit === "month") return endOfMonth(date);
  return endOfQuarter(date);
}

function resolveCellGroup(date: Date, unit: GanttDisplayUnit) {
  if (unit === "day" || unit === "week") {
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: MONTH_HEADER_FORMATTER.format(date),
    };
  }

  return {
    key: `${date.getFullYear()}`,
    label: YEAR_HEADER_FORMATTER.format(date),
  };
}

function buildTimelineCells(rangeStart: Date, rangeEnd: Date, today: Date, unit: GanttDisplayUnit): TimelineCell[] {
  const cells: TimelineCell[] = [];
  let cursor = resolveTimelineRangeStart(rangeStart, unit);
  const last = resolveTimelineRangeEnd(rangeEnd, unit);

  while (cursor.getTime() <= last.getTime()) {
    let start = startOfDay(cursor);
    let end = startOfDay(cursor);
    let label = "";
    let sublabel = "";
    let nextCursor = addDays(cursor, 1);

    if (unit === "day") {
      label = `${start.getDate()}`;
      sublabel = WEEKDAY_LABELS[start.getDay()];
    } else if (unit === "week") {
      start = startOfWeek(cursor);
      end = endOfWeek(cursor);
      label = `${start.getMonth() + 1}/${start.getDate()}`;
      sublabel = `${end.getMonth() + 1}/${end.getDate()}`;
      nextCursor = addDays(start, 7);
    } else if (unit === "month") {
      start = startOfMonth(cursor);
      end = endOfMonth(cursor);
      label = `${start.getMonth() + 1}m`;
      sublabel = `${diffInCalendarDays(start, end) + 1}d`;
      nextCursor = addMonthsClamped(start, 1);
    } else {
      start = startOfQuarter(cursor);
      end = endOfQuarter(cursor);
      label = `Q${getQuarter(start)}`;
      sublabel = `${start.getMonth() + 1}-${end.getMonth() + 1}m`;
      nextCursor = addMonthsClamped(start, 3);
    }

    const group = resolveCellGroup(start, unit);
    const previous = cells[cells.length - 1];
    cells.push({
      key: `${unit}-${start.toISOString()}`,
      start,
      end,
      label,
      sublabel,
      isCurrent: today.getTime() >= start.getTime() && today.getTime() <= end.getTime(),
      isWeekend: unit === "day" && (start.getDay() === 0 || start.getDay() === 6),
      isGroupStart: !previous || previous.groupKey !== group.key,
      groupKey: group.key,
      groupLabel: group.label,
    });

    cursor = nextCursor;
  }

  return cells;
}

function buildHeaderGroups(cells: TimelineCell[]): TimelineHeaderGroup[] {
  if (cells.length === 0) return [];

  const groups: TimelineHeaderGroup[] = [];
  let groupStart = 0;
  let groupKey = cells[0].groupKey;

  for (let index = 1; index <= cells.length; index += 1) {
    const cell = cells[index];
    const nextKey = cell?.groupKey ?? null;
    if (nextKey === groupKey) continue;

    groups.push({
      key: groupKey,
      label: cells[groupStart].groupLabel,
      startOffset: groupStart,
      span: index - groupStart,
    });

    groupStart = index;
    groupKey = nextKey ?? groupKey;
  }

  return groups;
}

function buildTimelineBar(cells: TimelineCell[], start: Date, end: Date) {
  let visibleStartOffset = -1;
  let visibleEndOffset = -1;

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    if (visibleStartOffset < 0 && cell.end.getTime() >= start.getTime()) {
      visibleStartOffset = index;
    }
    if (cell.start.getTime() <= end.getTime()) {
      visibleEndOffset = index;
    }
  }

  if (visibleStartOffset < 0 || visibleEndOffset < 0 || visibleStartOffset > visibleEndOffset) {
    return null;
  }

  return {
    start,
    end,
    visibleStartOffset,
    visibleEndOffset,
  } satisfies TimelineBar;
}

function buildTimelineMarker(cells: TimelineCell[], date: Date, kind: TimelineMarker["kind"]) {
  const visibleOffset = cells.findIndex((cell) => cell.start.getTime() <= date.getTime() && cell.end.getTime() >= date.getTime());
  if (visibleOffset < 0) return null;

  return {
    date,
    visibleOffset,
    kind,
  } satisfies TimelineMarker;
}

export function TaskGantt({
  tasks,
  statuses,
  allowedStatusIdsByIssueType = {},
  transitionsByIssueType = {},
  onUpdate,
  onSelect,
  onCommentClick,
  onContextMenu,
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
  displayRangeStart,
  displayRangeEnd,
  displayUnit = "day",
  isFullscreen = false,
  projectMembersByProjectId,
  highlightQuery,
  stickyTopOffset = 0,
}: TaskGanttProps) {
  const { messages } = useI18n();
  const dragHandleLabel = messages.taskCommon.dragHandleLabel;
  const rootDropHint = messages.taskCommon.rootDropHint;
  const expandLabel = messages.taskCommon.expandLabel;
  const collapseLabel = messages.taskCommon.collapseLabel;
  const containerRef = useRef<HTMLDivElement>(null);
  const leftHeaderScrollRef = useRef<HTMLDivElement>(null);
  const leftBodyScrollViewportRef = useRef<HTMLDivElement>(null);
  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightHeaderScrollRef = useRef<HTMLDivElement>(null);
  const rightBodyScrollViewportRef = useRef<HTMLDivElement>(null);
  const rightBodyRef = useRef<HTMLDivElement>(null);
  const isSyncingVerticalScrollRef = useRef(false);
  const isSyncingLeftHorizontalScrollRef = useRef(false);
  const isSyncingRightHorizontalScrollRef = useRef(false);
  const editableTriggerClassName = "p-0.5 hover:border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]";
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [paneRatio, setPaneRatio] = useState(0.5);
  const [paneResizeState, setPaneResizeState] = useState<PaneResizeState | null>(null);
  const [columnResizeState, setColumnResizeState] = useState<{ column: TaskColumnKey; originClientX: number; originWidth: number } | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const {
    draggingId: parentingDraggingId,
    dropTargetId: parentingDropTargetId,
    showRootDropHint: parentingShowRootDropHint,
    rowProps: parentingRowProps,
    containerProps: parentingContainerProps,
    shouldSuppressClick: parentingShouldSuppressClick,
    notifyDragEnded: parentingNotifyDragEnded,
  } = useParentingDragHandlers(tasks, onUpdate);

  const childCountByParentId = useMemo(() => {
    if (allChildCountById) return allChildCountById;
    const next = new Map<string, number>();
    for (const task of tasks) {
      if (!task.parentId) continue;
      next.set(task.parentId, (next.get(task.parentId) ?? 0) + 1);
    }
    return next;
  }, [allChildCountById, tasks]);

  const previewSchedule = useMemo(() => {
    if (!dragState) return null;
    return {
      taskId: dragState.taskId,
      start: dragState.previewStart,
      end: dragState.previewEnd,
    };
  }, [dragState]);

  const taskScheduleById = useMemo(() => {
    const next = new Map<string, TaskSchedule>();

    for (const task of tasks) {
      const start =
        previewSchedule?.taskId === task.id
          ? previewSchedule.start
          : task.startDate
            ? startOfDay(parseDateOnly(task.startDate))
            : null;
      const end =
        previewSchedule?.taskId === task.id
          ? previewSchedule.end
          : task.dueDate
            ? startOfDay(parseDateOnly(task.dueDate))
            : null;

      next.set(task.id, {
        start,
        end: start && end && end.getTime() >= start.getTime() ? end : start && end ? start : end,
      });
    }

    return next;
  }, [tasks, previewSchedule]);

  const timeline = useMemo(() => {
    const explicitStart = displayRangeStart ? startOfDay(parseDateOnly(displayRangeStart)) : null;
    const explicitEnd = displayRangeEnd ? startOfDay(parseDateOnly(displayRangeEnd)) : null;

    if (!explicitStart || !explicitEnd) return null;

    const rawRangeStart = explicitStart.getTime() <= explicitEnd.getTime() ? explicitStart : explicitEnd;
    const rawRangeEnd = explicitEnd.getTime() >= explicitStart.getTime() ? explicitEnd : explicitStart;
    const rangeStart = resolveTimelineRangeStart(rawRangeStart, displayUnit);
    const rangeEnd = resolveTimelineRangeEnd(rawRangeEnd, displayUnit);
    const today = startOfDay(new Date());
    const cells = buildTimelineCells(rangeStart, rangeEnd, today, displayUnit);
    const unitWidth = resolveTimelineUnitWidth(displayUnit, cells.length);
    const headerGroups = buildHeaderGroups(cells);
    const bars = new Map<string, TimelineBar>();
    const markers = new Map<string, TimelineMarker>();

    for (const task of tasks) {
      const schedule = taskScheduleById.get(task.id);
      if (!schedule) continue;

      if (schedule.start && schedule.end) {
        const bar = buildTimelineBar(cells, schedule.start, schedule.end);
        if (bar) bars.set(task.id, bar);
        continue;
      }

      if (schedule.start) {
        const marker = buildTimelineMarker(cells, schedule.start, "start-only");
        if (marker) markers.set(task.id, marker);
        continue;
      }

      if (schedule.end) {
        const marker = buildTimelineMarker(cells, schedule.end, "end-only");
        if (marker) markers.set(task.id, marker);
      }
    }

    const todayOffset = cells.findIndex((cell) => cell.isCurrent);

    return {
      rangeStart,
      rangeEnd,
      totalUnits: cells.length,
      unitWidth,
      chartWidth: cells.length * unitWidth,
      cells,
      headerGroups,
      bars,
      markers,
      todayOffset: todayOffset >= 0 ? todayOffset : null,
    };
  }, [displayRangeStart, displayRangeEnd, displayUnit, taskScheduleById, tasks]);

  useEffect(() => {
    if (!dragState || !timeline) return;

    const handlePointerMove = (event: PointerEvent) => {
      setDragState((current) => {
        if (!current) return null;

        const viewportWidth = rightBodyScrollViewportRef.current?.clientWidth ?? timeline.chartWidth;
        const unitPixelWidth = Math.max(1, viewportWidth / Math.max(1, timeline.totalUnits));
        const deltaUnits = Math.round((event.clientX - current.originClientX) / unitPixelWidth);
        if (deltaUnits === 0) return current;

        if (current.mode === "move") {
          return {
            ...current,
            previewStart: shiftDateByUnit(current.originalStart, displayUnit, deltaUnits),
            previewEnd: shiftDateByUnit(current.originalEnd, displayUnit, deltaUnits),
          };
        }

        if (current.mode === "resize-start") {
          const nextStart = shiftDateByUnit(current.originalStart, displayUnit, deltaUnits);
          return {
            ...current,
            previewStart: nextStart.getTime() <= current.originalEnd.getTime() ? nextStart : current.originalEnd,
            previewEnd: current.originalEnd,
          };
        }

        const nextEnd = shiftDateByUnit(current.originalEnd, displayUnit, deltaUnits);
        return {
          ...current,
          previewStart: current.originalStart,
          previewEnd: nextEnd.getTime() >= current.originalStart.getTime() ? nextEnd : current.originalStart,
        };
      });
    };

    const handlePointerUp = () => {
      setDragState((current) => {
        if (
          current &&
          (
            current.previewStart.getTime() !== current.originalStart.getTime() ||
            current.previewEnd.getTime() !== current.originalEnd.getTime()
          )
        ) {
          onUpdate?.(current.taskId, {
            startDate: toDateInputValue(current.previewStart),
            dueDate: toDateInputValue(current.previewEnd),
          });
        }

        return null;
      });
      parentingNotifyDragEnded();
    };

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [displayUnit, dragState, onUpdate, parentingNotifyDragEnded, timeline]);

  useEffect(() => {
    if (!paneResizeState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;

      const deltaRatio = (event.clientX - paneResizeState.originClientX) / rect.width;
      const nextRatio = Math.min(0.75, Math.max(0.25, paneResizeState.originRatio + deltaRatio));
      setPaneRatio(nextRatio);
    };

    const handlePointerUp = () => {
      setPaneResizeState(null);
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
  }, [paneResizeState]);

  useEffect(() => {
    if (!columnResizeState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = Math.max(
        MIN_COLUMN_WIDTH,
        columnResizeState.originWidth + event.clientX - columnResizeState.originClientX
      );
      onColumnWidthChange?.(columnResizeState.column, nextWidth);
    };

    const handlePointerUp = () => {
      setColumnResizeState(null);
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
  }, [columnResizeState, onColumnWidthChange]);

  useEffect(() => {
    if (leftHeaderScrollRef.current && leftBodyScrollViewportRef.current) {
      leftHeaderScrollRef.current.scrollLeft = leftBodyScrollViewportRef.current.scrollLeft;
    }

    if (rightHeaderScrollRef.current && rightBodyScrollViewportRef.current) {
      rightHeaderScrollRef.current.scrollLeft = rightBodyScrollViewportRef.current.scrollLeft;
    }
  }, [columnWidths, fieldVisibility, paneRatio, timeline?.chartWidth]);

  if (tasks.length === 0) {
    return (
      <TaskEmptyState
        title={messages.taskViews.emptyTitle}
        description={messages.taskViews.emptyDescription}
        className="py-14"
      />
    );
  }

  if (!timeline) {
    return (
      <TaskEmptyState
        title={messages.taskWorkspace.displayRange}
        description={messages.taskWorkspace.currentRange}
        className="py-14"
      />
    );
  }

  const getStatusOptionsForTask = (task: WorkItemWithRelations) =>
    getAllowedTransitionTargets(
      task.issueTypeId,
      task.statusId,
      getAllowedStatusesForIssueType(task.issueTypeId, statuses, allowedStatusIdsByIssueType),
      transitionsByIssueType,
    ).map((status) => ({ value: status.id, label: status.name, color: status.color }));
  const columns: GanttGridColumn[] = [
    ...(fieldVisibility?.issueKey === false ? [] : [{ key: "issueKey" as TaskColumnKey, label: messages.taskWorkspace.fieldLabels.issueKey, width: columnWidths?.issueKey ?? 108 }]),
    { key: "title" as TaskColumnKey, label: messages.taskWorkspace.filterFields.title, width: columnWidths?.title ?? 320 },
    ...(fieldVisibility?.issueType === false ? [] : [{ key: "issueType" as TaskColumnKey, label: messages.taskWorkspace.fieldLabels.issueType, width: columnWidths?.issueType ?? 120 }]),
    ...(fieldVisibility?.status === false ? [] : [{ key: "status" as TaskColumnKey, label: messages.taskWorkspace.fieldLabels.status, width: columnWidths?.status ?? 132 }]),
    ...(fieldVisibility?.assignee === false ? [] : [{ key: "assignee" as TaskColumnKey, label: messages.taskWorkspace.fieldLabels.assignee, width: columnWidths?.assignee ?? 120 }]),
    ...(fieldVisibility?.startDate === false ? [] : [{ key: "startDate" as TaskColumnKey, label: messages.taskWorkspace.fieldLabels.startDate, width: columnWidths?.startDate ?? 168 }]),
    ...(fieldVisibility?.dueDate === false ? [] : [{ key: "dueDate" as TaskColumnKey, label: messages.taskWorkspace.fieldLabels.dueDate, width: columnWidths?.dueDate ?? 168 }]),
    ...(fieldVisibility?.createdAt === false ? [] : [{ key: "createdAt" as TaskColumnKey, label: messages.taskWorkspace.fieldLabels.createdAt, width: columnWidths?.createdAt ?? 132 }]),
    ...(fieldVisibility?.updatedAt === false ? [] : [{ key: "updatedAt" as TaskColumnKey, label: messages.taskWorkspace.fieldLabels.updatedAt, width: columnWidths?.updatedAt ?? 132 }]),
    ...(fieldVisibility?.childCount === false ? [] : [{ key: "childCount" as TaskColumnKey, label: messages.taskWorkspace.fieldLabels.childCount, width: columnWidths?.childCount ?? 88 }]),
    ...(fieldVisibility?.commentCount === false ? [] : [{ key: "commentCount" as TaskColumnKey, label: messages.taskWorkspace.fieldLabels.commentCount, width: columnWidths?.commentCount ?? 90 }]),
  ];

  const leftWidth = GANTT_DRAG_HANDLE_WIDTH + columns.reduce((sum, column) => sum + column.width, 0);
  const leftGridStyle = { gridTemplateColumns: [`${GANTT_DRAG_HANDLE_WIDTH}px`, ...columns.map((column) => `${column.width}px`)].join(" ") };
  const leftContentStyle = { width: `${leftWidth}px` };
  const rightContentStyle = { minWidth: "100%", width: "100%" };
  const timelineGridStyle = { gridTemplateColumns: `repeat(${timeline.totalUnits}, minmax(0, 1fr))` };
  const timelineUnitPercent = 100 / Math.max(1, timeline.totalUnits);
  const bodyRowsHeight = tasks.length * ROW_HEIGHT;
  const bodyViewportStyle = isFullscreen ? undefined : { height: `${bodyRowsHeight}px` };
  const bodyScrollViewportClassName = cn(
    "min-w-0 overscroll-x-contain",
    isFullscreen ? "min-h-0 flex-1 overflow-auto" : "shrink-0 overflow-x-auto overflow-y-hidden"
  );
  const bodyScrollClassName = isFullscreen
    ? "min-h-full overflow-x-hidden"
    : "overflow-y-hidden overflow-x-hidden";
  const taskGanttRootClassName = cn(
    "flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)]",
    isFullscreen ? "h-full min-h-0" : "min-h-full"
  );
  const taskGanttMainClassName = cn(
    "flex min-h-0",
    isFullscreen ? "flex-1" : "flex-none"
  );
  const rangeHeaderStyle = isFullscreen ? undefined : { top: `${stickyTopOffset}px`, height: `${RANGE_HEADER_HEIGHT}px` };
  const stickyHeaderStyle = { top: `${stickyTopOffset + (isFullscreen ? 0 : RANGE_HEADER_HEIGHT)}px` };
  const todayLineStyle =
    timeline.todayOffset === null
      ? null
      : { left: `${(timeline.todayOffset + 0.5) * timelineUnitPercent}%` };

  const syncScroll = (lockRef: MutableRefObject<boolean>, callback: () => void) => {
    if (lockRef.current) return;
    lockRef.current = true;
    callback();
    requestAnimationFrame(() => {
      lockRef.current = false;
    });
  };

  const handleLeftBodyScroll = () => {
    if (!leftBodyRef.current || !rightBodyRef.current) return;
    syncScroll(isSyncingVerticalScrollRef, () => {
      rightBodyRef.current!.scrollTop = leftBodyRef.current!.scrollTop;
    });
  };

  const handleRightBodyScroll = () => {
    if (!leftBodyRef.current || !rightBodyRef.current) return;
    syncScroll(isSyncingVerticalScrollRef, () => {
      leftBodyRef.current!.scrollTop = rightBodyRef.current!.scrollTop;
    });
  };

  const handleLeftBodyViewportScroll = () => {
    if (!leftHeaderScrollRef.current || !leftBodyScrollViewportRef.current) return;
    syncScroll(isSyncingLeftHorizontalScrollRef, () => {
      leftHeaderScrollRef.current!.scrollLeft = leftBodyScrollViewportRef.current!.scrollLeft;
    });
    if (isFullscreen && rightBodyScrollViewportRef.current) {
      syncScroll(isSyncingVerticalScrollRef, () => {
        rightBodyScrollViewportRef.current!.scrollTop = leftBodyScrollViewportRef.current!.scrollTop;
      });
    }
  };

  const handleRightBodyViewportScroll = () => {
    if (!rightHeaderScrollRef.current || !rightBodyScrollViewportRef.current) return;
    syncScroll(isSyncingRightHorizontalScrollRef, () => {
      rightHeaderScrollRef.current!.scrollLeft = rightBodyScrollViewportRef.current!.scrollLeft;
    });
    if (isFullscreen && leftBodyScrollViewportRef.current) {
      syncScroll(isSyncingVerticalScrollRef, () => {
        leftBodyScrollViewportRef.current!.scrollTop = rightBodyScrollViewportRef.current!.scrollTop;
      });
    }
  };

  const startDrag = (
    event: React.PointerEvent,
    task: WorkItemWithRelations,
    mode: DragState["mode"],
    schedule: TaskSchedule
  ) => {
    if (!schedule.start || !schedule.end) return;
    event.stopPropagation();
    event.preventDefault();
    setDragState({
      taskId: task.id,
      mode,
      originClientX: event.clientX,
      originalStart: schedule.start,
      originalEnd: schedule.end,
      previewStart: schedule.start,
      previewEnd: schedule.end,
    });
  };

  const startPaneResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setPaneResizeState({
      originClientX: event.clientX,
      originRatio: paneRatio,
    });
  };

  const startColumnResize = (event: React.PointerEvent<HTMLButtonElement>, column: TaskColumnKey, width: number) => {
    event.preventDefault();
    event.stopPropagation();
    setColumnResizeState({
      column,
      originClientX: event.clientX,
      originWidth: width,
    });
  };

  return (
    <div
      className={taskGanttRootClassName}
      data-task-gantt-root="true"
      data-fullscreen={isFullscreen ? "true" : "false"}
    >
      <div
        className={cn(
          "z-30 flex min-h-8 items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]",
          !isFullscreen && "sticky"
        )}
        style={rangeHeaderStyle}
        data-task-gantt-range-header="true"
      >
        <span className="min-w-0 truncate" title={`${messages.taskWorkspace.displayRange}: ${displayRangeStart} ~ ${displayRangeEnd}`}>
          {messages.taskWorkspace.displayRange}: {displayRangeStart} ~ {displayRangeEnd}
        </span>
        <span className="hidden shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-0.5 font-medium text-[var(--color-text-secondary)] md:inline-flex">
          {messages.taskWorkspace.ganttUnits[displayUnit]} · {timeline.totalUnits}
        </span>
      </div>

      <div ref={containerRef} className={taskGanttMainClassName} data-task-gantt-main="true">
        <div className="flex min-w-0 flex-none flex-col border-r border-[var(--color-border)]" style={{ width: `${paneRatio * 100}%` }}>
          <div
            ref={leftHeaderScrollRef}
            className="sticky z-20 overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            style={stickyHeaderStyle}
            data-task-gantt-sticky-shell="true"
            data-task-gantt-left-header="true"
          >
            <div className="h-full min-h-0" style={leftContentStyle}>
                <div className="grid items-center" style={{ ...leftGridStyle, height: `${HEADER_PRIMARY_HEIGHT}px` }}>
                  <div aria-hidden="true" className="h-full" />
                  {columns.map((column) => (
                    <div key={column.key} className="relative h-full px-2.5 text-[length:var(--text-3xs)] font-semibold text-[var(--color-text-secondary)]">
                      <div className="flex h-full items-center truncate pr-3">
                        {column.label}
                      </div>
                      <button
                        type="button"
                        aria-label={`${column.label} resize`}
                        className="absolute inset-y-0 right-0 w-3 cursor-col-resize touch-none"
                        onPointerDown={(event) => startColumnResize(event, column.key, column.width)}
                      >
                        <span className="absolute inset-y-2 right-1 w-px bg-[var(--color-border)]" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center border-t border-[var(--color-border)] px-2.5 text-[length:var(--text-3xs)] text-[var(--color-text-secondary)]" style={{ height: `${HEADER_SECONDARY_HEIGHT}px` }}>
                  {messages.taskCalendar.range}
                </div>
              </div>
          </div>

          <div
            ref={leftBodyScrollViewportRef}
            onScroll={handleLeftBodyViewportScroll}
            className={cn(
              bodyScrollViewportClassName,
              "transition-all",
              parentingShowRootDropHint && "outline outline-2 outline-dashed outline-[var(--color-accent)] outline-offset-[-2px] bg-[var(--color-accent-light)]/10"
            )}
            data-task-gantt-left-body-scroll="true"
            {...parentingContainerProps()}
          >
            {parentingShowRootDropHint && (
              <div className="py-1 text-center text-[length:var(--text-2xs)] font-medium text-[var(--color-accent)] animate-pulse pointer-events-none">
                {rootDropHint}
              </div>
            )}
            <div style={leftContentStyle}>
              <div
                ref={leftBodyRef}
                onScroll={handleLeftBodyScroll}
                className={bodyScrollClassName}
                style={bodyViewportStyle}
              >
              {tasks.map((task) => {
                const depth = splitHierarchy ? 0 : (hierarchyDepthById?.get(task.id) ?? 0);
                const hasChildren = !splitHierarchy && !!hasChildrenIds?.has(task.id);
                const childCount = childCountByParentId.get(task.id) ?? 0;
                const childProgress = childProgressById?.get(task.id) ?? { done: 0, total: childCount };
                const assigneeOptions = [
                  { value: "", label: "Unassigned" },
                  ...((projectMembersByProjectId?.get(task.projectId ?? "") ?? []).map((member) => ({
                    value: member.id,
                    label: member.name,
                  }))),
                ];
                const isParentingDragging = parentingDraggingId === task.id;
                const isParentingDropTarget = parentingDropTargetId === task.id;
                const {
                  onDragStart: handleRowDragStart,
                  onDragEnd: handleRowDragEnd,
                  onDragOver: handleRowDragOver,
                  onDragLeave: handleRowDragLeave,
                  onDrop: handleRowDrop,
                } = parentingRowProps(task.id);

                return (
                  <div
                    key={`${task.id}-grid`}
                    className={cn(
                      "grid border-b border-[var(--color-border)] transition-colors duration-100",
                      isParentingDragging && "opacity-40",
                      isParentingDropTarget && "outline outline-2 outline-[var(--color-accent)] bg-[var(--color-accent-light)]"
                    )}
                    style={{
                      ...leftGridStyle,
                      height: `${ROW_HEIGHT}px`,
                      backgroundColor: hoveredTaskId === task.id ? "var(--color-bg-hover)" : "var(--color-bg-primary)",
                    }}
                    onClick={() => { if (parentingShouldSuppressClick()) return; onSelect?.(task); }}
                    onContextMenu={(e) => onContextMenu?.(task, e)}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    onDragOver={handleRowDragOver}
                    onDragLeave={handleRowDragLeave}
                    onDrop={handleRowDrop}
                  >
                    <div className="flex h-full items-center justify-center">
                      <span
                        draggable
                        role="button"
                        aria-label={dragHandleLabel}
                        aria-roledescription="draggable"
                        onDragStart={handleRowDragStart}
                        onDragEnd={handleRowDragEnd}
                        className={cn(
                          "inline-flex h-full w-full items-center justify-center text-[length:var(--text-3xs)] leading-none text-[var(--color-text-tertiary)] transition-colors",
                          isParentingDragging ? "cursor-grabbing" : "cursor-grab hover:text-[var(--color-text-primary)]"
                        )}
                      >
                        <DragHandleIcon className="h-4 w-4" />
                      </span>
                    </div>
                    {columns.map((column) => (
                      <div key={column.key} className="flex h-full min-w-0 items-center overflow-hidden px-2.5 py-0 text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                        {column.key === "issueKey" && (
                          <span className="truncate whitespace-nowrap text-[length:var(--text-2xs)] font-medium text-[var(--color-text-tertiary)]">{task.issueKey}</span>
                        )}
                        {column.key === "title" && (
                          <div
                            style={{ paddingLeft: `${depth * 0.55}rem` }}
                            className="flex h-full min-w-0 items-center gap-1.5 overflow-hidden"
                          >
                            {!splitHierarchy && (
                              <div className="shrink-0 flex items-center gap-1.5">
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
                                <span aria-hidden="true" className="flex w-2.5 justify-center text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                                  {depth > 0 ? "-" : ""}
                                </span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelect?.(task);
                              }}
                              className="block min-w-0 truncate text-left text-[length:var(--text-xs)] leading-4 text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                            >
                              <span className="truncate">
                                <TaskTitleHighlight text={task.title} query={highlightQuery} />
                              </span>
                            </button>
                          </div>
                        )}
                        {column.key === "issueType" && (
                          <Badge color={task.issueType.color ?? undefined} className="shrink-0 whitespace-nowrap px-2 py-0.5 text-[length:var(--text-2xs)]">{task.issueType.name}</Badge>
                        )}
                        {column.key === "status" && (
                          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                            <Combobox
                              options={getStatusOptionsForTask(task)}
                              value={task.statusId}
                              onChange={(statusId) => onUpdate?.(task.id, { statusId })}
                              triggerClassName={editableTriggerClassName}
                              renderTrigger={(option) => (
                                <Badge color={option?.color ?? task.status.color} className="shrink-0 whitespace-nowrap px-2 py-0.5 text-[length:var(--text-2xs)]">
                                  {option?.label ?? task.status.name}
                                </Badge>
                              )}
                            />
                          </div>
                        )}
                        {column.key === "assignee" && (
                          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                            <Combobox
                              options={assigneeOptions}
                              value={task.assignee?.id ?? ""}
                              onChange={(assigneeId) => onUpdate?.(task.id, { assigneeId })}
                              dropdownWidth="w-64"
                              triggerClassName={editableTriggerClassName}
                              renderTrigger={(option) => (
                                <span className="inline-flex max-w-full px-1.5 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]">
                                  <span className="truncate">{option?.label ?? task.assignee?.name ?? "Unassigned"}</span>
                                </span>
                              )}
                            />
                          </div>
                        )}
                        {column.key === "startDate" && (
                          <TaskInlineDateEditor
                            value={task.startDate ? toDateInputValue(task.startDate) : null}
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
                        )}
                        {column.key === "dueDate" && (
                          <TaskInlineDateEditor
                            value={task.dueDate ? toDateInputValue(task.dueDate) : null}
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
                        )}
                        {column.key === "createdAt" && (
                          <DateDisplay date={task.createdAt} format="compact" className="truncate whitespace-nowrap text-xs text-[var(--color-text-tertiary)]" />
                        )}
                        {column.key === "updatedAt" && (
                          <DateDisplay date={task.updatedAt} format="compact" className="truncate whitespace-nowrap text-xs text-[var(--color-text-tertiary)]" />
                        )}
                        {column.key === "childCount" && childCount > 0 && (
                          <span className="inline-flex min-w-6 justify-center rounded-full bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-xs tabular-nums text-[var(--color-text-tertiary)]">
                            {childCount}
                          </span>
                        )}
                        {column.key === "commentCount" && (
                          <TaskCommentCountButton
                            count={task.commentCount ?? task.comments?.length ?? 0}
                            onClick={() => onCommentClick?.(task)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize gantt panes"
          onPointerDown={startPaneResize}
          className="group relative z-10 w-3 shrink-0 cursor-col-resize bg-[var(--color-bg-secondary)]"
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--color-border)] transition-colors group-hover:bg-[var(--color-accent)]" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={rightHeaderScrollRef}
            className="sticky z-20 overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            style={stickyHeaderStyle}
            data-task-gantt-sticky-shell="true"
            data-task-gantt-right-header="true"
          >
            <div className="relative h-full min-h-0" style={rightContentStyle}>
                  <div className="grid border-b border-[var(--color-border)]" style={{ ...timelineGridStyle, height: `${HEADER_PRIMARY_HEIGHT}px` }}>
                    {timeline.headerGroups.map((group) => (
                      <div
                        key={group.key}
                        className="flex items-center border-l border-[var(--color-border)] px-2 text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]"
                        style={{ gridColumn: `${group.startOffset + 1} / span ${group.span}` }}
                      >
                        {group.label}
                      </div>
                    ))}
                  </div>

                  <div className="grid" style={{ ...timelineGridStyle, height: `${HEADER_SECONDARY_HEIGHT}px` }}>
                    {timeline.cells.map((cell) => (
                      <div
                        key={cell.key}
                        className={cn(
                          "flex flex-col items-center justify-center gap-0.5 border-l px-1 text-center text-[length:var(--text-3xs)] text-[var(--color-text-secondary)]",
                          cell.isWeekend && "bg-[var(--color-bg-tertiary)]/45",
                          cell.isGroupStart && "border-l-2 border-l-[var(--color-border)]",
                          !cell.isGroupStart && "border-l-[var(--color-border)]",
                          cell.isCurrent && "bg-[var(--color-accent)]/8 text-[var(--color-text-primary)]"
                        )}
                      >
                        <span className="font-semibold">{cell.label}</span>
                        <span>{cell.sublabel}</span>
                      </div>
                    ))}
                  </div>

                  {todayLineStyle && (
                    <div className="pointer-events-none absolute inset-y-0 w-px bg-[var(--color-accent)]/70" style={todayLineStyle} />
                  )}
                </div>
          </div>

          <div
            ref={rightBodyScrollViewportRef}
            onScroll={handleRightBodyViewportScroll}
            className={bodyScrollViewportClassName}
            data-task-gantt-right-body-scroll="true"
          >
            <div className="relative" style={rightContentStyle}>
              <div
                ref={rightBodyRef}
                onScroll={handleRightBodyScroll}
                className={bodyScrollClassName}
                style={bodyViewportStyle}
              >
                <div className="relative">
                  {todayLineStyle && (
                    <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[var(--color-accent)]/70" style={todayLineStyle} />
                  )}

                  {tasks.map((task) => {
                    const bar = timeline.bars.get(task.id);
                    const marker = timeline.markers.get(task.id);
                    const schedule = taskScheduleById.get(task.id) ?? { start: null, end: null };
                    const visibleUnits = bar ? (bar.visibleEndOffset - bar.visibleStartOffset + 1) : 0;
                    const visibleWidth = visibleUnits * timeline.unitWidth;
                    const barLeftPercent = bar ? bar.visibleStartOffset * timelineUnitPercent : 0;
                    const barWidthPercent = bar ? visibleUnits * timelineUnitPercent : 0;
                    const markerLeftPercent = marker ? (marker.visibleOffset + 0.5) * timelineUnitPercent : 0;
                    const barLabel = bar && visibleWidth >= 88 ? task.title : "";

                    return (
                      <Fragment key={`${task.id}-chart`}>
                        <div
                          className="relative border-b border-[var(--color-border)] transition-colors duration-100"
                          style={{
                            height: `${ROW_HEIGHT}px`,
                            backgroundColor: hoveredTaskId === task.id ? "var(--color-bg-hover)" : "var(--color-bg-primary)",
                          }}
                          onClick={() => { if (parentingShouldSuppressClick()) return; onSelect?.(task); }}
                          onContextMenu={(e) => onContextMenu?.(task, e)}
                          onMouseEnter={() => setHoveredTaskId(task.id)}
                          onMouseLeave={() => setHoveredTaskId(null)}
                          title={
                            bar
                              ? `${task.title} · ${formatDate(bar.start, "date")} ~ ${formatDate(bar.end, "date")}`
                              : marker
                                ? `${task.title} · ${marker.kind === "start-only" ? messages.taskCalendar.startDate : messages.taskCalendar.dueDate} ${formatDate(marker.date, "date")}`
                                : task.title
                          }
                        >
                          <div className="grid h-full" style={timelineGridStyle}>
                            {timeline.cells.map((cell, index) => (
                              <div
                                key={`${task.id}-${cell.key}`}
                                className={cn(
                                  "border-l",
                                  cell.isWeekend && "bg-[var(--color-bg-tertiary)]/35",
                                  cell.isGroupStart && "border-l-2 border-l-[var(--color-border)]",
                                  !cell.isGroupStart && "border-l-[var(--color-border)]/70",
                                  index === 0 && "border-l-0",
                                  cell.isCurrent && "bg-[var(--color-accent)]/8"
                                )}
                              />
                            ))}
                          </div>

                          {bar && (
                            <div
                              className="absolute top-1/2 z-20 -translate-y-1/2"
                              style={{ left: `calc(${barLeftPercent}% + 2px)`, width: `calc(${barWidthPercent}% - 4px)`, minWidth: "12px" }}
                            >
                              <div
                                className="relative flex h-6 items-center rounded-md text-white shadow-sm"
                                style={{ backgroundColor: task.status.color ?? "var(--color-accent)" }}
                              >
                                <button
                                  type="button"
                                  className="absolute left-0 top-0 h-full w-3 cursor-ew-resize rounded-l-md bg-black/10 hover:bg-black/20"
                                  onPointerDown={(event) => startDrag(event, task, "resize-start", schedule)}
                                  aria-label={messages.taskCalendar.startDate}
                                />
                                <button
                                  type="button"
                                  className="absolute right-0 top-0 h-full w-3 cursor-ew-resize rounded-r-md bg-black/10 hover:bg-black/20"
                                  onPointerDown={(event) => startDrag(event, task, "resize-end", schedule)}
                                  aria-label={messages.taskCalendar.dueDate}
                                />
                                <button
                                  type="button"
                                  className="absolute inset-y-0 left-3 right-3 cursor-grab active:cursor-grabbing"
                                  onPointerDown={(event) => startDrag(event, task, "move", schedule)}
                                  aria-label={messages.taskCalendar.range}
                                />
                                {barLabel && <span className="pointer-events-none mx-auto truncate px-2.5 text-[length:var(--text-3xs)] font-semibold">{barLabel}</span>}
                              </div>
                            </div>
                          )}

                          {!bar && marker && (
                            <div
                              className="absolute top-1/2 z-20 -translate-y-1/2"
                              style={{ left: `${markerLeftPercent}%` }}
                            >
                              <div className="-translate-x-1/2">
                                <div
                                  className={cn(
                                    "h-3.5 w-3.5 border-2 border-white shadow-sm",
                                    marker.kind === "start-only" ? "rotate-45 rounded-[2px]" : "rounded-full"
                                  )}
                                  style={{ backgroundColor: task.status.color ?? "var(--color-accent)" }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
