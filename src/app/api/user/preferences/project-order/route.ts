import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { getServerMessages } from "@/lib/i18n/server";

export async function GET() {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }
  const userId = session.user?.id;
  if (!userId) return NextResponse.json([]);

  const rows = await prisma.userProjectPreference.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    select: { projectId: true, sortOrder: true },
  });
  return NextResponse.json(rows);
}

export async function PUT(request: NextRequest) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: messages.errors.cannotIdentifyUser }, { status: 400 });
  }

  const body = await request.json();
  const { order } = body as { order?: unknown };
  if (!Array.isArray(order) || !order.every((v): v is string => typeof v === "string")) {
    return NextResponse.json({ error: messages.errors.orderMustBeProjectIdArray }, { status: 400 });
  }
  const uniqueOrder = Array.from(new Set(order));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.userProjectPreference.deleteMany({ where: { userId } });
      if (uniqueOrder.length > 0) {
        const existing = await tx.project.findMany({
          where: { id: { in: uniqueOrder } },
          select: { id: true },
        });
        const valid = new Set(existing.map((p) => p.id));
        const filtered = uniqueOrder.filter((id) => valid.has(id));
        if (filtered.length > 0) {
          await tx.userProjectPreference.createMany({
            data: filtered.map((projectId, index) => ({ userId, projectId, sortOrder: index })),
          });
        }
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("PUT", "/api/user/preferences/project-order", error, { userId });
    return NextResponse.json(
      { error: messages.errors.failedToUpdate, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
