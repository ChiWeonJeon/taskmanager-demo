import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";

const VALID_CATEGORIES = new Set(["TODO", "IN_PROGRESS", "DONE"]);

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const statuses = await prisma.status.findMany({
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(statuses);
  } catch (error) {
    logApiError("GET", "/api/statuses", error);
    return NextResponse.json(
      {
        error: "Failed to load statuses.",
        detail: error instanceof Error ? error.message : String(error),
      },
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

  if (!name?.trim() || !key?.trim() || !category?.trim() || !color?.trim()) {
    return NextResponse.json({ error: "name, key, category, and color are required." }, { status: 400 });
  }

  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid status category." }, { status: 400 });
  }

  const duplicate = await prisma.status.findUnique({
    where: { key: key.trim() },
    select: { id: true },
  });

  if (duplicate) {
    return NextResponse.json({ error: `Status key '${key.trim()}' is already in use.` }, { status: 409 });
  }

  const status = await prisma.status.create({
    data: {
      name: name.trim(),
      key: key.trim(),
      category,
      color: color.trim(),
      isSystem: false,
    },
  });

  return NextResponse.json(status, { status: 201 });
}
