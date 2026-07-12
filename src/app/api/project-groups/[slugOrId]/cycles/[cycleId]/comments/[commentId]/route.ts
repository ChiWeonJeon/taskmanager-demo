import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { serializeMentionRefs } from "@/lib/mention/extract";
import { resolveGroupMentionRefs } from "@/lib/mention/server";
import { cycleError, resolveGroupCycleAccess } from "@/lib/cycle/api";

type Ctx = { params: Promise<{ slugOrId: string; cycleId: string; commentId: string }> };

const AUTHOR_SELECT = { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } as const;

async function getGroupCycle(groupId: string, cycleId: string) {
  return prisma.cycle.findFirst({
    where: { id: cycleId, groupId, scope: "GROUP", deletedAt: null },
    select: { id: true },
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { slugOrId, cycleId, commentId } = await params;
  const auth = await resolveGroupCycleAccess(slugOrId);
  if (!auth.ok) return auth.response;

  const groupId = auth.access.group!.id;
  const cycle = await getGroupCycle(groupId, cycleId);
  if (!cycle) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  const comment = await prisma.cycleComment.findFirst({
    where: { id: commentId, cycleId },
    select: { id: true, authorId: true },
  });
  if (!comment) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);
  if (comment.authorId !== auth.session.user?.id && !auth.access.isAdmin && !auth.access.isOwner) {
    return cycleError(messages.errors.forbidden, "FORBIDDEN", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return cycleError(messages.errors.invalidRequestBody, "BAD_REQUEST", 400);
  }
  const text = typeof (body as { body?: string }).body === "string" ? (body as { body: string }).body.trim() : "";
  if (!text) return cycleError(messages.errors.commentContentRequired, "BAD_REQUEST", 400);

  const mentionRefs = await resolveGroupMentionRefs(prisma, text, groupId);
  const updated = await prisma.cycleComment.update({
    where: { id: commentId },
    data: { body: text, mentions: serializeMentionRefs(mentionRefs) },
    include: { author: { select: AUTHOR_SELECT } },
  });
  return NextResponse.json({
    id: updated.id,
    body: updated.body,
    mentions: updated.mentions,
    createdAt: updated.createdAt.toISOString(),
    author: updated.author,
  });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { slugOrId, cycleId, commentId } = await params;
  const auth = await resolveGroupCycleAccess(slugOrId);
  if (!auth.ok) return auth.response;

  const cycle = await getGroupCycle(auth.access.group!.id, cycleId);
  if (!cycle) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  const comment = await prisma.cycleComment.findFirst({
    where: { id: commentId, cycleId },
    select: { id: true, authorId: true },
  });
  if (!comment) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);
  if (comment.authorId !== auth.session.user?.id && !auth.access.isAdmin && !auth.access.isOwner) {
    return cycleError(messages.errors.forbidden, "FORBIDDEN", 403);
  }

  await prisma.cycleComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
