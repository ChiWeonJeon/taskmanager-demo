import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ key: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const m = messages.admin.objectTypes;
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const { key } = await params;
  const existing = await prisma.objectDef.findUnique({ where: { key } });
  if (!existing) {
    return NextResponse.json({ error: messages.errors.notFound }, { status: 404 });
  }
  if (existing.isSystem) {
    return NextResponse.json({ error: m.systemReadOnly }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : existing.name;
  if (!name) {
    return NextResponse.json({ error: m.requiredFields }, { status: 400 });
  }

  const objectType = await prisma.objectDef.update({
    where: { key },
    data: {
      name,
      icon: typeof body.icon === "string" ? body.icon.trim() || null : existing.icon,
      color: typeof body.color === "string" ? body.color.trim() || null : existing.color,
    },
  });

  return NextResponse.json(objectType);
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const m = messages.admin.objectTypes;
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const { key } = await params;
  const existing = await prisma.objectDef.findUnique({
    where: { key },
    select: { id: true, key: true, isSystem: true },
  });
  if (!existing) {
    return NextResponse.json({ error: messages.errors.notFound }, { status: 404 });
  }
  if (existing.isSystem) {
    return NextResponse.json({ error: m.systemReadOnly }, { status: 400 });
  }

  const [referenceFields, options] = await Promise.all([
    prisma.field.count({ where: { referenceObjectDefId: existing.id } }),
    prisma.objectRecord.count({ where: { objectDefId: existing.id, deletedAt: null } }),
  ]);

  if (referenceFields > 0 || options > 0) {
    return NextResponse.json({ error: m.deleteBlocked }, { status: 400 });
  }

  await prisma.objectDef.update({ where: { key }, data: { deletedAt: new Date() } });
  return new NextResponse(null, { status: 204 });
}
