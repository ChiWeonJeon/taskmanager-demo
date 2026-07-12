import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import {
  canManageGroup,
  ensureGroupOwnerMembership,
  getGroupAccess,
  hasGroupAccess,
} from "@/lib/group-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import { getDefaultRoleId } from "@/lib/roles";
import { materializeGroupMemberInProjects } from "@/lib/group-membership-sync";

type Ctx = { params: Promise<{ slugOrId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { slugOrId } = await params;
  const access = await getGroupAccess(slugOrId, session.user);
  if (!access.group) {
    return NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 });
  }
  if (!hasGroupAccess(access)) {
    return NextResponse.json({ error: messages.errors.groupAccessRequired }, { status: 403 });
  }

  if (access.group.ownerId) {
    await ensureGroupOwnerMembership(prisma, access.group.id, access.group.ownerId);
  }

  const members = await prisma.projectGroupMember.findMany({
    where: { groupId: access.group.id },
    include: {
      user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
      role: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    members.map((m) => ({ ...m, isOwner: m.userId === access.group!.ownerId })),
  );
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { slugOrId } = await params;
  const access = await getGroupAccess(slugOrId, session.user);
  if (!access.group) {
    return NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 });
  }
  if (!canManageGroup(access)) {
    return NextResponse.json({ error: messages.errors.memberManageForbidden }, { status: 403 });
  }

  const body = await request.json();
  const { userId: targetUserId } = body as { userId?: string };
  // 그룹 멤버십은 (프로젝트) 역할을 갖지 않는다. 역할은 프로젝트별 ProjectMember 로 부여되며,
  // 자동 상속 멤버에게는 기본 역할이 적용된다. roleId 컬럼은 NOT NULL 이라 기본 역할로 채운다(미사용).
  if (!targetUserId) {
    return NextResponse.json({ error: messages.errors.userIdRequired }, { status: 400 });
  }
  if (access.group.ownerId === targetUserId) {
    return NextResponse.json({ error: messages.errors.ownerCannotBeAddedDirectly }, { status: 400 });
  }

  const existing = await prisma.projectGroupMember.findUnique({
    where: { groupId_userId: { groupId: access.group.id, userId: targetUserId } },
  });
  if (existing) {
    return NextResponse.json({ error: messages.errors.memberAlreadyAdded }, { status: 409 });
  }

  const defaultRoleId = await getDefaultRoleId(prisma);
  if (!defaultRoleId) {
    return NextResponse.json({ error: messages.errors.failedToCreate }, { status: 500 });
  }

  try {
    const groupId = access.group.id;
    const member = await prisma.$transaction(async (tx) => {
      const created = await tx.projectGroupMember.create({
        data: { groupId, userId: targetUserId, roleId: defaultRoleId },
        include: {
          user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
          role: { select: { id: true, name: true } },
        },
      });
      await materializeGroupMemberInProjects(tx, groupId, targetUserId, defaultRoleId);
      return created;
    });
    return NextResponse.json({ ...member, isOwner: false }, { status: 201 });
  } catch (error) {
    logApiError("POST", `/api/project-groups/${slugOrId}/members`, error, { userId: session.user?.id });
    return NextResponse.json(
      { error: messages.errors.failedToCreate, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
