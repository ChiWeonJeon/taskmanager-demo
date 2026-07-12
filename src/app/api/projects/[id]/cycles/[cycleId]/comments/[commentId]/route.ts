import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { resolveCycleAccess, cycleError } from "@/lib/cycle/api";
import { findCycleForProject } from "@/lib/cycle/service";

type Ctx = { params: Promise<{ id: string; cycleId: string; commentId: string }> };

const AUTHOR_SELECT = { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } as const;

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cycleId, commentId } = await params;
  const auth = await resolveCycleAccess(id, "cycle:edit");
  if (!auth.ok) return auth.response;

  const cycle = await findCycleForProject(prisma, auth.access.project!.id, cycleId);
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

  const updated = await prisma.cycleComment.update({
    where: { id: commentId },
    data: { body: text },
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
  const { id, cycleId, commentId } = await params;
  const auth = await resolveCycleAccess(id, "cycle:edit");
  if (!auth.ok) return auth.response;

  const cycle = await findCycleForProject(prisma, auth.access.project!.id, cycleId);
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
