import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { canManageGroup, getGroupAccess } from "@/lib/group-permissions";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ slugOrId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { slugOrId } = await params;
  const access = await getGroupAccess(slugOrId, session.user);
  if (!access.group) {
    return NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 });
  }
  if (!canManageGroup(access)) {
    return NextResponse.json({ error: messages.errors.orderForbidden }, { status: 403 });
  }

  const body = await request.json();
  const { order } = body as { order?: unknown };
  if (!Array.isArray(order) || !order.every((v): v is string => typeof v === "string")) {
    return NextResponse.json({ error: messages.errors.orderMustBeProjectIdArray }, { status: 400 });
  }

  const uniqueOrder = Array.from(new Set(order));
  const belonging = await prisma.project.findMany({
    where: { id: { in: uniqueOrder }, groupId: access.group.id },
    select: { id: true },
  });
  const belongingIds = new Set(belonging.map((p) => p.id));
  const filtered = uniqueOrder.filter((id) => belongingIds.has(id));

  try {
    await prisma.$transaction(
      filtered.map((id, index) =>
        prisma.project.update({ where: { id }, data: { sortOrderInGroup: index } }),
      ),
    );
    return NextResponse.json({ ok: true, ordered: filtered });
  } catch (error) {
    logApiError("PATCH", `/api/project-groups/${slugOrId}/projects/order`, error, { userId: session.user?.id });
    return NextResponse.json(
      { error: messages.errors.failedToUpdate, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
