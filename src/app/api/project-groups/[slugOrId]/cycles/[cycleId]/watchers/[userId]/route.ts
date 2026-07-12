import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { cycleError, resolveGroupCycleAccess } from "@/lib/cycle/api";

type Ctx = { params: Promise<{ slugOrId: string; cycleId: string; userId: string }> };

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { slugOrId, cycleId, userId: rawUserId } = await params;
  const auth = await resolveGroupCycleAccess(slugOrId);
  if (!auth.ok) return auth.response;

  const actorId = auth.session.user?.id ?? "";
  const targetUserId = rawUserId === "me" ? actorId : rawUserId;
  const watcher = await prisma.cycleWatcher.findFirst({
    where: {
      cycleId,
      userId: targetUserId,
      cycle: { groupId: auth.access.group!.id, scope: "GROUP", deletedAt: null },
    },
    select: { id: true, addedById: true },
  });
  if (!watcher) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  if (targetUserId !== actorId && !auth.access.isAdmin && !auth.access.isOwner && watcher.addedById !== actorId) {
    return cycleError(messages.errors.forbidden, "FORBIDDEN", 403);
  }

  await prisma.cycleWatcher.delete({ where: { id: watcher.id } });
  return NextResponse.json({ ok: true });
}
