import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { getGroupAccess, hasGroupAccess } from "@/lib/group-permissions";
import { scopedWorkItemWhere, serializeWorkItemSummaries, workItemSummarySelect } from "@/lib/work-item-query";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ slugOrId: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
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

  const { searchParams } = new URL(request.url);
  const assigneeId = searchParams.get("assigneeId");

  try {
    const projects = await prisma.project.findMany({
      where: { groupId: access.group.id },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) return NextResponse.json([]);

    const resolvedAssigneeId =
      assigneeId === "me" ? session.user?.id ?? null : assigneeId ?? null;

    const items = await prisma.workItem.findMany({
      where: scopedWorkItemWhere({
        projectId: { in: projectIds },
        deletedAt: null,
        ...(resolvedAssigneeId ? { assigneeId: resolvedAssigneeId } : {}),
      }),
      orderBy: { createdAt: "desc" },
      select: workItemSummarySelect,
    });

    return NextResponse.json(await serializeWorkItemSummaries(prisma, items));
  } catch (error) {
    logApiError("GET", `/api/project-groups/${slugOrId}/work-items`, error, { userId: session.user?.id });
    return NextResponse.json(
      { error: messages.errors.failedToLoad, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
