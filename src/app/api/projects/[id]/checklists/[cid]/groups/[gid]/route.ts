import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string; gid: string }> };

// PATCH — rename or change sortOrder of one group.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid, gid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:edit");
  if (!auth.ok) return auth.response;

  let body: { name?: string; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }

  const existing = await prisma.checklistItemGroup.findFirst({
    where: { id: gid, checklist: { id: cid, projectId: auth.access.project!.id } },
    select: { id: true },
  });
  if (!existing) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return checklistError(messages.errors.titleRequired, "CHECKLIST_BAD_REQUEST", 400);
    }
    data.name = trimmed;
  }
  if (typeof body.sortOrder === "number") {
    data.sortOrder = body.sortOrder;
  }

  const updated = await prisma.checklistItemGroup.update({
    where: { id: gid },
    data,
    select: { id: true, name: true, sortOrder: true, checklistId: true },
  });
  return NextResponse.json({ group: updated });
}

// DELETE — remove a group. ChecklistItem.groupId is set to null via FK
// (ON DELETE SET NULL), so the items are kept but become ungrouped.
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid, gid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:edit");
  if (!auth.ok) return auth.response;

  const existing = await prisma.checklistItemGroup.findFirst({
    where: { id: gid, checklist: { id: cid, projectId: auth.access.project!.id } },
    select: { id: true },
  });
  if (!existing) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  await prisma.checklistItemGroup.delete({ where: { id: gid } });
  return NextResponse.json({ ok: true });
}
