import type { ProjectOption, StatusOption, UserOption, WorkItemWithRelations } from "@/components/task/types";
import {
  getTaskCustomFieldValue,
  type WorkspaceField,
} from "@/lib/workspace-field-model";
import { findReferenceOption } from "@/lib/reference-options";

export const EMPTY_TASK_GROUP_KEY = "__task_group_empty__";

export const GROUPABLE_SYSTEM_KEYS = ["status", "issueType", "assignee", "project"] as const;
export type GroupableSystemKey = (typeof GROUPABLE_SYSTEM_KEYS)[number];

export const GROUPABLE_CUSTOM_FIELD_TYPES = [
  "SELECT",
  "MULTI_SELECT",
  "USER",
  "REFERENCE",
  "MULTI_REFERENCE",
  "OBJECT_REF",
  "MULTI_OBJECT_REF",
  "ENTITY_REF",
  "MULTI_ENTITY_REF",
] as const;

export interface TaskGroupOption {
  id: string;
  kind: "system" | "custom";
  label: string;
  field?: WorkspaceField;
}

export interface TaskGroupSection {
  key: string;
  label: string;
  tasks: WorkItemWithRelations[];
}

export interface TaskGroupLabels {
  noValue: string;
  removedField: string;
}

export function isTaskGroupableCustomField(field: Pick<WorkspaceField, "type">) {
  return GROUPABLE_CUSTOM_FIELD_TYPES.includes(field.type as (typeof GROUPABLE_CUSTOM_FIELD_TYPES)[number]);
}

export function getTaskGroupOptions({
  customFields,
  systemLabels,
}: {
  customFields: readonly WorkspaceField[];
  systemLabels: Record<GroupableSystemKey, string>;
}): TaskGroupOption[] {
  return [
    ...GROUPABLE_SYSTEM_KEYS.map((key) => ({
      id: key,
      kind: "system" as const,
      label: systemLabels[key],
    })),
    ...customFields
      .filter(isTaskGroupableCustomField)
      .map((field) => ({
        id: field.id,
        kind: "custom" as const,
        label: field.name,
        field,
      })),
  ];
}

export function extractTaskGroupKeys(task: WorkItemWithRelations, option: TaskGroupOption): string[] {
  if (option.kind === "system") {
    switch (option.id) {
      case "status":
        return task.statusId ? [task.statusId] : [EMPTY_TASK_GROUP_KEY];
      case "issueType":
        return task.issueTypeId ? [task.issueTypeId] : [EMPTY_TASK_GROUP_KEY];
      case "assignee":
        return task.assignee?.id ? [task.assignee.id] : [EMPTY_TASK_GROUP_KEY];
      case "project": {
        const projectId = task.project?.id ?? task.projectId;
        return projectId ? [projectId] : [EMPTY_TASK_GROUP_KEY];
      }
      default:
        return [EMPTY_TASK_GROUP_KEY];
    }
  }

  const field = option.field;
  if (!field) return [EMPTY_TASK_GROUP_KEY];
  const value = getTaskCustomFieldValue(task, field);
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const nonEmpty = values.map((entry) => entry.trim()).filter(Boolean);
  return nonEmpty.length > 0 ? Array.from(new Set(nonEmpty)) : [EMPTY_TASK_GROUP_KEY];
}

export function resolveTaskGroupLabel({
  key,
  option,
  statuses,
  issueTypes,
  projects,
  users,
  labels,
}: {
  key: string;
  option: TaskGroupOption | null;
  statuses: readonly StatusOption[];
  issueTypes: readonly { id: string; name: string }[];
  projects: readonly ProjectOption[];
  users: readonly UserOption[];
  labels: TaskGroupLabels;
}) {
  if (key === EMPTY_TASK_GROUP_KEY) return labels.noValue;
  if (!option) return labels.removedField;

  if (option.kind === "custom") {
    const field = option.field;
    if (!field) return labels.removedField;
    return findReferenceOption(field.options, key)?.label ?? labels.removedField;
  }

  switch (option.id) {
    case "status":
      return statuses.find((status) => status.id === key)?.name ?? labels.removedField;
    case "issueType":
      return issueTypes.find((issueType) => issueType.id === key)?.name ?? labels.removedField;
    case "assignee":
      return users.find((user) => user.id === key)?.name ?? labels.removedField;
    case "project":
      return projects.find((project) => project.id === key)?.name ?? labels.removedField;
    default:
      return labels.removedField;
  }
}

export function groupTasks({
  tasks,
  option,
  statuses,
  issueTypes,
  projects,
  users,
  labels,
}: {
  tasks: readonly WorkItemWithRelations[];
  option: TaskGroupOption;
  statuses: readonly StatusOption[];
  issueTypes: readonly { id: string; name: string }[];
  projects: readonly ProjectOption[];
  users: readonly UserOption[];
  labels: TaskGroupLabels;
}): TaskGroupSection[] {
  const sections = new Map<string, WorkItemWithRelations[]>();
  for (const task of tasks) {
    const keys = extractTaskGroupKeys(task, option);
    for (const key of keys) {
      const sectionTasks = sections.get(key) ?? [];
      sectionTasks.push(task);
      sections.set(key, sectionTasks);
    }
  }

  return Array.from(sections.entries())
    .sort(([left], [right]) => {
      if (left === EMPTY_TASK_GROUP_KEY && right !== EMPTY_TASK_GROUP_KEY) return 1;
      if (right === EMPTY_TASK_GROUP_KEY && left !== EMPTY_TASK_GROUP_KEY) return -1;
      return 0;
    })
    .map(([key, sectionTasks]) => ({
      key,
      label: resolveTaskGroupLabel({ key, option, statuses, issueTypes, projects, users, labels }),
      tasks: sectionTasks,
    }));
}
