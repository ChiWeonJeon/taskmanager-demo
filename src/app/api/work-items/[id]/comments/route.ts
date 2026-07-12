import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { resolveMentionRefs } from "@/lib/mention/server";
import { filterUserMentionIds, serializeMentionRefs } from "@/lib/mention/extract";
import {
  addWatcherIfMissing,
  notifyCrossReferences,
  notifyMention,
  notifyWorkItemCommented,
} from "@/lib/notifications/server";
import { getServerMessages } from "@/lib/i18n/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { id } = await params;

  const workItem = await prisma.workItem.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      issueKey: true,
      title: true,
      project: { select: { key: true } },
    },
  });
  if (!workItem) {
    return NextResponse.json({ error: messages.errors.workItemNotFound }, { status: 404 });
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
  const actorId = session.user?.id ?? null;

  const created = await prisma.$transaction(async (tx) => {
    const mentionRefs = await resolveMentionRefs(tx, trimmed, workItem.projectId);
    const mentionUserIds = filterUserMentionIds(mentionRefs);

    const comment = await tx.workItemComment.create({
      data: {
        workItemId: id,
        body: trimmed,
        mentions: serializeMentionRefs(mentionRefs),
        authorId: actorId,
      },
      include: { author: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } } },
    });

    await tx.workItemHistory.create({
      data: {
        workItemId: id,
        field: "comment",
        before: null,
        after: messages.errors.commentAdded,
        actorId,
      },
    });

    if (actorId) {
      await addWatcherIfMissing(tx, {
        workItemId: id,
        userId: actorId,
        source: "auto_commenter",
        addedById: actorId,
      });
    }

    let mentionRecipients: string[] = [];
    if (actorId && mentionUserIds.length > 0) {
      mentionRecipients = await notifyMention(tx, {
        scope: "work_item",
        actorId,
        recipientIds: mentionUserIds,
        workItemId: id,
        commentId: comment.id,
        projectId: workItem.projectId,
        payload: {
          context: "comment",
          issueKey: workItem.issueKey,
          workItemTitle: workItem.title,
        },
      });
    }

    if (actorId && mentionRefs.length > 0) {
      await notifyCrossReferences(tx, {
        actorId,
        refs: mentionRefs,
        source: {
          scope: "work_item",
          projectId: workItem.projectId,
          workItemId: id,
          commentId: comment.id,
          sourceContext: "comment",
          sourceIssueKey: workItem.issueKey,
          sourceWorkItemTitle: workItem.title,
          sourceProjectKey: workItem.project?.key,
        },
        skipRecipientIds: mentionRecipients,
      });
    }

    await notifyWorkItemCommented(tx, {
      workItemId: id,
      commentId: comment.id,
      actorId,
      skipRecipientIds: mentionRecipients,
      issueKey: workItem.issueKey,
      workItemTitle: workItem.title,
      projectId: workItem.projectId,
    });

    return comment;
  });

  return NextResponse.json(created, { status: 201 });
}
