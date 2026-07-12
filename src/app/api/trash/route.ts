import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";
import { scopedWorkItemWhere } from "@/lib/work-item-query";

const RETENTION_DAYS = 30;

export async function GET(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const projectKey = searchParams.get("projectKey");

  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - RETENTION_DAYS);

  const baseWhere = {
    deletedAt: { not: null, gte: retentionCutoff },
  };

  if (projectId) {
    Object.assign(baseWhere, { projectId });
  } else if (projectKey) {
    const project = await prisma.project.findUnique({ where: { key: projectKey } });
    if (project) Object.assign(baseWhere, { projectId: project.id });
  }

  const items = await prisma.workItem.findMany({
    where: scopedWorkItemWhere(baseWhere),
    include: {
      status: true,
      issueType: true,
      project: true,
      assignee: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
    },
    orderBy: { deletedAt: "desc" },
  });

  return NextResponse.json(items);
}
