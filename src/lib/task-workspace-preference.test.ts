import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTaskWorkspacePreference,
  parseTaskWorkspacePreference,
  serializeTaskWorkspacePreference,
  TASK_WORKSPACE_PREFERENCE_DEFAULTS,
  TASK_WORKSPACE_PREFERENCE_VIEW_NAME,
} from "./task-workspace-preference";

test("normalizes complete account-backed task workspace preferences", () => {
  assert.equal(TASK_WORKSPACE_PREFERENCE_VIEW_NAME, "__account_workspace_preferences__");
  const preference = normalizeTaskWorkspacePreference({
    filters: [{ id: "title", field: "title", operator: "contains", value: "release" }],
    combinator: "OR",
    sort: [
      { id: "due", field: "dueDate", direction: "desc" },
      { id: "duplicate", field: "dueDate", direction: "asc" },
      { id: "invalid", field: "unknown", direction: "asc" },
    ],
    group: " priority-field ",
    columns: { status: false, priority: true },
    columnOrder: ["priority", "status", "priority"],
    viewMode: "gantt",
    splitHierarchy: true,
    ganttUnit: "quarter",
    calendarUnit: "week",
    ganttRangeMode: "custom",
    customGanttRange: { start: "2026-07-01", end: "2026-07-31" },
    todayBucket: "next7",
    filterMyTasks: true,
    excludeDone: true,
  }, true);

  assert.deepEqual(preference, {
    exists: true,
    filters: [{ id: "title", field: "title", operator: "contains", value: "release" }],
    combinator: "OR",
    sort: [{ id: "due", field: "dueDate", direction: "desc" }],
    group: "priority-field",
    columns: { status: false, priority: true },
    columnOrder: ["priority", "status"],
    viewMode: "gantt",
    splitHierarchy: true,
    ganttUnit: "quarter",
    calendarUnit: "week",
    ganttRangeMode: "custom",
    customGanttRange: { start: "2026-07-01", end: "2026-07-31" },
    todayBucket: "next7",
    filterMyTasks: true,
    excludeDone: true,
  });
});

test("keeps legacy sort and group records backward compatible", () => {
  const preference = normalizeTaskWorkspacePreference({ sort: [], group: null }, true);
  assert.deepEqual(preference, {
    exists: true,
    ...TASK_WORKSPACE_PREFERENCE_DEFAULTS,
  });
});

test("rejects malformed units, buckets, and custom date ranges", () => {
  const preference = normalizeTaskWorkspacePreference({
    viewMode: "calendar",
    ganttUnit: "year",
    calendarUnit: "invalid",
    ganttRangeMode: "custom",
    customGanttRange: { start: "2026-08-01", end: "2026-07-01" },
    todayBucket: "tomorrow",
  }, true);
  assert.equal(preference.ganttUnit, "month");
  assert.equal(preference.calendarUnit, "month");
  assert.equal(preference.ganttRangeMode, "auto");
  assert.deepEqual(preference.customGanttRange, { start: "", end: "" });
  assert.equal(preference.todayBucket, "byToday");
});

test("round-trips the dedicated preference payload without an exists field", () => {
  const serialized = serializeTaskWorkspacePreference({
    ...TASK_WORKSPACE_PREFERENCE_DEFAULTS,
    todayBucket: "done",
    filterMyTasks: true,
  });
  assert.equal(Object.hasOwn(JSON.parse(serialized), "exists"), false);
  assert.deepEqual(parseTaskWorkspacePreference(serialized, true), {
    exists: true,
    ...TASK_WORKSPACE_PREFERENCE_DEFAULTS,
    todayBucket: "done",
    filterMyTasks: true,
  });
  assert.deepEqual(parseTaskWorkspacePreference("{", false), {
    exists: false,
    ...TASK_WORKSPACE_PREFERENCE_DEFAULTS,
  });
});
