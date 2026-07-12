import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { cycleError, resolveGroupCycleAccess } from "@/lib/cycle/api";
import { addCycleWatcherIfMissing } from "@/lib/cycle/watchers";

type Ctx = { params: Promise<{ slugOrId: string; cycleId: string }> };

const USER_SELECT = { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } as const;

async function getGroupCycle(groupId: string, cycleId: string) {
  return prisma.cycle.findFirst({
    where: { id: cycleId, groupId, scope: "GROUP", deletedAt: null },
    select: { id: true },
  });
}

async function isGroupUser(groupId: string, userId: string) {
  const [member, owner] = await Promise.all([
    prisma.projectGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { userId: true },
    }),
    prisma.projectGroup.findFirst({ where: { id: groupId, ownerId: userId }, select: { id: true } }),
  ]);
  return Boolean(member || owner);
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { slugOrId, cycleId } = await params;
  const auth = await resolveGroupCycleAccess(slugOrId);
  if (!auth.ok) return auth.response;

  const cycle = await getGroupCycle(auth.access.group!.id, cycleId);
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
  const { slugOrId, cycleId } = await params;
  const auth = await resolveGroupCycleAccess(slugOrId);
  if (!auth.ok) return auth.response;

  const groupId = auth.access.group!.id;
  const cycle = await getGroupCycle(groupId, cycleId);
  if (!cycle) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  const actorId = auth.session.user?.id ?? "";
  let targetUserId = actorId;
  try {
    const body = (await request.json()) as { userId?: string };
    if (body?.userId) targetUserId = body.userId;
  } catch {
    // Empty body means watch self.
  }

  if (targetUserId !== actorId && !(await isGroupUser(groupId, targetUserId))) {
    return cycleError(messages.errors.groupAccessRequired, "FORBIDDEN", 403);
  }

  await addCycleWatcherIfMissing(prisma, {
    cycleId,
    userId: targetUserId,
    source: targetUserId === actorId ? "manual" : "added_by_other",
    addedById: actorId,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
