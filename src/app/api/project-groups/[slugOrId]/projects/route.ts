import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { canManageGroup, getGroupAccess } from "@/lib/group-permissions";
import { getProjectAccess } from "@/lib/project-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import { materializeAllGroupMembersInProject } from "@/lib/group-membership-sync";

type Ctx = { params: Promise<{ slugOrId: string }> };

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
    return NextResponse.json({ error: messages.errors.projectLinkForbidden }, { status: 403 });
  }

  const body = await request.json();
  const { projectId } = body as { projectId?: string };
  if (!projectId) {
    return NextResponse.json({ error: messages.errors.projectIdRequired }, { status: 400 });
  }

  const projectAccess = await getProjectAccess(projectId, session.user);
  const project = projectAccess.project;
  if (!project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }
  if (project.isPersonal) {
    return NextResponse.json({ error: messages.errors.personalProjectCannotJoinGroup }, { status: 400 });
  }
  if (!projectAccess.isAdmin && !projectAccess.isOwner) {
    return NextResponse.json({ error: messages.errors.projectLinkNotGroupOwnerAdmin }, { status: 403 });
  }
  if (project.groupId && project.groupId !== access.group.id) {
    return NextResponse.json({ error: messages.errors.projectAlreadyInOtherGroup }, { status: 409 });
  }

  try {
    const maxOrder = await prisma.project.aggregate({
      where: { groupId: access.group.id },
      _max: { sortOrderInGroup: true },
    });
    const nextOrder = (maxOrder._max.sortOrderInGroup ?? -1) + 1;

    const groupId = access.group.id;
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.project.update({
        where: { id: project.id },
        data: { groupId, sortOrderInGroup: nextOrder },
      });
      // 편입된 프로젝트에 그룹의 모든 멤버를 group-sourced 멤버로 실체화.
      await materializeAllGroupMembersInProject(tx, project.id, groupId);
      return result;
    });
    return NextResponse.json(updated);
  } catch (error) {
    logApiError("POST", `/api/project-groups/${slugOrId}/projects`, error, { userId: session.user?.id });
    return NextResponse.json(
      { error: messages.errors.failedToCreate, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
