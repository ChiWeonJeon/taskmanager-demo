import assert from "node:assert/strict";
import test from "node:test";
import type { WorkItemWithRelations } from "@/components/task/types";
import {
  matchesFilterCondition,
  normalizeOperatorForKind,
  parseTaskFilters,
  parseTaskSort,
  sanitizeTaskFilterConditions,
  serializeTaskFilters,
  serializeTaskSort,
  type FilterCondition,
  type SortRule,
} from "@/components/task/task-filter-model";
import type { WorkspaceField } from "@/lib/workspace-field-model";

const numberField: WorkspaceField = {
  id: "field-size",
  key: "size",
  name: "Size",
  type: "NUMBER",
  referenceObjectKey: null,
  isSystem: false,
  options: [],
  issueTypeIdsHavingField: new Set(["type-task"]),
  requiredIssueTypeIds: new Set(),
  sortOrder: 100,
};

const customFieldById = new Map([[numberField.id, numberField]]);

function makeTask(overrides: Partial<WorkItemWithRelations> = {}): WorkItemWithRelations {
  return {
    id: "task-1",
    issueKey: "TM-1",
    title: "Refine bulk filters",
    description: "Needs URL sync",
    startDate: "2026-07-01T00:00:00.000Z",
    dueDate: "2026-07-15T00:00:00.000Z",
    statusId: "status-open",
    issueTypeId: "type-task",
    projectId: "project-1",
    parentId: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    deletedAt: null,
    status: { id: "status-open", name: "Open", color: "#111", category: "TODO" },
    issueType: { id: "type-task", name: "Task", color: null },
    project: { id: "project-1", key: "TM", name: "TaskManager" },
    parent: null,
    creator: null,
    assignee: { id: "user-1", name: "Ari", email: "ari@example.com" },
    fieldValues: [
      {
        fieldId: numberField.id,
        value: JSON.stringify("12"),
        field: {
          id: numberField.id,
          key: numberField.key,
          name: numberField.name,
          type: numberField.type,
          options: null,
          referenceObjectKey: null,
          isSystem: false,
          isRequired: false,
        },
      },
    ],
    comments: [],
    histories: [],
    ...overrides,
  };
}

test("normalizes legacy operators for field kinds", () => {
  assert.equal(normalizeOperatorForKind("on_or_after", "date"), "gte");
  assert.equal(normalizeOperatorForKind("on_or_before", "date"), "lte");
  assert.equal(normalizeOperatorForKind("is", "select"), "in");
  assert.equal(normalizeOperatorForKind("is_not", "multiselect"), "not_in");
});

test("matches expanded text, number, date, and select operators", () => {
  const task = makeTask();

  assert.equal(matchesFilterCondition(task, { id: "1", field: "title", operator: "not_contains", value: "archived" }), true);
  assert.equal(matchesFilterCondition(task, { id: "2", field: numberField.id, operator: "between", value: "10", value2: "20" }, customFieldById), true);
  assert.equal(matchesFilterCondition(task, { id: "3", field: "dueDate", operator: "lte", value: "2026-07-15" }), true);
  assert.equal(matchesFilterCondition(task, { id: "4", field: "status", operator: "in", value: ["status-open"] }), true);
  assert.equal(matchesFilterCondition(task, { id: "5", field: "status", operator: "not_in", value: ["status-open"] }), false);
});

test("round-trips filter and sort URL codecs", () => {
  const filters: FilterCondition[] = [
    { id: "title", field: "title", operator: "not_contains", value: "archived" },
    { id: "status", field: "status", operator: "in", value: ["status-open", "status-done"] },
    { id: "date", field: "dueDate", operator: "between", value: "2026-07-01", value2: "2026-07-31" },
    { id: "locked", field: "assignee", operator: "in", value: ["user-1"], locked: true },
  ];
  const encodedFilters = serializeTaskFilters(filters);
  const parsedFilters = parseTaskFilters(encodedFilters);

  assert.equal(parsedFilters.length, 3);
  assert.deepEqual(parsedFilters.map((filter) => filter.operator), ["not_contains", "in", "between"]);
  assert.deepEqual(parsedFilters[1]?.value, ["status-open", "status-done"]);
  assert.equal(parsedFilters[2]?.value2, "2026-07-31");

  const sortRules: SortRule[] = [
    { id: "due", field: "dueDate", direction: "asc" },
    { id: "title", field: "title", direction: "desc" },
  ];
  const parsedSort = parseTaskSort(serializeTaskSort(sortRules));

  assert.deepEqual(parsedSort.map(({ field, direction }) => ({ field, direction })), [
    { field: "dueDate", direction: "asc" },
    { field: "title", direction: "desc" },
  ]);
});

test("serializes empty filters to an empty URL token", () => {
  assert.equal(serializeTaskFilters([]), "");
  assert.equal(serializeTaskFilters([{ id: "blank", field: "title", operator: "contains", value: "" }]), "");
});

test("drops non-work-item status filters from URL state", () => {
  const parsed = parseTaskFilters("status:in:system-cycle-status-active||title:contains:bulk");
  const sanitized = sanitizeTaskFilterConditions(parsed, {
    validStatusIds: new Set(["status-open", "status-done"]),
  });

  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0]?.field, "title");

  const valid = parseTaskFilters("status:in:status-open,status-done||title:contains:bulk");
  const validSanitized = sanitizeTaskFilterConditions(valid, {
    validStatusIds: new Set(["status-open", "status-done"]),
  });

  assert.deepEqual(validSanitized.map((condition) => condition.field), ["status", "title"]);
  assert.deepEqual(validSanitized[0]?.value, ["status-open", "status-done"]);
});
