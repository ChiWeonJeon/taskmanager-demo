import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string; rid: string }> };

const RUN_DETAIL_SELECT = {
  id: true,
  checklistId: true,
  status: true,
  startedAt: true,
  completedAt: true,
  startedBy: { select: { id: true, name: true, email: true } },
  completedBy: { select: { id: true, name: true, email: true } },
  checklist: { select: { id: true, title: true, description: true, projectId: true } },
  items: {
    // Sort by sortOrder asc; client buckets by groupName/groupSortOrder.
    // (SQLite + Prisma don't expose nulls-last ordering portably, so the
    // bucketing happens client-side instead of in SQL.)
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      content: true,
      sortOrder: true,
      groupName: true,
      groupSortOrder: true,
      checked: true,
      checkedAt: true,
      checkedBy: { select: { id: true, name: true, email: true } },
    },
  },
  events: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      action: true,
      itemId: true,
      payload: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid, rid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:read");
  if (!auth.ok) return auth.response;

  const run = await prisma.checklistRun.findFirst({
    where: {
      id: rid,
      checklistId: cid,
      checklist: { projectId: auth.access.project!.id },
    },
    select: RUN_DETAIL_SELECT,
  });
  if (!run) {
    return checklistError(messages.errors.checklistRunNotFound, "CHECKLIST_RUN_NOT_FOUND", 404);
  }
  return NextResponse.json({ run });
}
