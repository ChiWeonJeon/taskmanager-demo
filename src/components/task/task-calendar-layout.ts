import { WorkItemWithRelations } from "@/components/task/types";
import { parseDateOnly, toDateInputValue } from "@/lib/date";

export type CalendarDisplayUnit = "day" | "week" | "month" | "quarter";

export interface CalendarCell {
  date: Date;
  isCurrentMonth: boolean;
}

export interface CalendarSection {
  key: string;
  title: string | null;
  cells: CalendarCell[];
  columns: 1 | 7;
  variant: CalendarDisplayUnit;
}

export interface TaskSchedule {
  start: Date | null;
  end: Date | null;
}

export interface CalendarRangeEntry {
  kind: "range";
  task: WorkItemWithRelations;
  start: Date;
  end: Date;
}

export interface CalendarMarkerEntry {
  kind: "marker";
  markerType: "start" | "due";
  task: WorkItemWithRelations;
  date: Date;
}

export type CalendarEntry = CalendarRangeEntry | CalendarMarkerEntry;

export interface ScheduledTask {
  task: WorkItemWithRelations;
  schedule: TaskSchedule;
}

export interface CalendarRowLane {
  laneIndex: number;
  startColumn: number;
  endColumn: number;
  entry: CalendarEntry;
}

export interface CalendarRowLayout {
  rowKey: string;
  cells: CalendarCell[];
  lanes: CalendarRowLane[];
  laneCount: number;
  laneByDateKey: Map<string, Map<number, CalendarRowLane>>;
}

function clampStartEnd(start: Date | null, end: Date | null) {
  if (!start || !end) return { start, end };
  if (start.getTime() <= end.getTime()) return { start, end };
  return { start: end, end: start };
}

export function startOfDay(date: Date) {
  const next = new Date(date.getTime());
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, amount: number) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date: Date) {
  return addDays(date, -startOfDay(date).getDay());
}

export function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function getQuarter(date: Date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), (getQuarter(date) - 1) * 3, 1);
}

export function dateKey(date: Date) {
  return toDateInputValue(date);
}

export function isToday(date: Date) {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export function buildMonthCells(baseDate: Date) {
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(baseDate);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const cells: CalendarCell[] = [];

  let cursor = gridStart;
  while (cursor.getTime() <= monthEnd.getTime() || cells.length % 7 !== 0) {
    cells.push({
      date: cursor,
      isCurrentMonth: cursor.getMonth() === monthStart.getMonth(),
    });
    cursor = addDays(cursor, 1);
  }

  while (cells.length < 35) {
    cells.push({
      date: cursor,
      isCurrentMonth: cursor.getMonth() === monthStart.getMonth(),
    });
    cursor = addDays(cursor, 1);
  }

  return cells;
}

export function buildSections(displayUnit: CalendarDisplayUnit, anchorDate: Date, locale: string) {
  const monthFormatter = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" });
  const monthDayFormatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const dayFormatter = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  if (displayUnit === "day") {
    const currentDay = startOfDay(anchorDate);
    return {
      label: dayFormatter.format(currentDay),
      sections: [{
        key: `day-${dateKey(currentDay)}`,
        title: null,
        cells: [{ date: currentDay, isCurrentMonth: true }],
        columns: 1 as const,
        variant: "day" as const,
      }],
    };
  }

  if (displayUnit === "week") {
    const weekStart = startOfWeek(anchorDate);
    const weekEnd = endOfWeek(anchorDate);
    return {
      label: `${monthDayFormatter.format(weekStart)} - ${monthDayFormatter.format(weekEnd)}`,
      sections: [{
        key: `week-${dateKey(weekStart)}`,
        title: null,
        cells: Array.from({ length: 7 }, (_, index) => ({
          date: addDays(weekStart, index),
          isCurrentMonth: true,
        })),
        columns: 7 as const,
        variant: "week" as const,
      }],
    };
  }

  if (displayUnit === "month") {
    const monthStart = startOfMonth(anchorDate);
    return {
      label: monthFormatter.format(monthStart),
      sections: [{
        key: `month-${monthStart.getFullYear()}-${monthStart.getMonth()}`,
        title: null,
        cells: buildMonthCells(monthStart),
        columns: 7 as const,
        variant: "month" as const,
      }],
    };
  }

  const quarterStart = startOfQuarter(anchorDate);
  const sections = Array.from({ length: 3 }, (_, index) => {
    const monthDate = addMonths(quarterStart, index);
    return {
      key: `quarter-${monthDate.getFullYear()}-${monthDate.getMonth()}`,
      title: monthFormatter.format(monthDate),
      cells: buildMonthCells(monthDate),
      columns: 7 as const,
      variant: "quarter" as const,
    };
  });

  return {
    label: `Q${getQuarter(quarterStart)} ${quarterStart.getFullYear()}`,
    sections,
  };
}

export function getTaskSchedule(task: WorkItemWithRelations): TaskSchedule {
  const directStart = task.startDate ? startOfDay(parseDateOnly(task.startDate)) : null;
  const directEnd = task.dueDate ? startOfDay(parseDateOnly(task.dueDate)) : null;

  if (directStart || directEnd) {
    return clampStartEnd(directStart, directEnd);
  }

  let start: Date | null = null;
  let end: Date | null = null;

  for (const fieldValue of task.fieldValues ?? []) {
    if (!fieldValue.value) continue;

    if (fieldValue.field.key === "start_date") {
      start = startOfDay(parseDateOnly(fieldValue.value));
    }

    if (fieldValue.field.key === "due_date") {
      end = startOfDay(parseDateOnly(fieldValue.value));
    }
  }

  return clampStartEnd(start, end);
}

export function buildScheduledTasks(tasks: WorkItemWithRelations[]): ScheduledTask[] {
  return tasks.map((task) => ({ task, schedule: getTaskSchedule(task) }));
}

function isWithinRow(date: Date, rowStart: Date, rowEnd: Date) {
  const time = date.getTime();
  return time >= rowStart.getTime() && time <= rowEnd.getTime();
}

function compareEntries(left: CalendarEntry, right: CalendarEntry, leftStartColumn: number, rightStartColumn: number, leftEndColumn: number, rightEndColumn: number) {
  if (left.kind !== right.kind) {
    return left.kind === "range" ? -1 : 1;
  }

  if (leftStartColumn !== rightStartColumn) {
    return leftStartColumn - rightStartColumn;
  }

  const leftSpan = leftEndColumn - leftStartColumn;
  const rightSpan = rightEndColumn - rightStartColumn;
  if (leftSpan !== rightSpan) {
    return rightSpan - leftSpan;
  }

  const leftStart = left.kind === "range" ? left.start.getTime() : left.date.getTime();
  const rightStart = right.kind === "range" ? right.start.getTime() : right.date.getTime();
  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return left.task.title.localeCompare(right.task.title);
}

export function groupCellsIntoRows(cells: CalendarCell[], columns: 1 | 7) {
  if (columns === 1) return [cells];

  const rows: CalendarCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return rows;
}

export function buildCalendarRowLayout(cells: CalendarCell[], scheduledTasks: ScheduledTask[]): CalendarRowLayout {
  const rowKey = `${dateKey(cells[0].date)}-${dateKey(cells[cells.length - 1].date)}`;
  const rowStart = startOfDay(cells[0].date);
  const rowEnd = startOfDay(cells[cells.length - 1].date);
  const cellIndexByKey = new Map(cells.map((cell, index) => [dateKey(cell.date), index]));
  const pendingLanes: Array<Omit<CalendarRowLane, "laneIndex">> = [];

  for (const scheduledTask of scheduledTasks) {
    const { task, schedule } = scheduledTask;

    if (schedule.start && schedule.end) {
      if (schedule.end.getTime() < rowStart.getTime() || schedule.start.getTime() > rowEnd.getTime()) {
        continue;
      }

      const clampedStart = schedule.start.getTime() < rowStart.getTime() ? rowStart : schedule.start;
      const clampedEnd = schedule.end.getTime() > rowEnd.getTime() ? rowEnd : schedule.end;
      const startColumn = cellIndexByKey.get(dateKey(clampedStart));
      const endColumn = cellIndexByKey.get(dateKey(clampedEnd));

      if (startColumn === undefined || endColumn === undefined) continue;

      pendingLanes.push({
        startColumn,
        endColumn,
        entry: {
          kind: "range",
          task,
          start: schedule.start,
          end: schedule.end,
        },
      });
      continue;
    }

    if (schedule.start && isWithinRow(schedule.start, rowStart, rowEnd)) {
      const startColumn = cellIndexByKey.get(dateKey(schedule.start));
      if (startColumn !== undefined) {
        pendingLanes.push({
          startColumn,
          endColumn: startColumn,
          entry: {
            kind: "marker",
            markerType: "start",
            task,
            date: schedule.start,
          },
        });
      }
    }

    if (schedule.end && isWithinRow(schedule.end, rowStart, rowEnd)) {
      const endColumn = cellIndexByKey.get(dateKey(schedule.end));
      if (endColumn !== undefined) {
        pendingLanes.push({
          startColumn: endColumn,
          endColumn,
          entry: {
            kind: "marker",
            markerType: "due",
            task,
            date: schedule.end,
          },
        });
      }
    }
  }

  pendingLanes.sort((left, right) => compareEntries(left.entry, right.entry, left.startColumn, right.startColumn, left.endColumn, right.endColumn));

  const laneEndColumns: number[] = [];
  const lanes: CalendarRowLane[] = [];

  for (const pendingLane of pendingLanes) {
    let laneIndex = laneEndColumns.findIndex((endColumn) => pendingLane.startColumn > endColumn);
    if (laneIndex === -1) laneIndex = laneEndColumns.length;

    laneEndColumns[laneIndex] = pendingLane.endColumn;
    lanes.push({
      laneIndex,
      startColumn: pendingLane.startColumn,
      endColumn: pendingLane.endColumn,
      entry: pendingLane.entry,
    });
  }

  const laneByDateKey = new Map<string, Map<number, CalendarRowLane>>();

  for (const lane of lanes) {
    for (let columnIndex = lane.startColumn; columnIndex <= lane.endColumn; columnIndex += 1) {
      const key = dateKey(cells[columnIndex].date);
      const lanesForDate = laneByDateKey.get(key) ?? new Map<number, CalendarRowLane>();
      lanesForDate.set(lane.laneIndex, lane);
      laneByDateKey.set(key, lanesForDate);
    }
  }

  return {
    rowKey,
    cells,
    lanes,
    laneCount: laneEndColumns.length,
    laneByDateKey,
  };
}

export function buildRowLayouts(section: CalendarSection, scheduledTasks: ScheduledTask[]) {
  return groupCellsIntoRows(section.cells, section.columns).map((cells) => buildCalendarRowLayout(cells, scheduledTasks));
}

export function getLaneForDate(rowLayout: CalendarRowLayout, dateValue: string, laneIndex: number) {
  return rowLayout.laneByDateKey.get(dateValue)?.get(laneIndex) ?? null;
}

export function getHiddenEntryCountForDate(rowLayout: CalendarRowLayout, dateValue: string, visibleLaneCount: number) {
  const lanesForDate = rowLayout.laneByDateKey.get(dateValue);
  if (!lanesForDate) return 0;

  let hiddenCount = 0;
  for (const laneIndex of lanesForDate.keys()) {
    if (laneIndex >= visibleLaneCount) hiddenCount += 1;
  }

  return hiddenCount;
}

export function resolveCalendarCellLaneVisibility(
  rowLayout: CalendarRowLayout,
  dateValue: string,
  rowCapacity: number,
) {
  const normalizedCapacity = Math.max(0, Math.floor(rowCapacity));
  const hiddenAtFullCapacity = getHiddenEntryCountForDate(rowLayout, dateValue, normalizedCapacity);
  const visibleLaneCount = Math.min(
    rowLayout.laneCount,
    hiddenAtFullCapacity > 0 ? Math.max(0, normalizedCapacity - 1) : normalizedCapacity,
  );

  return {
    visibleLaneCount,
    hiddenEntryCount: getHiddenEntryCountForDate(rowLayout, dateValue, visibleLaneCount),
  };
}
