import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { logApiError } from "@/lib/api-logger";
import { serializeTaskSavedViewConfig } from "@/lib/task-saved-view";
import {
  canReadTaskSavedViewWorkspace,
  normalizeSavedViewName,
  normalizeSavedViewPayloadConfig,
  toTaskSavedViewDto,
} from "@/lib/task-saved-view-server";
import { TASK_WORKSPACE_PREFERENCE_VIEW_NAME } from "@/lib/task-workspace-preference";

export async function GET(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
    const workspaceKey = request.nextUrl.searchParams.get("workspaceKey") ?? "";
    if (!await canReadTaskSavedViewWorkspace(workspaceKey, session.user)) {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }

    const rows = await prisma.savedView.findMany({
      where: {
        workspaceKey,
        name: { not: TASK_WORKSPACE_PREFERENCE_VIEW_NAME },
        deletedAt: null,
        OR: [
          { createdById: userId },
          { isShared: true },
        ],
      },
      orderBy: [
        { isDefault: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return NextResponse.json({
      defaultViewId: rows.find((row) => row.isShared && row.isDefault)?.id ?? null,
      views: rows.map((row) => toTaskSavedViewDto(row, session.user)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
    logApiError("GET", "/api/saved-views", error, {
      workspaceKey: request.nextUrl.searchParams.get("workspaceKey"),
    });
    return NextResponse.json({ error: messages.errors.internal }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const workspaceKey = typeof body.workspaceKey === "string" ? body.workspaceKey.trim() : "";
    const name = normalizeSavedViewName(body.name);
    if (!workspaceKey || !name || name === TASK_WORKSPACE_PREFERENCE_VIEW_NAME || !await canReadTaskSavedViewWorkspace(workspaceKey, session.user)) {
      return NextResponse.json({ error: messages.errors.badRequest }, { status: 400 });
    }

    const row = await prisma.savedView.create({
      data: {
        workspaceKey,
        name,
        isShared: body.isShared === true,
        isDefault: false,
        config: serializeTaskSavedViewConfig(normalizeSavedViewPayloadConfig(body.config)),
        createdById: userId,
      },
    });

    return NextResponse.json(toTaskSavedViewDto(row, session.user), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
    logApiError("POST", "/api/saved-views", error);
    return NextResponse.json({ error: messages.errors.internal }, { status: 500 });
  }
}
