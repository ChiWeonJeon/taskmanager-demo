import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { LocaleMessages } from "@/lib/i18n/messages";
import {
  getCycleIssueTypeWithSchema,
  parseStoredValue,
  type IssueTypeWithSchemas,
} from "@/lib/issue-type-config";
import { hasFieldInputValue, normalizeFieldValueForStorage } from "@/lib/objects/field-kinds";
import {
  CYCLE_OBJECT_TYPE,
  deleteFieldValues,
  readFieldValues,
  withFieldValues,
  writeFieldValues,
  type ObjectFieldValue,
} from "@/lib/objects/field-value";
import { getObjectDescriptor } from "@/lib/objects/registry";

type DbClient = Prisma.TransactionClient | typeof prisma;

const cycleManagedFieldKeys = new Set(Object.keys(getObjectDescriptor(CYCLE_OBJECT_TYPE)?.managedFields ?? {}));

function requiredFieldMessage(messages: LocaleMessages, fieldName: string) {
  return messages.createTaskModal.requiredField.replace("{field}", fieldName);
}

export function getCycleSchemaFields(issueType: IssueTypeWithSchemas | null | undefined) {
  return (
    issueType?.fieldSchema.fields.map((entry) => ({
      id: entry.field.id,
      name: entry.field.name,
      key: entry.field.key,
      type: entry.field.type,
      options: entry.field.options,
      referenceObjectKey: entry.field.referenceObjectKey,
      defaultValue: entry.defaultValue ?? entry.field.defaultValue,
      isSystem: entry.field.isSystem,
      isRequired: Boolean(entry.isRequired || entry.field.isRequired),
    })) ?? []
  );
}

export async function resolveCycleIssueType(client: DbClient, issueTypeId?: string | null) {
  return getCycleIssueTypeWithSchema(client, issueTypeId);
}

export async function attachCycleFieldValues<T extends { id: string }>(client: DbClient, cycles: T[]) {
  return withFieldValues(client, CYCLE_OBJECT_TYPE, cycles);
}

export async function readCycleFieldValueMap(client: DbClient, cycleId: string) {
  const byCycleId = await readFieldValues(client, CYCLE_OBJECT_TYPE, [cycleId]);
  return new Map((byCycleId.get(cycleId) ?? []).map((fieldValue) => [fieldValue.fieldId, fieldValue.value]));
}

export function buildCycleFieldValuePatch(args: {
  issueType: IssueTypeWithSchemas;
  rawFieldValues: Record<string, unknown>;
  clearFieldIds?: string[];
  existingFieldValues?: Map<string, string>;
  messages: LocaleMessages;
}) {
  const records: { fieldId: string; value: string }[] = [];
  const clearFieldIds = new Set(args.clearFieldIds ?? []);

  for (const field of getCycleSchemaFields(args.issueType)) {
    if (cycleManagedFieldKeys.has(field.key)) continue;

    const hasIncomingValue = Object.prototype.hasOwnProperty.call(args.rawFieldValues, field.id);
    const incomingValue = args.rawFieldValues[field.id];
    const existingValue = args.existingFieldValues?.has(field.id)
      ? parseStoredValue(args.existingFieldValues.get(field.id))
      : undefined;
    const defaultValue = parseStoredValue(field.defaultValue);
    const effectiveValue = hasIncomingValue
      ? incomingValue
      : existingValue !== undefined
        ? existingValue
        : defaultValue;

    if (field.isRequired && !hasFieldInputValue(effectiveValue)) {
      throw new Error(requiredFieldMessage(args.messages, field.name));
    }

    const normalized = normalizeFieldValueForStorage(field, effectiveValue);
    if (normalized) {
      records.push({ fieldId: field.id, value: normalized });
      clearFieldIds.delete(field.id);
    } else if (hasIncomingValue) {
      clearFieldIds.add(field.id);
    }
  }

  return { records, clearFieldIds: Array.from(clearFieldIds) };
}

export async function writeCycleFieldValues(
  client: Prisma.TransactionClient,
  cycleId: string,
  patch: { records: { fieldId: string; value: string }[]; clearFieldIds: string[] },
) {
  await deleteFieldValues(client, CYCLE_OBJECT_TYPE, cycleId, patch.clearFieldIds);
  await writeFieldValues(client, CYCLE_OBJECT_TYPE, cycleId, patch.records);
}

export async function deleteCycleFieldValues(client: Prisma.TransactionClient, cycleId: string) {
  await deleteFieldValues(client, CYCLE_OBJECT_TYPE, cycleId);
}

export type CycleFieldValue = ObjectFieldValue;
