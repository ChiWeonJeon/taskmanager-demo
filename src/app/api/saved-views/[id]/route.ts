import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { logApiError } from "@/lib/api-logger";
import { serializeTaskSavedViewConfig } from "@/lib/task-saved-view";
import {
  canManageSavedView,
  canReadTaskSavedViewWorkspace,
  normalizeSavedViewName,
  normalizeSavedViewPayloadConfig,
  toTaskSavedViewDto,
} from "@/lib/task-saved-view-server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id } = await params;
  try {
    const session = await requireAuth();
    const existing = await prisma.savedView.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: messages.errors.notFound }, { status: 404 });
    }
    if (
      !await canReadTaskSavedViewWorkspace(existing.workspaceKey, session.user) ||
      !canManageSavedView(existing, session.user)
    ) {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const nextName = body.name === undefined ? existing.name : normalizeSavedViewName(body.name);
    if (!nextName) {
      return NextResponse.json({ error: messages.errors.badRequest }, { status: 400 });
    }
    const nextIsShared = body.isShared === undefined ? existing.isShared : body.isShared === true;
    const config = body.config === undefined
      ? existing.config
      : serializeTaskSavedViewConfig(normalizeSavedViewPayloadConfig(body.config));

    const updated = await prisma.savedView.update({
      where: { id },
      data: {
        name: nextName,
        isShared: nextIsShared,
        isDefault: nextIsShared ? existing.isDefault : false,
        config,
      },
    });

    return NextResponse.json(toTaskSavedViewDto(updated, session.user));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
    logApiError("PATCH", "/api/saved-views/[id]", error, { id });
    return NextResponse.json({ error: messages.errors.internal }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id } = await params;
  try {
    const session = await requireAuth();
    const existing = await prisma.savedView.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: messages.errors.notFound }, { status: 404 });
    }
    if (
      !await canReadTaskSavedViewWorkspace(existing.workspaceKey, session.user) ||
      !canManageSavedView(existing, session.user)
    ) {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }

    await prisma.savedView.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isDefault: false,
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
    logApiError("DELETE", "/api/saved-views/[id]", error, { id });
    return NextResponse.json({ error: messages.errors.internal }, { status: 500 });
  }
}
