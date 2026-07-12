import {
  SORT_FIELDS,
  type FilterCombinator,
  type FilterCondition,
  type FilterOperator,
  type SortDirection,
  type SortFieldKey,
  type SortRule,
} from "@/components/task/task-filter-model";

export type TaskSavedViewMode = "list" | "grid" | "kanban" | "gantt" | "calendar";
export type TaskSavedViewUnit = "day" | "week" | "month" | "quarter";

export interface TaskSavedViewConfig {
  filters: FilterCondition[];
  combinator: FilterCombinator;
  sort: SortRule[];
  group: string | null;
  columns: Record<string, boolean>;
  columnOrder: string[];
  viewMode: TaskSavedViewMode;
  ganttUnit?: TaskSavedViewUnit;
  calendarUnit?: TaskSavedViewUnit;
}

export interface TaskSavedViewDto {
  id: string;
  workspaceKey: string;
  name: string;
  isShared: boolean;
  isDefault: boolean;
  config: TaskSavedViewConfig;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  canManage: boolean;
}

export type ParsedTaskWorkspaceKey =
  | { scope: "my" }
  | { scope: "all" }
  | { scope: "project"; id: string }
  | { scope: "group"; id: string };

const FILTER_OPERATORS: FilterOperator[] = [
  "contains",
  "not_contains",
  "is",
  "is_not",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "in",
  "not_in",
  "on_or_before",
  "on_or_after",
  "is_empty",
  "is_not_empty",
];

const VIEW_MODES: TaskSavedViewMode[] = ["list", "grid", "kanban", "gantt", "calendar"];
const UNITS: TaskSavedViewUnit[] = ["day", "week", "month", "quarter"];

export const TASK_SAVED_VIEW_DEFAULT_CONFIG: TaskSavedViewConfig = {
  filters: [],
  combinator: "AND",
  sort: [],
  group: null,
  columns: {},
  columnOrder: [],
  viewMode: "list",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)));
}

function normalizeFilters(value: unknown): FilterCondition[] {
  if (!Array.isArray(value)) return [];
  const out: FilterCondition[] = [];
  value.forEach((raw, index) => {
    if (!isPlainObject(raw) || raw.locked === true) return;
    const field = asString(raw.field).trim();
    const operator = asString(raw.operator) as FilterOperator;
    if (!field || !FILTER_OPERATORS.includes(operator)) return;
    const value = Array.isArray(raw.value)
      ? normalizeStringArray(raw.value)
      : asString(raw.value);
    const id = asString(raw.id, `saved-filter-${index}`).trim() || `saved-filter-${index}`;
    out.push({
      id,
      field,
      operator,
      value,
      ...(typeof raw.value2 === "string" ? { value2: raw.value2 } : {}),
    });
  });
  return out;
}

function normalizeSort(value: unknown): SortRule[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: SortRule[] = [];
  value.forEach((raw, index) => {
    if (!isPlainObject(raw)) return;
    const field = asString(raw.field) as SortFieldKey;
    if (!SORT_FIELDS.includes(field) || seen.has(field)) return;
    seen.add(field);
    const direction: SortDirection = raw.direction === "desc" ? "desc" : "asc";
    const id = asString(raw.id, `saved-sort-${index}`).trim() || `saved-sort-${index}`;
    out.push({ id, field, direction });
  });
  return out;
}

function normalizeBooleanMap(value: unknown) {
  if (!isPlainObject(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key && typeof raw === "boolean") out[key] = raw;
  }
  return out;
}

function normalizeColumnOrder(value: unknown) {
  return normalizeStringArray(value);
}

function normalizeViewMode(value: unknown): TaskSavedViewMode {
  return VIEW_MODES.includes(value as TaskSavedViewMode) ? value as TaskSavedViewMode : "list";
}

function normalizeUnit(value: unknown): TaskSavedViewUnit | undefined {
  return UNITS.includes(value as TaskSavedViewUnit) ? value as TaskSavedViewUnit : undefined;
}

export function normalizeTaskSavedViewConfig(value: unknown): TaskSavedViewConfig {
  if (typeof value === "string") return parseTaskSavedViewConfig(value);
  if (!isPlainObject(value)) return { ...TASK_SAVED_VIEW_DEFAULT_CONFIG };
  const viewMode = normalizeViewMode(value.viewMode);
  return {
    filters: normalizeFilters(value.filters),
    combinator: value.combinator === "OR" ? "OR" : "AND",
    sort: normalizeSort(value.sort),
    group: typeof value.group === "string" && value.group.trim() ? value.group.trim() : null,
    columns: normalizeBooleanMap(value.columns),
    columnOrder: normalizeColumnOrder(value.columnOrder),
    viewMode,
    ...(viewMode === "gantt" ? { ganttUnit: normalizeUnit(value.ganttUnit) ?? "week" } : {}),
    ...(viewMode === "calendar" ? { calendarUnit: normalizeUnit(value.calendarUnit) ?? "month" } : {}),
  };
}

export function parseTaskSavedViewConfig(raw: string | null | undefined): TaskSavedViewConfig {
  if (!raw) return { ...TASK_SAVED_VIEW_DEFAULT_CONFIG };
  try {
    return normalizeTaskSavedViewConfig(JSON.parse(raw));
  } catch {
    return { ...TASK_SAVED_VIEW_DEFAULT_CONFIG };
  }
}

export function serializeTaskSavedViewConfig(config: TaskSavedViewConfig) {
  return JSON.stringify(normalizeTaskSavedViewConfig(config));
}

function canonicalizeFilters(filters: FilterCondition[]) {
  return filters.map((filter) => ({
    field: filter.field,
    operator: filter.operator,
    value: filter.value,
    ...(filter.value2 !== undefined ? { value2: filter.value2 } : {}),
  }));
}

function sortBooleanMap(value: Record<string, boolean>) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

export function taskSavedViewConfigSignature(config: TaskSavedViewConfig) {
  const normalized = normalizeTaskSavedViewConfig(config);
  return JSON.stringify({
    filters: canonicalizeFilters(normalized.filters),
    combinator: normalized.combinator,
    sort: normalized.sort.map((rule) => ({ field: rule.field, direction: rule.direction })),
    group: normalized.group,
    columns: sortBooleanMap(normalized.columns),
    columnOrder: normalized.columnOrder,
    viewMode: normalized.viewMode,
    ganttUnit: normalized.ganttUnit ?? null,
    calendarUnit: normalized.calendarUnit ?? null,
  });
}

export function taskSavedViewConfigsEqual(left: TaskSavedViewConfig, right: TaskSavedViewConfig) {
  return taskSavedViewConfigSignature(left) === taskSavedViewConfigSignature(right);
}

export function parseTaskWorkspaceKey(workspaceKey: string): ParsedTaskWorkspaceKey | null {
  if (workspaceKey === "tasks:my" || workspaceKey === "tasks:my:today") return { scope: "my" };
  if (workspaceKey === "tasks:all" || workspaceKey === "tasks:all:today") return { scope: "all" };
  const project = workspaceKey.match(/^tasks:project:([^:]+)(?::today)?$/);
  if (project?.[1]) return { scope: "project", id: project[1] };
  const group = workspaceKey.match(/^tasks:group:([^:]+)(?::today)?$/);
  if (group?.[1]) return { scope: "group", id: group[1] };
  return null;
}
