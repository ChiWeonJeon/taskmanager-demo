import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth-utils";
import {
  normalizeDefaultValue,
  normalizeFieldType,
  normalizeOptions,
  normalizeReferenceObjectKey,
  resolveReferenceObjectDefId,
} from "@/lib/objects/field-definition";

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const fields = await prisma.field.findMany({
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(fields);
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    key,
    type,
    options,
    defaultValue,
    referenceObjectKey,
  } = body as {
    name?: string;
    key?: string;
    type?: string;
    options?: unknown;
    defaultValue?: unknown;
    referenceObjectKey?: unknown;
  };

  if (!name?.trim() || !key?.trim() || !type?.trim()) {
    return NextResponse.json({ error: "name, key, and type are required." }, { status: 400 });
  }

  const existing = await prisma.field.findUnique({
    where: { key: key.trim() },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ error: `Field key '${key.trim()}' is already in use.` }, { status: 409 });
  }

  try {
    const normalizedType = normalizeFieldType(type);
    const normalizedOptions = normalizeOptions(normalizedType, options);
    const normalizedReferenceObjectKey = await normalizeReferenceObjectKey(
      prisma,
      normalizedType,
      type === "USER" ? "user" : referenceObjectKey,
    );
    const normalizedReferenceObjectDefId = await resolveReferenceObjectDefId(
      prisma,
      normalizedType,
      normalizedReferenceObjectKey,
    );
    const normalizedDefaultValue = normalizeDefaultValue(normalizedType, normalizedOptions, defaultValue);

    const field = await prisma.field.create({
      data: {
        name: name.trim(),
        key: key.trim(),
        type: normalizedType,
        referenceObjectKey: normalizedReferenceObjectKey,
        referenceObjectDefId: normalizedReferenceObjectDefId,
        options: normalizedOptions ? JSON.stringify(normalizedOptions) : null,
        defaultValue: normalizedDefaultValue,
        isRequired: false,
        isSystem: false,
      },
    });

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create the field." },
      { status: 400 },
    );
  }
}
