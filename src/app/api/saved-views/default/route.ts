import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin-access";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { logApiError } from "@/lib/api-logger";
import {
  canReadTaskSavedViewWorkspace,
  toTaskSavedViewDto,
} from "@/lib/task-saved-view-server";

export async function PUT(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    const session = await requireAuth();
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const id = typeof body.viewId === "string" ? body.viewId.trim() : "";
    if (!id) {
      return NextResponse.json({ error: messages.errors.badRequest }, { status: 400 });
    }

    const existing = await prisma.savedView.findFirst({
      where: { id, deletedAt: null, isShared: true },
    });
    if (!existing) {
      return NextResponse.json({ error: messages.errors.notFound }, { status: 404 });
    }
    if (!await canReadTaskSavedViewWorkspace(existing.workspaceKey, session.user)) {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.savedView.updateMany({
        where: { workspaceKey: existing.workspaceKey, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
      return tx.savedView.update({
        where: { id: existing.id },
        data: { isDefault: true },
      });
    });

    return NextResponse.json(toTaskSavedViewDto(updated, session.user));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
    logApiError("PUT", "/api/saved-views/default", error);
    return NextResponse.json({ error: messages.errors.internal }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    const session = await requireAuth();
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }

    const workspaceKey = request.nextUrl.searchParams.get("workspaceKey") ?? "";
    if (!await canReadTaskSavedViewWorkspace(workspaceKey, session.user)) {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }

    await prisma.savedView.updateMany({
      where: { workspaceKey, deletedAt: null, isDefault: true },
      data: { isDefault: false },
    });

    return NextResponse.json({ defaultViewId: null });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
    logApiError("DELETE", "/api/saved-views/default", error, {
      workspaceKey: request.nextUrl.searchParams.get("workspaceKey"),
    });
    return NextResponse.json({ error: messages.errors.internal }, { status: 500 });
  }
}
