import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const WORK_ITEM_OBJECT_TYPE = "work_item";
export const CYCLE_OBJECT_TYPE = "cycle";

type DbClient = Prisma.TransactionClient | typeof prisma;

const fieldValueFieldSelect = {
  id: true,
  name: true,
  key: true,
  type: true,
  options: true,
  defaultValue: true,
  referenceObjectKey: true,
  isSystem: true,
  isRequired: true,
} satisfies Prisma.FieldSelect;

export const fieldValueSelect = {
  objectId: true,
  fieldId: true,
  value: true,
  field: { select: fieldValueFieldSelect },
} satisfies Prisma.FieldValueSelect;

export type ObjectFieldValue = Omit<Prisma.FieldValueGetPayload<{ select: typeof fieldValueSelect }>, "objectId">;

export async function readFieldValues(
  client: DbClient,
  objectType: string,
  objectIds: string[],
) {
  const uniqueObjectIds = Array.from(new Set(objectIds));
  if (uniqueObjectIds.length === 0) return new Map<string, ObjectFieldValue[]>();

  const rows = await client.fieldValue.findMany({
    where: { objectType, objectId: { in: uniqueObjectIds } },
    select: fieldValueSelect,
  });
  const byObjectId = new Map<string, ObjectFieldValue[]>();
  for (const row of rows) {
    const { objectId, ...fieldValue } = row;
    const values = byObjectId.get(objectId) ?? [];
    values.push(fieldValue);
    byObjectId.set(objectId, values);
  }

  return byObjectId;
}

export async function withFieldValues<T extends { id: string }>(
  client: DbClient,
  objectType: string,
  objects: T[],
) {
  const byObjectId = await readFieldValues(client, objectType, objects.map((object) => object.id));
  return objects.map((object) => ({
    ...object,
    fieldValues: byObjectId.get(object.id) ?? [],
  }));
}

export async function writeFieldValues(
  client: Prisma.TransactionClient,
  objectType: string,
  objectId: string,
  values: { fieldId: string; value: string }[],
) {
  for (const fieldValue of values) {
    await client.fieldValue.upsert({
      where: {
        objectType_objectId_fieldId: {
          objectType,
          objectId,
          fieldId: fieldValue.fieldId,
        },
      },
      update: { value: fieldValue.value },
      create: {
        objectType,
        objectId,
        fieldId: fieldValue.fieldId,
        value: fieldValue.value,
      },
    });
  }
}

export async function deleteFieldValues(
  client: Prisma.TransactionClient,
  objectType: string,
  objectId: string,
  fieldIds?: string[],
) {
  if (fieldIds && fieldIds.length === 0) return;
  await client.fieldValue.deleteMany({
    where: {
      objectType,
      objectId,
      ...(fieldIds ? { fieldId: { in: fieldIds } } : {}),
    },
  });
}
