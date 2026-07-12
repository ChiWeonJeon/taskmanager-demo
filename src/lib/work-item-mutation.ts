import type { Prisma } from "@/generated/prisma/client";
import { ENTITY_RECORD_EXCLUDED_FIELD_KEYS, resolveSchemaFieldRequired } from "@/lib/field-schema";
import {
  hasFieldInputValue as hasObjectFieldInputValue,
  normalizeFieldValueForStorage as normalizeObjectFieldValueForStorage,
  parseFieldOptions,
} from "@/lib/objects/field-kinds";

export const MANAGED_SCHEMA_FIELD_KEYS = new Set([
  "title",
  "project",
  "status",
  "assignee",
  "parent",
  "description",
  "start_date",
  "due_date",
  "issue_id",
  "created_at",
  "updated_at",
  ...ENTITY_RECORD_EXCLUDED_FIELD_KEYS,
]);

export const READ_ONLY_SCHEMA_FIELD_KEYS = new Set(["issue_id", "created_at", "updated_at"]);

export const issueTypeSchemaInclude = {
  fieldSchema: {
    include: {
      fields: {
        include: { field: true },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
  statusSchema: {
    include: {
      statuses: {
        include: { status: true },
        orderBy: { sortOrder: "asc" as const },
      },
      transitions: {
        select: { fromStatusId: true, toStatusId: true },
      },
    },
  },
} satisfies Prisma.IssueTypeInclude;

export type IssueTypeWithSchema = Prisma.IssueTypeGetPayload<{ include: typeof issueTypeSchemaInclude }>;

export interface SchemaFieldDefinition {
  id: string;
  name: string;
  key: string;
  type: string;
  options: string | null;
  referenceObjectKey?: string | null;
  defaultValue: string | null;
  isRequired: boolean;
}

export function getSchemaFieldDefinitions(issueType: IssueTypeWithSchema) {
  return issueType.fieldSchema.fields.map((entry) => ({
    id: entry.field.id,
    name: entry.field.name,
    key: entry.field.key,
    type: entry.field.type,
    options: entry.field.options,
    referenceObjectKey: entry.field.referenceObjectKey,
    defaultValue: entry.defaultValue ?? entry.field.defaultValue,
    isRequired: resolveSchemaFieldRequired(entry.field.key, entry.isRequired, entry.field.isRequired),
  })) satisfies SchemaFieldDefinition[];
}

export function normalizeDateInput(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Dates must use YYYY-MM-DD.");
  }

  const normalized = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(normalized.getTime())) {
    throw new Error("Enter a valid date.");
  }

  return normalized;
}

export function formatHistoryDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matched) return matched[1];
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function parseSchemaFieldOptions(rawOptions: string | null) {
  return parseFieldOptions(rawOptions).map((option) => ({ value: option.value, label: option.label }));
}

export function hasFieldInputValue(value: unknown) {
  return hasObjectFieldInputValue(value);
}

export function normalizeFieldValueForStorage(field: SchemaFieldDefinition, value: unknown): string | null {
  return normalizeObjectFieldValueForStorage(field, value);
}

// 전이 규칙: 스키마에 transition 이 하나도 없으면 제약 없음. 있으면 from → to 가 허용 목록에 있어야 한다.
export function isStatusTransitionAllowed(
  issueType: IssueTypeWithSchema,
  fromStatusId: string | null | undefined,
  toStatusId: string,
) {
  if (!fromStatusId || fromStatusId === toStatusId) return true;
  const transitions = issueType.statusSchema?.transitions ?? [];
  if (transitions.length === 0) return true;
  // 현재 상태가 이 스키마에 속하지 않으면(유형 변경 등) 전이 제약을 적용하지 않는다.
  const inSchema = issueType.statusSchema?.statuses.some((entry) => entry.status.id === fromStatusId);
  if (!inSchema) return true;
  return transitions.some(
    (transition) => transition.fromStatusId === fromStatusId && transition.toStatusId === toStatusId,
  );
}

export function resolveStatusId(issueType: IssueTypeWithSchema, requestedStatusId: string | undefined, fallbackStatusId?: string | null) {
  const allowedStatuses = issueType.statusSchema?.statuses.map((entry) => entry.status) ?? [];
  if (requestedStatusId) {
    if (allowedStatuses.length > 0 && !allowedStatuses.some((status) => status.id === requestedStatusId)) {
      throw new Error("The selected status is not allowed for this type.");
    }
    if (!isStatusTransitionAllowed(issueType, fallbackStatusId, requestedStatusId)) {
      throw new Error("This status transition is not allowed.");
    }
    return requestedStatusId;
  }

  if (fallbackStatusId && allowedStatuses.some((status) => status.id === fallbackStatusId)) {
    return fallbackStatusId;
  }

  const configuredStartStatusId = issueType.statusSchema?.startStatusId;
  const startStatusId = configuredStartStatusId
    && allowedStatuses.some((status) => status.id === configuredStartStatusId)
    ? configuredStartStatusId
    : undefined;
  const defaultStatusId = startStatusId
    ?? allowedStatuses.find((status) => status.key === "open")?.id
    ?? allowedStatuses[0]?.id;
  if (!defaultStatusId) {
    throw new Error("No statuses are configured for this type.");
  }

  return defaultStatusId;
}
