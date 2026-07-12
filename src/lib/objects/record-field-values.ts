import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isObjectRecordTitleFieldKey, resolveObjectSchemaFieldRequired } from "@/lib/field-schema";
import { hasFieldInputValue, normalizeFieldValueForStorage } from "@/lib/objects/field-kinds";
import { parseStoredValue } from "@/lib/issue-type-config";

export const objectDefRecordFieldSchemaInclude = {
  fieldSchema: {
    include: {
      fields: {
        include: { field: true },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
} satisfies Prisma.ObjectDefInclude;

export type ObjectDefWithRecordFieldSchema = Prisma.ObjectDefGetPayload<{
  include: typeof objectDefRecordFieldSchemaInclude;
}>;

type DbClient = Prisma.TransactionClient | typeof prisma;

export function getObjectRecordSchemaFieldIds(objectDef: ObjectDefWithRecordFieldSchema) {
  return objectDef.fieldSchema.fields.map((entry) => entry.fieldId);
}

function isObjectRecordTitleField(key: string) {
  return isObjectRecordTitleFieldKey(key);
}

export function buildObjectRecordFieldValueRecords(
  objectDef: ObjectDefWithRecordFieldSchema,
  rawFieldValues: unknown,
  coreValues: { title?: string } = {},
) {
  const input = rawFieldValues && typeof rawFieldValues === "object" && !Array.isArray(rawFieldValues)
    ? rawFieldValues as Record<string, unknown>
    : {};

  const records = [] as { fieldId: string; value: string }[];
  for (const entry of objectDef.fieldSchema.fields) {
    const field = entry.field;
    const value = Object.prototype.hasOwnProperty.call(input, field.id)
      ? input[field.id]
      : isObjectRecordTitleField(field.key) && coreValues.title
        ? coreValues.title
      : parseStoredValue(entry.defaultValue ?? field.defaultValue);
    const isRequired = resolveObjectSchemaFieldRequired(field.key, entry.isRequired, field.isRequired);

    if (isRequired && !hasFieldInputValue(value)) {
      throw new Error(`${field.name} is required.`);
    }

    const normalized = normalizeFieldValueForStorage(field, value);
    if (normalized) records.push({ fieldId: field.id, value: normalized });
  }
  return records;
}

export async function replaceObjectRecordFieldValues(
  client: DbClient,
  objectRecordId: string,
  schemaFieldIds: string[],
  records: { fieldId: string; value: string }[],
) {
  if (schemaFieldIds.length > 0) {
    await client.objectRecordFieldValue.deleteMany({
      where: { objectRecordId, fieldId: { in: schemaFieldIds } },
    });
  }
  if (records.length > 0) {
    await client.objectRecordFieldValue.createMany({
      data: records.map((record) => ({ objectRecordId, ...record })),
    });
  }
}
