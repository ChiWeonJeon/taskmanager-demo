import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getChecklistRecipientIds } from "@/lib/checklist/recipients";
import { notifyChecklistRunEvent } from "@/lib/notifications/server";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string; rid: string }> };

export async function POST(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid, rid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:read");
  if (!auth.ok) return auth.response;

  const userId = auth.session.user!.id!;
  const projectId = auth.access.project!.id;
  const projectKey = auth.access.project!.key;

  const run = await prisma.checklistRun.findFirst({
    where: {
      id: rid,
      checklistId: cid,
      checklist: { projectId },
    },
    select: {
      id: true,
      status: true,
      checklist: { select: { id: true, title: true, createdById: true } },
      _count: { select: { items: true } },
    },
  });
  if (!run) {
    return checklistError(messages.errors.checklistRunNotFound, "CHECKLIST_RUN_NOT_FOUND", 404);
  }
  if (run.status !== "RUNNING") {
    return checklistError(messages.errors.checklistRunNotActive, "CHECKLIST_RUN_NOT_ACTIVE", 409);
  }

  const checkedCount = await prisma.checklistRunItem.count({
    where: { runId: rid, checked: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.checklistRun.update({
      where: { id: rid },
      data: { status: "COMPLETED", completedById: userId, completedAt: new Date() },
    });
    await tx.checklistRunEvent.create({
      data: { runId: rid, actorId: userId, action: "COMPLETE" },
    });

    const recipients = await getChecklistRecipientIds(tx, projectId, run.checklist.createdById);
    await notifyChecklistRunEvent(tx, {
      type: "checklist_run_completed",
      runId: rid,
      actorId: userId,
      recipientIds: recipients,
      projectId,
      payload: {
        checklistId: cid,
        checklistTitle: run.checklist.title,
        projectKey,
        totalItems: run._count.items,
        checkedItems: checkedCount,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
