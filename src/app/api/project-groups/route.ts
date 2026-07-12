import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { isAdminUser } from "@/lib/admin-access";
import { logApiError } from "@/lib/api-logger";
import { ensureGroupOwnerMembership, slugifyGroupName } from "@/lib/group-permissions";
import { getServerMessages } from "@/lib/i18n/server";

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

  if (!currentUserId) return NextResponse.json([]);

  const resolvedId = memberIdParam
    ? memberIdParam === "me"
      ? currentUserId
      : memberIdParam
    : currentUserId;

  if (!isAdmin && resolvedId !== currentUserId) {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  try {
    const [owned, memberships] = await Promise.all([
      prisma.projectGroup.findMany({
        where: { ownerId: resolvedId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.projectGroupMember.findMany({
        where: { userId: resolvedId },
        include: { group: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const merged = [...owned, ...memberships.map((m) => m.group)];
    const groups = Array.from(new Map(merged.map((g) => [g.id, g])).values());
    return NextResponse.json(groups);
  } catch (error) {
    logApiError("GET", "/api/project-groups", error, { memberId: memberIdParam, userId: currentUserId });
    return NextResponse.json(
      { error: messages.errors.failedToLoad, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
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

  const creatorId = session.user?.id;
  if (!creatorId) {
    return NextResponse.json({ error: messages.errors.cannotIdentifyUser }, { status: 400 });
  }

  const body = await request.json();
  const { name, slug, description } = body as { name?: string; slug?: string; description?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: messages.errors.nameRequired }, { status: 400 });
  }

  let finalSlug = (slug?.trim() || slugifyGroupName(name)).toLowerCase();
  const conflict = await prisma.projectGroup.findUnique({ where: { slug: finalSlug } });
  if (conflict) {
    finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  try {
    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.projectGroup.create({
        data: {
          name: name.trim(),
          slug: finalSlug,
          description: description?.trim() || null,
          ownerId: creatorId,
        },
      });
      await ensureGroupOwnerMembership(tx, created.id, creatorId);
      return created;
    });
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    logApiError("POST", "/api/project-groups", error, { userId: creatorId });
    return NextResponse.json(
      { error: messages.errors.failedToCreate, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
