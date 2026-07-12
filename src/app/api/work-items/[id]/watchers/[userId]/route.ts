import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getProjectAccess, hasProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 }); }

  const { id, userId: rawUserId } = await params;
  const meId = session.user?.id;
  if (!meId) return NextResponse.json({ error: messages.errors.missingSession }, { status: 401 });
  const userId = rawUserId === "me" ? meId : rawUserId;
  const isSelf = userId === meId;

  const watcher = await prisma.workItemWatcher.findUnique({
    where: { workItemId_userId: { workItemId: id, userId } },
    select: { id: true, addedById: true, workItem: { select: { projectId: true, deletedAt: true } } },
  });
  if (!watcher) {
    return NextResponse.json({ ok: true });
  }
  if (watcher.workItem.deletedAt) {
    return NextResponse.json({ error: messages.errors.workItemNotFound }, { status: 404 });
  }

  if (!isSelf) {
    if (!watcher.workItem.projectId) {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }
    const access = await getProjectAccess(watcher.workItem.projectId, session.user);
    if (!access.project || !hasProjectAccess(access)) {
      return NextResponse.json({ error: messages.errors.projectAccessRequired }, { status: 403 });
    }
    const canManage = hasProjectPermission(access, "project:manage");
    const isAdder = watcher.addedById === meId;
    if (!canManage && !isAdder) {
      return NextResponse.json({ error: messages.errors.cannotUnwatchOthers }, { status: 403 });
    }
  }

  await prisma.workItemWatcher.delete({ where: { workItemId_userId: { workItemId: id, userId } } });
  return NextResponse.json({ ok: true });
}
