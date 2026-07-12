import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { SchemaFieldDefinition } from "@/lib/work-item-schema";
import { parseStoredValue } from "@/lib/issue-type-config";
import { WORK_ITEM_OBJECT_TYPE } from "@/lib/objects/field-value";
import { workItemObjectDescriptor } from "@/lib/objects/registry";

type DbClient = Prisma.TransactionClient | typeof prisma;

const missingManagedWorkItemWhereByKey: Record<string, Prisma.WorkItemWhereInput | null> = {
  title: { OR: [{ title: "" }] },
  project: null,
  status: null,
  assignee: { assigneeId: null },
  parent: { parentId: null },
  description: { OR: [{ description: null }, { description: "" }] },
  start_date: { startDate: null },
  due_date: { dueDate: null },
  issue_id: null,
  created_at: null,
  updated_at: null,
};

async function countWorkItemsMissingField(
  client: DbClient,
  issueTypeIds: string[],
  field: SchemaFieldDefinition,
) {
  if (issueTypeIds.length === 0) return 0;

  if (workItemObjectDescriptor.managedFields[field.key]) {
    const missingWhere = missingManagedWorkItemWhereByKey[field.key];
    if (!missingWhere) return 0;
    return client.workItem.count({
      where: {
        issueTypeId: { in: issueTypeIds },
        ...missingWhere,
      },
    });
  }

  const workItems = await client.workItem.findMany({
    where: { issueTypeId: { in: issueTypeIds } },
    select: { id: true },
  });
  if (workItems.length === 0) return 0;

  const values = await client.fieldValue.findMany({
    where: {
      objectType: WORK_ITEM_OBJECT_TYPE,
      objectId: { in: workItems.map((workItem) => workItem.id) },
      fieldId: field.id,
    },
    select: { objectId: true, value: true },
  });
  const valueByObjectId = new Map(values.map((value) => [value.objectId, value.value]));

  return workItems.filter((workItem) => {
    const value = valueByObjectId.get(workItem.id);
    const parsedValue = value ? parseStoredValue(value) : null;

    if (Array.isArray(parsedValue)) {
      return parsedValue.length === 0;
    }

    return parsedValue == null || parsedValue === "";
  }).length;
}

export async function assertRequiredSchemaFieldsSatisfied(
  client: DbClient,
  issueTypeIds: string[],
  fields: SchemaFieldDefinition[],
) {
  for (const field of fields) {
    if (!field.isRequired) continue;

    const missingCount = await countWorkItemsMissingField(client, issueTypeIds, field);
    if (missingCount > 0) {
      throw new Error(`Cannot require ${field.name}: ${missingCount} existing work items are missing a value.`);
    }
  }
}

export async function assertStatusesAllowedForIssueTypes(
  client: DbClient,
  issueTypeIds: string[],
  allowedStatusIds: string[],
) {
  if (issueTypeIds.length === 0) return;

  const invalidCount = await client.workItem.count({
    where: {
      issueTypeId: { in: issueTypeIds },
      statusId: { notIn: allowedStatusIds },
    },
  });

  if (invalidCount > 0) {
    throw new Error(`Cannot apply this status configuration: ${invalidCount} existing work items use disallowed statuses.`);
  }
}

export async function assertSchemaFieldRemovalAllowed(
  client: DbClient,
  issueTypeIds: string[],
  removedFieldIds: string[],
) {
  if (issueTypeIds.length === 0 || removedFieldIds.length === 0) return;

  const workItems = await client.workItem.findMany({
    where: { issueTypeId: { in: issueTypeIds } },
    select: { id: true },
  });
  if (workItems.length === 0) return;

  const invalidCount = await client.fieldValue.count({
    where: {
      objectType: WORK_ITEM_OBJECT_TYPE,
      objectId: { in: workItems.map((workItem) => workItem.id) },
      fieldId: { in: removedFieldIds },
    },
  });

  if (invalidCount > 0) {
    throw new Error(`Cannot remove a field that is still used by ${invalidCount} work items.`);
  }
}

export async function assertObjectSchemaFieldRemovalAllowed(
  client: DbClient,
  objectDefIds: string[],
  removedFieldIds: string[],
) {
  if (objectDefIds.length === 0 || removedFieldIds.length === 0) return;

  const invalidCount = await client.objectRecordFieldValue.count({
    where: {
      fieldId: { in: removedFieldIds },
      objectRecord: {
        objectDefId: { in: objectDefIds },
        deletedAt: null,
      },
    },
  });

  if (invalidCount > 0) {
    throw new Error(`Cannot remove a field that is still used by ${invalidCount} object records.`);
  }
}

// 필드 스키마별 기본값(FieldSchemaField.defaultValue)이 제거될 옵션을 가리키면 차단한다.
export async function assertSchemaDefaultOptionsRemovalAllowed(
  client: DbClient,
  fieldId: string,
  removedOptionValues: string[],
) {
  if (removedOptionValues.length === 0) return;

  const rows = await client.fieldSchemaField.findMany({
    where: { fieldId, defaultValue: { not: null } },
    select: { defaultValue: true },
  });

  for (const row of rows) {
    const parsedValue = parseStoredValue(row.defaultValue);

    if (Array.isArray(parsedValue)) {
      if (parsedValue.some((value) => removedOptionValues.includes(String(value)))) {
        throw new Error("Cannot remove an option used by a field schema default value.");
      }
      continue;
    }

    if (parsedValue != null && removedOptionValues.includes(String(parsedValue))) {
      throw new Error("Cannot remove an option used by a field schema default value.");
    }
  }
}

export async function assertProjectIssueTypeRemovalAllowed(
  client: DbClient,
  projectId: string,
  removedIssueTypeIds: string[],
) {
  if (removedIssueTypeIds.length === 0) return;

  const invalidCount = await client.workItem.count({
    where: {
      projectId,
      issueTypeId: { in: removedIssueTypeIds },
    },
  });

  if (invalidCount > 0) {
    throw new Error(`Cannot remove an issue type that is still used by ${invalidCount} work items in the project.`);
  }
}

export async function assertFieldOptionsRemovalAllowed(
  client: DbClient,
  fieldId: string,
  removedOptionValues: string[],
) {
  if (removedOptionValues.length === 0) return;

  const fieldValues = await client.fieldValue.findMany({
    where: { objectType: WORK_ITEM_OBJECT_TYPE, fieldId },
    select: { value: true },
  });

  for (const fieldValue of fieldValues) {
    const parsedValue = parseStoredValue(fieldValue.value);

    if (Array.isArray(parsedValue)) {
      if (parsedValue.some((value) => removedOptionValues.includes(String(value)))) {
        throw new Error("Cannot remove an option that is used by existing work items.");
      }
      continue;
    }

    if (parsedValue != null && removedOptionValues.includes(String(parsedValue))) {
      throw new Error("Cannot remove an option that is used by existing work items.");
    }
  }
}
