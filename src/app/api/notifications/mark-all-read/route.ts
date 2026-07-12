import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";

export async function POST() {
  const messages = await getServerMessages();
  let session;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 }); }
  const meId = session.user?.id;
  if (!meId) return NextResponse.json({ error: messages.errors.missingSession }, { status: 401 });

  const result = await prisma.notification.updateMany({
    where: { recipientId: meId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return NextResponse.json({ ok: true, updated: result.count });
}
