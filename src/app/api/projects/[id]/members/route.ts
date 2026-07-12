import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { ensureProjectOwnerMembership, getProjectAccess, hasProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { getServerMessages } from "@/lib/i18n/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user);
  const project = access.project;
  if (!project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }

  if (project.isPersonal) {
    if (!access.isAdmin && !access.isOwner) {
      return NextResponse.json({ error: messages.errors.personalProjectAccessRequired }, { status: 403 });
    }

    const owner = project.ownerId
      ? await prisma.user.findUnique({ where: { id: project.ownerId }, select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } })
      : null;

    return NextResponse.json(
      owner
        ? [{ id: `personal-${project.id}`, userId: owner.id, user: owner, roleId: "personal-owner", role: { id: "personal-owner", name: messages.projectRoles.personalOwner }, isOwner: true, project: { id: project.id, name: project.name, key: project.key }, createdAt: project.createdAt, updatedAt: project.updatedAt }]
        : []
    );
  }

  if (!hasProjectAccess(access)) {
    return NextResponse.json({ error: messages.errors.notProjectMember }, { status: 403 });
  }

  if (project.ownerId) {
    await ensureProjectOwnerMembership(prisma, project.id, project.ownerId);
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId: project.id },
    include: {
      user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
      role: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, key: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // 상속(group-sourced) 멤버에 표시할 그룹 이름을 한 번에 조회한다.
  const groupIds = Array.from(
    new Set(members.map((member) => member.groupId).filter((value): value is string => Boolean(value))),
  );
  const groups = groupIds.length
    ? await prisma.projectGroup.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } })
    : [];
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  return NextResponse.json(
    members.map((member) => ({
      ...member,
      isOwner: member.userId === project.ownerId,
      groupName: member.source === "group" && member.groupId ? groupNameById.get(member.groupId) ?? null : null,
    }))
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user);
  const project = access.project;
  if (!project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }
  if (project.isPersonal) {
    return NextResponse.json({ error: messages.errors.personalProjectCannotChangeMembers }, { status: 400 });
  }

  if (!access.isAdmin && !access.isOwner && !hasProjectPermission(access, "members:manage")) {
    return NextResponse.json({ error: messages.errors.memberManageForbidden }, { status: 403 });
  }

  const body = await request.json();
  const { userId: targetUserId, roleId } = body;

  if (!targetUserId || !roleId) {
    return NextResponse.json({ error: messages.errors.userRoleRequired }, { status: 400 });
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: targetUserId } },
  });
  if (existing) {
    return NextResponse.json({ error: messages.errors.memberAlreadyAdded }, { status: 409 });
  }
  if (project.ownerId === targetUserId) {
    return NextResponse.json({ error: messages.errors.ownerCannotBeAddedDirectly }, { status: 400 });
  }

  const member = await prisma.projectMember.create({
    data: { projectId: project.id, userId: targetUserId, roleId },
    include: {
      user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
      role: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, key: true } },
    },
  });

  return NextResponse.json({ ...member, isOwner: member.userId === project.ownerId }, { status: 201 });
}
