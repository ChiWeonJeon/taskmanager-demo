import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string; rid: string; iid: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid, rid, iid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:read");
  if (!auth.ok) return auth.response;

  const userId = auth.session.user!.id!;

  let body: { checked?: boolean };
  try {
    body = await request.json();
  } catch {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }
  if (typeof body.checked !== "boolean") {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }

  const run = await prisma.checklistRun.findFirst({
    where: {
      id: rid,
      checklistId: cid,
      checklist: { projectId: auth.access.project!.id },
    },
    select: { id: true, status: true },
  });
  if (!run) {
    return checklistError(messages.errors.checklistRunNotFound, "CHECKLIST_RUN_NOT_FOUND", 404);
  }
  if (run.status !== "RUNNING") {
    return checklistError(messages.errors.checklistRunNotActive, "CHECKLIST_RUN_NOT_ACTIVE", 409);
  }

  const item = await prisma.checklistRunItem.findFirst({
    where: { id: iid, runId: rid },
    select: { id: true, checked: true, content: true },
  });
  if (!item) {
    return checklistError(messages.errors.checklistRunItemNotFound, "CHECKLIST_RUN_ITEM_NOT_FOUND", 404);
  }
  if (item.checked === body.checked) {
    return NextResponse.json({ item: { id: item.id, checked: item.checked } });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.checklistRunItem.update({
      where: { id: iid },
      data: {
        checked: body.checked,
        checkedById: body.checked ? userId : null,
        checkedAt: body.checked ? new Date() : null,
      },
      select: {
        id: true,
        checked: true,
        checkedAt: true,
        checkedBy: { select: { id: true, name: true, email: true } },
      },
    });
    await tx.checklistRunEvent.create({
      data: {
        runId: rid,
        itemId: iid,
        actorId: userId,
        action: body.checked ? "CHECK" : "UNCHECK",
        // Snapshot the item content so the activity timeline survives later
        // edits and so the UI doesn't have to cross-reference run items by id
        // (especially for items deleted from the master afterwards).
        payload: JSON.stringify({ itemContent: item.content }),
      },
    });
    return next;
  });

  return NextResponse.json({ item: updated });
}
