import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_TASK_GROUP_KEY,
  extractTaskGroupKeys,
  getTaskGroupOptions,
  groupTasks,
  resolveTaskGroupLabel,
} from "./task-group-model";
import type { IssueTypeOption, ProjectOption, StatusOption, WorkItemFieldValue, WorkItemWithRelations } from "./types";
import type { WorkspaceField } from "@/lib/workspace-field-model";

function field(id: string, type: string, options: WorkspaceField["options"] = []): WorkspaceField {
  return {
    id,
    key: id,
    name: id,
    type,
    referenceObjectKey: null,
    isSystem: false,
    options,
    issueTypeIdsHavingField: new Set(["type-1"]),
    requiredIssueTypeIds: new Set(),
    sortOrder: 100,
  };
}

function task(overrides: Partial<WorkItemWithRelations>): WorkItemWithRelations {
  return {
    id: "task-1",
    issueKey: "TASK-1",
    title: "Task 1",
    description: null,
    startDate: null,
    dueDate: null,
    statusId: "status-open",
    issueTypeId: "type-task",
    projectId: "project-1",
    parentId: null,
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    deletedAt: null,
    status: { id: "status-open", name: "Open", color: "#999", category: "TODO" },
    issueType: { id: "type-task", name: "Task", category: "ISSUE", icon: null, color: null },
    project: { id: "project-1", name: "Project", key: "PRJ" },
    parent: null,
    creator: null,
    assignee: null,
    fieldValues: [],
    ...overrides,
  };
}

function fieldValue(field: WorkspaceField, value: string): WorkItemFieldValue {
  return {
    fieldId: field.id,
    value,
    field: {
      id: field.id,
      name: field.name,
      key: field.key,
      type: field.type,
      options: null,
      referenceObjectKey: field.referenceObjectKey,
      defaultValue: null,
      isSystem: field.isSystem,
      isRequired: false,
    },
  };
}

const labels = { noValue: "No value", removedField: "Removed field" };
const statuses: StatusOption[] = [{ id: "status-open", name: "Open", color: "#999", category: "TODO" }];
const issueTypes: Pick<IssueTypeOption, "id" | "name">[] = [{ id: "type-task", name: "Task" }];
const projects: ProjectOption[] = [{ id: "project-1", name: "Project", key: "PRJ" }];
const users = [{ id: "user-1", name: "Ada", email: "ada@example.com" }];

test("lists system group options and only closed-domain custom fields", () => {
  const options = getTaskGroupOptions({
    customFields: [field("select_a", "SELECT"), field("text_a", "TEXT"), field("multi_a", "MULTI_REFERENCE")],
    systemLabels: {
      status: "Status",
      issueType: "Type",
      assignee: "Assignee",
      project: "Project",
    },
  });

  assert.deepEqual(options.map((option) => option.id), ["status", "issueType", "assignee", "project", "select_a", "multi_a"]);
});

test("extracts single, empty, and multi-value task group keys", () => {
  const tags = field("tags", "MULTI_SELECT");
  const option = { id: tags.id, kind: "custom" as const, label: tags.name, field: tags };

  assert.deepEqual(extractTaskGroupKeys(task({ assignee: { id: "user-1", name: "Ada", email: "ada@example.com" } }), {
    id: "assignee",
    kind: "system",
    label: "Assignee",
  }), ["user-1"]);
  assert.deepEqual(extractTaskGroupKeys(task({ assignee: null }), { id: "assignee", kind: "system", label: "Assignee" }), [EMPTY_TASK_GROUP_KEY]);
  assert.deepEqual(extractTaskGroupKeys(task({
    fieldValues: [fieldValue(tags, JSON.stringify(["red", "blue", "red"]))],
  }), option), ["red", "blue"]);
});

test("groups tasks in first-seen order with empty bucket last", () => {
  const tags = field("tags", "MULTI_SELECT", [
    { value: "red", label: "Red" },
    { value: "blue", label: "Blue" },
  ]);
  const option = { id: tags.id, kind: "custom" as const, label: tags.name, field: tags };
  const sections = groupTasks({
    tasks: [
      task({ id: "task-1", fieldValues: [fieldValue(tags, JSON.stringify(["red", "blue"]))] }),
      task({ id: "task-2", fieldValues: [] }),
    ],
    option,
    statuses,
    issueTypes,
    projects,
    users,
    labels,
  });

  assert.deepEqual(sections.map((section) => section.key), ["red", "blue", EMPTY_TASK_GROUP_KEY]);
  assert.deepEqual(sections.map((section) => section.label), ["Red", "Blue", "No value"]);
  assert.deepEqual(sections[0]?.tasks.map((item) => item.id), ["task-1"]);
  assert.deepEqual(sections[1]?.tasks.map((item) => item.id), ["task-1"]);
});

test("resolves labels without exposing raw ids", () => {
  assert.equal(resolveTaskGroupLabel({
    key: "status-open",
    option: { id: "status", kind: "system", label: "Status" },
    statuses,
    issueTypes,
    projects,
    users,
    labels,
  }), "Open");
  assert.equal(resolveTaskGroupLabel({
    key: "missing",
    option: { id: "status", kind: "system", label: "Status" },
    statuses,
    issueTypes,
    projects,
    users,
    labels,
  }), "Removed field");
});
