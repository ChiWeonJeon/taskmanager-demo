import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { getServerMessages } from "@/lib/i18n/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { id, memberId } = await params;
  const access = await getProjectAccess(id, session.user);
  const project = access.project;
  if (!project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }
  if (project.isPersonal) {
    return NextResponse.json({ error: messages.errors.personalProjectCannotChangeRole }, { status: 400 });
  }
  if (!access.isAdmin && !access.isOwner && !hasProjectPermission(access, "members:manage")) {
    return NextResponse.json({ error: messages.errors.memberManageForbidden }, { status: 403 });
  }

  const body = await request.json();
  const { roleId } = body;
  if (!roleId) {
    return NextResponse.json({ error: messages.errors.roleIdRequired }, { status: 400 });
  }

  const existingMember = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId: project.id },
  });
  if (!existingMember) {
    return NextResponse.json({ error: messages.errors.memberNotFound }, { status: 404 });
  }
  if (existingMember.userId === project.ownerId) {
    return NextResponse.json({ error: messages.errors.ownerCannotBeAssignedRole }, { status: 400 });
  }

  const member = await prisma.projectMember.update({
    where: { id: memberId },
    data: { roleId },
    include: {
      user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
      role: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, key: true } },
    },
  });

  return NextResponse.json({ ...member, isOwner: member.userId === project.ownerId });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { id, memberId } = await params;
  const access = await getProjectAccess(id, session.user);
  const project = access.project;
  if (!project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }
  if (project.isPersonal) {
    return NextResponse.json({ error: messages.errors.personalProjectCannotRemoveMembers }, { status: 400 });
  }
  if (!access.isAdmin && !access.isOwner && !hasProjectPermission(access, "members:manage")) {
    return NextResponse.json({ error: messages.errors.memberManageForbidden }, { status: 403 });
  }

  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId: project.id },
  });
  if (!member) {
    return NextResponse.json({ error: messages.errors.memberNotFound }, { status: 404 });
  }
  if (member.userId === project.ownerId) {
    return NextResponse.json({ error: messages.errors.ownerMustBeTransferredFirst }, { status: 400 });
  }
  // 그룹에서 상속된 멤버는 프로젝트에서 직접 제거할 수 없다(그룹 탈퇴로만 제거).
  if (member.source === "group") {
    return NextResponse.json({ error: messages.errors.cannotRemoveInheritedMember }, { status: 400 });
  }

  await prisma.projectMember.delete({ where: { id: memberId } });
  return new NextResponse(null, { status: 204 });
}
