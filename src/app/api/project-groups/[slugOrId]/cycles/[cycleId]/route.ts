import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { canManageGroup } from "@/lib/group-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import { logApiError } from "@/lib/api-logger";
import { logProjectGroupActivity } from "@/lib/activity/log";
import { notifyCycleUpdated } from "@/lib/notifications/server";
import { resolveGroupCycleAccess, cycleError } from "@/lib/cycle/api";
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
  getCycleProjectInheritance,
  parseCycleDate,
  resolveCycleTypeDefaults,
  serializeCycle,
} from "@/lib/cycle/service";
import { softDeleteCycleEntityRecordMirror, upsertCycleEntityRecordMirror } from "@/lib/cycle/entity-record";

type Ctx = { params: Promise<{ slugOrId: string; cycleId: string }> };

async function findGroupCycle(groupId: string, cycleId: string) {
  return prisma.cycle.findFirst({
    where: { id: cycleId, groupId, scope: "GROUP", deletedAt: null },
    include: CYCLE_INCLUDE,
  });
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { slugOrId, cycleId } = await params;
  const auth = await resolveGroupCycleAccess(slugOrId);
  if (!auth.ok) return auth.response;

  const cycle = await findGroupCycle(auth.access.group!.id, cycleId);
  if (!cycle) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);
  const [cycleWithFieldValues] = await attachCycleFieldValues(prisma, [cycle]);
  const inheritance = await getCycleProjectInheritance(prisma, cycleId, auth.access.group!.id);
  return NextResponse.json({ cycle: serializeCycle(cycleWithFieldValues), inheritance });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { slugOrId, cycleId } = await params;
  const auth = await resolveGroupCycleAccess(slugOrId);
  if (!auth.ok) return auth.response;
  if (!canManageGroup(auth.access)) return cycleError(messages.errors.forbidden, "FORBIDDEN", 403);

  const existing = await findGroupCycle(auth.access.group!.id, cycleId);
  if (!existing) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

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
    inheritByDefault?: unknown;
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

  if (typeof input.inheritByDefault === "boolean" && input.inheritByDefault !== existing.inheritByDefault) {
    update.inheritByDefault = input.inheritByDefault;
    changedFields.push("inheritByDefault");
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
        group: auth.access.group,
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
        await tx.cycleHistory.create({ data: { cycleId, field, before: null, after: null, actorId } });
      }
      await notifyCycleUpdated(tx, {
        cycleId,
        actorId,
        fieldKeys: Array.from(new Set(changedFields)),
        payload: {
          cycleName: typeof update.name === "string" ? update.name : existing.name,
          fieldKeys: Array.from(new Set(changedFields)),
          groupSlug: auth.access.group?.slug,
        },
      });
      await logProjectGroupActivity({
        tx,
        projectGroupId: auth.access.group!.id,
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
    const inheritance = await getCycleProjectInheritance(prisma, cycleId, auth.access.group!.id);
    return NextResponse.json({ cycle: serializeCycle(updated), inheritance });
  } catch (error) {
    logApiError("PATCH", `/api/project-groups/${slugOrId}/cycles/${cycleId}`, error, { userId: auth.session.user?.id });
    return cycleError(messages.errors.failedToUpdate, "FAILED_TO_UPDATE", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { slugOrId, cycleId } = await params;
  const auth = await resolveGroupCycleAccess(slugOrId);
  if (!auth.ok) return auth.response;
  if (!canManageGroup(auth.access)) return cycleError(messages.errors.forbidden, "FORBIDDEN", 403);

  const existing = await findGroupCycle(auth.access.group!.id, cycleId);
  if (!existing) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

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
      await logProjectGroupActivity({
        tx,
        projectGroupId: auth.access.group!.id,
        actorId,
        kind: "cycle.deleted",
        subjectType: "cycle",
        subjectId: cycleId,
        payload: { name: existing.name },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("DELETE", `/api/project-groups/${slugOrId}/cycles/${cycleId}`, error, { userId: auth.session.user?.id });
    return cycleError(messages.errors.failedToDelete, "FAILED_TO_DELETE", 500);
  }
}
