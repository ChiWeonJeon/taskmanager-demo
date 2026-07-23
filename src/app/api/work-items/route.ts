import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { ensurePersonalProjectForUser } from "@/lib/personal-project";
import { logApiError } from "@/lib/api-logger";
import { ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET } from "@/lib/field-schema";
import {
  attachWorkItemFieldValuesToDetail,
  scopedWorkItemWhere,
  serializeWorkItemSummaries,
  workItemDetailInclude,
  workItemSummarySelect,
} from "@/lib/work-item-query";
import { WORK_ITEM_OBJECT_TYPE, writeFieldValues } from "@/lib/objects/field-value";
import { validateReferenceFieldValues } from "@/lib/objects/reference-validation";
import {
  MANAGED_SCHEMA_FIELD_KEYS,
  getSchemaFieldDefinitions,
  hasFieldInputValue,
  normalizeDateInput,
  normalizeFieldValueForStorage,
  resolveStatusId,
} from "@/lib/work-item-mutation";
import { resolveMentionRefs } from "@/lib/mention/server";
import { filterUserMentionIds, serializeMentionRefs } from "@/lib/mention/extract";
import {
  addWatcherIfMissing,
  notifyCrossReferences,
  notifyMention,
} from "@/lib/notifications/server";
import { listProjectIssueTypesWithSchemas, parseStoredValue, pickDefaultIssueType } from "@/lib/issue-type-config";
import { logProjectActivity } from "@/lib/activity/log";
import { enqueueServerAnalyticsEvent } from "@/lib/server-analytics";
import { scheduleServerAnalyticsDispatch } from "@/lib/server-analytics-dispatcher";
import { serverWorkspaceScope } from "@/lib/server-analytics-core";

function isMissingRequiredField(
  field: { id: string; key: string; isRequired: boolean },
  values: {
    title: string;
    description: string | null;
    projectId: string | null;
    statusId: string;
    assigneeId: string;
    parentId: string | null;
    startDate: Date | null | undefined;
    dueDate: Date | null | undefined;
    fieldValues: Record<string, unknown>;
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
      return !hasFieldInputValue(values.fieldValues[field.id]);
  }
}

async function reserveProjectIssueNumber(tx: Prisma.TransactionClient, projectId: string) {
  const counter = await tx.projectIssueCounter.upsert({
    where: { projectId },
    create: { projectId, current: 1 },
    update: { current: { increment: 1 } },
  });

  return counter.current;
}

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (session.user?.id) {
    ensurePersonalProjectForUser({ id: session.user.id, name: session.user.name }).catch(() => {});
  }

  const { searchParams } = new URL(request.url);
  const assigneeIdParam = searchParams.get("assigneeId");
  const projectIdParam = searchParams.get("projectId");
  const projectKeyParam = searchParams.get("projectKey");
  const fieldsParam = searchParams.get("fields");

  const where: Prisma.WorkItemWhereInput = { deletedAt: null };
  if (assigneeIdParam) {
    const resolvedAssigneeId = assigneeIdParam === "me" ? (session.user?.id ?? null) : assigneeIdParam;
    if (resolvedAssigneeId) where.assigneeId = resolvedAssigneeId;
  }

  if (projectIdParam) {
    where.projectId = projectIdParam;
  }

  try {
    if (projectKeyParam) {
      const project = await prisma.project.findUnique({ where: { key: projectKeyParam } });
      if (project) where.projectId = project.id;
    }

    if (fieldsParam) {
      const requestedFields = fieldsParam.split(",").map((field) => field.trim()).filter(Boolean);
      const select = Object.fromEntries(requestedFields.map((field) => [field, true]));
      const items = await prisma.workItem.findMany({
        where: scopedWorkItemWhere(where),
        select,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(items);
    }

    const workItems = await prisma.workItem.findMany({
      where: scopedWorkItemWhere(where),
      select: workItemSummarySelect,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(await serializeWorkItemSummaries(prisma, workItems));
  } catch (error) {
    logApiError("GET", "/api/work-items", error, {
      assigneeId: assigneeIdParam,
      projectId: projectIdParam,
      projectKey: projectKeyParam,
      userId: session.user?.id,
    });
    return NextResponse.json(
      { error: "Failed to load work items.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    description,
    issueTypeId,
    entityTypeId,
    statusId,
    projectId,
    assigneeId,
    parentId,
    startDate,
    dueDate,
    fieldValues,
  } = body as {
    title?: string;
    description?: string;
    issueTypeId?: string;
    entityTypeId?: string;
    statusId?: string;
    projectId?: string;
    assigneeId?: string;
    parentId?: string;
    startDate?: string | null;
    dueDate?: string | null;
    fieldValues?: Record<string, unknown>;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const currentUserId = session.user?.id ?? null;
  const resolvedAssigneeId = assigneeId?.trim() || currentUserId;
  if (!resolvedAssigneeId) {
    return NextResponse.json({ error: "Assignee is required." }, { status: 400 });
  }

  const assigneeUser = await prisma.user.findUnique({ where: { id: resolvedAssigneeId } });
  if (!assigneeUser) {
    return NextResponse.json({ error: "Assignee not found." }, { status: 400 });
  }

  const project = projectId
    ? await prisma.project.findUnique({ where: { id: projectId } })
    : await ensurePersonalProjectForUser({ id: assigneeUser.id, name: assigneeUser.name });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 400 });
  }

  if (project.isPersonal) {
    if (project.ownerId !== resolvedAssigneeId) {
      return NextResponse.json({ error: "Only the personal project owner can be assigned there." }, { status: 400 });
    }
  } else {
    const projectMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: resolvedAssigneeId } },
    });
    if (!projectMember) {
      return NextResponse.json({ error: "Assignee must be a project member." }, { status: 400 });
    }
  }

  const requestedIssueTypeId = issueTypeId ?? entityTypeId;
  const enabledIssueTypes = await listProjectIssueTypesWithSchemas(prisma, project.id);
  const resolvedIssueType = requestedIssueTypeId
    ? enabledIssueTypes.find((issueType) => issueType.id === requestedIssueTypeId)
    : pickDefaultIssueType(enabledIssueTypes, project.defaultIssueTypeId);

  if (!resolvedIssueType) {
    return NextResponse.json(
      {
        error: requestedIssueTypeId
          ? "The selected issue type is not enabled for this project."
          : "No issue types are enabled for this project.",
      },
      { status: 400 },
    );
  }

  let resolvedStatusId: string;
  try {
    resolvedStatusId = resolveStatusId(resolvedIssueType, statusId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid status." }, { status: 400 });
  }

  if (parentId) {
    const parent = await prisma.workItem.findFirst({ where: scopedWorkItemWhere({ id: parentId }) });
    if (!parent) {
      return NextResponse.json({ error: "Parent work item not found." }, { status: 400 });
    }
    if (parent.projectId !== project.id) {
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

  if (normalizedStartDate && normalizedDueDate && normalizedStartDate.getTime() > normalizedDueDate.getTime()) {
    return NextResponse.json({ error: "Start date cannot be after due date." }, { status: 400 });
  }

  const normalizedDescription = typeof description === "string" ? description.trim() || null : null;
  const rawFieldValues = fieldValues && typeof fieldValues === "object" && !Array.isArray(fieldValues)
    ? fieldValues
    : {};

  const schemaFields = getSchemaFieldDefinitions(resolvedIssueType);
  const preparedFieldValues: { fieldId: string; value: string }[] = [];

  // 사용자가 값을 주지 않은 커스텀 필드는 (필드 스키마 우선) 기본값으로 채운다.
  const effectiveFieldValues: Record<string, unknown> = { ...rawFieldValues };
  for (const schemaField of schemaFields) {
    if (MANAGED_SCHEMA_FIELD_KEYS.has(schemaField.key)) continue;
    if (hasFieldInputValue(effectiveFieldValues[schemaField.id])) continue;
    const parsedDefault = parseStoredValue(schemaField.defaultValue);
    if (hasFieldInputValue(parsedDefault)) {
      effectiveFieldValues[schemaField.id] = parsedDefault;
    }
  }

  for (const schemaField of schemaFields) {
    if (isMissingRequiredField(schemaField, {
      title,
      description: normalizedDescription,
      projectId: project.id,
      statusId: resolvedStatusId,
      assigneeId: resolvedAssigneeId,
      parentId: parentId ?? null,
      startDate: normalizedStartDate,
      dueDate: normalizedDueDate,
      fieldValues: effectiveFieldValues,
    })) {
      return NextResponse.json({ error: `${schemaField.name} is required.` }, { status: 400 });
    }

    if (MANAGED_SCHEMA_FIELD_KEYS.has(schemaField.key)) {
      continue;
    }

    try {
      const normalizedFieldValue = normalizeFieldValueForStorage(schemaField, effectiveFieldValues[schemaField.id]);
      if (!normalizedFieldValue) continue;
      preparedFieldValues.push({ fieldId: schemaField.id, value: normalizedFieldValue });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid custom field value." }, { status: 400 });
    }
  }

  try {
    await validateReferenceFieldValues(prisma, preparedFieldValues, {
      user: session.user,
      project,
    });
  } catch {
    return NextResponse.json({ error: "Invalid custom field value." }, { status: 400 });
  }

  const { createdWorkItem, serverEventQueued } = await prisma.$transaction(async (tx) => {
    const issueNumber = await reserveProjectIssueNumber(tx, project.id);
    const issueKey = `${project.key}-${issueNumber}`;

    const descMentionRefs = await resolveMentionRefs(tx, normalizedDescription ?? "", project.id);
    const descUserMentionIds = filterUserMentionIds(descMentionRefs);

    const created = await tx.workItem.create({
      data: {
        issueKey,
        title: title.trim(),
        description: normalizedDescription,
        descriptionMentions: serializeMentionRefs(descMentionRefs),
        startDate: normalizedStartDate ?? null,
        dueDate: normalizedDueDate ?? null,
        issueTypeId: resolvedIssueType.id,
        statusId: resolvedStatusId,
        projectId: project.id,
        parentId: parentId || null,
        creatorId: currentUserId,
        assigneeId: resolvedAssigneeId,
        histories: {
          create: {
            field: "created",
            before: null,
            after: "Work item created.",
            actorId: currentUserId,
          },
        },
      },
      include: {
        ...workItemDetailInclude,
      },
    });
    await writeFieldValues(tx, WORK_ITEM_OBJECT_TYPE, created.id, preparedFieldValues);

    await tx.workItemProjectIssueKey.create({
      data: {
        workItemId: created.id,
        projectId: project.id,
        issueNumber,
      },
    });

    if (currentUserId) {
      await addWatcherIfMissing(tx, {
        workItemId: created.id,
        userId: currentUserId,
        source: "auto_creator",
        addedById: currentUserId,
      });
    }
    if (resolvedAssigneeId && resolvedAssigneeId !== currentUserId) {
      await addWatcherIfMissing(tx, {
        workItemId: created.id,
        userId: resolvedAssigneeId,
        source: "auto_assignee",
        addedById: currentUserId,
      });
    }

    let mentionRecipients: string[] = [];
    if (currentUserId && descUserMentionIds.length > 0) {
      mentionRecipients = await notifyMention(tx, {
        scope: "work_item",
        actorId: currentUserId,
        recipientIds: descUserMentionIds,
        workItemId: created.id,
        projectId: project.id,
        payload: {
          context: "description",
          issueKey,
          workItemTitle: created.title,
        },
      });
    }

    if (currentUserId && descMentionRefs.length > 0) {
      await notifyCrossReferences(tx, {
        actorId: currentUserId,
        refs: descMentionRefs,
        source: {
          scope: "work_item",
          projectId: project.id,
          workItemId: created.id,
          sourceContext: "description",
          sourceIssueKey: issueKey,
          sourceWorkItemTitle: created.title,
          sourceProjectKey: project.key,
        },
        skipRecipientIds: mentionRecipients,
      });
    }

    const detail = await attachWorkItemFieldValuesToDetail(tx, created);
    const queued = currentUserId
      ? await enqueueServerAnalyticsEvent(tx, "Work Item Created", currentUserId, {
          workspace_scope: serverWorkspaceScope(project),
          issue_type: resolvedIssueType.name,
        })
      : false;
    return { createdWorkItem: detail, serverEventQueued: queued };
  });

  if (serverEventQueued) scheduleServerAnalyticsDispatch();

  await logProjectActivity({
    projectId: project.id,
    actorId: currentUserId,
    kind: "workitem.created",
    subjectType: "workitem",
    subjectId: createdWorkItem.id,
    payload: { title: createdWorkItem.title, issueKey: createdWorkItem.issueKey },
  });

  return NextResponse.json(createdWorkItem, { status: 201 });
}
