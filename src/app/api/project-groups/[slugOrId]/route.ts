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
import { removeAllGroupSourced } from "@/lib/group-membership-sync";

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

  const projects = await prisma.project.findMany({
    where: { groupId: access.group.id },
    orderBy: [{ sortOrderInGroup: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    group: access.group,
    projects,
    isOwner: access.isOwner,
    isAdmin: access.isAdmin,
    canManage: canManageGroup(access),
    permissions: Array.from(access.permissions),
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
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
    return NextResponse.json({ error: messages.errors.groupManageForbidden }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug, description, ownerId } = body as {
    name?: string;
    slug?: string;
    description?: string | null;
    ownerId?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof description !== "undefined") data.description = description?.toString().trim() || null;

  if (typeof slug === "string" && slug.trim()) {
    const nextSlug = slug.trim().toLowerCase();
    if (nextSlug !== access.group.slug) {
      const conflict = await prisma.projectGroup.findFirst({
        where: { slug: nextSlug, NOT: { id: access.group.id } },
      });
      if (conflict) {
        return NextResponse.json(
          { error: messages.errors.slugTaken.replace("{slug}", nextSlug) },
          { status: 409 },
        );
      }
      data.slug = nextSlug;
    }
  }

  if (typeof ownerId === "string") {
    const nextOwnerId = ownerId.trim();
    if (nextOwnerId === "") {
      return NextResponse.json(
        { error: messages.errors.ownerRequiredMinimum },
        { status: 400 },
      );
    }
    if (nextOwnerId !== access.group.ownerId) {
      if (!access.isAdmin && !access.isOwner) {
        return NextResponse.json({ error: messages.errors.ownerTransferForbidden }, { status: 403 });
      }
      const targetUser = await prisma.user.findUnique({ where: { id: nextOwnerId } });
      if (!targetUser) {
        return NextResponse.json({ error: messages.errors.transferTargetUserNotFound }, { status: 404 });
      }
      data.ownerId = nextOwnerId;
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.projectGroup.update({ where: { id: access.group!.id }, data });
      if (data.ownerId) {
        await ensureGroupOwnerMembership(tx, row.id, row.ownerId);
      }
      return row;
    });
    return NextResponse.json(updated);
  } catch (error) {
    logApiError("PATCH", `/api/project-groups/${slugOrId}`, error, { userId: session.user?.id });
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

  const { slugOrId } = await params;
  const access = await getGroupAccess(slugOrId, session.user);
  if (!access.group) {
    return NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 });
  }
  if (!canManageGroup(access)) {
    return NextResponse.json({ error: messages.errors.groupManageForbidden }, { status: 403 });
  }

  try {
    const groupId = access.group.id;
    await prisma.$transaction(async (tx) => {
      // 그룹 삭제 시 상속된 ProjectMember 행을 먼저 정리(groupId SetNull 전에).
      await removeAllGroupSourced(tx, groupId);
      await tx.project.updateMany({ where: { groupId }, data: { groupId: null, sortOrderInGroup: 0 } });
      await tx.projectGroup.delete({ where: { id: groupId } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("DELETE", `/api/project-groups/${slugOrId}`, error, { userId: session.user?.id });
    return NextResponse.json(
      { error: messages.errors.failedToDelete, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
