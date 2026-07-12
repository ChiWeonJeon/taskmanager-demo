import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { notificationListSelect } from "@/lib/notifications/select";
import { getServerMessages } from "@/lib/i18n/server";

export async function GET(request: NextRequest) {
  const messages = await getServerMessages();
  let session;
  try { session = await requireAuth(); } catch { return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 }); }
  const meId = session.user?.id;
  if (!meId) return NextResponse.json({ error: messages.errors.missingSession }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const unreadOnly = sp.get("unreadOnly") === "1" || sp.get("unreadOnly") === "true";
  const limitRaw = Number(sp.get("limit") ?? "20");
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 100);
  const cursor = sp.get("cursor");

  const where = {
    recipientId: meId,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const items = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: notificationListSelect,
  });

  const nextCursor = items.length > limit ? items[limit].id : null;
  return NextResponse.json({ notifications: items.slice(0, limit), nextCursor });
}
