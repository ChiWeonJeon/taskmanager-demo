import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";
import { logApiError } from "@/lib/api-logger";
import { decodeActivityCursor, paginateActivityItems } from "@/lib/activity/aggregate";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const userId = session.user?.id;
  if (!userId) return NextResponse.json({ items: [], nextCursor: null });

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "me" ? "me" : "all";
  const kindParam = searchParams.get("kind");
  const cursor = decodeActivityCursor(searchParams.get("cursor"));
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;
  const kinds = kindParam
    ? kindParam.split(",").map((k) => k.trim()).filter(Boolean)
    : null;
  const cursorWhere = cursor
    ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
    : {};

  try {
    const [projectMemberships, ownedProjects, groupMemberships, ownedGroups] = await Promise.all([
      prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
      prisma.project.findMany({ where: { ownerId: userId }, select: { id: true } }),
      prisma.projectGroupMember.findMany({ where: { userId }, select: { groupId: true } }),
      prisma.projectGroup.findMany({ where: { ownerId: userId }, select: { id: true } }),
    ]);
    const projectIds = Array.from(new Set([...projectMemberships.map((m) => m.projectId), ...ownedProjects.map((p) => p.id)]));
    const groupIds = Array.from(new Set([...groupMemberships.map((m) => m.groupId), ...ownedGroups.map((g) => g.id)]));

    const [projectItems, groupItems] = await Promise.all([
      projectIds.length > 0
        ? prisma.projectActivity.findMany({
            where: {
              projectId: { in: projectIds },
              ...(kinds && kinds.length > 0 ? { kind: { in: kinds } } : {}),
              ...(scope === "me" ? { actorId: userId } : {}),
              ...cursorWhere,
            } satisfies Prisma.ProjectActivityWhereInput,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            include: {
              actor: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
              project: { select: { id: true, key: true, name: true } },
            },
          })
        : [],
      groupIds.length > 0
        ? prisma.projectGroupActivity.findMany({
            where: {
              projectGroupId: { in: groupIds },
              ...(kinds && kinds.length > 0 ? { kind: { in: kinds } } : {}),
              ...(scope === "me" ? { actorId: userId } : {}),
              ...cursorWhere,
            } satisfies Prisma.ProjectGroupActivityWhereInput,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            include: {
              actor: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
              group: { select: { id: true, slug: true, name: true } },
            },
          })
        : [],
    ]);

    const page = paginateActivityItems([
      ...projectItems.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        subjectType: entry.subjectType,
        subjectId: entry.subjectId,
        payload: entry.payload ? JSON.parse(entry.payload) : null,
        actor: entry.actor,
        createdAt: entry.createdAt,
        scope: { type: "project", id: entry.project.id, key: entry.project.key, name: entry.project.name },
      })),
      ...groupItems.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        subjectType: entry.subjectType,
        subjectId: entry.subjectId,
        payload: entry.payload ? JSON.parse(entry.payload) : null,
        actor: entry.actor,
        createdAt: entry.createdAt,
        scope: { type: "group", id: entry.group.id, slug: entry.group.slug, name: entry.group.name },
      })),
    ], limit);

    return NextResponse.json(page);
  } catch (error) {
    logApiError("GET", "/api/activity/accessible", error, { userId, scope });
    return NextResponse.json({ error: messages.errors.failedToLoad }, { status: 500 });
  }
}
