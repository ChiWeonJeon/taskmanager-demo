import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { assertObjectFieldSchema } from "@/lib/objects/reference-validation";

type Ctx = { params: Promise<{ key: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const { key } = await params;
  const existing = await prisma.objectDef.findUnique({ where: { key } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Reference object not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : existing.name;
  const fieldSchemaId = Object.prototype.hasOwnProperty.call(body, "fieldSchemaId")
    ? typeof body.fieldSchemaId === "string" && body.fieldSchemaId.trim()
      ? body.fieldSchemaId.trim()
      : ""
    : existing.fieldSchemaId;
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!fieldSchemaId) {
    return NextResponse.json({ error: "Field schema is required." }, { status: 400 });
  }
  const schemaError = await assertObjectFieldSchema(fieldSchemaId);
  if (schemaError) {
    return NextResponse.json({ error: schemaError }, { status: 400 });
  }

  if (fieldSchemaId !== existing.fieldSchemaId) {
    const activeRecordCount = await prisma.objectRecord.count({
      where: { objectDefId: existing.id, deletedAt: null },
    });
    if (activeRecordCount > 0) {
      return NextResponse.json({ error: messages.admin.objectTypes.schemaChangeBlocked }, { status: 400 });
    }
  }

  const objectDef = await prisma.objectDef.update({
    where: { key },
    data: {
      name,
      icon: typeof body.icon === "string" ? body.icon.trim() || null : existing.icon,
      color: typeof body.color === "string" ? body.color.trim() || null : existing.color,
      fieldSchemaId,
    },
    include: {
      _count: {
        select: { records: true },
      },
    },
  });

  return NextResponse.json(objectDef);
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { key } = await params;
  const existing = await prisma.objectDef.findUnique({
    where: { key },
    select: { id: true, isSystem: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Reference object not found." }, { status: 404 });
  }
  if (existing.isSystem) {
    return NextResponse.json({ error: "Built-in reference objects cannot be deleted." }, { status: 400 });
  }

  const [fieldCount, recordCount] = await Promise.all([
    prisma.field.count({ where: { referenceObjectDefId: existing.id } }),
    prisma.objectRecord.count({ where: { objectDefId: existing.id, deletedAt: null } }),
  ]);
  if (fieldCount > 0 || recordCount > 0) {
    return NextResponse.json({ error: "Cannot delete a reference object that is still used by fields or records." }, { status: 400 });
  }

  await prisma.objectDef.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  return new NextResponse(null, { status: 204 });
}
