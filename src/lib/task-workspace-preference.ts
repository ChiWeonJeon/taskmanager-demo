import type { FilterCombinator, FilterCondition, SortRule } from "@/components/task/task-filter-model";
import {
  normalizeTaskSavedViewConfig,
  type TaskSavedViewMode,
  type TaskSavedViewUnit,
} from "@/lib/task-saved-view";

export const TASK_WORKSPACE_PREFERENCE_VIEW_NAME = "__account_workspace_preferences__";

export type TaskWorkspaceTodayBucket = "byToday" | "overdue" | "next7" | "unplanned" | "done";
export type TaskWorkspaceGanttRangeMode = "auto" | "custom";

export interface TaskWorkspaceDateRange {
  start: string;
  end: string;
}

export interface TaskWorkspacePreferenceInput {
  filters: FilterCondition[];
  combinator: FilterCombinator;
  sort: SortRule[];
  group: string | null;
  columns: Record<string, boolean>;
  columnOrder: string[];
  viewMode: TaskSavedViewMode;
  splitHierarchy: boolean;
  ganttUnit: TaskSavedViewUnit;
  calendarUnit: TaskSavedViewUnit;
  ganttRangeMode: TaskWorkspaceGanttRangeMode;
  customGanttRange: TaskWorkspaceDateRange;
  todayBucket: TaskWorkspaceTodayBucket;
  filterMyTasks: boolean;
  excludeDone: boolean;
}

export interface TaskWorkspacePreferenceDto extends TaskWorkspacePreferenceInput {
  exists: boolean;
}

export const TASK_WORKSPACE_PREFERENCE_DEFAULTS: TaskWorkspacePreferenceInput = {
  filters: [],
  combinator: "AND",
  sort: [],
  group: null,
  columns: {},
  columnOrder: [],
  viewMode: "list",
  splitHierarchy: false,
  ganttUnit: "month",
  calendarUnit: "month",
  ganttRangeMode: "auto",
  customGanttRange: { start: "", end: "" },
  todayBucket: "byToday",
  filterMyTasks: false,
  excludeDone: false,
};

const UNITS: TaskSavedViewUnit[] = ["day", "week", "month", "quarter"];
const TODAY_BUCKETS: TaskWorkspaceTodayBucket[] = ["byToday", "overdue", "next7", "unplanned", "done"];
const DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeUnit(value: unknown, fallback: TaskSavedViewUnit): TaskSavedViewUnit {
  return UNITS.includes(value as TaskSavedViewUnit) ? value as TaskSavedViewUnit : fallback;
}

function normalizeCustomGanttRange(value: unknown): TaskWorkspaceDateRange {
  if (!isPlainObject(value)) return { start: "", end: "" };
  const start = typeof value.start === "string" && DATE_VALUE_PATTERN.test(value.start) ? value.start : "";
  const end = typeof value.end === "string" && DATE_VALUE_PATTERN.test(value.end) ? value.end : "";
  if (!start || !end || start > end) return { start: "", end: "" };
  return { start, end };
}

export function normalizeTaskWorkspacePreference(
  value: unknown,
  exists: boolean,
): TaskWorkspacePreferenceDto {
  const raw = isPlainObject(value) ? value : {};
  const savedViewConfig = normalizeTaskSavedViewConfig(raw);
  const customGanttRange = normalizeCustomGanttRange(raw.customGanttRange);
  const requestedRangeMode: TaskWorkspaceGanttRangeMode = raw.ganttRangeMode === "custom" ? "custom" : "auto";

  return {
    exists,
    filters: savedViewConfig.filters,
    combinator: savedViewConfig.combinator,
    sort: savedViewConfig.sort,
    group: savedViewConfig.group,
    columns: savedViewConfig.columns,
    columnOrder: savedViewConfig.columnOrder,
    viewMode: savedViewConfig.viewMode,
    splitHierarchy: raw.splitHierarchy === true,
    ganttUnit: normalizeUnit(raw.ganttUnit ?? savedViewConfig.ganttUnit, "month"),
    calendarUnit: normalizeUnit(raw.calendarUnit ?? savedViewConfig.calendarUnit, "month"),
    ganttRangeMode: requestedRangeMode === "custom" && customGanttRange.start ? "custom" : "auto",
    customGanttRange,
    todayBucket: TODAY_BUCKETS.includes(raw.todayBucket as TaskWorkspaceTodayBucket)
      ? raw.todayBucket as TaskWorkspaceTodayBucket
      : "byToday",
    filterMyTasks: raw.filterMyTasks === true,
    excludeDone: raw.excludeDone === true,
  };
}

export function parseTaskWorkspacePreference(raw: string | null | undefined, exists: boolean) {
  if (!raw) return normalizeTaskWorkspacePreference(null, exists);
  try {
    return normalizeTaskWorkspacePreference(JSON.parse(raw), exists);
  } catch {
    return normalizeTaskWorkspacePreference(null, exists);
  }
}

export function serializeTaskWorkspacePreference(value: unknown) {
  const preference = normalizeTaskWorkspacePreference(value, true);
  return JSON.stringify(Object.fromEntries(
    Object.entries(preference).filter(([key]) => key !== "exists"),
  ));
}
