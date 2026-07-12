import type { IssueTypeField, IssueTypeOption, WorkItemFieldValue, WorkItemWithRelations } from "@/components/task/types";
import { parseStoredFieldValue as parseObjectStoredFieldValue } from "@/lib/objects/field-kinds";
import { isResolvedValuePresent, workItemObjectDescriptor } from "@/lib/objects/registry";

export const LOCKED_REQUIRED_SYSTEM_FIELD_KEYS = ["title", "project", "status", "assignee"] as const;
export const LOCKED_OPTIONAL_SYSTEM_FIELD_KEYS = ["parent", "description"] as const;
export const LOCKED_READ_ONLY_SYSTEM_FIELD_KEYS = ["issue_id", "created_at", "updated_at"] as const;
export const EDITABLE_SYSTEM_FIELD_KEYS = [
  ...LOCKED_REQUIRED_SYSTEM_FIELD_KEYS,
  ...LOCKED_OPTIONAL_SYSTEM_FIELD_KEYS,
  "start_date",
  "due_date",
] as const;

export const CANONICAL_FIELD_SCHEMA_ORDER = [
  "title",
  "project",
  "status",
  "assignee",
  "parent",
  "description",
  "start_date",
  "due_date",
  "cycle",
  "issue_id",
  "created_at",
  "updated_at",
] as const;
export const FIELD_SCHEMA_CANONICAL_ID = "system-canonical-field-schema";
export const OBJECT_RECORD_TITLE_FIELD_KEYS = ["object_record_title", "title"] as const;
export const ENTITY_RECORD_EXCLUDED_FIELD_KEYS = ["object_record_title"] as const;
export const OBJECT_RECORD_SCHEMA_FIELD_TYPES = new Set<string>([
  "TEXT",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "URL",
  "REFERENCE",
  "MULTI_REFERENCE",
  "OBJECT_REF",
  "MULTI_OBJECT_REF",
  "ENTITY_REF",
  "MULTI_ENTITY_REF",
  "USER",
]);

export const LOCKED_REQUIRED_SYSTEM_FIELD_KEY_SET = new Set<string>(LOCKED_REQUIRED_SYSTEM_FIELD_KEYS);
export const LOCKED_OPTIONAL_SYSTEM_FIELD_KEY_SET = new Set<string>(LOCKED_OPTIONAL_SYSTEM_FIELD_KEYS);
export const LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET = new Set<string>(LOCKED_READ_ONLY_SYSTEM_FIELD_KEYS);
export const LOCKED_SYSTEM_FIELD_KEY_SET = new Set<string>([
  ...LOCKED_REQUIRED_SYSTEM_FIELD_KEYS,
  ...LOCKED_OPTIONAL_SYSTEM_FIELD_KEYS,
  ...LOCKED_READ_ONLY_SYSTEM_FIELD_KEYS,
]);
export const EDITABLE_SYSTEM_FIELD_KEY_SET = new Set<string>(EDITABLE_SYSTEM_FIELD_KEYS);
export const ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET = new Set<string>(ENTITY_RECORD_EXCLUDED_FIELD_KEYS);

// 필드의 "필수" 여부를 결정하는 단일 규칙(클라이언트/서버/관리자/뷰 공용).
// 잠긴 시스템 필수키는 데이터와 무관하게 항상 필수(title/project/status/assignee),
// 그 외에는 스키마별 isRequired → 필드 기본 isRequired 순으로 OR 판정한다.
// TODO(ai-followup): [배경] FieldSchemaField.isRequired 가 과거 시드/관리자 쓰기에서 누락돼 false 로
// 남는 경우가 있어, 잠금 키 OR 절로 즉시 복구한다. [작업] 데이터 진실화(seed/admin) 완료 후에도 이 규칙은
// 비잠금 커스텀 필수 필드의 단일 소스로 유지. [테스트] 생성 모달 필수 표시 + 서버 필수 검증.
export function resolveSchemaFieldRequired(
  key: string,
  schemaIsRequired?: boolean | null,
  fieldIsRequired?: boolean | null,
) {
  return LOCKED_REQUIRED_SYSTEM_FIELD_KEY_SET.has(key)
    || Boolean(schemaIsRequired)
    || Boolean(fieldIsRequired);
}

export function isObjectRecordTitleFieldKey(key: string) {
  return OBJECT_RECORD_TITLE_FIELD_KEYS.includes(key as (typeof OBJECT_RECORD_TITLE_FIELD_KEYS)[number]);
}

export function resolveObjectSchemaFieldRequired(
  key: string,
  schemaIsRequired?: boolean | null,
  fieldIsRequired?: boolean | null,
) {
  return isObjectRecordTitleFieldKey(key) || Boolean(schemaIsRequired) || Boolean(fieldIsRequired);
}

export function isObjectRecordSchemaFieldType(type: string) {
  return OBJECT_RECORD_SCHEMA_FIELD_TYPES.has(type);
}

export function parseFieldOptions(rawOptions: string | null) {
  if (!rawOptions) return [] as { value: string; label: string; color?: string | null }[];

  try {
    const parsed = JSON.parse(rawOptions) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is { value: string; label: string; color?: string | null } => (
        typeof item === "object"
        && item !== null
        && typeof (item as { value?: string }).value === "string"
        && typeof (item as { label?: string }).label === "string"
      ))
      .map((item) => ({
        value: item.value,
        label: item.label,
        color: item.color ?? null,
      }));
  } catch {
    return [];
  }
}

export function getIssueTypeSchemaFields(issueType: IssueTypeOption | null | undefined) {
  return (
    issueType?.fieldSchema?.fields.map((entry) => ({
      ...entry.field,
      isRequired: resolveSchemaFieldRequired(entry.field.key, entry.isRequired, entry.field.isRequired),
      defaultValue: entry.defaultValue ?? entry.field.defaultValue ?? null,
    })) ?? []
  ) as IssueTypeField[];
}

export function isEditableSchemaField(field: Pick<IssueTypeField, "key">) {
  return !LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET.has(field.key)
    && !ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET.has(field.key);
}

// 제목만 입력하는 빠른 생성(task bar)에서 서버가 자동 충족할 수 있는 필수 시스템 키.
// title=입력, project=컨텍스트, status=시작 상태, assignee=현재 사용자.
const QUICK_CREATE_AUTOFILLABLE_REQUIRED_KEYS = new Set<string>(["title", "project", "status", "assignee"]);

// 빠른 생성이 충족할 수 없는 필수 필드 목록을 반환한다.
// - description/start_date/due_date/parent(필수): 빠른 생성이 값을 제공하지 않음.
// - 커스텀 필수 필드: 기본값이 있어야만 충족 가능.
export function getQuickCreateBlockingRequiredFields(issueType: IssueTypeOption | null | undefined) {
  return getIssueTypeSchemaFields(issueType).filter((field) => {
    if (!field.isRequired) return false;
    if (ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET.has(field.key)) return false;
    if (LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET.has(field.key)) return false;
    if (QUICK_CREATE_AUTOFILLABLE_REQUIRED_KEYS.has(field.key)) return false;
    if (EDITABLE_SYSTEM_FIELD_KEY_SET.has(field.key)) return true; // parent/description/start_date/due_date
    return !field.defaultValue; // custom: 기본값 없으면 충족 불가
  });
}

export function canQuickCreateSatisfyRequiredFields(issueType: IssueTypeOption | null | undefined) {
  return getQuickCreateBlockingRequiredFields(issueType).length === 0;
}

export function isRequiredFieldKey(key: string) {
  return LOCKED_REQUIRED_SYSTEM_FIELD_KEY_SET.has(key);
}

export function isFieldValuePresent(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value?.trim());
}

export function parseStoredFieldValue(field: Pick<IssueTypeField, "type">, value: string | null | undefined) {
  return parseObjectStoredFieldValue(field, value);
}

export function getFieldValueMap(fieldValues: WorkItemFieldValue[] | undefined) {
  return new Map((fieldValues ?? []).map((fieldValue) => [fieldValue.fieldId, fieldValue.value]));
}

export function getCanonicalFieldSortOrder(key: string) {
  const index = CANONICAL_FIELD_SCHEMA_ORDER.indexOf(key as (typeof CANONICAL_FIELD_SCHEMA_ORDER)[number]);
  if (index >= 0) return index;
  return CANONICAL_FIELD_SCHEMA_ORDER.length + 100;
}

export function taskHasMissingRequiredSchemaFields(task: WorkItemWithRelations, issueTypes: IssueTypeOption[]) {
  const issueType = issueTypes.find((item) => item.id === task.issueTypeId);
  if (!issueType) return false;

  const fieldValueMap = getFieldValueMap(task.fieldValues);

  return getIssueTypeSchemaFields(issueType)
    .filter((field) => (
      field.isRequired
      && !LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET.has(field.key)
      && !ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET.has(field.key)
    ))
    .some((field) => {
      const managedField = workItemObjectDescriptor.managedFields[field.key];
      if (managedField) {
        return !isResolvedValuePresent(managedField.resolve(task));
      }

      const parsedValue = parseStoredFieldValue(field, fieldValueMap.get(field.id) ?? null);
      return !isFieldValuePresent(parsedValue ?? undefined);
    });
}
