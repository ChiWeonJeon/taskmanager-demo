import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string }> };

const ITEM_SELECT = {
  id: true,
  checklistId: true,
  groupId: true,
  content: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

// POST — create one item, optionally inside a group, appended to the bucket.
// Returns the created row so the client can splice it in without refetching.
export async function POST(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:edit");
  if (!auth.ok) return auth.response;

  let body: { content?: string; groupId?: string | null; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }
  const content = (body.content ?? "").trim();
  if (!content) {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }

  const checklist = await prisma.checklist.findFirst({
    where: { id: cid, projectId: auth.access.project!.id },
    select: { id: true },
  });
  if (!checklist) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  let groupId: string | null = null;
  if (body.groupId) {
    const owned = await prisma.checklistItemGroup.findFirst({
      where: { id: body.groupId, checklistId: cid },
      select: { id: true },
    });
    if (!owned) {
      return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
    }
    groupId = owned.id;
  }

  const last = await prisma.checklistItem.findFirst({
    where: { checklistId: cid, groupId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextSortOrder =
    typeof body.sortOrder === "number" ? body.sortOrder : (last?.sortOrder ?? -1) + 1;

  const item = await prisma.checklistItem.create({
    data: { checklistId: cid, groupId, content, sortOrder: nextSortOrder },
    select: ITEM_SELECT,
  });
  return NextResponse.json({ item }, { status: 201 });
}
