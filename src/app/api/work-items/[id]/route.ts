import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { ensurePersonalProjectForUser } from "@/lib/personal-project";
import { attachWorkItemFieldValuesToDetail, scopedWorkItemWhere, workItemDetailInclude } from "@/lib/work-item-query";
import { ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET } from "@/lib/field-schema";
import {
  WORK_ITEM_OBJECT_TYPE,
  deleteFieldValues,
  writeFieldValues,
} from "@/lib/objects/field-value";
import { validateReferenceFieldValues } from "@/lib/objects/reference-validation";
import { resolveMentionRefs } from "@/lib/mention/server";
import { filterUserMentionIds, serializeMentionRefs } from "@/lib/mention/extract";
import { resolveMentionRefsForRender } from "@/lib/mention/resolve-refs";
import { logProjectActivity } from "@/lib/activity/log";
import {
  addWatcherIfMissing,
  notifyCrossReferences,
  notifyMention,
  notifyWorkItemUpdated,
} from "@/lib/notifications/server";
import { listProjectIssueTypesWithSchemas } from "@/lib/issue-type-config";
import {
  MANAGED_SCHEMA_FIELD_KEYS,
  formatHistoryDate,
  getSchemaFieldDefinitions,
  hasFieldInputValue,
  issueTypeSchemaInclude,
  normalizeDateInput,
  normalizeFieldValueForStorage,
  resolveStatusId,
} from "@/lib/work-item-mutation";

async function getOrCreateProjectIssueNumber(tx: Prisma.TransactionClient, workItemId: string, projectId: string) {
  const existing = await tx.workItemProjectIssueKey.findUnique({
    where: { workItemId_projectId: { workItemId, projectId } },
  });
  if (existing) return existing.issueNumber;

  const counter = await tx.projectIssueCounter.upsert({
    where: { projectId },
    create: { projectId, current: 1 },
    update: { current: { increment: 1 } },
  });

  await tx.workItemProjectIssueKey.create({
    data: {
      workItemId,
      projectId,
      issueNumber: counter.current,
    },
  });

  return counter.current;
}

function isMissingRequiredField(
  field: { id: string; key: string; isRequired: boolean },
  values: {
    title: string;
    description: string | null;
    projectId: string | null;
    statusId: string;
    assigneeId: string | null;
    parentId: string | null;
    startDate: Date | null | undefined;
    dueDate: Date | null | undefined;
    customFieldValues: Map<string, unknown>;
  }
) {
  if (!field.isRequired) return false;
  if (ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET.has(field.key)) return false;

  switch (field.key) {
    case "title":
      return !values.title.trim();
    case "project":
      return !values.projectId;
    case "status":
      return !values.statusId;
    case "assignee":
      return !values.assigneeId;
    case "parent":
      return !values.parentId;
    case "description":
      return !values.description;
    case "start_date":
      return !values.startDate;
    case "due_date":
      return !values.dueDate;
    case "issue_id":
    case "created_at":
    case "updated_at":
      return false;
    default:
      return !hasFieldInputValue(values.customFieldValues.get(field.id));
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const workItemBase = await prisma.workItem.findFirst({
    where: scopedWorkItemWhere({ id, deletedAt: null }),
    include: workItemDetailInclude,
  });

  if (!workItemBase) {
    return NextResponse.json({ error: "Work item not found." }, { status: 404 });
  }
  const workItem = await attachWorkItemFieldValuesToDetail(prisma, workItemBase);

  // 댓글/설명 본문에 포함된 user/issue 멘션을 한 번에 server-side 에서 resolve.
  // 클라이언트 RichTextRenderer 가 user 칩(아바타+축약네임)을 그릴 수 있게 한다.
  const commentsBody = ((workItem as { comments?: { body: string }[] }).comments ?? [])
    .map((c) => c.body)
    .join("\n\n");
  const combinedBody = [workItem.description ?? "", commentsBody].filter(Boolean).join("\n\n");
  const mentionRefs = combinedBody
    ? await resolveMentionRefsForRender(combinedBody)
    : { users: {}, issues: {} };

  return NextResponse.json({ ...workItem, mentionRefs });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const actorId = session.user?.id ?? null;

  const { id } = await params;
  const workItem = await prisma.workItem.findFirst({ where: scopedWorkItemWhere({ id, deletedAt: null }) });
  if (!workItem) {
    return NextResponse.json({ error: "Work item not found." }, { status: 404 });
  }

  await prisma.workItem.update({ where: { id }, data: { deletedAt: new Date() } });

  if (workItem.projectId) {
    await logProjectActivity({
      projectId: workItem.projectId,
      actorId,
      kind: "workitem.deleted",
      subjectType: "workitem",
      subjectId: id,
      payload: { title: workItem.title, issueKey: workItem.issueKey },
    });
  }

  return new NextResponse(null, { status: 204 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    title,
    description,
    startDate,
    dueDate,
    statusId,
    issueTypeId,
    projectId,
    assigneeId,
    parentId,
    fieldValues,
    clearFieldIds,
  } = body as {
    title?: string;
    description?: string;
    startDate?: string | null;
    dueDate?: string | null;
    statusId?: string;
    issueTypeId?: string;
    projectId?: string | null;
    assigneeId?: string;
    parentId?: string | null;
    fieldValues?: Record<string, unknown>;
    clearFieldIds?: string[];
  };

  const workItemBase = await prisma.workItem.findFirst({
    where: scopedWorkItemWhere({ id, deletedAt: null }),
    include: {
      project: true,
      status: true,
      issueType: { include: issueTypeSchemaInclude },
      assignee: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
      parent: { select: { id: true, issueKey: true, title: true } },
    },
  });

  if (!workItemBase) {
    return NextResponse.json({ error: "Work item not found." }, { status: 404 });
  }
  const workItem = await attachWorkItemFieldValuesToDetail(prisma, workItemBase);

  const nextTitle = title !== undefined ? title.trim() : workItem.title;
  if (!nextTitle) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const nextDescription = description !== undefined ? description.trim() || null : workItem.description;
  const nextAssigneeId = assigneeId !== undefined ? (assigneeId || null) : workItem.assigneeId;
  if (!nextAssigneeId) {
    return NextResponse.json({ error: "Assignee is required." }, { status: 400 });
  }

  const nextAssignee = await prisma.user.findUnique({ where: { id: nextAssigneeId } });
  if (!nextAssignee) {
    return NextResponse.json({ error: "Assignee not found." }, { status: 400 });
  }

  let nextProjectId = workItem.projectId;
  if (projectId !== undefined) {
    if (projectId) {
      nextProjectId = projectId;
    } else {
      const personalProject = await ensurePersonalProjectForUser({ id: nextAssignee.id, name: nextAssignee.name });
      nextProjectId = personalProject.id;
    }
  }

  const nextProject = nextProjectId
    ? await prisma.project.findUnique({ where: { id: nextProjectId } })
    : null;

  if (!nextProject) {
    return NextResponse.json({ error: "Project not found." }, { status: 400 });
  }

  if (nextProject.isPersonal) {
    if (nextProject.ownerId !== nextAssigneeId) {
      return NextResponse.json({ error: "Only the personal project owner can be assigned there." }, { status: 400 });
    }
  } else {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: nextProject.id, userId: nextAssigneeId } },
    });
    if (!member) {
      return NextResponse.json({ error: "Assignee must be a project member." }, { status: 400 });
    }
  }

  const enabledIssueTypes = await listProjectIssueTypesWithSchemas(prisma, nextProject.id);
  const targetIssueTypeId = issueTypeId ?? workItem.issueTypeId;
  const targetIssueType = enabledIssueTypes.find((candidate) => candidate.id === targetIssueTypeId);

  if (!targetIssueType) {
    return NextResponse.json(
      { error: "The selected issue type is not enabled for this project." },
      { status: 400 },
    );
  }

  const nextParentId = parentId !== undefined ? (parentId || null) : workItem.parentId;
  if (nextParentId === id) {
    return NextResponse.json({ error: "A work item cannot be its own parent." }, { status: 400 });
  }

  if (nextParentId) {
    const nextParent = await prisma.workItem.findFirst({ where: scopedWorkItemWhere({ id: nextParentId }) });
    if (!nextParent) {
      return NextResponse.json({ error: "Parent work item not found." }, { status: 400 });
    }
    if (nextParent.projectId !== nextProject.id) {
      return NextResponse.json({ error: "Parent work item must be in the same project." }, { status: 400 });
    }
  }

  let normalizedStartDate: Date | null | undefined;
  let normalizedDueDate: Date | null | undefined;
  try {
    normalizedStartDate = normalizeDateInput(startDate);
    normalizedDueDate = normalizeDateInput(dueDate);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid date." }, { status: 400 });
  }

  const nextStartDate = normalizedStartDate !== undefined ? normalizedStartDate : workItem.startDate;
  const nextDueDate = normalizedDueDate !== undefined ? normalizedDueDate : workItem.dueDate;
  if (nextStartDate && nextDueDate && nextStartDate.getTime() > nextDueDate.getTime()) {
    return NextResponse.json({ error: "Start date cannot be after due date." }, { status: 400 });
  }

  let resolvedStatusId: string;
  try {
    resolvedStatusId = resolveStatusId(targetIssueType, statusId, workItem.statusId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid status." }, { status: 400 });
  }

  const rawFieldValues = fieldValues && typeof fieldValues === "object" && !Array.isArray(fieldValues)
    ? fieldValues
    : {};
  const clearFieldIdSet = new Set((clearFieldIds ?? []).filter(Boolean));
  const currentFieldValueMap = new Map(workItem.fieldValues.map((fieldValue) => [fieldValue.fieldId, fieldValue.value]));
  const schemaFields = getSchemaFieldDefinitions(targetIssueType);
  const customFieldValuesForValidation = new Map<string, unknown>();

  for (const schemaField of schemaFields) {
    if (MANAGED_SCHEMA_FIELD_KEYS.has(schemaField.key)) continue;

    const hasExplicitValue = Object.prototype.hasOwnProperty.call(rawFieldValues, schemaField.id);
    if (hasExplicitValue) {
      customFieldValuesForValidation.set(schemaField.id, rawFieldValues[schemaField.id]);
      continue;
    }

    if (clearFieldIdSet.has(schemaField.id)) {
      customFieldValuesForValidation.set(schemaField.id, null);
      continue;
    }

    customFieldValuesForValidation.set(schemaField.id, currentFieldValueMap.get(schemaField.id));
  }

  for (const schemaField of schemaFields) {
    if (isMissingRequiredField(schemaField, {
      title: nextTitle,
      description: nextDescription,
      projectId: nextProject.id,
      statusId: resolvedStatusId,
      assigneeId: nextAssigneeId,
      parentId: nextParentId,
      startDate: nextStartDate,
      dueDate: nextDueDate,
      customFieldValues: customFieldValuesForValidation,
    })) {
      return NextResponse.json({ error: `${schemaField.name} is required.` }, { status: 400 });
    }
  }

  const schemaCustomFieldIds = new Set(
    schemaFields.filter((field) => !MANAGED_SCHEMA_FIELD_KEYS.has(field.key)).map((field) => field.id)
  );
  const deleteFieldIds = new Set<string>();
  const upsertFieldValues: { fieldId: string; value: string }[] = [];

  for (const schemaField of schemaFields) {
    if (MANAGED_SCHEMA_FIELD_KEYS.has(schemaField.key)) continue;

    const hasExplicitValue = Object.prototype.hasOwnProperty.call(rawFieldValues, schemaField.id);
    if (!hasExplicitValue && !clearFieldIdSet.has(schemaField.id)) continue;

    try {
      const normalizedFieldValue = hasExplicitValue
        ? normalizeFieldValueForStorage(schemaField, rawFieldValues[schemaField.id])
        : null;

      if (!normalizedFieldValue) {
        deleteFieldIds.add(schemaField.id);
      } else {
        upsertFieldValues.push({ fieldId: schemaField.id, value: normalizedFieldValue });
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid custom field value." }, { status: 400 });
    }
  }

  // 유형이 실제로 바뀌면(payload 에 issueTypeId 가 없더라도) 새 스키마에 없는 필드 값은 정리한다.
  if (targetIssueType.id !== workItem.issueTypeId) {
    for (const fieldValue of workItem.fieldValues) {
      if (!schemaCustomFieldIds.has(fieldValue.fieldId)) {
        deleteFieldIds.add(fieldValue.fieldId);
      }
    }
  }

  const data: Record<string, string | Date | null> = {};
  const historyData: { field: string; before: string | null; after: string | null }[] = [];

  if (nextTitle !== workItem.title) {
    data.title = nextTitle;
    historyData.push({ field: "title", before: workItem.title, after: nextTitle });
  }

  if (nextDescription !== workItem.description) {
    data.description = nextDescription;
    const refs = await resolveMentionRefs(prisma, nextDescription ?? "", workItem.projectId);
    data.descriptionMentions = serializeMentionRefs(refs);
    historyData.push({ field: "description", before: workItem.description, after: nextDescription });
  }

  if (normalizedStartDate !== undefined && formatHistoryDate(workItem.startDate) !== formatHistoryDate(normalizedStartDate)) {
    data.startDate = normalizedStartDate;
    historyData.push({ field: "startDate", before: formatHistoryDate(workItem.startDate), after: formatHistoryDate(normalizedStartDate) });
  }

  if (normalizedDueDate !== undefined && formatHistoryDate(workItem.dueDate) !== formatHistoryDate(normalizedDueDate)) {
    data.dueDate = normalizedDueDate;
    historyData.push({ field: "dueDate", before: formatHistoryDate(workItem.dueDate), after: formatHistoryDate(normalizedDueDate) });
  }

  if (resolvedStatusId !== workItem.statusId) {
    data.statusId = resolvedStatusId;
    const nextStatus = await prisma.status.findUnique({ where: { id: resolvedStatusId } });
    historyData.push({ field: "status", before: workItem.status.name, after: nextStatus?.name || resolvedStatusId });
  }

  if (targetIssueType.id !== workItem.issueTypeId) {
    data.issueTypeId = targetIssueType.id;
    historyData.push({ field: "issueType", before: workItem.issueType.name, after: targetIssueType.name });
  }

  if (nextProject.id !== workItem.projectId) {
    data.projectId = nextProject.id;
    historyData.push({ field: "project", before: workItem.project?.name || null, after: nextProject.name });
  }

  if (nextAssigneeId !== workItem.assigneeId) {
    data.assigneeId = nextAssigneeId;
    historyData.push({ field: "assignee", before: workItem.assignee?.name || null, after: nextAssignee.name });
  }

  if (nextParentId !== workItem.parentId) {
    data.parentId = nextParentId;
    const nextParent = nextParentId
      ? await prisma.workItem.findFirst({
          where: scopedWorkItemWhere({ id: nextParentId }),
          select: { issueKey: true, title: true },
        })
      : null;
    const beforeParent = workItem.parent ? `[${workItem.parent.issueKey}] ${workItem.parent.title}` : null;
    const afterParent = nextParent ? `[${nextParent.issueKey}] ${nextParent.title}` : null;
    historyData.push({ field: "parent", before: beforeParent, after: afterParent });
  }

  if (Object.keys(data).length === 0 && deleteFieldIds.size === 0 && upsertFieldValues.length === 0) {
    return NextResponse.json({ error: "No changes to save." }, { status: 400 });
  }

  try {
    await validateReferenceFieldValues(prisma, upsertFieldValues, {
      user: session.user,
      project: nextProject,
    });
  } catch {
    return NextResponse.json({ error: "Invalid custom field value." }, { status: 400 });
  }

  if (typeof data.projectId === "string" && data.projectId !== workItem.projectId) {
    const targetProject = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true, key: true } });
    if (!targetProject) {
      return NextResponse.json({ error: "Project not found." }, { status: 400 });
    }

    const issueNumber = await prisma.$transaction(async (tx) => getOrCreateProjectIssueNumber(tx, workItem.id, targetProject.id));
    data.issueKey = `${targetProject.key}-${issueNumber}`;
  }

  const actorId = session.user?.id ?? null;
  const descChanged = nextDescription !== workItem.description;
  const assigneeChanged = nextAssigneeId !== workItem.assigneeId;
  const newAssigneeId = assigneeChanged ? nextAssigneeId : null;
  const fieldKeys = historyData.map((h) => h.field).filter((f) => f !== "comment");

  const updated = await prisma.$transaction(async (tx) => {
    if (deleteFieldIds.size > 0) {
      await deleteFieldValues(tx, WORK_ITEM_OBJECT_TYPE, id, Array.from(deleteFieldIds));
    }

    await writeFieldValues(tx, WORK_ITEM_OBJECT_TYPE, id, upsertFieldValues);

    const result = await tx.workItem.update({
      where: { id },
      data: {
        ...data,
        histories: historyData.length > 0
          ? {
              create: historyData.map((entry) => ({
                ...entry,
                actorId,
              })),
            }
          : undefined,
      },
      include: {
        ...workItemDetailInclude,
      },
    });

    let mentionRecipients: string[] = [];
    if (descChanged && actorId) {
      const refs = await resolveMentionRefs(tx, nextDescription ?? "", nextProject.id);
      const userIds = filterUserMentionIds(refs);
      if (userIds.length > 0) {
        mentionRecipients = await notifyMention(tx, {
          scope: "work_item",
          actorId,
          recipientIds: userIds,
          workItemId: id,
          projectId: nextProject.id,
          payload: {
            context: "description",
            issueKey: result.issueKey,
            workItemTitle: result.title,
          },
        });
      }
      if (refs.length > 0) {
        await notifyCrossReferences(tx, {
          actorId,
          refs,
          source: {
            scope: "work_item",
            projectId: nextProject.id,
            workItemId: id,
            sourceContext: "description",
            sourceIssueKey: result.issueKey,
            sourceWorkItemTitle: result.title,
            sourceProjectKey: nextProject.key,
          },
          skipRecipientIds: mentionRecipients,
        });
      }
    }

    if (actorId) {
      await addWatcherIfMissing(tx, {
        workItemId: id,
        userId: actorId,
        source: "auto_editor",
        addedById: actorId,
      });
    }
    if (newAssigneeId && newAssigneeId !== actorId) {
      await addWatcherIfMissing(tx, {
        workItemId: id,
        userId: newAssigneeId,
        source: "auto_assignee",
        addedById: actorId,
      });
    }

    if (fieldKeys.length > 0 || newAssigneeId) {
      await notifyWorkItemUpdated(tx, {
        workItemId: id,
        actorId,
        fieldKeys,
        newAssigneeId,
        skipRecipientIds: mentionRecipients,
        issueKey: result.issueKey,
        workItemTitle: result.title,
        projectId: nextProject.id,
      });
    }

    return attachWorkItemFieldValuesToDetail(tx, result);
  });

  return NextResponse.json(updated);
}
