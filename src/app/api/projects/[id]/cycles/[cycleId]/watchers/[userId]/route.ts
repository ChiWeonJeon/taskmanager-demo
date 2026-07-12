import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { resolveCycleAccess, cycleError } from "@/lib/cycle/api";

type Ctx = { params: Promise<{ id: string; cycleId: string; userId: string }> };

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cycleId, userId: rawUserId } = await params;
  const auth = await resolveCycleAccess(id, "cycle:read");
  if (!auth.ok) return auth.response;

  const actorId = auth.session.user?.id ?? "";
  const targetUserId = rawUserId === "me" ? actorId : rawUserId;
  const watcher = await prisma.cycleWatcher.findFirst({
    where: {
      cycleId,
      userId: targetUserId,
      cycle: {
        deletedAt: null,
        OR: [
          { projectId: auth.access.project!.id },
          { scope: "GROUP", groupId: auth.access.project!.groupId ?? "__none__" },
        ],
      },
    },
    select: { id: true, addedById: true },
  });
  if (!watcher) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  if (targetUserId !== actorId && !auth.access.isAdmin && watcher.addedById !== actorId) {
    return cycleError(messages.errors.forbidden, "FORBIDDEN", 403);
  }

  await prisma.cycleWatcher.delete({ where: { id: watcher.id } });
  return NextResponse.json({ ok: true });
}
