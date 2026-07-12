import {
  IssueTypeOption,
  ProjectOption,
  StatusOption,
  WorkItemWithRelations,
} from "@/components/task/types";

interface TaskWorkspaceMetadataInput {
  tasks: WorkItemWithRelations[];
  statuses: StatusOption[];
  issueTypes: IssueTypeOption[];
  projects: ProjectOption[];
}

function mergeById<T extends { id: string }>(primary: T[], fallback: T[]) {
  const merged = new Map(primary.map((item) => [item.id, item]));

  for (const item of fallback) {
    if (!merged.has(item.id)) {
      merged.set(item.id, item);
    }
  }

  return Array.from(merged.values());
}

function collectStatusesFromTasks(tasks: WorkItemWithRelations[]) {
  const statuses = new Map<string, StatusOption>();

  for (const task of tasks) {
    if (statuses.has(task.status.id)) continue;

    statuses.set(task.status.id, {
      id: task.status.id,
      name: task.status.name,
      color: task.status.color,
      category: task.status.category,
    });
  }

  return Array.from(statuses.values());
}

function collectIssueTypesFromTasks(tasks: WorkItemWithRelations[]) {
  const issueTypes = new Map<string, IssueTypeOption>();

  for (const task of tasks) {
    if (issueTypes.has(task.issueType.id)) continue;

    issueTypes.set(task.issueType.id, {
      id: task.issueType.id,
      key: task.issueType.key,
      name: task.issueType.name,
      category: task.issueType.category ?? "ISSUE",
      icon: task.issueType.icon ?? null,
      color: task.issueType.color ?? null,
      fieldSchemaId: task.issueType.fieldSchemaId ?? "",
      statusSchemaId: task.issueType.statusSchemaId ?? "",
    });
  }

  return Array.from(issueTypes.values());
}

function collectProjectsFromTasks(tasks: WorkItemWithRelations[]) {
  const projects = new Map<string, ProjectOption>();

  for (const task of tasks) {
    if (!task.project || projects.has(task.project.id)) continue;

    projects.set(task.project.id, {
      id: task.project.id,
      name: task.project.name,
      key: task.project.key,
    });
  }

  return Array.from(projects.values());
}

export function resolveTaskWorkspaceMetadata({
  tasks,
  statuses,
  issueTypes,
  projects,
}: TaskWorkspaceMetadataInput) {
  return {
    statuses: mergeById(statuses, collectStatusesFromTasks(tasks)),
    issueTypes: mergeById(issueTypes, collectIssueTypesFromTasks(tasks)),
    projects: mergeById(projects, collectProjectsFromTasks(tasks)),
  };
}
