import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";
import { logProjectActivity } from "@/lib/activity/log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }
  const actorId = session.user?.id ?? null;

  const { id } = await params;
  const body = await request.json();
  const { roleId } = body;

  if (!roleId) {
    return NextResponse.json(
      { error: messages.errors.roleRequired },
      { status: 400 }
    );
  }

  const existing = await prisma.projectMember.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: messages.errors.memberNotFound },
      { status: 404 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: existing.projectId },
    select: { id: true, isPersonal: true, ownerId: true },
  });
  if (!project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }
  if (project.isPersonal) {
    return NextResponse.json({ error: messages.errors.personalProjectCannotChangeMembers }, { status: 400 });
  }
  if (existing.userId === project.ownerId) {
    return NextResponse.json({ error: messages.errors.ownerCannotBeAssignedRole }, { status: 400 });
  }

  const member = await prisma.projectMember.update({
    where: { id },
    data: { roleId },
    include: {
      user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
      role: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, key: true, ownerId: true, isPersonal: true } },
    },
  });

  if (existing.roleId !== roleId) {
    await logProjectActivity({
      projectId: existing.projectId,
      actorId,
      kind: "member.role_changed",
      subjectType: "user",
      subjectId: existing.userId,
      payload: { userName: member.user?.name, fromRoleId: existing.roleId, toRoleId: roleId, toRoleName: member.role.name },
    });
  }

  return NextResponse.json({ ...member, isOwner: member.userId === member.project.ownerId });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }
  const actorId = session.user?.id ?? null;

  const { id } = await params;

  const existing = await prisma.projectMember.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: messages.errors.memberNotFound },
      { status: 404 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: existing.projectId },
    select: { id: true, isPersonal: true, ownerId: true },
  });
  if (!project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }
  if (project.isPersonal) {
    return NextResponse.json({ error: messages.errors.personalProjectCannotRemoveMembers }, { status: 400 });
  }
  if (existing.userId === project.ownerId) {
    return NextResponse.json({ error: messages.errors.ownerMustBeTransferredFirst }, { status: 400 });
  }
  // 그룹에서 상속된 멤버는 직접 제거할 수 없다(그룹 탈퇴로만 제거).
  if (existing.source === "group") {
    return NextResponse.json({ error: messages.errors.cannotRemoveInheritedMember }, { status: 400 });
  }

  await prisma.projectMember.delete({ where: { id } });

  await logProjectActivity({
    projectId: existing.projectId,
    actorId,
    kind: "member.removed",
    subjectType: "user",
    subjectId: existing.userId,
  });

  return NextResponse.json({ success: true });
}
