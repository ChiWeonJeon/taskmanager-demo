import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { canManageGroup, getGroupAccess } from "@/lib/group-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import { removeGroupSourcedFromProject } from "@/lib/group-membership-sync";

type Ctx = { params: Promise<{ slugOrId: string; projectId: string }> };

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { slugOrId, projectId } = await params;
  const access = await getGroupAccess(slugOrId, session.user);
  if (!access.group) {
    return NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 });
  }
  if (!canManageGroup(access)) {
    return NextResponse.json({ error: messages.errors.projectUnlinkForbidden }, { status: 403 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }
  if (project.groupId !== access.group.id) {
    return NextResponse.json({ error: messages.errors.projectNotInGroup }, { status: 400 });
  }

  try {
    const previousGroupId = project.groupId;
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.project.update({
        where: { id: project.id },
        data: { groupId: null, sortOrderInGroup: 0 },
      });
      // 그룹에서 빠진 프로젝트의 group-sourced 멤버 행 정리(직접 멤버는 보존).
      if (previousGroupId) {
        await removeGroupSourcedFromProject(tx, project.id, previousGroupId);
      }
      return result;
    });
    return NextResponse.json(updated);
  } catch (error) {
    logApiError("DELETE", `/api/project-groups/${slugOrId}/projects/${projectId}`, error, { userId: session.user?.id });
    return NextResponse.json(
      { error: messages.errors.failedToDelete, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
