import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  isObjectRecordSchemaFieldType,
  isObjectRecordTitleFieldKey,
  resolveObjectSchemaFieldRequired,
} from "@/lib/field-schema";
import {
  isEntityReferenceFieldType,
  isObjectReferenceFieldType,
  isReferenceFieldType,
  parseStoredFieldValue,
} from "@/lib/objects/field-kinds";
import type { ObjectInstanceContext } from "@/lib/objects/instances";
import { getServerObjectDescriptor } from "@/lib/objects/registry-server";

type DbClient = Prisma.TransactionClient | typeof prisma;

export class InvalidReferenceFieldValueError extends Error {
  constructor() {
    super("Invalid custom field value.");
    this.name = "InvalidReferenceFieldValueError";
  }
}

export async function assertObjectFieldSchema(fieldSchemaId: string, client: DbClient = prisma) {
  const schema = await client.fieldSchema.findUnique({
    where: { id: fieldSchemaId },
    include: { fields: { include: { field: true } } },
  });
  if (!schema) {
    return "Field schema not found.";
  }
  const unsupportedField = schema.fields.find((entry) => !isObjectRecordSchemaFieldType(entry.field.type));
  if (unsupportedField) {
    return "Unsupported field type for object record schemas.";
  }
  const hasTitle = schema.fields.some((entry) => (
    isObjectRecordTitleFieldKey(entry.field.key)
    && resolveObjectSchemaFieldRequired(entry.field.key, entry.isRequired, entry.field.isRequired)
  ));
  return hasTitle ? null : "Object field schema must include a required title field.";
}

export async function validateReferenceFieldValues(
  client: DbClient,
  records: { fieldId: string; value: string }[],
  context: ObjectInstanceContext,
) {
  const fieldIds = Array.from(new Set(records.map((record) => record.fieldId)));
  if (fieldIds.length === 0) return;

  const fields = await client.field.findMany({
    where: { id: { in: fieldIds } },
    select: { id: true, type: true, referenceObjectKey: true, referenceObjectDefId: true },
  });
  const fieldsById = new Map(fields.map((field) => [field.id, field]));

  for (const record of records) {
    const field = fieldsById.get(record.fieldId);
    if (!field || !isReferenceFieldType(field.type)) continue;

    const parsed = parseStoredFieldValue(field, record.value);
    const values = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "string"
        ? [parsed]
        : [];
    const nonEmptyValues = values.map((value) => value.trim()).filter(Boolean);

    if (isObjectReferenceFieldType(field.type) && field.referenceObjectDefId) {
      const validCount = await client.objectRecord.count({
        where: {
          id: { in: nonEmptyValues },
          objectDefId: field.referenceObjectDefId,
          deletedAt: null,
        },
      });
      if (validCount !== new Set(nonEmptyValues).size) throw new InvalidReferenceFieldValueError();
      continue;
    }

    if (isEntityReferenceFieldType(field.type)) {
      for (const value of nonEmptyValues) {
        const valid = await client.workItem.findFirst({
          where: {
            deletedAt: null,
            ...(field.referenceObjectKey ? { issueType: { key: field.referenceObjectKey } } : {}),
            OR: [
              { id: value },
              ...(field.referenceObjectKey === "cycle"
                ? [{ sourceTable: "cycle", sourceId: value }]
                : []),
            ],
          },
          select: { id: true },
        });
        if (!valid) throw new InvalidReferenceFieldValueError();
      }
      continue;
    }

    const targetKey = field.referenceObjectKey ?? (field.type === "USER" ? "user" : null);
    const descriptor = targetKey ? getServerObjectDescriptor(targetKey) : null;
    if (!descriptor) throw new InvalidReferenceFieldValueError();

    for (const value of nonEmptyValues) {
      const valid = await descriptor.validateReference(client, value, context);
      if (!valid) throw new InvalidReferenceFieldValueError();
    }
  }
}
