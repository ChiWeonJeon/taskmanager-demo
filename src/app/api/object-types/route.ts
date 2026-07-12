import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { assertObjectFieldSchema } from "@/lib/objects/reference-validation";

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function GET(request: NextRequest) {
  const messages = await getServerMessages();
  const includeAll = request.nextUrl.searchParams.get("all") === "1";

  if (includeAll) {
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }
  } else {
    try {
      await requireAuth();
    } catch {
      return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
    }
  }

  const objectDefs = await prisma.objectDef.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      key: true,
      name: true,
      icon: true,
      color: true,
      fieldSchemaId: true,
      isSystem: true,
      _count: { select: { records: { where: { deletedAt: null } } } },
    },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(objectDefs.map((objectDef) => ({
    ...objectDef,
    isCreatable: true,
    hasFieldSchema: Boolean(objectDef.fieldSchemaId),
    hasStatusSchema: false,
    referenceable: true,
  })));
}

export async function POST(request: NextRequest) {
  const messages = await getServerMessages();
  const m = messages.admin.objectTypes;
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const key = normalizeKey(typeof body.key === "string" ? body.key : name);
  const fieldSchemaId = typeof body.fieldSchemaId === "string" ? body.fieldSchemaId.trim() : "";

  if (!name || !key || !fieldSchemaId) {
    return NextResponse.json({ error: m.requiredFields }, { status: 400 });
  }
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return NextResponse.json({ error: m.invalidKey }, { status: 400 });
  }

  const duplicate = await prisma.objectDef.findUnique({
    where: { key },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: m.duplicateKey }, { status: 409 });
  }
  const schemaError = await assertObjectFieldSchema(fieldSchemaId);
  if (schemaError) {
    return NextResponse.json({ error: schemaError }, { status: 400 });
  }

  const objectDef = await prisma.objectDef.create({
    data: {
      name,
      key,
      icon: typeof body.icon === "string" ? body.icon.trim() || null : null,
      color: typeof body.color === "string" ? body.color.trim() || null : null,
      fieldSchemaId,
      isSystem: false,
    },
  });

  return NextResponse.json(objectDef, { status: 201 });
}
