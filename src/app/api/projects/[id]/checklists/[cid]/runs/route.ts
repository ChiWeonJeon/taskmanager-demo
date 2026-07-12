import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getChecklistRecipientIds } from "@/lib/checklist/recipients";
import { notifyChecklistRunEvent } from "@/lib/notifications/server";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string }> };

const RUN_LIST_SELECT = {
  id: true,
  checklistId: true,
  status: true,
  startedAt: true,
  completedAt: true,
  startedBy: { select: { id: true, name: true, email: true } },
  completedBy: { select: { id: true, name: true, email: true } },
  _count: { select: { items: true } },
} as const;

export async function GET(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:read");
  if (!auth.ok) return auth.response;

  const checklist = await prisma.checklist.findFirst({
    where: { id: cid, projectId: auth.access.project!.id },
    select: { id: true },
  });
  if (!checklist) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const from = sp.get("from");
  const to = sp.get("to");

  const where: Prisma.ChecklistRunWhereInput = { checklistId: cid };
  if (status === "RUNNING" || status === "COMPLETED" || status === "CANCELED") {
    where.status = status;
  }
  if (from || to) {
    where.startedAt = {};
    if (from) where.startedAt.gte = new Date(from);
    if (to) where.startedAt.lte = new Date(to);
  }

  const runs = await prisma.checklistRun.findMany({
    where,
    orderBy: [{ startedAt: "desc" }],
    select: RUN_LIST_SELECT,
  });

  const checkedCounts = await prisma.checklistRunItem.groupBy({
    by: ["runId"],
    where: { runId: { in: runs.map((r) => r.id) }, checked: true },
    _count: { _all: true },
  });
  const checkedMap = new Map(checkedCounts.map((c) => [c.runId, c._count._all]));

  const enriched = runs.map((r) => ({
    ...r,
    checkedCount: checkedMap.get(r.id) ?? 0,
    totalCount: r._count.items,
  }));

  return NextResponse.json({ runs: enriched });
}

export async function POST(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:read");
  if (!auth.ok) return auth.response;

  const userId = auth.session.user!.id!;
  const projectId = auth.access.project!.id;
  const projectKey = auth.access.project!.key;

  const checklist = await prisma.checklist.findFirst({
    where: { id: cid, projectId, archivedAt: null },
    select: {
      id: true,
      title: true,
      createdById: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          content: true,
          sortOrder: true,
          groupId: true,
          group: { select: { id: true, name: true, sortOrder: true } },
        },
      },
    },
  });
  if (!checklist) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }
  if (checklist.items.length === 0) {
    return checklistError(messages.errors.checklistEmptyItems, "CHECKLIST_EMPTY", 400);
  }

  const existingRunning = await prisma.checklistRun.findFirst({
    where: { checklistId: cid, status: "RUNNING" },
    select: { id: true, startedBy: { select: { id: true, name: true } } },
  });
  if (existingRunning) {
    return checklistError(
      messages.errors.checklistRunAlreadyRunning,
      "CHECKLIST_RUN_CONFLICT",
      409,
      { runId: existingRunning.id, startedBy: existingRunning.startedBy }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const run = await tx.checklistRun.create({
        data: {
          checklistId: cid,
          status: "RUNNING",
          startedById: userId,
          items: {
            create: checklist.items.map((it) => ({
              sourceItemId: it.id,
              content: it.content,
              sortOrder: it.sortOrder,
              // Snapshot group label so the run stays readable even if the
              // master group is renamed or removed later. groupSortOrder
              // preserves grouping order for display; null = ungrouped.
              groupName: it.group?.name ?? null,
              groupSortOrder: it.group?.sortOrder ?? null,
            })),
          },
        },
        select: { id: true },
      });

      await tx.checklistRunEvent.create({
        data: { runId: run.id, actorId: userId, action: "START" },
      });

      const recipients = await getChecklistRecipientIds(tx, projectId, checklist.createdById);
      await notifyChecklistRunEvent(tx, {
        type: "checklist_run_started",
        runId: run.id,
        actorId: userId,
        recipientIds: recipients,
        projectId,
        payload: {
          checklistId: cid,
          checklistTitle: checklist.title,
          projectKey,
        },
      });

      return run;
    });

    return NextResponse.json({ runId: result.id }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return checklistError(messages.errors.checklistRunAlreadyRunning, "CHECKLIST_RUN_CONFLICT", 409);
    }
    throw err;
  }
}
