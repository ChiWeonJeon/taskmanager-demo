import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";
import { logProjectActivity } from "@/lib/activity/log";

type Ctx = { params: Promise<{ id: string }> };

const CHECKLIST_SELECT = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { items: true, runs: true } },
} as const;

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:read");
  if (!auth.ok) return auth.response;

  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "1";

  const checklists = await prisma.checklist.findMany({
    where: {
      projectId: auth.access.project!.id,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      ...CHECKLIST_SELECT,
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
    },
  });

  return NextResponse.json({ checklists });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:create");
  if (!auth.ok) return auth.response;

  const project = auth.access.project!;
  const userId = auth.session.user!.id!;

  let body: { title?: string; description?: string | null };
  try {
    body = await request.json();
  } catch {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return checklistError(messages.errors.titleRequired, "CHECKLIST_BAD_REQUEST", 400);
  }

  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.checklist.findFirst({
      where: { projectId: project.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const nextSortOrder = (last?.sortOrder ?? -1) + 1;
    const master = await tx.checklist.create({
      data: {
        projectId: project.id,
        title,
        description: body.description?.trim() || null,
        createdById: userId,
        sortOrder: nextSortOrder,
      },
      select: CHECKLIST_SELECT,
    });
    return master;
  });

  await logProjectActivity({
    projectId: project.id,
    actorId: userId,
    kind: "checklist.created",
    subjectType: "checklist",
    subjectId: created.id,
    payload: { title: created.title },
  });

  return NextResponse.json({ checklist: created }, { status: 201 });
}
