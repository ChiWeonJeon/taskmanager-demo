import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 }); }
  const meId = session.user?.id;
  if (!meId) return NextResponse.json({ error: messages.errors.missingSession }, { status: 401 });

  const { id } = await params;

  let body: { isRead?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: messages.errors.invalidRequestBody }, { status: 400 }); }

  if (typeof body.isRead !== "boolean") {
    return NextResponse.json({ error: messages.errors.isReadFieldRequired }, { status: 400 });
  }

  const existing = await prisma.notification.findUnique({
    where: { id },
    select: { recipientId: true, isRead: true },
  });
  if (!existing || existing.recipientId !== meId) {
    return NextResponse.json({ error: messages.errors.notificationNotFound }, { status: 404 });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: {
      isRead: body.isRead,
      readAt: body.isRead ? new Date() : null,
    },
    select: { id: true, isRead: true, readAt: true },
  });
  return NextResponse.json(updated);
}
