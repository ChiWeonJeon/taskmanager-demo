import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { ENTITY_TYPE_CATEGORIES, issueTypeSchemaInclude, type EntityTypeCategory } from "@/lib/issue-type-config";
import { getServerMessages } from "@/lib/i18n/server";

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function parseCategory(value: unknown): EntityTypeCategory | null {
  return typeof value === "string" && ENTITY_TYPE_CATEGORIES.includes(value as EntityTypeCategory)
    ? value as EntityTypeCategory
    : null;
}

export async function GET(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");
  const key = searchParams.get("key") ?? searchParams.get("type");
  const categoryParam = searchParams.get("category");
  const requestedCategory = parseCategory(categoryParam);
  const legacyObjectType = searchParams.get("objectType");
  if (categoryParam !== null && !requestedCategory) {
    return NextResponse.json({ error: messages.errors.unsupportedEntityTypeCategory }, { status: 400 });
  }
  if (legacyObjectType === "calendar_event") {
    return NextResponse.json([]);
  }
  const legacyCategory: EntityTypeCategory | null = legacyObjectType === "cycle"
      ? "CYCLE"
      : legacyObjectType === "work_item"
        ? "ISSUE"
        : null;
  const category = requestedCategory ?? legacyCategory ?? undefined;

  try {
    const where = {
      deletedAt: null,
      ...(key ? { key } : {}),
      ...(category ? { category } : {}),
    };

    if (view === "summary") {
      const entityTypes = await prisma.issueType.findMany({
        where,
        select: {
          id: true,
          key: true,
          name: true,
          category: true,
          icon: true,
          color: true,
          fieldSchemaId: true,
          statusSchemaId: true,
          allowedViews: true,
          allowedChildEntityTypeIds: true,
        },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json(entityTypes);
    }

    const entityTypes = await prisma.issueType.findMany({
      where,
      include: issueTypeSchemaInclude,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(entityTypes);
  } catch (error) {
    logApiError("GET", "/api/entity-types", error, { view, key, legacyObjectType });
    return NextResponse.json(
      { error: "Failed to load entity types.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
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
  const category = parseCategory(body.category);
  const fieldSchemaId = typeof body.fieldSchemaId === "string" ? body.fieldSchemaId : "";
  const statusSchemaId = typeof body.statusSchemaId === "string" && body.statusSchemaId.trim()
    ? body.statusSchemaId.trim()
    : null;

  if (!name || !key || !category || !fieldSchemaId) {
    return NextResponse.json({ error: "name, key, category, and fieldSchemaId are required." }, { status: 400 });
  }
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return NextResponse.json({ error: "Entity type keys must start with a letter and use lowercase letters, numbers, and underscores." }, { status: 400 });
  }

  const duplicate = await prisma.issueType.findFirst({
    where: { OR: [{ key }, { name }] },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "That entity type key or name is already in use." }, { status: 409 });
  }

  const created = await prisma.issueType.create({
    data: {
      key,
      name,
      category,
      icon: typeof body.icon === "string" ? body.icon.trim() || null : null,
      color: typeof body.color === "string" ? body.color.trim() || null : null,
      fieldSchemaId,
      statusSchemaId,
      allowedViews: JSON.stringify(parseStringArray(body.allowedViews)),
      allowedChildEntityTypeIds: JSON.stringify(parseStringArray(body.allowedChildEntityTypeIds)),
      isSystem: false,
    },
    include: issueTypeSchemaInclude,
  });

  return NextResponse.json(created, { status: 201 });
}
