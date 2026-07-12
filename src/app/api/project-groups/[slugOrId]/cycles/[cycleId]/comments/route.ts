import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { filterUserMentionIds, serializeMentionRefs } from "@/lib/mention/extract";
import { resolveGroupMentionRefs } from "@/lib/mention/server";
import { notifyCycleCommented, notifyMention } from "@/lib/notifications/server";
import { cycleError, resolveGroupCycleAccess } from "@/lib/cycle/api";
import { addCycleWatcherIfMissing, getCycleWatcherIds } from "@/lib/cycle/watchers";

type Ctx = { params: Promise<{ slugOrId: string; cycleId: string }> };

const AUTHOR_SELECT = { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } as const;

async function getGroupCycle(groupId: string, cycleId: string) {
  return prisma.cycle.findFirst({
    where: { id: cycleId, groupId, scope: "GROUP", deletedAt: null },
    select: { id: true, name: true, group: { select: { slug: true } } },
  });
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { slugOrId, cycleId } = await params;
  const auth = await resolveGroupCycleAccess(slugOrId);
  if (!auth.ok) return auth.response;

  const cycle = await getGroupCycle(auth.access.group!.id, cycleId);
  if (!cycle) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  const comments = await prisma.cycleComment.findMany({
    where: { cycleId },
    include: { author: { select: AUTHOR_SELECT } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    comments: comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      mentions: comment.mentions,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
    })),
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return cycleError(messages.errors.invalidRequestBody, "BAD_REQUEST", 400);
  }
  const text = typeof (body as { body?: string }).body === "string" ? (body as { body: string }).body.trim() : "";
  if (!text) return cycleError(messages.errors.commentContentRequired, "BAD_REQUEST", 400);

  const actorId = auth.session.user?.id ?? null;
  const created = await prisma.$transaction(async (tx) => {
    const mentionRefs = await resolveGroupMentionRefs(tx, text, groupId);
    const mentionUserIds = filterUserMentionIds(mentionRefs);
    const comment = await tx.cycleComment.create({
      data: { cycleId, body: text, mentions: serializeMentionRefs(mentionRefs), authorId: actorId },
      include: { author: { select: AUTHOR_SELECT } },
    });
    await tx.cycleHistory.create({
      data: { cycleId, field: "comment", before: null, after: messages.errors.commentAdded, actorId },
    });
    if (actorId) {
      await addCycleWatcherIfMissing(tx, { cycleId, userId: actorId, source: "auto_commenter", addedById: actorId });
    }

    let mentionRecipients: string[] = [];
    if (actorId && mentionUserIds.length > 0) {
      mentionRecipients = await notifyMention(tx, {
        scope: "cycle",
        actorId,
        recipientIds: mentionUserIds,
        cycleId,
        commentId: comment.id,
        projectId: null,
        payload: { context: "cycle_comment", cycleName: cycle.name },
      });
    }

    const watcherIds = await getCycleWatcherIds(tx, cycleId);
    await notifyCycleCommented(tx, {
      cycleId,
      commentId: comment.id,
      actorId,
      recipientIds: watcherIds,
      skipRecipientIds: mentionRecipients,
      projectId: null,
      payload: { cycleName: cycle.name, groupSlug: cycle.group?.slug, context: "comment" },
    });

    return comment;
  });

  return NextResponse.json(
    {
      id: created.id,
      body: created.body,
      mentions: created.mentions,
      createdAt: created.createdAt.toISOString(),
      author: created.author,
    },
    { status: 201 },
  );
}
