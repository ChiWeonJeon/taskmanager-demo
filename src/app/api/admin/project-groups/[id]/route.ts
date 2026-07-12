import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { ensureGroupOwnerMembership } from "@/lib/group-permissions";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.adminPermissionRequired }, { status: 403 });
  }
  const { id } = await params;

  const existing = await prisma.projectGroup.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 });
  }

  const body = await request.json();
  const { name, slug, description, ownerId } = body as {
    name?: string;
    slug?: string;
    description?: string | null;
    ownerId?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof description !== "undefined") data.description = description?.toString().trim() || null;
  if (typeof slug === "string" && slug.trim()) {
    const nextSlug = slug.trim().toLowerCase();
    if (nextSlug !== existing.slug) {
      const conflict = await prisma.projectGroup.findFirst({
        where: { slug: nextSlug, NOT: { id } },
      });
      if (conflict) {
        return NextResponse.json(
          { error: messages.errors.slugTaken.replace("{slug}", nextSlug) },
          { status: 409 },
        );
      }
      data.slug = nextSlug;
    }
  }
  if (typeof ownerId === "string") {
    const nextOwnerId = ownerId.trim();
    if (nextOwnerId === "") {
      return NextResponse.json(
        { error: messages.errors.ownerRequiredMinimum },
        { status: 400 },
      );
    }
    if (nextOwnerId !== existing.ownerId) {
      const targetUser = await prisma.user.findUnique({ where: { id: nextOwnerId } });
      if (!targetUser) {
        return NextResponse.json({ error: messages.errors.transferTargetUserNotFound }, { status: 404 });
      }
      data.ownerId = nextOwnerId;
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.projectGroup.update({ where: { id }, data });
      if (data.ownerId) {
        await ensureGroupOwnerMembership(tx, row.id, row.ownerId);
      }
      return row;
    });
    return NextResponse.json(updated);
  } catch (error) {
    logApiError("PATCH", `/api/admin/project-groups/${id}`, error);
    return NextResponse.json(
      { error: messages.errors.failedToUpdate, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.adminPermissionRequired }, { status: 403 });
  }
  const { id } = await params;

  const existing = await prisma.projectGroup.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.project.updateMany({ where: { groupId: id }, data: { groupId: null, sortOrderInGroup: 0 } });
      await tx.projectGroup.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("DELETE", `/api/admin/project-groups/${id}`, error);
    return NextResponse.json(
      { error: messages.errors.failedToDelete, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
