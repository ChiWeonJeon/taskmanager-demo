import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string }> };

// POST /items/order — body: { items: { id: string; groupId: string | null; sortOrder: number }[] }
// Bulk apply DnD result: each entry is the desired groupId+sortOrder for one item.
// Foreign ids/groupIds are filtered out before the transaction.
export async function POST(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:edit");
  if (!auth.ok) return auth.response;

  let body: {
    items?: Array<{ id?: unknown; groupId?: unknown; sortOrder?: unknown }>;
  };
  try {
    body = await request.json();
  } catch {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }
  if (!Array.isArray(body.items)) {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }

  const checklist = await prisma.checklist.findFirst({
    where: { id: cid, projectId: auth.access.project!.id },
    select: { id: true },
  });
  if (!checklist) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  const ownedItemIds = new Set(
    (
      await prisma.checklistItem.findMany({
        where: { checklistId: cid },
        select: { id: true },
      })
    ).map((it) => it.id)
  );
  const ownedGroupIds = new Set(
    (
      await prisma.checklistItemGroup.findMany({
        where: { checklistId: cid },
        select: { id: true },
      })
    ).map((g) => g.id)
  );

  const sanitized = body.items
    .map((entry) => {
      const itemId = typeof entry.id === "string" ? entry.id : null;
      if (!itemId || !ownedItemIds.has(itemId)) return null;
      const sortOrder = typeof entry.sortOrder === "number" ? entry.sortOrder : null;
      if (sortOrder === null) return null;
      let groupId: string | null = null;
      if (entry.groupId === null || entry.groupId === undefined) {
        groupId = null;
      } else if (typeof entry.groupId === "string" && ownedGroupIds.has(entry.groupId)) {
        groupId = entry.groupId;
      } else {
        return null;
      }
      return { id: itemId, groupId, sortOrder };
    })
    .filter((x): x is { id: string; groupId: string | null; sortOrder: number } => x !== null);

  await prisma.$transaction(
    sanitized.map((entry) =>
      prisma.checklistItem.update({
        where: { id: entry.id },
        data: { groupId: entry.groupId, sortOrder: entry.sortOrder },
      })
    )
  );

  return NextResponse.json({ ok: true, applied: sanitized.length });
}
