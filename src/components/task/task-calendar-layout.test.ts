import assert from "node:assert/strict";
import test from "node:test";
import {
  type CalendarRowLane,
  type CalendarRowLayout,
  resolveCalendarCellLaneVisibility,
} from "./task-calendar-layout";

function createRowLayout(dateValue: string, laneIndexes: number[], laneCount = laneIndexes.length): CalendarRowLayout {
  const lanesForDate = new Map<number, CalendarRowLane>(
    laneIndexes.map((laneIndex) => [laneIndex, { laneIndex } as CalendarRowLane]),
  );

  return {
    rowKey: dateValue,
    cells: [],
    lanes: [],
    laneCount,
    laneByDateKey: new Map([[dateValue, lanesForDate]]),
  };
}

test("calendar cells reserve one measured row for the overflow control", () => {
  const dateValue = "2026-07-13";
  const rowLayout = createRowLayout(dateValue, [0, 1, 2, 3, 4]);

  assert.deepEqual(resolveCalendarCellLaneVisibility(rowLayout, dateValue, 4), {
    visibleLaneCount: 3,
    hiddenEntryCount: 2,
  });
});

test("calendar cells use the full measured capacity when no overflow control is needed", () => {
  const dateValue = "2026-07-13";
  const rowLayout = createRowLayout(dateValue, [0, 1, 2, 3]);

  assert.deepEqual(resolveCalendarCellLaneVisibility(rowLayout, dateValue, 4), {
    visibleLaneCount: 4,
    hiddenEntryCount: 0,
  });
});

test("calendar cells show only the overflow control when a single row is available", () => {
  const dateValue = "2026-07-13";
  const rowLayout = createRowLayout(dateValue, [0, 1]);

  assert.deepEqual(resolveCalendarCellLaneVisibility(rowLayout, dateValue, 1), {
    visibleLaneCount: 0,
    hiddenEntryCount: 2,
  });
});
