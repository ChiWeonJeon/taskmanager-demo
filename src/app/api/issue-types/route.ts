import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { ENTITY_TYPE_CATEGORIES, ISSUE_ENTITY_CATEGORY, issueTypeSchemaInclude, workItemIssueTypeWhere, type EntityTypeCategory } from "@/lib/issue-type-config";
import { getServerMessages } from "@/lib/i18n/server";

export async function GET(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");
  const categoryParam = searchParams.get("category");
  if (categoryParam !== null && !ENTITY_TYPE_CATEGORIES.includes(categoryParam as EntityTypeCategory)) {
    return NextResponse.json({ error: messages.errors.unsupportedEntityTypeCategory }, { status: 400 });
  }
  const category = categoryParam as EntityTypeCategory | null;
  const issueTypeWhere = category ? { deletedAt: null, category } : workItemIssueTypeWhere;

  try {
    if (view === "summary") {
      const issueTypes = await prisma.issueType.findMany({
        where: issueTypeWhere,
        select: {
          id: true,
          key: true,
          name: true,
          category: true,
          icon: true,
          color: true,
          fieldSchemaId: true,
          statusSchemaId: true,
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json(issueTypes);
    }

    const issueTypes = await prisma.issueType.findMany({
      where: issueTypeWhere,
      include: issueTypeSchemaInclude,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(issueTypes);
  } catch (error) {
    logApiError("GET", "/api/issue-types", error, { view });
    return NextResponse.json(
      { error: "Failed to load issue types.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { name, icon, color, fieldSchemaId, statusSchemaId } = (await request.json()) as {
    name?: string;
    icon?: string;
    color?: string;
    fieldSchemaId?: string;
    statusSchemaId?: string;
  };

  if (!name?.trim() || !fieldSchemaId || !statusSchemaId) {
    return NextResponse.json({ error: "name, fieldSchemaId, and statusSchemaId are required." }, { status: 400 });
  }

  const created = await prisma.issueType.create({
    data: {
      name: name.trim(),
      icon: icon?.trim() || null,
      color: color?.trim() || null,
      fieldSchemaId,
      statusSchemaId,
      category: ISSUE_ENTITY_CATEGORY,
    },
    include: issueTypeSchemaInclude,
  });

  return NextResponse.json(created, { status: 201 });
}
