import type { WorkItemWithRelations } from "@/components/task/types";

const WORK_ITEM_OBJECT_TYPE = "work_item";
const CYCLE_OBJECT_TYPE = "cycle";

type ManagedFieldResolver<T> = (entity: T) => unknown;

export interface ObjectDescriptor<T = unknown> {
  key: string;
  managedFields: Record<string, { resolve: ManagedFieldResolver<T> }>;
}

export const workItemObjectDescriptor: ObjectDescriptor<WorkItemWithRelations> = {
  key: WORK_ITEM_OBJECT_TYPE,
  managedFields: {
    title: { resolve: (task) => task.title },
    project: { resolve: (task) => task.projectId },
    status: { resolve: (task) => task.statusId },
    assignee: { resolve: (task) => task.assignee?.id },
    parent: { resolve: (task) => task.parentId },
    description: { resolve: (task) => task.description },
    start_date: { resolve: (task) => task.startDate },
    due_date: { resolve: (task) => task.dueDate },
    issue_id: { resolve: (task) => task.issueKey },
    created_at: { resolve: (task) => task.createdAt },
    updated_at: { resolve: (task) => task.updatedAt },
  },
};

export function isResolvedValuePresent(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value != null;
}

export const objectRegistry: Record<string, ObjectDescriptor<never>> = {
  [WORK_ITEM_OBJECT_TYPE]: workItemObjectDescriptor,
  user: {
    key: "user",
    managedFields: {},
  },
  project: {
    key: "project",
    managedFields: {},
  },
  [CYCLE_OBJECT_TYPE]: {
    key: CYCLE_OBJECT_TYPE,
    managedFields: {
      title: { resolve: (cycle) => (cycle as { name?: unknown }).name },
      name: { resolve: (cycle) => (cycle as { name?: unknown }).name },
      status: { resolve: (cycle) => (cycle as { statusId?: unknown }).statusId },
      start_date: { resolve: (cycle) => (cycle as { startDate?: unknown }).startDate },
      end_date: { resolve: (cycle) => (cycle as { endDate?: unknown }).endDate },
      cycle_scope: { resolve: (cycle) => (cycle as { scope?: unknown }).scope },
      cycle_project: { resolve: (cycle) => (cycle as { projectId?: unknown }).projectId },
      cycle_group: { resolve: (cycle) => (cycle as { groupId?: unknown }).groupId },
      owner: { resolve: (cycle) => (cycle as { ownerId?: unknown }).ownerId },
      cycle_owner: { resolve: (cycle) => (cycle as { ownerId?: unknown }).ownerId },
      cycle_inherit_by_default: { resolve: (cycle) => (cycle as { inheritByDefault?: unknown }).inheritByDefault },
    },
  },
};

export function getObjectDescriptor(key: string) {
  return objectRegistry[key] ?? null;
}
