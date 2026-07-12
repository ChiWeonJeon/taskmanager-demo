import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth-utils";
import { fieldSchemaAdminInclude, normalizeFieldSchemaFieldRows, type FieldSchemaUsage } from "@/lib/field-schema-admin";
import { logApiError } from "@/lib/api-logger";

function normalizeUsage(raw: unknown): FieldSchemaUsage {
  return raw === "object" ? "object" : "entity";
}

export async function GET() {
  try {
    await requireAuth();

    const rows = await prisma.fieldSchema.findMany({
      include: fieldSchemaAdminInclude,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(rows);
  } catch (error) {
    logApiError("GET", "/api/field-schemas", error);
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Authentication is required." : "Failed to load field schemas." },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = (await request.json()) as {
      name?: string;
      fieldIds?: string[];
      fieldDefaults?: Record<string, string | null>;
      fieldRequired?: Record<string, boolean>;
      usage?: string;
    };
    const { name, fieldIds, fieldDefaults, fieldRequired } = body;
    const usage = normalizeUsage(body.usage ?? request.nextUrl.searchParams.get("usage"));

    if (!name?.trim()) {
      return NextResponse.json({ error: "Schema name is required." }, { status: 400 });
    }

    const fieldRows = await normalizeFieldSchemaFieldRows(fieldIds, fieldDefaults, fieldRequired, { usage });

    const created = await prisma.fieldSchema.create({
      data: {
        name: name.trim(),
        fields: {
          create: fieldRows,
        },
      },
      include: fieldSchemaAdminInclude,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logApiError("POST", "/api/field-schemas", error);

    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Admin permission is required." }, { status: 403 });
      }
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
      }
      if (
        error.message === "Unknown field ids."
        || error.message === "Locked system fields are missing."
        || error.message === "Object field schema must include a required title field."
        || error.message === "Unsupported field type for object record schemas."
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Failed to create the field schema." }, { status: 500 });
  }
}
