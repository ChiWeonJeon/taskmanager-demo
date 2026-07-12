import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getProjectAccess, hasProjectAccess } from "@/lib/project-permissions";
import { addWatcherIfMissing } from "@/lib/notifications/server";
import { getServerMessages } from "@/lib/i18n/server";
import type { LocaleMessages } from "@/lib/i18n/messages";

type Ctx = { params: Promise<{ id: string }> };

async function loadWorkItemForAccess(workItemId: string) {
  return prisma.workItem.findUnique({
    where: { id: workItemId },
    select: { id: true, projectId: true, deletedAt: true, assigneeId: true, creatorId: true },
  });
}

async function ensureWorkItemAccess(
  workItemId: string,
  sessionUser: { id?: string | null; role?: string | null; email?: string | null },
  messages: LocaleMessages,
) {
  const wi = await loadWorkItemForAccess(workItemId);
  if (!wi || wi.deletedAt) return { ok: false as const, status: 404, error: messages.errors.workItemNotFound };
  if (!wi.projectId) {
    if (sessionUser.id && (wi.assigneeId === sessionUser.id || wi.creatorId === sessionUser.id)) {
      return { ok: true as const, workItem: wi, access: null };
    }
    return { ok: false as const, status: 403, error: messages.errors.accessForbidden };
  }
  const access = await getProjectAccess(wi.projectId, sessionUser);
  if (!access.project || !hasProjectAccess(access)) {
    return { ok: false as const, status: 403, error: messages.errors.accessForbidden };
  }
  return { ok: true as const, workItem: wi, access };
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 }); }

  const { id } = await params;
  const access = await ensureWorkItemAccess(id, session.user, messages);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const watchers = await prisma.workItemWatcher.findMany({
    where: { workItemId: id },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
      addedBy: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
    },
  });

  const meId = session.user?.id ?? null;
  return NextResponse.json({
    watchers: watchers.map((w) => ({
      id: w.id,
      user: w.user,
      source: w.source,
      addedBy: w.addedBy,
      createdAt: w.createdAt,
    })),
    isWatching: meId ? watchers.some((w) => w.userId === meId) : false,
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 }); }

  const { id } = await params;
  const access = await ensureWorkItemAccess(id, session.user, messages);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  let body: { userId?: string } = {};
  try { body = await request.json(); } catch { /* empty body = self */ }

  const meId = session.user?.id;
  if (!meId) return NextResponse.json({ error: messages.errors.missingSession }, { status: 401 });

  const targetUserId = body.userId ?? meId;
  const isSelf = targetUserId === meId;

  if (!isSelf) {
    if (!access.workItem.projectId) {
      return NextResponse.json({ error: messages.errors.personalWorkItemCannotAddOthers }, { status: 400 });
    }
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: access.workItem.projectId, userId: targetUserId } },
      select: { id: true },
    });
    const targetIsOwner = await prisma.project.findFirst({
      where: { id: access.workItem.projectId, ownerId: targetUserId },
      select: { id: true },
    });
    if (!member && !targetIsOwner) {
      return NextResponse.json({ error: messages.errors.onlyMembersCanWatch }, { status: 403 });
    }
  }

  await addWatcherIfMissing(prisma, {
    workItemId: id,
    userId: targetUserId,
    source: isSelf ? "manual" : "added_by_other",
    addedById: meId,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
