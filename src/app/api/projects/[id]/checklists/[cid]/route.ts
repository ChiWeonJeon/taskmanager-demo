import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";
import { logProjectActivity } from "@/lib/activity/log";

type Ctx = { params: Promise<{ id: string; cid: string }> };

const FULL_SELECT = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  createdById: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      content: true,
      sortOrder: true,
      groupId: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  groups: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, name: true, sortOrder: true, createdAt: true, updatedAt: true },
  },
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

export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:read");
  if (!auth.ok) return auth.response;

  const checklist = await prisma.checklist.findFirst({
    where: { id: cid, projectId: auth.access.project!.id },
    select: FULL_SELECT,
  });
  if (!checklist) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }
  return NextResponse.json({ checklist });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:edit");
  if (!auth.ok) return auth.response;

  let body: {
    title?: string;
    description?: string | null;
    items?: Array<{ id?: string; content: string; sortOrder?: number; groupId?: string | null }>;
  };
  try {
    body = await request.json();
  } catch {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }

  const existing = await prisma.checklist.findFirst({
    where: { id: cid, projectId: auth.access.project!.id },
    select: { id: true, items: { select: { id: true } } },
  });
  if (!existing) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (!t) throw new Error("EMPTY_TITLE");
      updateData.title = t;
    }
    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }
    if (Object.keys(updateData).length > 0) {
      await tx.checklist.update({ where: { id: cid }, data: updateData });
    }

    if (Array.isArray(body.items)) {
      // Resolve incoming groupIds against rows actually owned by this checklist.
      const validGroupIds = new Set(
        (
          await tx.checklistItemGroup.findMany({
            where: { checklistId: cid },
            select: { id: true },
          })
        ).map((g) => g.id)
      );
      const incoming = body.items
        .map((it, idx) => ({
          id: it.id,
          content: (it.content ?? "").trim(),
          sortOrder: typeof it.sortOrder === "number" ? it.sortOrder : idx,
          groupId:
            it.groupId === undefined
              ? undefined
              : it.groupId && validGroupIds.has(it.groupId)
                ? it.groupId
                : null,
        }))
        .filter((it) => it.content.length > 0);

      const incomingIds = new Set(incoming.filter((it) => it.id).map((it) => it.id!));
      const toDelete = existing.items.filter((it) => !incomingIds.has(it.id)).map((it) => it.id);
      if (toDelete.length > 0) {
        await tx.checklistItem.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (const it of incoming) {
        if (it.id) {
          // Update can omit groupId (only sets it when caller provided one).
          const updateData: { content: string; sortOrder: number; groupId?: string | null } = {
            content: it.content,
            sortOrder: it.sortOrder,
          };
          if (it.groupId !== undefined) updateData.groupId = it.groupId;
          await tx.checklistItem.update({ where: { id: it.id }, data: updateData });
        } else {
          await tx.checklistItem.create({
            data: {
              checklistId: cid,
              content: it.content,
              sortOrder: it.sortOrder,
              groupId: it.groupId ?? null,
            },
          });
        }
      }
    }
  });

  const checklist = await prisma.checklist.findUnique({ where: { id: cid }, select: FULL_SELECT });
  return NextResponse.json({ checklist });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:delete");
  if (!auth.ok) return auth.response;

  const existing = await prisma.checklist.findFirst({
    where: { id: cid, projectId: auth.access.project!.id },
    select: { id: true, title: true },
  });
  if (!existing) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  await prisma.checklist.delete({ where: { id: cid } });

  await logProjectActivity({
    projectId: auth.access.project!.id,
    actorId: auth.session.user?.id ?? null,
    kind: "checklist.deleted",
    subjectType: "checklist",
    subjectId: cid,
    payload: { title: existing.title },
  });

  return NextResponse.json({ ok: true });
}
