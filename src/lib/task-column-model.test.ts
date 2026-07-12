import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderedTaskColumns,
  countHiddenColumns,
  normalizeColumnOrder,
  parseTaskColumnState,
  reorderColumnOrder,
  serializeTaskColumnState,
  setAllColumnVisibility,
  taskColumnStorageKey,
  toggleColumnVisibility,
  visibleCustomFieldIdSet,
  visibleSystemFieldState,
  type TaskColumnState,
} from "./task-column-model";
import type { WorkspaceField } from "./workspace-field-model";

function field(id: string, name = id, key = id): WorkspaceField {
  return {
    id,
    key,
    name,
    type: "TEXT",
    referenceObjectKey: null,
    isSystem: false,
    options: [],
    issueTypeIdsHavingField: new Set(["type-1"]),
    requiredIssueTypeIds: new Set(),
    sortOrder: 100,
  };
}

test("normalizes persisted task column order", () => {
  assert.deepEqual(
    normalizeColumnOrder(["issueKey", "status", "assignee"], ["status", "missing", "status"]),
    ["status", "issueKey", "assignee"],
  );
});

test("reorders task columns inside normalized order", () => {
  assert.deepEqual(
    reorderColumnOrder(["issueKey", "status", "assignee"], ["assignee", "issueKey"], "issueKey", "assignee"),
    ["issueKey", "assignee", "status"],
  );
});

test("builds system and custom task columns with tolerant visibility defaults", () => {
  const columns = buildOrderedTaskColumns(
    {
      visibility: { createdAt: true, custom_a: true },
      order: ["custom_a", "status"],
    },
    [field("custom_a", "Custom A"), field("custom_b", "Custom B")],
  );

  assert.deepEqual(columns.slice(0, 3).map((column) => column.id), ["custom_a", "status", "issueKey"]);
  assert.equal(columns.find((column) => column.id === "createdAt")?.visible, true);
  assert.equal(columns.find((column) => column.id === "custom_a")?.visible, true);
  assert.equal(columns.find((column) => column.id === "custom_b")?.visible, false);
  assert.equal(countHiddenColumns(columns), 2);
});

test("derives legacy visibility shapes for existing task views", () => {
  const columns = buildOrderedTaskColumns(
    { visibility: { status: false, custom_a: true }, order: [] },
    [field("custom_a")],
  );

  assert.equal(visibleSystemFieldState(columns).status, false);
  assert.equal(visibleSystemFieldState(columns).createdAt, false);
  assert.deepEqual(Array.from(visibleCustomFieldIdSet(columns)), ["custom_a"]);
});

test("shows priority custom columns by default while respecting an explicit hidden preference", () => {
  const priority = field("priority-field", "Priority", "priority");

  assert.equal(buildOrderedTaskColumns({ visibility: {}, order: [] }, [priority])[10]?.visible, true);
  assert.equal(buildOrderedTaskColumns({ visibility: { "priority-field": false }, order: [] }, [priority])[10]?.visible, false);
});

test("parses and serializes persisted task column state defensively", () => {
  const state: TaskColumnState = { visibility: { status: false }, order: ["status"] };
  assert.deepEqual(parseTaskColumnState(serializeTaskColumnState(state)), state);
  assert.deepEqual(parseTaskColumnState(JSON.stringify({ visibility: { status: "no", assignee: true }, order: [1, "assignee"] })), {
    visibility: { assignee: true },
    order: ["assignee"],
  });
  assert.equal(parseTaskColumnState("{"), null);
});

test("updates visibility maps and storage keys", () => {
  assert.equal(taskColumnStorageKey("user-1", "tasks:my"), "taskWorkspace:columns:user-1:tasks:my");
  assert.deepEqual(toggleColumnVisibility({ status: true }, "status", false), { status: false });
  assert.deepEqual(setAllColumnVisibility({ stale: false }, ["status", "assignee"], true), {
    stale: false,
    status: true,
    assignee: true,
  });
});
