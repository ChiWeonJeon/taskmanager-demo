import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { ensureProjectOwnerMembership, getProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { assertProjectIssueTypeRemovalAllowed } from "@/lib/schema-guards";
import { pickDefaultIssueType, syncProjectIssueTypeLinks } from "@/lib/issue-type-config";
import { logProjectActivity } from "@/lib/activity/log";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user);
  if (!access.project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  if (!access.isAdmin && !access.isOwner && !hasProjectPermission(access, "project:manage")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const existing = await prisma.project.findUnique({
    where: { id: access.project.id },
    include: {
      enabledIssueTypes: {
        include: { issueType: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = await request.json();
  const {
    name,
    key,
    description,
    ownerId,
    enabledIssueTypeIds,
    defaultIssueTypeId,
  } = body as {
    name?: string;
    key?: string;
    description?: string;
    ownerId?: string;
    enabledIssueTypeIds?: string[];
    defaultIssueTypeId?: string | null;
  };

  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: "Project name cannot be empty." }, { status: 400 });
  }

  if (key !== undefined && !key.trim()) {
    return NextResponse.json({ error: "Project key cannot be empty." }, { status: 400 });
  }

  const nextKey = key?.trim().toUpperCase() ?? existing.key;
  if (nextKey !== existing.key) {
    const duplicate = await prisma.project.findUnique({
      where: { key: nextKey },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json({ error: `Project key '${nextKey}' is already in use.` }, { status: 409 });
    }
  }

  if (ownerId !== undefined) {
    const nextOwnerId = ownerId.trim();
    if (!nextOwnerId) {
      return NextResponse.json({ error: "ownerId cannot be empty." }, { status: 400 });
    }

    if (existing.isPersonal) {
      return NextResponse.json({ error: "Personal project ownership cannot be transferred." }, { status: 400 });
    }

    const nextOwner = await prisma.user.findUnique({
      where: { id: nextOwnerId },
      select: { id: true },
    });

    if (!nextOwner) {
      return NextResponse.json({ error: "New owner not found." }, { status: 400 });
    }

    if (nextOwnerId !== existing.ownerId) {
      const memberUserIds = new Set(
        (await prisma.projectMember.findMany({
          where: { projectId: existing.id },
          select: { userId: true },
        })).map((member) => member.userId),
      );

      if (existing.ownerId) {
        memberUserIds.add(existing.ownerId);
      }

      if (memberUserIds.size < 2) {
        return NextResponse.json(
          { error: "Ownership can only be transferred when another member already exists." },
          { status: 400 },
        );
      }

      if (!memberUserIds.has(nextOwnerId)) {
        return NextResponse.json(
          { error: "Ownership can only be transferred to an existing project member." },
          { status: 400 },
        );
      }
    }
  }

  const currentEnabledIssueTypes = existing.enabledIssueTypes.map((link) => link.issueType);
  const normalizedEnabledIssueTypeIds = enabledIssueTypeIds
    ? Array.from(new Set(enabledIssueTypeIds))
    : currentEnabledIssueTypes.map((issueType) => issueType.id);

  if (normalizedEnabledIssueTypeIds.length === 0) {
    return NextResponse.json({ error: "A project must have at least one enabled issue type." }, { status: 400 });
  }

  const nextEnabledIssueTypes = await prisma.issueType.findMany({
    where: { id: { in: normalizedEnabledIssueTypeIds } },
    orderBy: { createdAt: "asc" },
  });

  if (nextEnabledIssueTypes.length !== normalizedEnabledIssueTypeIds.length) {
    return NextResponse.json({ error: "One or more issue types were not found." }, { status: 400 });
  }

  const removedIssueTypeIds = currentEnabledIssueTypes
    .map((issueType) => issueType.id)
    .filter((issueTypeId) => !normalizedEnabledIssueTypeIds.includes(issueTypeId));

  try {
    await assertProjectIssueTypeRemovalAllowed(prisma, existing.id, removedIssueTypeIds);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to validate issue type changes." },
      { status: 400 },
    );
  }

  const nextDefaultIssueType = defaultIssueTypeId === null
    ? null
    : pickDefaultIssueType(
      nextEnabledIssueTypes,
      defaultIssueTypeId ?? existing.defaultIssueTypeId ?? normalizedEnabledIssueTypeIds[0],
    );

  if (!nextDefaultIssueType) {
    return NextResponse.json({ error: "A default issue type is required." }, { status: 400 });
  }

  const project = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id: existing.id },
      data: {
        name: name?.trim() || existing.name,
        key: nextKey,
        description: description !== undefined ? description.trim() || null : existing.description,
        ownerId: ownerId !== undefined ? ownerId.trim() : existing.ownerId,
        defaultIssueTypeId: nextDefaultIssueType.id,
      },
    });

    await syncProjectIssueTypeLinks(tx, existing.id, normalizedEnabledIssueTypeIds);

    if (ownerId !== undefined) {
      await ensureProjectOwnerMembership(tx, existing.id, ownerId.trim());
    }

    return updated;
  });

  await logProjectActivity({
    projectId: existing.id,
    actorId: session.user?.id ?? null,
    kind: "settings.updated",
    subjectType: "project",
    subjectId: existing.id,
    payload: {
      nameChanged: name !== undefined && name?.trim() !== existing.name,
      keyChanged: nextKey !== existing.key,
      descriptionChanged: description !== undefined,
      ownerChanged: ownerId !== undefined && ownerId.trim() !== existing.ownerId,
      defaultIssueTypeChanged: nextDefaultIssueType.id !== existing.defaultIssueTypeId,
    },
  });

  return NextResponse.json(project);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user);
  const existing = access.project;

  if (!existing) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  if (!access.isAdmin && !access.isOwner && !hasProjectPermission(access, "project:manage")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (existing.isPersonal) {
    return NextResponse.json({ error: "Personal projects cannot be deleted." }, { status: 400 });
  }

  const workItemCount = await prisma.workItem.count({ where: { projectId: existing.id } });

  let body: { confirmationKey?: string; confirmCascade?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!body.confirmCascade) {
    return NextResponse.json(
      { error: "Confirm project deletion and cascading work item deletion first." },
      { status: 400 },
    );
  }

  if ((body.confirmationKey ?? "").trim().toUpperCase() !== existing.key) {
    return NextResponse.json(
      { error: "Project key confirmation did not match." },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.workItem.deleteMany({ where: { projectId: existing.id } });
    await tx.project.delete({ where: { id: existing.id } });
  });

  return NextResponse.json({
    deletedProjectId: existing.id,
    deletedWorkItemCount: workItemCount,
  });
}
