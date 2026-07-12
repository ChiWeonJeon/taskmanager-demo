import { IssueTypeWithSchemas, parseStoredValue } from "@/lib/issue-type-config";
import { ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET, resolveSchemaFieldRequired } from "@/lib/field-schema";
import {
  hasFieldInputValue,
  normalizeFieldValueForStorage as normalizeObjectFieldValueForStorage,
} from "@/lib/objects/field-kinds";

export interface SchemaFieldDefinition {
  id: string;
  name: string;
  key: string;
  type: string;
  options: string | null;
  referenceObjectKey?: string | null;
  defaultValue: string | null;
  isSystem: boolean;
  isRequired: boolean;
}

export interface ManagedFieldContext {
  title?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export const READ_ONLY_SCHEMA_FIELD_KEYS = new Set(["issue_id", "updated_at"]);
export const SYSTEM_MANAGED_SCHEMA_FIELD_KEYS = new Set([
  "title",
  "project",
  "assignee",
  "description",
  "start_date",
  "due_date",
]);

export function getIssueTypeSchemaFields(issueType: IssueTypeWithSchemas) {
  return issueType.fieldSchema.fields.map((entry) => ({
    id: entry.field.id,
    name: entry.field.name,
    key: entry.field.key,
    type: entry.field.type,
    options: entry.field.options,
    referenceObjectKey: entry.field.referenceObjectKey,
    defaultValue: entry.defaultValue ?? entry.field.defaultValue,
    isSystem: entry.field.isSystem,
    isRequired: resolveSchemaFieldRequired(entry.field.key, entry.isRequired, entry.field.isRequired),
  })) satisfies SchemaFieldDefinition[];
}

export function getIssueTypeStartStatus(issueType: IssueTypeWithSchemas) {
  return issueType.statusSchema?.startStatus
    ?? issueType.statusSchema?.statuses[0]?.status
    ?? null;
}

export function isSchemaFieldEditable(field: SchemaFieldDefinition) {
  return !READ_ONLY_SCHEMA_FIELD_KEYS.has(field.key);
}

export function isDynamicCustomField(field: SchemaFieldDefinition) {
  if (ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET.has(field.key)) return false;
  return !READ_ONLY_SCHEMA_FIELD_KEYS.has(field.key)
    && !SYSTEM_MANAGED_SCHEMA_FIELD_KEYS.has(field.key);
}

export function normalizeFieldValueForStorage(field: SchemaFieldDefinition, value: unknown): string | null {
  return normalizeObjectFieldValueForStorage(field, value);
}

export function getRequiredFieldError(field: SchemaFieldDefinition, context: ManagedFieldContext, value: unknown) {
  if (!field.isRequired) return null;
  if (ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET.has(field.key)) return null;

  const isMissing = (() => {
    switch (field.key) {
      case "title":
        return !context.title?.trim();
      case "project":
        return !context.projectId;
      case "assignee":
        return !context.assigneeId;
      case "description":
        return !context.description?.trim();
      case "start_date":
        return !context.startDate;
      case "due_date":
        return !context.dueDate;
      case "issue_id":
      case "updated_at":
        return false;
      default:
        return !hasFieldInputValue(value);
    }
  })();

  return isMissing ? `${field.name} is required.` : null;
}

export function buildSchemaFieldValueRecords(args: {
  issueType: IssueTypeWithSchemas;
  rawFieldValues: Record<string, unknown>;
  managedFieldContext: ManagedFieldContext;
  existingFieldValues?: Map<string, string>;
}) {
  const preparedFieldValues = [] as { fieldId: string; value: string }[];
  const schemaFields = getIssueTypeSchemaFields(args.issueType);

  for (const field of schemaFields) {
    if (READ_ONLY_SCHEMA_FIELD_KEYS.has(field.key)) {
      continue;
    }

    const incomingValue = args.rawFieldValues[field.id];
    const parsedExistingValue = args.existingFieldValues?.has(field.id)
      ? parseStoredValue(args.existingFieldValues.get(field.id))
      : undefined;
    const parsedDefaultValue = parseStoredValue(field.defaultValue);
    const effectiveValue = incomingValue !== undefined
      ? incomingValue
      : parsedExistingValue !== undefined
        ? parsedExistingValue
        : parsedDefaultValue;

    const requiredFieldError = getRequiredFieldError(field, args.managedFieldContext, effectiveValue);
    if (requiredFieldError) {
      throw new Error(requiredFieldError);
    }

    if (!isDynamicCustomField(field)) {
      continue;
    }

    const normalizedFieldValue = normalizeFieldValueForStorage(field, effectiveValue);
    if (!normalizedFieldValue) continue;

    preparedFieldValues.push({
      fieldId: field.id,
      value: normalizedFieldValue,
    });
  }

  return preparedFieldValues;
}
