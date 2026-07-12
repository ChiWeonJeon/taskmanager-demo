import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { assertObjectFieldSchema } from "@/lib/objects/reference-validation";

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function GET(request: NextRequest) {
  const includeAll = request.nextUrl.searchParams.get("all") === "1";
  try {
    if (includeAll) await requireAdmin();
    else await requireAuth();
  } catch {
    return NextResponse.json({ error: includeAll ? "Forbidden." : "Authentication required." }, { status: includeAll ? 403 : 401 });
  }

  const objectDefs = await prisma.objectDef.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: { records: true },
      },
    },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(objectDefs);
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const key = normalizeKey(typeof body.key === "string" ? body.key : name);
  const fieldSchemaId = typeof body.fieldSchemaId === "string" ? body.fieldSchemaId.trim() : "";

  if (!name || !key || !fieldSchemaId) {
    return NextResponse.json({ error: "Name, key, and fieldSchemaId are required." }, { status: 400 });
  }
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return NextResponse.json({ error: "Reference object keys must start with a letter and use lowercase letters, numbers, and underscores." }, { status: 400 });
  }

  const duplicate = await prisma.objectDef.findUnique({
    where: { key },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "That reference object key is already in use." }, { status: 409 });
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
    include: {
      _count: {
        select: { records: true },
      },
    },
  });

  return NextResponse.json(objectDef, { status: 201 });
}
