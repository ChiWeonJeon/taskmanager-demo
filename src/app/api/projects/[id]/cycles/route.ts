import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { logApiError } from "@/lib/api-logger";
import { logProjectActivity } from "@/lib/activity/log";
import { resolveCycleAccess, cycleError } from "@/lib/cycle/api";
import {
  attachCycleFieldValues,
  buildCycleFieldValuePatch,
  writeCycleFieldValues,
} from "@/lib/cycle/field-values";
import { addCycleWatcherIfMissing } from "@/lib/cycle/watchers";
import { validateReferenceFieldValues } from "@/lib/objects/reference-validation";
import {
  CYCLE_INCLUDE,
  listCyclesForProject,
  parseCycleDate,
  resolveCycleTypeDefaults,
  serializeCycle,
} from "@/lib/cycle/service";
import { upsertCycleEntityRecordMirror } from "@/lib/cycle/entity-record";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id } = await params;
  const auth = await resolveCycleAccess(id, "cycle:read");
  if (!auth.ok) return auth.response;

  try {
    const cycles = await listCyclesForProject(prisma, auth.access.project!.id);
    return NextResponse.json({ cycles });
  } catch (error) {
    logApiError("GET", `/api/projects/${id}/cycles`, error, { userId: auth.session.user?.id });
    return cycleError(messages.errors.failedToLoad, "FAILED_TO_LOAD", 500);
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id } = await params;
  const auth = await resolveCycleAccess(id, "cycle:create");
  if (!auth.ok) return auth.response;

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
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return cycleError(messages.errors.nameRequired, "BAD_REQUEST", 400);

  let startDate: Date | null | undefined;
  let endDate: Date | null | undefined;
  try {
    startDate = parseCycleDate(input.startDate);
    endDate = parseCycleDate(input.endDate);
  } catch {
    return cycleError(messages.errors.badRequest, "BAD_REQUEST", 400);
  }

  const actorId = auth.session.user?.id ?? null;
  const projectId = auth.access.project!.id;
  const ownerId = typeof input.ownerId === "string" && input.ownerId.trim() ? input.ownerId.trim() : actorId;
  const rawFieldValues = input.fieldValues && typeof input.fieldValues === "object" && !Array.isArray(input.fieldValues)
    ? input.fieldValues as Record<string, unknown>
    : {};
  const clearFieldIds = Array.isArray(input.clearFieldIds)
    ? input.clearFieldIds.filter((fieldId): fieldId is string => typeof fieldId === "string")
    : [];

  let issueTypeDefaults: Awaited<ReturnType<typeof resolveCycleTypeDefaults>>;
  let fieldValuePatch: ReturnType<typeof buildCycleFieldValuePatch>;
  try {
    issueTypeDefaults = await resolveCycleTypeDefaults(prisma, typeof input.issueTypeId === "string" ? input.issueTypeId : null);
    fieldValuePatch = buildCycleFieldValuePatch({
      issueType: issueTypeDefaults.issueType,
      rawFieldValues,
      clearFieldIds,
      messages,
    });
    await validateReferenceFieldValues(prisma, fieldValuePatch.records, {
      user: auth.session.user,
      project: auth.access.project,
    });
  } catch (error) {
    return cycleError(error instanceof Error ? error.message : messages.errors.badRequest, "BAD_REQUEST", 400);
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const { issueType, statusId: defaultStatusId } = issueTypeDefaults;
      const allowedStatusIds = new Set(issueType.statusSchema.statuses.map((entry) => entry.statusId));
      const requestedStatusId = typeof input.statusId === "string" ? input.statusId : null;
      const statusId = requestedStatusId && allowedStatusIds.has(requestedStatusId)
        ? requestedStatusId
        : defaultStatusId;

      if (ownerId) {
        const owner = await tx.user.findUnique({ where: { id: ownerId }, select: { id: true } });
        if (!owner) throw new Error("OWNER_NOT_FOUND");
      }

      const cycle = await tx.cycle.create({
        data: {
          issueTypeId: issueType.id,
          scope: "PROJECT",
          projectId,
          name,
          statusId,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          ownerId,
          creatorId: actorId,
          updatedById: actorId,
        },
      });
      await upsertCycleEntityRecordMirror(tx, cycle);

      if (actorId) {
        await addCycleWatcherIfMissing(tx, { cycleId: cycle.id, userId: actorId, source: "auto_creator" });
      }
      await tx.cycleHistory.create({
        data: { cycleId: cycle.id, field: "created", before: null, after: name, actorId },
      });
      await logProjectActivity({
        tx,
        projectId,
        actorId,
        kind: "cycle.created",
        subjectType: "cycle",
        subjectId: cycle.id,
        payload: { name },
      });

      await writeCycleFieldValues(tx, cycle.id, fieldValuePatch);
      const hydrated = await tx.cycle.findUniqueOrThrow({ where: { id: cycle.id }, include: CYCLE_INCLUDE });
      return (await attachCycleFieldValues(tx, [hydrated]))[0];
    });

    return NextResponse.json({ cycle: serializeCycle(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "OWNER_NOT_FOUND") {
      return cycleError(messages.errors.notFound, "OWNER_NOT_FOUND", 400);
    }
    logApiError("POST", `/api/projects/${id}/cycles`, error, { userId: auth.session.user?.id });
    return cycleError(messages.errors.failedToUpdate, "FAILED_TO_SAVE", 500);
  }
}
