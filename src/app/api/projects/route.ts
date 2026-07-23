import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { isAdminUser } from "@/lib/admin-access";
import { ensurePersonalProjectForUser } from "@/lib/personal-project";
import { logApiError } from "@/lib/api-logger";
import { ensureProjectOwnerMembership } from "@/lib/project-permissions";
import { ensureProjectHasAllIssueTypes, listAllIssueTypeIds } from "@/lib/issue-type-config";
import { getServerMessages } from "@/lib/i18n/server";
import { enqueueServerAnalyticsEvent } from "@/lib/server-analytics";
import { scheduleServerAnalyticsDispatch } from "@/lib/server-analytics-dispatcher";

export async function GET(request: NextRequest) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberIdParam = searchParams.get("memberId");
  const currentUserId = session.user?.id;
  const isAdmin = isAdminUser(session.user);

  try {
    if (currentUserId) {
      try {
        await ensurePersonalProjectForUser({ id: currentUserId, name: session.user.name });
      } catch (error) {
        // 개인 프로젝트 생성 실패가 전체 프로젝트 목록 조회 실패로 이어지지 않도록 방어
        logApiError("GET", "/api/projects", error, {
          memberId: memberIdParam,
          userId: currentUserId,
          phase: "ensurePersonalProjectForUser",
        });
      }
    }

    const resolvedId = memberIdParam
      ? memberIdParam === "me"
        ? currentUserId
        : memberIdParam
      : currentUserId;

    if (!resolvedId) {
      return NextResponse.json([]);
    }

    if (!isAdmin && resolvedId !== currentUserId) {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }

    const memberships = await prisma.projectMember.findMany({
      where: { userId: resolvedId },
      include: { project: true },
      orderBy: { createdAt: "asc" },
    });
    const ownedProjects = await prisma.project.findMany({
      where: { ownerId: resolvedId },
      orderBy: { createdAt: "asc" },
    });

    const merged = [...ownedProjects, ...memberships.map((m) => m.project)];
    const projects = Array.from(new Map(merged.map((project) => [project.id, project])).values());

    return NextResponse.json(projects);
  } catch (error) {
    logApiError("GET", "/api/projects", error, { memberId: memberIdParam, userId: session?.user?.id });
    return NextResponse.json(
      { error: messages.errors.failedToLoad, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const body = await request.json();
  const { name, key, description } = body as { name?: string; key?: string; description?: string };

  if (!name?.trim() || !key?.trim()) {
    return NextResponse.json({ error: messages.errors.nameKeyRequired }, { status: 400 });
  }

  const existingProject = await prisma.project.findUnique({ where: { key: key.trim().toUpperCase() } });
  if (existingProject) {
    return NextResponse.json(
      { error: messages.errors.projectKeyInUse.replace("{key}", key.trim().toUpperCase()) },
      { status: 409 },
    );
  }

  const creatorId = session.user?.id;
  if (!creatorId) {
    return NextResponse.json({ error: messages.errors.cannotIdentifyCreator }, { status: 400 });
  }

  const { project, serverEventQueued } = await prisma.$transaction(async (tx) => {
    const issueTypeIds = await listAllIssueTypeIds(tx);
    const defaultIssueTypeId = issueTypeIds[0] ?? null;

    const created = await tx.project.create({
      data: {
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description?.trim() || null,
        ownerId: creatorId,
        defaultIssueTypeId,
      },
    });

    await ensureProjectOwnerMembership(tx, created.id, creatorId);
    await ensureProjectHasAllIssueTypes(tx, created.id);
    const queued = await enqueueServerAnalyticsEvent(tx, "Project Created", creatorId, {
      project_type: created.isPersonal ? "personal" : "shared",
    });
    return { project: created, serverEventQueued: queued };
  });

  if (serverEventQueued) scheduleServerAnalyticsDispatch();

  return NextResponse.json(project, { status: 201 });
}
