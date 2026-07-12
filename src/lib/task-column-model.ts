import type { WorkspaceField } from "@/lib/workspace-field-model";

export const SYSTEM_TASK_COLUMN_IDS = [
  "issueKey",
  "issueType",
  "status",
  "assignee",
  "startDate",
  "dueDate",
  "createdAt",
  "updatedAt",
  "childCount",
  "commentCount",
] as const;

export type SystemTaskColumnId = (typeof SYSTEM_TASK_COLUMN_IDS)[number];

export interface TaskColumnState {
  visibility: Record<string, boolean>;
  order: string[];
}

export interface TaskWorkspaceColumn {
  id: string;
  kind: "system" | "custom";
  field?: WorkspaceField;
  visible: boolean;
}

export const DEFAULT_TASK_COLUMN_VISIBILITY: Record<SystemTaskColumnId, boolean> = {
  issueKey: true,
  issueType: true,
  status: true,
  assignee: true,
  startDate: true,
  dueDate: true,
  createdAt: false,
  updatedAt: false,
  childCount: true,
  commentCount: true,
};

export const EMPTY_TASK_COLUMN_STATE: TaskColumnState = {
  visibility: {},
  order: [],
};

export function taskColumnStorageKey(userId: string, workspaceKey: string) {
  return `taskWorkspace:columns:${userId}:${workspaceKey}`;
}

export function parseTaskColumnState(raw: string | null | undefined): TaskColumnState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as { visibility?: unknown; order?: unknown };
    const visibility: Record<string, boolean> = {};
    if (value.visibility && typeof value.visibility === "object") {
      for (const [key, visible] of Object.entries(value.visibility as Record<string, unknown>)) {
        if (typeof key !== "string" || key.length === 0) continue;
        if (typeof visible === "boolean") visibility[key] = visible;
      }
    }
    const order = Array.isArray(value.order)
      ? value.order.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];
    return { visibility, order };
  } catch {
    return null;
  }
}

export function serializeTaskColumnState(state: TaskColumnState) {
  return JSON.stringify({
    visibility: state.visibility,
    order: state.order,
  });
}

export function toggleColumnVisibility(
  visibility: Readonly<Record<string, boolean>>,
  columnId: string,
  visible?: boolean,
): Record<string, boolean> {
  const current = visibility[columnId] ?? defaultVisibilityForColumn(columnId, "custom");
  const nextVisible = visible === undefined ? !current : visible;
  return { ...visibility, [columnId]: nextVisible };
}

export function setAllColumnVisibility(
  visibility: Readonly<Record<string, boolean>>,
  columnIds: readonly string[],
  visible: boolean,
): Record<string, boolean> {
  const next = { ...visibility };
  for (const id of columnIds) next[id] = visible;
  return next;
}

export function normalizeColumnOrder(
  columnIds: readonly string[],
  persistedOrder: readonly string[],
): string[] {
  const available = new Set(columnIds);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of persistedOrder) {
    if (!available.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  for (const id of columnIds) {
    if (seen.has(id)) continue;
    ordered.push(id);
  }

  return ordered;
}

export function reorderColumnOrder(
  columnIds: readonly string[],
  persistedOrder: readonly string[],
  draggedId: string,
  targetId: string,
): string[] {
  if (draggedId === targetId) return normalizeColumnOrder(columnIds, persistedOrder);
  const next = normalizeColumnOrder(columnIds, persistedOrder);
  const fromIndex = next.indexOf(draggedId);
  const toIndex = next.indexOf(targetId);
  if (fromIndex === -1 || toIndex === -1) return next;
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, draggedId);
  return next;
}

export function countHiddenColumns(
  columns: readonly TaskWorkspaceColumn[],
): number {
  return columns.reduce((sum, column) => (column.visible ? sum : sum + 1), 0);
}

export function defaultVisibilityForColumn(id: string, kind: TaskWorkspaceColumn["kind"]) {
  if (kind === "system" && id in DEFAULT_TASK_COLUMN_VISIBILITY) {
    return DEFAULT_TASK_COLUMN_VISIBILITY[id as SystemTaskColumnId];
  }
  return false;
}

export function buildOrderedTaskColumns(
  state: TaskColumnState,
  customFields: readonly WorkspaceField[],
): TaskWorkspaceColumn[] {
  const systemColumns: TaskWorkspaceColumn[] = SYSTEM_TASK_COLUMN_IDS.map((id) => ({
    id,
    kind: "system",
    visible: state.visibility[id] ?? defaultVisibilityForColumn(id, "system"),
  }));
  const customColumns: TaskWorkspaceColumn[] = customFields.map((field) => ({
    id: field.id,
    kind: "custom",
    field,
    visible: state.visibility[field.id] ?? (field.key === "priority" || defaultVisibilityForColumn(field.id, "custom")),
  }));
  const byId = new Map([...systemColumns, ...customColumns].map((column) => [column.id, column] as const));
  const orderedIds = normalizeColumnOrder(Array.from(byId.keys()), state.order);
  return orderedIds.map((id) => byId.get(id)).filter((column): column is TaskWorkspaceColumn => Boolean(column));
}

export function visibleSystemFieldState(columns: readonly TaskWorkspaceColumn[]) {
  const next = {} as Record<SystemTaskColumnId, boolean>;
  for (const id of SYSTEM_TASK_COLUMN_IDS) next[id] = false;
  for (const column of columns) {
    if (column.kind !== "system") continue;
    next[column.id as SystemTaskColumnId] = column.visible;
  }
  return next;
}

export function visibleCustomFieldIdSet(columns: readonly TaskWorkspaceColumn[]) {
  return new Set(columns.filter((column) => column.kind === "custom" && column.visible).map((column) => column.id));
}
