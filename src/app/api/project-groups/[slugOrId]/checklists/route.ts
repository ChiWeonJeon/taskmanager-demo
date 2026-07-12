import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { getGroupAccess, hasGroupAccess } from "@/lib/group-permissions";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ slugOrId: string }> };

const CHECKLIST_SELECT = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, key: true, name: true } },
  _count: { select: { items: true, runs: true } },
  runs: {
    where: { status: "RUNNING" },
    select: {
      id: true,
      status: true,
      startedAt: true,
      startedBy: { select: { id: true, name: true, email: true } },
    },
    take: 1,
  },
} as const;

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

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status"); // "active" | "running" | "completed" | "all"
  const projectFilter = sp.get("projectId");
  const includeArchived = sp.get("includeArchived") === "1";

  try {
    const projects = await prisma.project.findMany({
      where: { groupId: access.group.id },
      select: { id: true, key: true, name: true, sortOrderInGroup: true },
      orderBy: [{ sortOrderInGroup: "asc" }, { createdAt: "asc" }],
    });
    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) {
      return NextResponse.json({ projects, checklists: [] });
    }

    const checklists = await prisma.checklist.findMany({
      where: {
        projectId: projectFilter && projectIds.includes(projectFilter) ? projectFilter : { in: projectIds },
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [{ createdAt: "desc" }],
      select: CHECKLIST_SELECT,
    });

    let filtered = checklists;
    if (status === "running") {
      filtered = filtered.filter((c) => c.runs.length > 0);
    } else if (status === "active") {
      filtered = filtered.filter((c) => c.archivedAt === null);
    }

    return NextResponse.json({ projects, checklists: filtered });
  } catch (error) {
    logApiError("GET", `/api/project-groups/${slugOrId}/checklists`, error, {
      userId: session.user?.id,
    });
    return NextResponse.json(
      {
        error: messages.errors.failedToLoad,
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
