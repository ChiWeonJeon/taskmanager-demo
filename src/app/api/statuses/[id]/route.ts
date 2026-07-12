import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";

const VALID_CATEGORIES = new Set(["TODO", "IN_PROGRESS", "DONE"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.status.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Status not found." }, { status: 404 });
  }

  if (existing.isSystem) {
    return NextResponse.json({ error: "System statuses cannot be modified." }, { status: 400 });
  }

  const body = await request.json();
  const {
    name,
    key,
    category,
    color,
  } = body as {
    name?: string;
    key?: string;
    category?: string;
    color?: string;
  };

  const nextKey = key?.trim() ?? existing.key;
  if (nextKey !== existing.key) {
    const duplicate = await prisma.status.findUnique({
      where: { key: nextKey },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json({ error: `Status key '${nextKey}' is already in use.` }, { status: 409 });
    }
  }

  if (category && !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid status category." }, { status: 400 });
  }

  const status = await prisma.status.update({
    where: { id },
    data: {
      name: name?.trim() || existing.name,
      key: nextKey,
      category: category ?? existing.category,
      color: color?.trim() || existing.color,
    },
  });

  return NextResponse.json(status);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.status.findUnique({
    where: { id },
    select: { id: true, isSystem: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Status not found." }, { status: 404 });
  }

  if (existing.isSystem) {
    return NextResponse.json({ error: "System statuses cannot be deleted." }, { status: 400 });
  }

  const [schemaUsageCount, workItemCount, startStatusCount] = await Promise.all([
    prisma.statusSchemaStatus.count({ where: { statusId: id } }),
    prisma.workItem.count({ where: { statusId: id } }),
    prisma.statusSchema.count({ where: { startStatusId: id } }),
  ]);

  if (schemaUsageCount > 0 || workItemCount > 0 || startStatusCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a status that is referenced by a schema or work item." },
      { status: 400 },
    );
  }

  await prisma.status.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
