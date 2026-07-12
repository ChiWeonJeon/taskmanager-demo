"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/date";
import type { LocaleMessages } from "@/lib/i18n/messages";
import {
  addDays,
  addMonths,
  buildRowLayouts,
  buildScheduledTasks,
  buildSections,
  type CalendarDisplayUnit,
  type CalendarRowLane,
  type CalendarRowLayout,
  type CalendarSection,
  dateKey,
  getHiddenEntryCountForDate,
  getLaneForDate,
  isToday,
  startOfDay,
} from "@/components/task/task-calendar-layout";
import {
  WorkItemWithRelations,
  StatusOption,
  IssueTypeOption,
  WorkItemUpdate,
  TaskFieldVisibility,
} from "@/components/task/types";
import { CheckSmallIcon } from "@/components/task/task-icons";

interface TaskCalendarProps {
  tasks: WorkItemWithRelations[];
  statuses: StatusOption[];
  issueTypes: IssueTypeOption[];
  onUpdate?: (id: string, data: WorkItemUpdate) => void;
  onSelect?: (task: WorkItemWithRelations) => void;
  onContextMenu?: (task: WorkItemWithRelations, e: MouseEvent) => void;
  fieldVisibility?: TaskFieldVisibility;
  hierarchyDepthById?: Map<string, number>;
  splitHierarchy?: boolean;
  hasChildrenIds?: Set<string>;
  collapsedIds?: Set<string>;
  onToggleCollapse?: (id: string) => void;
  onCreateTaskAtDate?: (date: string) => void;
  anchorDate?: string;
  onAnchorDateChange?: (date: string) => void;
  onSelectDate?: (date: string) => void;
  displayUnit?: CalendarDisplayUnit;
  isFullscreen?: boolean;
  stickyTopOffset?: number;
}

interface CalendarSectionGridProps {
  section: CalendarSection;
  rowLayouts: CalendarRowLayout[];
  dayLabels: string[];
  displayUnit: CalendarDisplayUnit;
  messages: LocaleMessages;
  visibleEntryLimit: number;
  dragTaskId: string | null;
  dropDateKey: string | null;
  dayCellLabelFormatter: Intl.DateTimeFormat;
  hideWeekdayHeader?: boolean;
  gridFrameClassName?: string;
  onSelectDate: (date: string) => void;
  onSelect?: (task: WorkItemWithRelations) => void;
  onContextMenu?: (task: WorkItemWithRelations, e: MouseEvent) => void;
  onUpdate?: (id: string, data: WorkItemUpdate) => void;
  onCreateTaskAtDate?: (date: string) => void;
  onDragOverCell: (date: string) => void;
  onDragLeaveCell: (date: string) => void;
  onDropTask: (date: string) => void;
  onDragTaskStart: (taskId: string) => void;
  onDragTaskEnd: () => void;
}

function CalendarWeekdayHeader({
  sectionKey,
  dayLabels,
  roundedClassName,
}: {
  sectionKey: string;
  dayLabels: string[];
  roundedClassName: string;
}) {
  return (
    <div className={cn("grid grid-cols-7 gap-px overflow-hidden bg-[var(--color-border)]", roundedClassName)}>
      {dayLabels.map((label, index) => (
        <div
          key={`${sectionKey}-${label}`}
          className={cn(
            "calendar-weekday-label bg-[var(--color-bg-secondary)]",
            index === 0
              ? "text-[var(--color-danger)]"
              : index === 6
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)]"
          )}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function resolveVisibleEntryLimit(displayUnit: CalendarDisplayUnit, isFullscreen: boolean, sectionVariant: CalendarDisplayUnit) {
  // Static fallback — used only when dynamic measurement is unavailable (non-flex-fill sections).
  // For flex-fill sections (month/week with h-full), CalendarSectionGrid overrides
  // this with a ResizeObserver-computed limit that adapts to actual viewport height.
  if (displayUnit === "day") return Number.MAX_SAFE_INTEGER;
  if (displayUnit === "week") return isFullscreen ? 10 : 8;
  if (sectionVariant === "quarter") return isFullscreen ? 4 : 3;
  return isFullscreen ? 8 : 6;
}

function resolveCellVariantClassName(sectionVariant: CalendarDisplayUnit) {
  if (sectionVariant === "day") return "calendar-cell-day";
  if (sectionVariant === "week") return "calendar-cell-week";
  if (sectionVariant === "quarter") return "calendar-cell-quarter";
  return "calendar-cell-month";
}

function getDragUpdatePayload(dateValue: string, taskSchedule: { start: Date | null; end: Date | null }): WorkItemUpdate {
  const targetDate = startOfDay(parseDateOnly(dateValue));

  if (taskSchedule.start && targetDate.getTime() < taskSchedule.start.getTime()) {
    return {
      startDate: dateValue,
      dueDate: dateValue,
    };
  }

  return { dueDate: dateValue };
}

export function TaskCalendar({
  tasks,
  onUpdate,
  onSelect,
  onContextMenu,
  onCreateTaskAtDate,
  anchorDate,
  onAnchorDateChange,
  onSelectDate,
  displayUnit = "month",
  isFullscreen = false,
}: TaskCalendarProps) {
  const { locale, messages } = useI18n();
  const [internalAnchorDate, setInternalAnchorDate] = useState(() => startOfDay(new Date()));
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropState, setDropState] = useState<{ viewKey: string; dateKey: string | null }>({
    viewKey: "",
    dateKey: null,
  });

  const resolvedAnchorDate = useMemo(
    () => (anchorDate ? startOfDay(parseDateOnly(anchorDate)) : internalAnchorDate),
    [anchorDate, internalAnchorDate]
  );

  const dayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const base = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) => formatter.format(addDays(base, index)));
  }, [locale]);

  const dayCellLabelFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", weekday: "long" }),
    [locale]
  );

  const { label: currentLabel, sections } = useMemo(
    () => buildSections(displayUnit, resolvedAnchorDate, locale),
    [displayUnit, locale, resolvedAnchorDate]
  );

  const viewStateKey = `${displayUnit}:${currentLabel}`;
  const dropDateKey = dropState.viewKey === viewStateKey ? dropState.dateKey : null;

  const scheduledTasks = useMemo(() => buildScheduledTasks(tasks), [tasks]);

  const rowLayoutsBySectionKey = useMemo(() => {
    const next = new Map<string, CalendarRowLayout[]>();

    for (const section of sections) {
      next.set(section.key, buildRowLayouts(section, scheduledTasks));
    }

    return next;
  }, [scheduledTasks, sections]);

  const tasksWithDates = useMemo(
    () => scheduledTasks.filter(({ schedule }) => schedule.start || schedule.end).length,
    [scheduledTasks]
  );

  const updateAnchorDate = (nextDate: Date) => {
    const normalized = startOfDay(nextDate);
    if (!anchorDate) {
      setInternalAnchorDate(normalized);
    }
    onAnchorDateChange?.(dateKey(normalized));
  };

  const shiftPeriod = (amount: number) => {
    if (displayUnit === "day") {
      updateAnchorDate(addDays(resolvedAnchorDate, amount));
      return;
    }

    if (displayUnit === "week") {
      updateAnchorDate(addDays(resolvedAnchorDate, amount * 7));
      return;
    }

    if (displayUnit === "month") {
      updateAnchorDate(addMonths(resolvedAnchorDate, amount));
      return;
    }

    updateAnchorDate(addMonths(resolvedAnchorDate, amount * 3));
  };

  const handleCreateTask = (dateValue: string) => {
    if (!onCreateTaskAtDate || dragTaskId) return;
    onCreateTaskAtDate(dateValue);
  };

  const handleSelectDate = (dateValue: string) => {
    if (onSelectDate) {
      onSelectDate(dateValue);
      return;
    }

    updateAnchorDate(parseDateOnly(dateValue));
  };

  const handleDropTask = (targetDateValue: string) => {
    const taskId = dragTaskId;
    setDropState({ viewKey: viewStateKey, dateKey: null });
    setDragTaskId(null);

    if (!taskId || !onUpdate) return;

    const scheduledTask = scheduledTasks.find(({ task }) => task.id === taskId);
    if (!scheduledTask) return;

    onUpdate(taskId, getDragUpdatePayload(targetDateValue, scheduledTask.schedule));
  };

  const emptyState = tasksWithDates === 0
    ? (
        <div className="calendar-empty-state">
          {messages.taskCalendar.empty}
        </div>
      )
    : null;

  const usesSharedWeekdayHeader = displayUnit === "month" || displayUnit === "week";
  const primarySection = usesSharedWeekdayHeader ? sections[0] : null;
  const usesIntrinsicDayHeight = displayUnit === "day" && !isFullscreen;

  const renderSection = (
    section: CalendarSection,
    options?: {
      hideWeekdayHeader?: boolean;
      gridFrameClassName?: string;
    }
  ) => {
    const rowLayouts = rowLayoutsBySectionKey.get(section.key) ?? [];
    const visibleEntryLimit = resolveVisibleEntryLimit(displayUnit, isFullscreen, section.variant);

    return (
      <div key={section.key} className={cn("space-y-1.5", options?.gridFrameClassName?.includes("h-full") && "h-full flex flex-col")}>
        {section.title && (
          <h3 className="calendar-section-title px-1">
            {section.title}
          </h3>
        )}

        <CalendarSectionGrid
          section={section}
          rowLayouts={rowLayouts}
          dayLabels={dayLabels}
          displayUnit={displayUnit}
          messages={messages}
          visibleEntryLimit={visibleEntryLimit}
          dragTaskId={dragTaskId}
          dropDateKey={dropDateKey}
          dayCellLabelFormatter={dayCellLabelFormatter}
          hideWeekdayHeader={options?.hideWeekdayHeader}
          gridFrameClassName={options?.gridFrameClassName}
          onSelectDate={handleSelectDate}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          onUpdate={onUpdate}
          onCreateTaskAtDate={onCreateTaskAtDate ? handleCreateTask : undefined}
          onDragOverCell={(dateValue) => {
            setDropState({ viewKey: viewStateKey, dateKey: dateValue });
          }}
          onDragLeaveCell={(dateValue) => {
            setDropState((current) => {
              if (current.viewKey !== viewStateKey) return current;
              return {
                viewKey: viewStateKey,
                dateKey: current.dateKey === dateValue ? null : current.dateKey,
              };
            });
          }}
          onDropTask={handleDropTask}
          onDragTaskStart={(taskId) => setDragTaskId(taskId)}
          onDragTaskEnd={() => {
            setDragTaskId(null);
            setDropState({ viewKey: viewStateKey, dateKey: null });
          }}
        />
      </div>
    );
  };

  const multiSectionContent = (
    <div className={cn(displayUnit === "quarter" ? "space-y-3 xl:grid xl:grid-cols-3 xl:gap-3 xl:space-y-0" : "space-y-0")}>
      {sections.map((section) => renderSection(section))}
      {emptyState}
    </div>
  );

  return (
    <div
      className={cn(
        "calendar-density-root flex min-h-0 flex-col gap-2",
        usesIntrinsicDayHeight ? "h-auto" : "h-full"
      )}
      data-fullscreen={isFullscreen ? "true" : "false"}
      data-display-unit={displayUnit}
    >
      <div className="calendar-toolbar-surface">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => shiftPeriod(-1)}
            className="calendar-nav-button"
            aria-label="Previous"
          >
            {"<"}
          </button>
          <h2 className="calendar-heading-text min-w-0">
            {currentLabel}
          </h2>
          <button
            type="button"
            onClick={() => shiftPeriod(1)}
            className="calendar-nav-button"
            aria-label="Next"
          >
            {">"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="calendar-legend hidden lg:flex">
            <span className="calendar-legend-item">
              <span className="calendar-legend-dot border-[var(--color-accent)]" />
              {messages.taskCalendar.startDate}
            </span>
            <span className="calendar-legend-item">
              <span className="calendar-legend-dot border-[var(--color-danger)]" />
              {messages.taskCalendar.dueDate}
            </span>
            <span className="calendar-legend-item">
              <span className="calendar-legend-bar" />
              {messages.taskCalendar.range}
            </span>
          </div>

          <button
            type="button"
            onClick={() => updateAnchorDate(new Date())}
            className="calendar-accent-button"
          >
            {messages.common.today}
          </button>
        </div>
      </div>

      {usesSharedWeekdayHeader && primarySection ? (
        <div className="min-h-0 flex flex-1 flex-col">
          <div className="z-20" data-calendar-sticky-header="true">
            <CalendarWeekdayHeader
              sectionKey={primarySection.key}
              dayLabels={dayLabels}
              roundedClassName="rounded-t-[var(--radius-md)]"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {renderSection(primarySection, {
              hideWeekdayHeader: true,
              gridFrameClassName: "overflow-hidden rounded-b-[var(--radius-md)] h-full",
            })}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {multiSectionContent}
        </div>
      )}
    </div>
  );
}

export function CalendarSectionGrid({
  section,
  rowLayouts,
  dayLabels,
  displayUnit,
  messages,
  visibleEntryLimit,
  dragTaskId,
  dropDateKey,
  dayCellLabelFormatter,
  hideWeekdayHeader = false,
  gridFrameClassName,
  onSelectDate,
  onSelect,
  onContextMenu,
  onUpdate,
  onCreateTaskAtDate,
  onDragOverCell,
  onDragLeaveCell,
  onDropTask,
  onDragTaskStart,
  onDragTaskEnd,
}: CalendarSectionGridProps) {
  const cellVariantClassName = resolveCellVariantClassName(section.variant);

  const isFlexFill = gridFrameClassName?.includes("h-full");
  const gridFrameRef = useRef<HTMLDivElement>(null);
  const [dynamicEntryLimit, setDynamicEntryLimit] = useState<number | null>(null);

  const rowCount = rowLayouts.length;

  useEffect(() => {
    const el = gridFrameRef.current;
    if (!el || !isFlexFill || rowCount === 0) {
      return;
    }

    const computeLimit = () => {
      const frameHeight = el.clientHeight;
      if (frameHeight <= 0) return;

      // gap-px between rows → 1px per gap
      const totalRowGap = Math.max(0, rowCount - 1);
      const rowHeight = (frameHeight - totalRowGap) / rowCount;

      // Read CSS custom properties (rem values) and convert to px
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const densityRoot = el.closest(".calendar-density-root") as HTMLElement | null;
      const densityStyle = densityRoot ? getComputedStyle(densityRoot) : getComputedStyle(el);

      const entryHeightRaw = densityStyle.getPropertyValue("--calendar-entry-height").trim();
      const stackGapRaw = densityStyle.getPropertyValue("--calendar-stack-gap").trim();

      const parseCssLength = (raw: string, fallbackPx: number): number => {
        const val = parseFloat(raw);
        if (Number.isNaN(val)) return fallbackPx;
        if (raw.includes("rem")) return val * rootFontSize;
        return val; // px or unitless
      };

      const entryHeight = parseCssLength(entryHeightRaw, 16);
      const stackGap = parseCssLength(stackGapRaw, 2);

      // Estimate header height: date button (~entryHeight) + cell-header padding (1px top + 4px bottom)
      const headerHeight = entryHeight + 5;
      // Entry region bottom padding: 2px
      const regionBottomPad = 2;

      const availableHeight = rowHeight - headerHeight - regionBottomPad;
      if (availableHeight <= 0) {
        setDynamicEntryLimit(1);
        return;
      }

      // n entries fit: n * entryHeight + (n-1) * stackGap <= availableHeight
      // n <= (availableHeight + stackGap) / (entryHeight + stackGap)
      const n = Math.floor((availableHeight + stackGap) / (entryHeight + stackGap));
      setDynamicEntryLimit(Math.max(1, n));
    };

    const observer = new ResizeObserver(computeLimit);
    observer.observe(el);

    return () => observer.disconnect();
  }, [isFlexFill, rowCount]);

  const effectiveEntryLimit = dynamicEntryLimit ?? visibleEntryLimit;

  return (
    <div className={cn("space-y-1.5", isFlexFill && "flex-1 min-h-0 flex flex-col")}>
      {section.columns === 7 && !hideWeekdayHeader && (
        <CalendarWeekdayHeader
          sectionKey={section.key}
          dayLabels={dayLabels}
          roundedClassName="rounded-t-[var(--radius-md)]"
        />
      )}

      <div ref={gridFrameRef} className={cn("flex flex-col gap-px bg-[var(--color-border)]", isFlexFill && "flex-1 min-h-0", gridFrameClassName ?? "overflow-hidden rounded-[var(--radius-md)]")}>
        {rowLayouts.map((rowLayout) => (
          <div
            key={`${section.key}-${rowLayout.rowKey}`}
            className={cn(
              "grid gap-px bg-[var(--color-border)] flex-1 min-h-0",
              section.columns === 7 ? "grid-cols-7" : "grid-cols-1"
            )}
          >
            {rowLayout.cells.map((cell, columnIndex) => (
              <CalendarGridCell
                key={`${section.key}-${dateKey(cell.date)}`}
                cell={cell}
                rowLayout={rowLayout}
                columnIndex={columnIndex}
                displayUnit={displayUnit}
                messages={messages}
                visibleEntryLimit={effectiveEntryLimit}
                dragTaskId={dragTaskId}
                dropDateKey={dropDateKey}
                dayCellLabelFormatter={dayCellLabelFormatter}
                onSelectDate={onSelectDate}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                onUpdate={onUpdate}
                onCreateTaskAtDate={onCreateTaskAtDate}
                onDragOverCell={onDragOverCell}
                onDragLeaveCell={onDragLeaveCell}
                onDropTask={onDropTask}
                onDragTaskStart={onDragTaskStart}
                onDragTaskEnd={onDragTaskEnd}
                cellVariantClassName={cellVariantClassName}
                sectionVariant={section.variant}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarGridCell({
  cell,
  rowLayout,
  columnIndex,
  displayUnit,
  messages,
  visibleEntryLimit,
  dragTaskId,
  dropDateKey,
  dayCellLabelFormatter,
  onSelectDate,
  onSelect,
  onContextMenu,
  onUpdate,
  onCreateTaskAtDate,
  onDragOverCell,
  onDragLeaveCell,
  onDropTask,
  onDragTaskStart,
  onDragTaskEnd,
  cellVariantClassName,
  sectionVariant,
}: {
  cell: CalendarSection["cells"][number];
  rowLayout: CalendarRowLayout;
  columnIndex: number;
  displayUnit: CalendarDisplayUnit;
  messages: LocaleMessages;
  visibleEntryLimit: number;
  dragTaskId: string | null;
  dropDateKey: string | null;
  dayCellLabelFormatter: Intl.DateTimeFormat;
  onSelectDate: (date: string) => void;
  onSelect?: (task: WorkItemWithRelations) => void;
  onContextMenu?: (task: WorkItemWithRelations, e: MouseEvent) => void;
  onUpdate?: (id: string, data: WorkItemUpdate) => void;
  onCreateTaskAtDate?: (date: string) => void;
  onDragOverCell: (date: string) => void;
  onDragLeaveCell: (date: string) => void;
  onDropTask: (date: string) => void;
  onDragTaskStart: (taskId: string) => void;
  onDragTaskEnd: () => void;
  cellVariantClassName: string;
  sectionVariant: CalendarDisplayUnit;
}) {
  const dateValue = dateKey(cell.date);
  const visibleLaneCount = Math.min(rowLayout.laneCount, visibleEntryLimit);
  const visibleLaneIndexes = Array.from({ length: visibleLaneCount }, (_, index) => index);
  const hiddenEntryCount = getHiddenEntryCountForDate(rowLayout, dateValue, visibleEntryLimit);
  const isDropTarget = dropDateKey === dateValue;
  const canCreateAtDate = Boolean(onCreateTaskAtDate && !dragTaskId);
  const handleCellClick = canCreateAtDate
    ? () => {
        onCreateTaskAtDate?.(dateValue);
      }
    : undefined;

  return (
    <div
      className={cn(
        "calendar-day-cell bg-[var(--color-bg-primary)] transition-colors",
        cellVariantClassName,
        !cell.isCurrentMonth && sectionVariant !== "week" && "bg-[var(--color-bg-tertiary)]/80",
        isToday(cell.date) && "ring-1 ring-inset ring-[var(--color-accent)]",
        isDropTarget && "bg-[color-mix(in_srgb,var(--color-accent-light)_82%,var(--color-bg-primary))] ring-2 ring-inset ring-[var(--color-accent)]",
        canCreateAtDate && "cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-bg-hover)_72%,var(--color-bg-primary))]"
      )}
      data-calendar-cell={dateValue}
      data-calendar-variant={sectionVariant}
      onClick={handleCellClick}
      onDragOver={(event) => {
        if (!dragTaskId) return;
        event.preventDefault();
        onDragOverCell(dateValue);
      }}
      onDragLeave={() => onDragLeaveCell(dateValue)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDropTask(dateValue);
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="calendar-cell-header">
          <button
            type="button"
            className={cn(
              "calendar-date-button",
              isToday(cell.date)
                ? "bg-[var(--color-accent)] text-white"
                : cell.date.getDay() === 0
                  ? "text-[var(--color-danger)]"
                  : cell.date.getDay() === 6
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text-secondary)]"
            )}
            data-calendar-date-button={dateValue}
            onClick={(event) => {
              event.stopPropagation();
              if (displayUnit === "day") return;
              onSelectDate(dateValue);
            }}
          >
            <span className="calendar-date-button-label">
              {sectionVariant === "day"
                ? dayCellLabelFormatter.format(cell.date)
                : cell.date.getDate()}
            </span>
          </button>
        </div>

        <div className="calendar-entry-region">
          <div className="calendar-entry-stack" data-calendar-row={rowLayout.rowKey}>
            {visibleLaneIndexes.map((laneIndex) => {
              const lane = getLaneForDate(rowLayout, dateValue, laneIndex);

              return lane ? (
                <CalendarEntryButton
                  key={`${dateValue}-${laneIndex}-${lane.entry.task.id}`}
                  lane={lane}
                  columnIndex={columnIndex}
                  displayUnit={displayUnit}
                  messages={messages}
                  onSelect={onSelect}
                  onContextMenu={onContextMenu}
                  draggable={Boolean(onUpdate)}
                  onDragStart={() => onDragTaskStart(lane.entry.task.id)}
                  onDragEnd={onDragTaskEnd}
                />
              ) : (
                <div
                  key={`${dateValue}-placeholder-${laneIndex}`}
                  className="calendar-entry-placeholder"
                  aria-hidden="true"
                />
              );
            })}

            {hiddenEntryCount > 0 && (
              <button
                type="button"
                className="calendar-more-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectDate(dateValue);
                }}
                title={dateValue}
                aria-label={dateValue}
                data-calendar-overflow={hiddenEntryCount}
              >
                +{hiddenEntryCount} {messages.nav.more}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarEntryButton({
  lane,
  columnIndex,
  displayUnit,
  messages,
  onSelect,
  onContextMenu,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  lane: CalendarRowLane;
  columnIndex: number;
  displayUnit: CalendarDisplayUnit;
  messages: LocaleMessages;
  onSelect?: (task: WorkItemWithRelations) => void;
  onContextMenu?: (task: WorkItemWithRelations, e: MouseEvent) => void;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const task = lane.entry.task;

  if (lane.entry.kind === "range") {
    const isStart = columnIndex === lane.startColumn;
    const isEnd = columnIndex === lane.endColumn;
    const position = isStart && isEnd ? "single" : isStart ? "start" : isEnd ? "end" : "middle";
    const showLabel = displayUnit === "day" || position === "start" || position === "single";

    return (
      <button
        type="button"
        draggable={draggable}
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", task.id);
          onDragStart();
        }}
        onDragEnd={(event) => {
          event.stopPropagation();
          onDragEnd();
        }}
        className={cn(
          "calendar-entry-chip calendar-entry-range text-white",
          draggable && "cursor-grab active:cursor-grabbing",
          position === "start" && "calendar-entry-start calendar-entry-bridge-right",
          position === "middle" && "calendar-entry-middle calendar-entry-bridge-left calendar-entry-bridge-right",
          position === "end" && "calendar-entry-end calendar-entry-bridge-left",
          position === "single" && "calendar-entry-single"
        )}
        style={{ backgroundColor: task.status.color }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(task);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onContextMenu?.(task, event);
        }}
        title={`${task.issueKey} ${task.title}`}
        data-calendar-entry-kind="range"
        data-calendar-lane={lane.laneIndex}
      >
        {showLabel && (
          <span className="calendar-entry-label inline-flex items-center gap-1">
            {task.status.category === "DONE" && (
              <CheckSmallIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{task.title}</span>
          </span>
        )}
      </button>
    );
  }

  const isStartMarker = lane.entry.markerType === "start";
  const markerLabel = isStartMarker ? messages.taskCalendar.startDate : messages.taskCalendar.dueDate;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragEnd={(event) => {
        event.stopPropagation();
        onDragEnd();
      }}
      className={cn(
        "calendar-entry-chip calendar-entry-marker",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(task);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.(task, event);
      }}
      title={`${markerLabel} - ${task.issueKey} ${task.title}`}
      data-calendar-entry-kind="marker"
      data-calendar-lane={lane.laneIndex}
    >
      <span
        className={cn(
          "calendar-marker-dot",
          isStartMarker ? "border-[var(--color-accent)]" : "border-[var(--color-danger)]"
        )}
      />
      <span className="calendar-entry-label inline-flex items-center gap-1 text-[var(--color-text-primary)]">
        {task.status.category === "DONE" && (
          <CheckSmallIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{task.title}</span>
      </span>
    </button>
  );
}
