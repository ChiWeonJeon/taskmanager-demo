import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getProjectAccess, hasProjectAccess } from "@/lib/project-permissions";
import { getServerMessages } from "@/lib/i18n/server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user);
  if (!hasProjectAccess(access) || !access.project) {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const kindParam = searchParams.get("kind");
  const actorIdParam = searchParams.get("actorId");
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const kinds = kindParam
    ? kindParam.split(",").map((k) => k.trim()).filter(Boolean)
    : null;

  const where = {
    projectId: access.project.id,
    ...(kinds && kinds.length > 0 ? { kind: { in: kinds } } : {}),
    ...(actorIdParam ? { actorId: actorIdParam } : {}),
  };

  const items = await prisma.projectActivity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      actor: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
    },
  });

  const hasMore = items.length > limit;
  const trimmed = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]!.id : null;

  return NextResponse.json({
    items: trimmed.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      payload: entry.payload ? JSON.parse(entry.payload) : null,
      actor: entry.actor,
      createdAt: entry.createdAt,
    })),
    nextCursor,
  });
}
