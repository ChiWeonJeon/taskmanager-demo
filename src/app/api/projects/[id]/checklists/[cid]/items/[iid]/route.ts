import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string; iid: string }> };

// PATCH — update content, group membership and/or sortOrder of one master item.
// Used for inline edits and DnD moves (drop into group, drop to root, reorder).
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid, iid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:edit");
  if (!auth.ok) return auth.response;

  let body: { content?: string; groupId?: string | null; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }

  const item = await prisma.checklistItem.findFirst({
    where: { id: iid, checklist: { id: cid, projectId: auth.access.project!.id } },
    select: { id: true },
  });
  if (!item) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  const data: Record<string, unknown> = {};
  if (typeof body.content === "string") {
    const trimmed = body.content.trim();
    if (!trimmed) {
      return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
    }
    data.content = trimmed;
  }
  if (body.groupId !== undefined) {
    if (body.groupId === null) {
      data.groupId = null;
    } else {
      const owned = await prisma.checklistItemGroup.findFirst({
        where: { id: body.groupId, checklistId: cid },
        select: { id: true },
      });
      if (!owned) {
        return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
      }
      data.groupId = owned.id;
    }
  }
  if (typeof body.sortOrder === "number") {
    data.sortOrder = body.sortOrder;
  }

  const updated = await prisma.checklistItem.update({
    where: { id: iid },
    data,
    select: { id: true, content: true, groupId: true, sortOrder: true },
  });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid, iid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:edit");
  if (!auth.ok) return auth.response;

  const item = await prisma.checklistItem.findFirst({
    where: { id: iid, checklist: { id: cid, projectId: auth.access.project!.id } },
    select: { id: true },
  });
  if (!item) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }
  await prisma.checklistItem.delete({ where: { id: iid } });
  return NextResponse.json({ ok: true });
}
