import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import {
  parseTaskWorkspaceKey,
} from "@/lib/task-saved-view";
import {
  parseTaskWorkspacePreference,
  serializeTaskWorkspacePreference,
  TASK_WORKSPACE_PREFERENCE_VIEW_NAME,
  type TaskWorkspacePreferenceDto,
} from "@/lib/task-workspace-preference";

function toPreference(config: string | null | undefined, exists: boolean): TaskWorkspacePreferenceDto {
  return parseTaskWorkspacePreference(config, exists);
}

export async function GET(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const workspaceKey = request.nextUrl.searchParams.get("workspaceKey")?.trim() ?? "";
    if (!userId || !parseTaskWorkspaceKey(workspaceKey)) {
      return NextResponse.json({ error: messages.errors.badRequest }, { status: 400 });
    }

    const row = await prisma.savedView.findFirst({
      where: {
        workspaceKey,
        name: TASK_WORKSPACE_PREFERENCE_VIEW_NAME,
        createdById: userId,
        isShared: false,
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
      select: { config: true },
    });
    return NextResponse.json(toPreference(row?.config, Boolean(row)));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
    logApiError("GET", "/api/user/preferences/task-workspace", error);
    return NextResponse.json({ error: messages.errors.internal }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const body = await request.json().catch(() => ({}));
    const workspaceKey = typeof body.workspaceKey === "string" ? body.workspaceKey.trim() : "";
    if (!userId || !parseTaskWorkspaceKey(workspaceKey)) {
      return NextResponse.json({ error: messages.errors.badRequest }, { status: 400 });
    }

    const serializedConfig = serializeTaskWorkspacePreference(body);
    const existing = await prisma.savedView.findFirst({
      where: {
        workspaceKey,
        name: TASK_WORKSPACE_PREFERENCE_VIEW_NAME,
        createdById: userId,
        isShared: false,
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (existing) {
      await prisma.savedView.update({
        where: { id: existing.id },
        data: { config: serializedConfig },
      });
    } else {
      await prisma.savedView.create({
        data: {
          workspaceKey,
          name: TASK_WORKSPACE_PREFERENCE_VIEW_NAME,
          config: serializedConfig,
          createdById: userId,
          isShared: false,
          isDefault: false,
        },
      });
    }

    return NextResponse.json(toPreference(serializedConfig, true));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
    logApiError("PUT", "/api/user/preferences/task-workspace", error);
    return NextResponse.json({ error: messages.errors.internal }, { status: 500 });
  }
}
