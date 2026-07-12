import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTaskSavedViewConfig,
  parseTaskWorkspaceKey,
  serializeTaskSavedViewConfig,
  taskSavedViewConfigsEqual,
} from "./task-saved-view";

test("normalizes task saved view config and drops locked filters", () => {
  const config = normalizeTaskSavedViewConfig({
    filters: [
      { id: "a", field: "status", operator: "in", value: ["open"], locked: true },
      { id: "b", field: "title", operator: "contains", value: "bug" },
      { field: "bad", operator: "unknown", value: "x" },
    ],
    combinator: "OR",
    sort: [
      { id: "s1", field: "dueDate", direction: "desc" },
      { id: "s2", field: "missing", direction: "desc" },
      { id: "s3", field: "dueDate", direction: "asc" },
    ],
    group: "status",
    columns: { status: true, description: "yes" },
    columnOrder: ["status", "status", "assignee"],
    viewMode: "gantt",
    ganttUnit: "quarter",
  });

  assert.deepEqual(config.filters.map((filter) => filter.id), ["b"]);
  assert.equal(config.combinator, "OR");
  assert.deepEqual(config.sort, [{ id: "s1", field: "dueDate", direction: "desc" }]);
  assert.equal(config.group, "status");
  assert.deepEqual(config.columns, { status: true });
  assert.deepEqual(config.columnOrder, ["status", "assignee"]);
  assert.equal(config.viewMode, "gantt");
  assert.equal(config.ganttUnit, "quarter");
});

test("round-trips serialized config and compares canonical signatures", () => {
  const left = normalizeTaskSavedViewConfig({
    filters: [{ id: "first", field: "title", operator: "contains", value: "bug" }],
    sort: [{ id: "sort-a", field: "title", direction: "asc" }],
    columns: { status: true, assignee: false },
    columnOrder: ["assignee", "status"],
    viewMode: "calendar",
    calendarUnit: "week",
  });
  const parsed = normalizeTaskSavedViewConfig(serializeTaskSavedViewConfig(left));
  const right = normalizeTaskSavedViewConfig({
    filters: [{ id: "second", field: "title", operator: "contains", value: "bug" }],
    sort: [{ id: "sort-b", field: "title", direction: "asc" }],
    columns: { assignee: false, status: true },
    columnOrder: ["assignee", "status"],
    viewMode: "calendar",
    calendarUnit: "week",
  });

  assert.deepEqual(parsed, left);
  assert.equal(taskSavedViewConfigsEqual(left, right), true);
});

test("parses supported task workspace keys", () => {
  assert.deepEqual(parseTaskWorkspaceKey("tasks:my"), { scope: "my" });
  assert.deepEqual(parseTaskWorkspaceKey("tasks:all"), { scope: "all" });
  assert.deepEqual(parseTaskWorkspaceKey("tasks:project:project-1"), { scope: "project", id: "project-1" });
  assert.deepEqual(parseTaskWorkspaceKey("tasks:group:group-1"), { scope: "group", id: "group-1" });
  assert.deepEqual(parseTaskWorkspaceKey("tasks:my:today"), { scope: "my" });
  assert.deepEqual(parseTaskWorkspaceKey("tasks:all:today"), { scope: "all" });
  assert.deepEqual(parseTaskWorkspaceKey("tasks:project:project-1:today"), { scope: "project", id: "project-1" });
  assert.deepEqual(parseTaskWorkspaceKey("tasks:group:group-1:today"), { scope: "group", id: "group-1" });
  assert.equal(parseTaskWorkspaceKey("entity:product"), null);
});
