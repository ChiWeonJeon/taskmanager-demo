import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { logProjectActivity } from "@/lib/activity/log";
import {
  WORK_ITEM_OBJECT_TYPE,
  deleteFieldValues,
  writeFieldValues,
} from "@/lib/objects/field-value";
import { validateReferenceFieldValues } from "@/lib/objects/reference-validation";
import { scopedWorkItemWhere } from "@/lib/work-item-query";
import { getServerMessages } from "@/lib/i18n/server";
import {
  MANAGED_SCHEMA_FIELD_KEYS,
  getSchemaFieldDefinitions,
  issueTypeSchemaInclude,
  normalizeFieldValueForStorage,
  resolveStatusId,
} from "@/lib/work-item-mutation";

const BULK_MAX = 200;

type BulkAction = "field" | "status";
type BulkItemResult = { id: string; success: boolean; error?: string };

interface FieldChangeInput {
  fieldId: string;
  fieldValue: unknown;
}

function uniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0)));
}

function bulkResponse(items: BulkItemResult[]) {
  const succeeded = items.filter((item) => item.success).length;
  const failed = items.length - succeeded;
  return NextResponse.json(
    {
      total: items.length,
      succeeded,
      failed,
      items,
    },
    { status: succeeded === 0 ? 400 : 200 },
  );
}

function parseFieldChanges(value: unknown): FieldChangeInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is { fieldId: unknown; fieldValue: unknown } => (
      typeof entry === "object"
      && entry !== null
      && "fieldId" in entry
    ))
    .map((entry) => ({ fieldId: String(entry.fieldId), fieldValue: entry.fieldValue }));
}

export async function PATCH(request: NextRequest) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    ids?: unknown;
    action?: BulkAction;
    changes?: unknown;
    statusId?: unknown;
  } | null;
  const ids = uniqueIds(body?.ids);
  if (!body || ids.length === 0 || ids.length > BULK_MAX) {
    return NextResponse.json({ error: messages.errors.invalidRequestBody }, { status: 400 });
  }

  const action = body.action;
  if (action !== "field" && action !== "status") {
    return NextResponse.json({ error: messages.errors.invalidRequestBody }, { status: 400 });
  }

  const fieldChanges = action === "field" ? parseFieldChanges(body.changes) : [];
  const statusId = typeof body.statusId === "string" ? body.statusId : "";
  if ((action === "field" && fieldChanges.length === 0) || (action === "status" && !statusId)) {
    return NextResponse.json({ error: messages.errors.invalidRequestBody }, { status: 400 });
  }

  const workItems = await prisma.workItem.findMany({
    where: scopedWorkItemWhere({ id: { in: ids }, deletedAt: null }),
    include: {
      status: true,
      project: true,
      issueType: { include: issueTypeSchemaInclude },
    },
  });
  const workItemById = new Map(workItems.map((item) => [item.id, item]));
  const actorId = session.user?.id ?? null;

  const results = await prisma.$transaction(async (tx) => {
    const nextResults: BulkItemResult[] = [];

    for (const id of ids) {
      const workItem = workItemById.get(id);
      if (!workItem) {
        nextResults.push({ id, success: false, error: "not_found" });
        continue;
      }

      if (action === "status") {
        try {
          const resolvedStatusId = resolveStatusId(workItem.issueType, statusId, workItem.statusId);
          if (resolvedStatusId !== workItem.statusId) {
            const nextStatus = workItem.issueType.statusSchema?.statuses.find((entry) => entry.status.id === resolvedStatusId)?.status
              ?? await tx.status.findUnique({ where: { id: resolvedStatusId } });
            await tx.workItem.update({
              where: { id },
              data: {
                statusId: resolvedStatusId,
                histories: {
                  create: {
                    field: "status",
                    before: workItem.status.name,
                    after: nextStatus?.name ?? resolvedStatusId,
                    actorId,
                  },
                },
              },
            });
          }
          nextResults.push({ id, success: true });
        } catch {
          nextResults.push({ id, success: false, error: "status_not_allowed" });
        }
        continue;
      }

      const schemaFields = getSchemaFieldDefinitions(workItem.issueType);
      const customFields = new Map(
        schemaFields
          .filter((field) => !MANAGED_SCHEMA_FIELD_KEYS.has(field.key))
          .map((field) => [field.id, field]),
      );
      const deleteFieldIds = new Set<string>();
      const upsertFieldValues: { fieldId: string; value: string }[] = [];
      let error: string | null = null;

      for (const change of fieldChanges) {
        const field = customFields.get(change.fieldId);
        if (!field) {
          error = "field_not_in_schema";
          break;
        }

        let normalized: string | null;
        try {
          normalized = change.fieldValue === null
            ? null
            : normalizeFieldValueForStorage(field, change.fieldValue);
        } catch {
          error = "invalid_value";
          break;
        }

        if (!normalized) {
          if (field.isRequired) {
            error = "required_field_clear_blocked";
            break;
          }
          deleteFieldIds.add(field.id);
        } else {
          upsertFieldValues.push({ fieldId: field.id, value: normalized });
        }
      }

      if (error) {
        nextResults.push({ id, success: false, error });
        continue;
      }

      try {
        await validateReferenceFieldValues(tx, upsertFieldValues, {
          user: session.user,
          project: workItem.project,
        });
      } catch {
        nextResults.push({ id, success: false, error: "invalid_value" });
        continue;
      }

      try {
        if (deleteFieldIds.size > 0) {
          await deleteFieldValues(tx, WORK_ITEM_OBJECT_TYPE, id, Array.from(deleteFieldIds));
        }
        await writeFieldValues(tx, WORK_ITEM_OBJECT_TYPE, id, upsertFieldValues);
        await tx.workItem.update({ where: { id }, data: { updatedAt: new Date() } });
        nextResults.push({ id, success: true });
      } catch {
        nextResults.push({ id, success: false, error: "invalid_value" });
      }
    }

    return nextResults;
  });

  return bulkResponse(results);
}

export async function DELETE(request: NextRequest) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = uniqueIds(body?.ids);
  if (!body || ids.length === 0 || ids.length > BULK_MAX) {
    return NextResponse.json({ error: messages.errors.invalidRequestBody }, { status: 400 });
  }

  const workItems = await prisma.workItem.findMany({
    where: scopedWorkItemWhere({ id: { in: ids }, deletedAt: null }),
    select: {
      id: true,
      title: true,
      issueKey: true,
      projectId: true,
    },
  });
  const workItemById = new Map(workItems.map((item) => [item.id, item]));
  const actorId = session.user?.id ?? null;

  const results = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const nextResults: BulkItemResult[] = [];
    for (const id of ids) {
      const workItem = workItemById.get(id);
      if (!workItem) {
        nextResults.push({ id, success: false, error: "not_found" });
        continue;
      }

      await tx.workItem.update({ where: { id }, data: { deletedAt: new Date() } });
      if (workItem.projectId) {
        await logProjectActivity({
          tx,
          projectId: workItem.projectId,
          actorId,
          kind: "workitem.deleted",
          subjectType: "workitem",
          subjectId: id,
          payload: { title: workItem.title, issueKey: workItem.issueKey },
        });
      }
      nextResults.push({ id, success: true });
    }
    return nextResults;
  });

  return bulkResponse(results);
}
