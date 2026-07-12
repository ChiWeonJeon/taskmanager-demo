import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { canManageGroup, getGroupAccess } from "@/lib/group-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import { removeGroupMemberFromProjects } from "@/lib/group-membership-sync";

type Ctx = { params: Promise<{ slugOrId: string; memberId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { slugOrId, memberId } = await params;
  const access = await getGroupAccess(slugOrId, session.user);
  if (!access.group) {
    return NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 });
  }
  if (!canManageGroup(access)) {
    return NextResponse.json({ error: messages.errors.memberManageForbidden }, { status: 403 });
  }

  const body = await request.json();
  const { roleId } = body as { roleId?: string };
  if (!roleId) {
    return NextResponse.json({ error: messages.errors.roleIdRequired }, { status: 400 });
  }

  const existing = await prisma.projectGroupMember.findUnique({ where: { id: memberId } });
  if (!existing || existing.groupId !== access.group.id) {
    return NextResponse.json({ error: messages.errors.memberNotFound }, { status: 404 });
  }
  if (existing.userId === access.group.ownerId) {
    return NextResponse.json({ error: messages.errors.ownerCannotBeAssignedRole }, { status: 400 });
  }

  try {
    const updated = await prisma.projectGroupMember.update({
      where: { id: memberId },
      data: { roleId },
      include: {
        user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
        role: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ ...updated, isOwner: false });
  } catch (error) {
    logApiError("PATCH", `/api/project-groups/${slugOrId}/members/${memberId}`, error, { userId: session.user?.id });
    return NextResponse.json(
      { error: messages.errors.failedToUpdate, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { slugOrId, memberId } = await params;
  const access = await getGroupAccess(slugOrId, session.user);
  if (!access.group) {
    return NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 });
  }
  if (!canManageGroup(access)) {
    return NextResponse.json({ error: messages.errors.memberManageForbidden }, { status: 403 });
  }

  const existing = await prisma.projectGroupMember.findUnique({ where: { id: memberId } });
  if (!existing || existing.groupId !== access.group.id) {
    return NextResponse.json({ error: messages.errors.memberNotFound }, { status: 404 });
  }
  if (existing.userId === access.group.ownerId) {
    return NextResponse.json({ error: messages.errors.ownerMustBeTransferredFirst }, { status: 400 });
  }

  const groupId = access.group.id;
  await prisma.$transaction(async (tx) => {
    await tx.projectGroupMember.delete({ where: { id: memberId } });
    // 그룹에서 상속된 ProjectMember 행 정리(직접 멤버는 보존).
    await removeGroupMemberFromProjects(tx, groupId, existing.userId);
  });
  return NextResponse.json({ ok: true });
}
