import type { WorkItemWithRelations } from "@/components/task/types";
import { getTaskCustomFieldValue, type WorkspaceField } from "@/lib/workspace-field-model";

export type FilterFieldKey =
  | "title"
  | "issueKey"
  | "description"
  | "status"
  | "issueType"
  | "assignee"
  | "project"
  | "startDate"
  | "dueDate"
  | "createdAt"
  | "updatedAt"
  | (string & {});
export type FilterFieldKind = "text" | "number" | "select" | "multiselect" | "date";
export type FilterOperator =
  | "contains"
  | "not_contains"
  | "is"
  | "is_not"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "in"
  | "not_in"
  | "on_or_before"
  | "on_or_after"
  | "is_empty"
  | "is_not_empty";
export type FilterCombinator = "AND" | "OR";
export type SortFieldKey = "title" | "startDate" | "dueDate" | "createdAt" | "updatedAt" | "status" | "issueType";
export type SortDirection = "asc" | "desc";

export interface FilterCondition {
  id: string;
  field: FilterFieldKey;
  operator: FilterOperator;
  value: string | string[];
  value2?: string;
  locked?: boolean;
}

export interface SortRule {
  id: string;
  field: SortFieldKey;
  direction: SortDirection;
}

export interface TaskFilterSanitizeOptions {
  validStatusIds?: Set<string>;
}

export const FILTER_FIELDS: FilterFieldKey[] = ["title", "issueKey", "description", "status", "issueType", "assignee", "project", "startDate", "dueDate", "createdAt", "updatedAt"];
export const SORT_FIELDS: SortFieldKey[] = ["title", "startDate", "dueDate", "createdAt", "updatedAt", "status", "issueType"];

export const FILTER_OPERATORS_BY_KIND: Record<FilterFieldKind, FilterOperator[]> = {
  text: ["contains", "not_contains", "is", "is_not", "is_empty", "is_not_empty"],
  number: ["is", "is_not", "gt", "gte", "lt", "lte", "between", "is_empty", "is_not_empty"],
  date: ["is", "is_not", "gt", "gte", "lt", "lte", "between", "is_empty", "is_not_empty"],
  select: ["in", "not_in", "is_empty", "is_not_empty"],
  multiselect: ["in", "not_in", "is_empty", "is_not_empty"],
};

function isSelectFilterField(field: FilterFieldKey) {
  return field === "status" || field === "issueType" || field === "assignee" || field === "project";
}

function isDateFilterField(field: FilterFieldKey) {
  return field.endsWith("Date") || field.endsWith("At");
}

export function createFilterId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getFilterFieldKind(field: FilterFieldKey, customFieldById?: Map<string, WorkspaceField>): FilterFieldKind {
  const custom = customFieldById?.get(field);
  if (custom) {
    if (["SELECT", "REFERENCE", "OBJECT_REF", "ENTITY_REF", "USER"].includes(custom.type)) return "select";
    if (["MULTI_SELECT", "MULTI_REFERENCE", "MULTI_OBJECT_REF", "MULTI_ENTITY_REF"].includes(custom.type)) return "multiselect";
    if (custom.type === "DATE") return "date";
    if (custom.type === "NUMBER") return "number";
    return "text";
  }
  if (isSelectFilterField(field)) return "select";
  if (isDateFilterField(field)) return "date";
  return "text";
}

export function normalizeOperatorForKind(operator: FilterOperator, kind: FilterFieldKind): FilterOperator {
  let normalized = operator;
  if (operator === "on_or_before") normalized = "lte";
  if (operator === "on_or_after") normalized = "gte";
  if ((kind === "select" || kind === "multiselect") && operator === "is") normalized = "in";
  if ((kind === "select" || kind === "multiselect") && operator === "is_not") normalized = "not_in";

  return FILTER_OPERATORS_BY_KIND[kind].includes(normalized)
    ? normalized
    : FILTER_OPERATORS_BY_KIND[kind][0]!;
}

export function createSortRule(field: SortFieldKey = "dueDate", direction: SortDirection = "asc"): SortRule {
  return {
    id: createFilterId(),
    field,
    direction,
  };
}

export function createFilterCondition(field: FilterFieldKey, kind: FilterFieldKind = getFilterFieldKind(field)): FilterCondition {
  const isSelectLike = kind === "select" || kind === "multiselect";
  const operator: FilterOperator = isSelectLike ? "in" : kind === "date" ? "lte" : kind === "number" ? "is" : "contains";
  return {
    id: createFilterId(),
    field,
    operator,
    value: isSelectLike ? [] : "",
  };
}

export function toDateFieldValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function filterRequiresValue(operator: FilterOperator) {
  return operator !== "is_empty" && operator !== "is_not_empty";
}

export function filterConditionHasValue(condition: FilterCondition): boolean {
  if (!filterRequiresValue(condition.operator)) return true;
  if (condition.operator === "between") {
    return Boolean(filterConditionStringValue(condition).trim()) && Boolean((condition.value2 ?? "").trim());
  }
  if (Array.isArray(condition.value)) return condition.value.length > 0;
  return Boolean(condition.value.trim());
}

export function filterConditionStringValue(condition: FilterCondition): string {
  if (Array.isArray(condition.value)) return condition.value[0] ?? "";
  return condition.value;
}

export function getTaskFilterValue(
  task: WorkItemWithRelations,
  field: FilterFieldKey,
  customFieldById?: Map<string, WorkspaceField>,
): string | string[] {
  switch (field) {
    case "title": return task.title;
    case "issueKey": return task.issueKey;
    case "description": return task.description ?? "";
    case "status": return task.statusId;
    case "issueType": return task.issueTypeId;
    case "assignee": return task.assignee?.id ?? "";
    case "project": return task.projectId ?? "";
    case "startDate": return toDateFieldValue(task.startDate);
    case "dueDate": return toDateFieldValue(task.dueDate);
    case "createdAt": return toDateFieldValue(task.createdAt);
    case "updatedAt": return toDateFieldValue(task.updatedAt);
    default: {
      const custom = customFieldById?.get(field);
      if (custom) return getTaskCustomFieldValue(task, custom) ?? "";
      return "";
    }
  }
}

function compareScalar(fieldValue: string, conditionValue: string, operator: FilterOperator, kind: FilterFieldKind, value2?: string) {
  if (kind === "number") {
    const left = Number(fieldValue);
    const right = Number(conditionValue);
    const right2 = Number(value2);
    if (Number.isNaN(left) || Number.isNaN(right) || (operator === "between" && Number.isNaN(right2))) return false;
    if (operator === "between") return left >= right && left <= right2;
    if (operator === "gt") return left > right;
    if (operator === "gte") return left >= right;
    if (operator === "lt") return left < right;
    if (operator === "lte") return left <= right;
    if (operator === "is") return left === right;
    if (operator === "is_not") return left !== right;
    return true;
  }

  if (kind === "date") {
    if (!fieldValue) return false;
    const upperValue = value2 ?? "";
    if (operator === "between") return Boolean(upperValue) && fieldValue >= conditionValue && fieldValue <= upperValue;
    if (operator === "gt") return fieldValue > conditionValue;
    if (operator === "gte") return fieldValue >= conditionValue;
    if (operator === "lt") return fieldValue < conditionValue;
    if (operator === "lte") return fieldValue <= conditionValue;
    if (operator === "is") return fieldValue === conditionValue;
    if (operator === "is_not") return fieldValue !== conditionValue;
    return true;
  }

  const normalizedFieldValue = normalizeText(fieldValue);
  const normalizedConditionValue = normalizeText(conditionValue);
  if (operator === "contains") return normalizedFieldValue.includes(normalizedConditionValue);
  if (operator === "not_contains") return !normalizedFieldValue.includes(normalizedConditionValue);
  if (operator === "is") return normalizedFieldValue === normalizedConditionValue || fieldValue === conditionValue;
  if (operator === "is_not") return normalizedFieldValue !== normalizedConditionValue && fieldValue !== conditionValue;
  return true;
}

export function matchesFilterCondition(
  task: WorkItemWithRelations,
  condition: FilterCondition,
  customFieldById?: Map<string, WorkspaceField>,
) {
  const kind = getFilterFieldKind(condition.field, customFieldById);
  const operator = normalizeOperatorForKind(condition.operator, kind);
  const rawValue = getTaskFilterValue(task, condition.field, customFieldById);
  const fieldArray = Array.isArray(rawValue) ? rawValue : (rawValue ? [rawValue] : []);
  const hasValue = fieldArray.length > 0;

  if (operator === "is_empty") return !hasValue;
  if (operator === "is_not_empty") return hasValue;

  if (kind === "select" || kind === "multiselect") {
    const values = Array.isArray(condition.value) ? condition.value : condition.value ? [condition.value] : [];
    if (values.length === 0) return true;
    const matchesOne = (candidate: string) =>
      fieldArray.some((fieldValue) => fieldValue === candidate || normalizeText(fieldValue) === normalizeText(candidate));
    const matches = values.some(matchesOne);
    return operator === "not_in" ? !matches : matches;
  }

  const conditionValue = filterConditionStringValue(condition);
  if (!conditionValue.trim()) return true;

  if (operator === "is_not" || operator === "not_contains") {
    return fieldArray.every((fieldValue) => compareScalar(fieldValue, conditionValue, operator, kind, condition.value2));
  }
  return fieldArray.some((fieldValue) => compareScalar(fieldValue, conditionValue, operator, kind, condition.value2));
}

function getTaskSortValue(task: WorkItemWithRelations, field: SortFieldKey) {
  switch (field) {
    case "title": return task.title;
    case "startDate": return task.startDate ?? "";
    case "dueDate": return task.dueDate ?? "";
    case "createdAt": return task.createdAt;
    case "updatedAt": return task.updatedAt;
    case "status": return task.status.name;
    case "issueType": return task.issueType.name;
    default: return "";
  }
}

export function sortItems(tasks: WorkItemWithRelations[], sortRules: SortRule[], locale: string) {
  if (sortRules.length === 0) return tasks;

  return [...tasks].sort((a, b) => {
    for (const rule of sortRules) {
      const left = getTaskSortValue(a, rule.field);
      const right = getTaskSortValue(b, rule.field);
      const compared = left.localeCompare(right, locale);
      if (compared !== 0) return rule.direction === "asc" ? compared : compared * -1;
    }

    return 0;
  });
}

function encodeFilterValue(value: string | string[]) {
  if (Array.isArray(value)) return value.map((item) => encodeURIComponent(item)).join(",");
  return encodeURIComponent(value);
}

function decodeFilterValue(raw: string, kind: FilterFieldKind) {
  if (kind === "select" || kind === "multiselect") {
    return raw
      .split(",")
      .map((item) => decodeURIComponent(item))
      .filter(Boolean);
  }
  return decodeURIComponent(raw);
}

export function serializeTaskFilters(conditions: FilterCondition[]) {
  const parts = conditions
    .filter((condition) => !condition.locked && filterConditionHasValue(condition))
    .map((condition) => {
      const segments = [
        condition.field,
        condition.operator,
        encodeFilterValue(condition.value),
      ];
      if (condition.operator === "between") segments.push(encodeURIComponent(condition.value2 ?? ""));
      return segments.join(":");
    });
  return parts.join("||");
}

export function parseTaskFilters(raw: string | null | undefined, customFieldById?: Map<string, WorkspaceField>) {
  if (!raw) return [] as FilterCondition[];
  return raw
    .split("||")
    .map((part): FilterCondition | null => {
      const [field, rawOperator, rawValue = "", rawValue2] = part.split(":");
      if (!field || !rawOperator) return null;
      const customKnown = Boolean(customFieldById?.has(field));
      const inferredKind: FilterFieldKind | null = rawOperator === "in" || rawOperator === "not_in"
        ? "multiselect"
        : ["gt", "gte", "lt", "lte", "between"].includes(rawOperator)
          ? "number"
          : null;
      const kind = customKnown || FILTER_FIELDS.includes(field)
        ? getFilterFieldKind(field, customFieldById)
        : inferredKind ?? getFilterFieldKind(field, customFieldById);
      const operator = normalizeOperatorForKind(rawOperator as FilterOperator, kind);
      const condition: FilterCondition = {
        id: createFilterId(),
        field,
        operator,
        value: decodeFilterValue(rawValue, kind),
        value2: rawValue2 ? decodeURIComponent(rawValue2) : undefined,
      };
      return condition;
    })
    .filter((condition): condition is FilterCondition => Boolean(condition));
}

export function sanitizeTaskFilterConditions(
  conditions: FilterCondition[],
  { validStatusIds }: TaskFilterSanitizeOptions,
) {
  if (!validStatusIds || validStatusIds.size === 0) return conditions;

  let changed = false;
  const sanitized: FilterCondition[] = [];

  for (const condition of conditions) {
    if (condition.locked || condition.field !== "status") {
      sanitized.push(condition);
      continue;
    }

    if (!filterRequiresValue(condition.operator)) {
      sanitized.push(condition);
      continue;
    }

    const rawValues = Array.isArray(condition.value)
      ? condition.value
      : condition.value
        ? [condition.value]
        : [];
    const validValues = rawValues.filter((value) => validStatusIds.has(value));

    if (validValues.length !== rawValues.length) changed = true;
    if (validValues.length === 0) {
      changed = true;
      continue;
    }

    sanitized.push({ ...condition, value: validValues });
  }

  return changed ? sanitized : conditions;
}

export function serializeTaskSort(sortRules: SortRule[]) {
  return sortRules
    .filter((rule) => SORT_FIELDS.includes(rule.field))
    .map((rule) => `${rule.field}:${rule.direction}`)
    .join(",");
}

export function parseTaskSort(raw: string | null | undefined) {
  if (!raw) return [] as SortRule[];
  return raw
    .split(",")
    .map((part) => {
      const [field, direction] = part.split(":");
      if (!SORT_FIELDS.includes(field as SortFieldKey)) return null;
      return createSortRule(field as SortFieldKey, direction === "desc" ? "desc" : "asc");
    })
    .filter((rule): rule is SortRule => Boolean(rule));
}
