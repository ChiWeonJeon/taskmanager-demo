import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { logApiError } from "@/lib/api-logger";
import { logProjectActivity } from "@/lib/activity/log";
import { notifyCycleUpdated } from "@/lib/notifications/server";
import { resolveCycleAccess, cycleError } from "@/lib/cycle/api";
import {
  attachCycleFieldValues,
  buildCycleFieldValuePatch,
  deleteCycleFieldValues,
  readCycleFieldValueMap,
  writeCycleFieldValues,
} from "@/lib/cycle/field-values";
import { validateReferenceFieldValues } from "@/lib/objects/reference-validation";
import {
  CYCLE_INCLUDE,
  findCycleForProject,
  parseCycleDate,
  resolveCycleTypeDefaults,
  serializeCycle,
} from "@/lib/cycle/service";
import { softDeleteCycleEntityRecordMirror, upsertCycleEntityRecordMirror } from "@/lib/cycle/entity-record";

type Ctx = { params: Promise<{ id: string; cycleId: string }> };

async function findEditableProjectCycle(projectId: string, cycleId: string) {
  return prisma.cycle.findFirst({
    where: { id: cycleId, projectId, scope: "PROJECT", deletedAt: null },
    include: CYCLE_INCLUDE,
  });
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cycleId } = await params;
  const auth = await resolveCycleAccess(id, "cycle:read");
  if (!auth.ok) return auth.response;

  const cycle = await findCycleForProject(prisma, auth.access.project!.id, cycleId);
  if (!cycle) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);
  return NextResponse.json({ cycle });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cycleId } = await params;
  const auth = await resolveCycleAccess(id, "cycle:edit");
  if (!auth.ok) return auth.response;

  const projectId = auth.access.project!.id;
  const existing = await findEditableProjectCycle(projectId, cycleId);
  if (!existing) {
    const visible = await findCycleForProject(prisma, projectId, cycleId);
    return visible
      ? cycleError(messages.errors.forbidden, "INHERITED_CYCLE_READONLY", 403)
      : cycleError(messages.errors.notFound, "NOT_FOUND", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return cycleError(messages.errors.invalidRequestBody, "BAD_REQUEST", 400);
  }
  const input = body as {
    name?: unknown;
    statusId?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    ownerId?: unknown;
    issueTypeId?: unknown;
    fieldValues?: unknown;
    clearFieldIds?: unknown;
  };

  const update: Prisma.CycleUpdateInput = { updatedBy: { disconnect: true } };
  const changedFields: string[] = [];
  const actorId = auth.session.user?.id ?? null;
  if (actorId) update.updatedBy = { connect: { id: actorId } };

  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) return cycleError(messages.errors.nameRequired, "BAD_REQUEST", 400);
    if (name !== existing.name) {
      update.name = name;
      changedFields.push("name");
    }
  }

  try {
    const startDate = parseCycleDate(input.startDate);
    if (startDate !== undefined) {
      update.startDate = startDate;
      changedFields.push("startDate");
    }
    const endDate = parseCycleDate(input.endDate);
    if (endDate !== undefined) {
      update.endDate = endDate;
      changedFields.push("endDate");
    }
  } catch {
    return cycleError(messages.errors.badRequest, "BAD_REQUEST", 400);
  }

  if (input.issueTypeId !== undefined || input.statusId !== undefined) {
    const { issueType, statusId: defaultStatusId } = await resolveCycleTypeDefaults(
      prisma,
      typeof input.issueTypeId === "string" ? input.issueTypeId : existing.issueTypeId,
    );
    update.issueType = { connect: { id: issueType.id } };
    const allowedStatusIds = new Set(issueType.statusSchema.statuses.map((entry) => entry.statusId));
    const requestedStatusId = typeof input.statusId === "string" ? input.statusId : existing.statusId;
    const statusId = requestedStatusId && allowedStatusIds.has(requestedStatusId)
      ? requestedStatusId
      : defaultStatusId;
    update.status = statusId ? { connect: { id: statusId } } : { disconnect: true };
    changedFields.push("status");
  }

  if (input.ownerId !== undefined) {
    const ownerId = typeof input.ownerId === "string" && input.ownerId.trim() ? input.ownerId.trim() : null;
    if (ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!owner) return cycleError(messages.errors.notFound, "OWNER_NOT_FOUND", 400);
      update.owner = { connect: { id: ownerId } };
    } else {
      update.owner = { disconnect: true };
    }
    changedFields.push("owner");
  }

  const rawFieldValues = input.fieldValues && typeof input.fieldValues === "object" && !Array.isArray(input.fieldValues)
    ? input.fieldValues as Record<string, unknown>
    : {};
  const clearFieldIds = Array.isArray(input.clearFieldIds)
    ? input.clearFieldIds.filter((fieldId): fieldId is string => typeof fieldId === "string")
    : [];
  const shouldPatchFieldValues = input.fieldValues !== undefined || input.clearFieldIds !== undefined || input.issueTypeId !== undefined;
  let fieldValuePatch: ReturnType<typeof buildCycleFieldValuePatch> | null = null;
  if (shouldPatchFieldValues) {
    try {
      fieldValuePatch = buildCycleFieldValuePatch({
        issueType: input.issueTypeId !== undefined
          ? await resolveCycleTypeDefaults(prisma, typeof input.issueTypeId === "string" ? input.issueTypeId : existing.issueTypeId).then((result) => result.issueType)
          : existing.issueType,
        rawFieldValues,
        clearFieldIds,
        existingFieldValues: await readCycleFieldValueMap(prisma, cycleId),
        messages,
      });
      await validateReferenceFieldValues(prisma, fieldValuePatch.records, {
        user: auth.session.user,
        project: auth.access.project,
      });
      if (fieldValuePatch.records.length > 0 || fieldValuePatch.clearFieldIds.length > 0) {
        changedFields.push("fieldValues");
      }
    } catch (error) {
      return cycleError(error instanceof Error ? error.message : messages.errors.badRequest, "BAD_REQUEST", 400);
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.cycle.update({ where: { id: cycleId }, data: update });
      if (fieldValuePatch) {
        await writeCycleFieldValues(tx, cycleId, fieldValuePatch);
      }
      for (const field of Array.from(new Set(changedFields))) {
        await tx.cycleHistory.create({
          data: { cycleId, field, before: null, after: null, actorId },
        });
      }
      await notifyCycleUpdated(tx, {
        cycleId,
        actorId,
        fieldKeys: Array.from(new Set(changedFields)),
        projectId,
        payload: {
          cycleName: typeof update.name === "string" ? update.name : existing.name,
          fieldKeys: Array.from(new Set(changedFields)),
          projectKey: auth.access.project?.key,
        },
      });
      await logProjectActivity({
        tx,
        projectId,
        actorId,
        kind: "cycle.updated",
        subjectType: "cycle",
        subjectId: cycleId,
        payload: { fieldKeys: Array.from(new Set(changedFields)) },
      });
      const hydrated = await tx.cycle.findUniqueOrThrow({ where: { id: cycleId }, include: CYCLE_INCLUDE });
      await upsertCycleEntityRecordMirror(tx, hydrated);
      return (await attachCycleFieldValues(tx, [hydrated]))[0];
    });
    return NextResponse.json({ cycle: serializeCycle(updated) });
  } catch (error) {
    logApiError("PATCH", `/api/projects/${id}/cycles/${cycleId}`, error, { userId: auth.session.user?.id });
    return cycleError(messages.errors.failedToUpdate, "FAILED_TO_UPDATE", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cycleId } = await params;
  const auth = await resolveCycleAccess(id, "cycle:delete");
  if (!auth.ok) return auth.response;

  const projectId = auth.access.project!.id;
  const existing = await findEditableProjectCycle(projectId, cycleId);
  if (!existing) {
    const visible = await findCycleForProject(prisma, projectId, cycleId);
    return visible
      ? cycleError(messages.errors.forbidden, "INHERITED_CYCLE_READONLY", 403)
      : cycleError(messages.errors.notFound, "NOT_FOUND", 404);
  }

  try {
    const actorId = auth.session.user?.id ?? null;
    const deletedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.cycle.update({
        where: { id: cycleId },
        data: {
          deletedAt,
          updatedBy: actorId ? { connect: { id: actorId } } : { disconnect: true },
        },
      });
      await tx.cycleHistory.create({
        data: { cycleId, field: "deleted", before: existing.name, after: null, actorId },
      });
      await deleteCycleFieldValues(tx, cycleId);
      await softDeleteCycleEntityRecordMirror(tx, cycleId, deletedAt);
      await logProjectActivity({
        tx,
        projectId,
        actorId,
        kind: "cycle.deleted",
        subjectType: "cycle",
        subjectId: cycleId,
        payload: { name: existing.name },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("DELETE", `/api/projects/${id}/cycles/${cycleId}`, error, { userId: auth.session.user?.id });
    return cycleError(messages.errors.failedToDelete, "FAILED_TO_DELETE", 500);
  }
}
