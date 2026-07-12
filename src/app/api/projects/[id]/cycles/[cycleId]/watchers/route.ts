import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { resolveCycleAccess, cycleError } from "@/lib/cycle/api";
import { findCycleForProject } from "@/lib/cycle/service";
import { addCycleWatcherIfMissing } from "@/lib/cycle/watchers";

type Ctx = { params: Promise<{ id: string; cycleId: string }> };

const USER_SELECT = { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } as const;

export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cycleId } = await params;
  const auth = await resolveCycleAccess(id, "cycle:read");
  if (!auth.ok) return auth.response;

  const cycle = await findCycleForProject(prisma, auth.access.project!.id, cycleId);
  if (!cycle) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  const userId = auth.session.user?.id ?? "";
  const rows = await prisma.cycleWatcher.findMany({
    where: { cycleId },
    include: { user: { select: USER_SELECT }, addedBy: { select: USER_SELECT } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    watchers: rows.map((watcher) => ({
      id: watcher.id,
      user: watcher.user,
      source: watcher.source,
      addedBy: watcher.addedBy,
      createdAt: watcher.createdAt.toISOString(),
    })),
    isWatching: rows.some((watcher) => watcher.userId === userId),
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cycleId } = await params;
  const auth = await resolveCycleAccess(id, "cycle:read");
  if (!auth.ok) return auth.response;

  const projectId = auth.access.project!.id;
  const cycle = await findCycleForProject(prisma, projectId, cycleId);
  if (!cycle) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  const actorId = auth.session.user?.id ?? "";
  let targetUserId = actorId;
  try {
    const body = (await request.json()) as { userId?: string };
    if (body?.userId) targetUserId = body.userId;
  } catch {
    // Empty body means watch self.
  }

  if (targetUserId !== actorId) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      select: { userId: true },
    });
    const owner = member
      ? null
      : await prisma.project.findFirst({ where: { id: projectId, ownerId: targetUserId }, select: { id: true } });
    if (!member && !owner) return cycleError(messages.errors.notProjectMember, "FORBIDDEN", 403);
  }

  await addCycleWatcherIfMissing(prisma, {
    cycleId,
    userId: targetUserId,
    source: targetUserId === actorId ? "manual" : "added_by_other",
    addedById: actorId,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
