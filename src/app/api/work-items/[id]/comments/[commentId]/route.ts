import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { resolveMentionRefs } from "@/lib/mention/server";
import {
  filterUserMentionIds,
  parseMentionRefs,
  serializeMentionRefs,
} from "@/lib/mention/extract";
import { notifyCrossReferences, notifyMention } from "@/lib/notifications/server";
import { getServerMessages } from "@/lib/i18n/server";

type RouteParams = { params: Promise<{ id: string; commentId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { id, commentId } = await params;

  const comment = await prisma.workItemComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      workItemId: true,
      authorId: true,
      mentions: true,
      workItem: {
        select: {
          projectId: true,
          issueKey: true,
          title: true,
          project: { select: { key: true } },
        },
      },
    },
  });

  if (!comment || comment.workItemId !== id) {
    return NextResponse.json({ error: messages.errors.commentNotFound }, { status: 404 });
  }

  const userId = session.user?.id;
  const isAdmin = (session.user as { role?: string })?.role === "ADMIN";
  if (comment.authorId !== userId && !isAdmin) {
    return NextResponse.json({ error: messages.errors.editForbidden }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: messages.errors.invalidRequestBody }, { status: 400 });
  }

  const { body: commentBody } = body as { body?: string };
  if (!commentBody?.trim()) {
    return NextResponse.json({ error: messages.errors.commentContentRequired }, { status: 400 });
  }

  const trimmed = commentBody.trim();

  const updated = await prisma.$transaction(async (tx) => {
    const nextRefs = await resolveMentionRefs(tx, trimmed, comment.workItem.projectId);
    const nextUserIds = filterUserMentionIds(nextRefs);
    const previousUserIds = new Set(
      filterUserMentionIds(parseMentionRefs(comment.mentions))
    );
    const newlyMentioned = nextUserIds.filter((uid) => !previousUserIds.has(uid));

    const result = await tx.workItemComment.update({
      where: { id: commentId },
      data: { body: trimmed, mentions: serializeMentionRefs(nextRefs) },
      include: { author: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } } },
    });

    let userMentionRecipients: string[] = [];
    if (userId && newlyMentioned.length > 0) {
      userMentionRecipients = await notifyMention(tx, {
        scope: "work_item",
        actorId: userId,
        recipientIds: newlyMentioned,
        workItemId: id,
        commentId,
        projectId: comment.workItem.projectId,
        payload: {
          context: "comment",
          issueKey: comment.workItem.issueKey,
          workItemTitle: comment.workItem.title,
        },
      });
    }

    // Fire cross-reference notifications for any newly added issue
    // mentions (compare vs pre-edit set). Avoid re-notifying on simple edits.
    const prevRefs = parseMentionRefs(comment.mentions);
    const prevKeys = new Set(prevRefs.map((r) => `${r.type}:${r.id}`));
    const newRefs = nextRefs.filter(
      (r) => r.type === "issue" && !prevKeys.has(`${r.type}:${r.id}`)
    );
    if (userId && newRefs.length > 0) {
      await notifyCrossReferences(tx, {
        actorId: userId,
        refs: newRefs,
        source: {
          scope: "work_item",
          projectId: comment.workItem.projectId,
          workItemId: id,
          commentId,
          sourceContext: "comment",
          sourceIssueKey: comment.workItem.issueKey,
          sourceWorkItemTitle: comment.workItem.title,
          sourceProjectKey: comment.workItem.project?.key,
        },
        skipRecipientIds: userMentionRecipients,
      });
    }

    return result;
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { id, commentId } = await params;

  const comment = await prisma.workItemComment.findUnique({
    where: { id: commentId },
    select: { id: true, workItemId: true, authorId: true },
  });

  if (!comment || comment.workItemId !== id) {
    return NextResponse.json({ error: messages.errors.commentNotFound }, { status: 404 });
  }

  const userId = session.user?.id;
  const isAdmin = (session.user as { role?: string })?.role === "ADMIN";
  if (comment.authorId !== userId && !isAdmin) {
    return NextResponse.json({ error: messages.errors.deleteForbidden }, { status: 403 });
  }

  await prisma.workItemComment.delete({ where: { id: commentId } });

  return new NextResponse(null, { status: 204 });
}
