import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";
import { logProjectActivity } from "@/lib/activity/log";

export async function GET(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const where = projectId ? { projectId } : {};

  const members = await prisma.projectMember.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
      role: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, key: true, ownerId: true, isPersonal: true } },
    },
    orderBy: { createdAt: "asc" },
  });

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
      isOwner: member.userId === member.project.ownerId,
      groupName: member.source === "group" && member.groupId ? groupNameById.get(member.groupId) ?? null : null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }
  const actorId = session.user?.id ?? null;

  const body = await request.json();
  const { projectId, userId, roleId } = body;

  if (!projectId || !userId || !roleId) {
    return NextResponse.json(
      { error: messages.errors.projectUserRoleRequired },
      { status: 400 }
    );
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: messages.errors.memberAlreadyAdded },
      { status: 409 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, isPersonal: true, ownerId: true },
  });
  if (!project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }
  if (project.isPersonal) {
    return NextResponse.json({ error: messages.errors.personalProjectCannotChangeMembers }, { status: 400 });
  }
  if (project.ownerId === userId) {
    return NextResponse.json({ error: messages.errors.ownerCannotBeAddedDirectly }, { status: 400 });
  }

  const member = await prisma.projectMember.create({
    data: { projectId, userId, roleId },
    include: {
      user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
      role: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, key: true, ownerId: true, isPersonal: true } },
    },
  });

  await logProjectActivity({
    projectId,
    actorId,
    kind: "member.added",
    subjectType: "user",
    subjectId: userId,
    payload: { userName: member.user?.name, roleName: member.role.name, roleId },
  });

  return NextResponse.json({ ...member, isOwner: member.userId === member.project.ownerId }, { status: 201 });
}
