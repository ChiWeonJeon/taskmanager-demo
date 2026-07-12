import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth-utils";
import {
  fieldSchemaAdminInclude,
  normalizeFieldSchemaFieldRows,
  type FieldSchemaUsage,
} from "@/lib/field-schema-admin";
import { assertObjectSchemaFieldRemovalAllowed, assertSchemaFieldRemovalAllowed } from "@/lib/schema-guards";
import { FIELD_SCHEMA_CANONICAL_ID } from "@/lib/field-schema";
import { logApiError } from "@/lib/api-logger";

function normalizeUsage(raw: unknown): FieldSchemaUsage | null {
  if (raw === "object") return "object";
  if (raw === "entity") return "entity";
  return null;
}

async function getExistingFieldSchema(id: string) {
  return prisma.fieldSchema.findUnique({
    where: { id },
    include: fieldSchemaAdminInclude,
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const fieldSchema = await getExistingFieldSchema(id);
    if (!fieldSchema) {
      return NextResponse.json({ error: "Field schema not found." }, { status: 404 });
    }

    return NextResponse.json(fieldSchema);
  } catch (error) {
    logApiError("GET", "/api/field-schemas/[id]", error);
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Authentication is required." : "Failed to load the field schema." },
      { status }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await getExistingFieldSchema(id);
    if (!existing) {
      return NextResponse.json({ error: "Field schema not found." }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      fieldIds?: string[];
      fieldDefaults?: Record<string, string | null>;
      fieldRequired?: Record<string, boolean>;
      usage?: string;
    };
    const { name, fieldIds, fieldDefaults, fieldRequired } = body;
    const requestedUsage = normalizeUsage(body.usage ?? request.nextUrl.searchParams.get("usage"));
    const usage: FieldSchemaUsage = requestedUsage ?? (existing.objectDefs.length > 0 ? "object" : "entity");

    if (!name?.trim()) {
      return NextResponse.json({ error: "Schema name is required." }, { status: 400 });
    }

    const fieldRows = await normalizeFieldSchemaFieldRows(fieldIds, fieldDefaults, fieldRequired, { usage });

    // 스키마에서 제거되는 필드가 기존 일감에 값으로 남아 있으면 차단(고아 값 방지).
    const nextFieldIds = new Set(fieldRows.map((row) => row.fieldId));
    const removedFieldIds = existing.fields
      .map((entry) => entry.field.id)
      .filter((fieldId) => !nextFieldIds.has(fieldId));
    const affectedIssueTypeIds = existing.issueTypes.map((issueType) => issueType.id);
    const affectedObjectDefIds = existing.objectDefs.map((objectDef) => objectDef.id);
    await assertSchemaFieldRemovalAllowed(prisma, affectedIssueTypeIds, removedFieldIds);
    await assertObjectSchemaFieldRemovalAllowed(prisma, affectedObjectDefIds, removedFieldIds);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.fieldSchemaField.deleteMany({ where: { fieldSchemaId: id } });

      return tx.fieldSchema.update({
        where: { id },
        data: {
          name: name.trim(),
          fields: {
            create: fieldRows,
          },
        },
        include: fieldSchemaAdminInclude,
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    logApiError("PATCH", "/api/field-schemas/[id]", error);

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
        || error.message.startsWith("Cannot remove a field that is still used")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Failed to update the field schema." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await getExistingFieldSchema(id);
    if (!existing) {
      return NextResponse.json({ error: "Field schema not found." }, { status: 404 });
    }

    if (id === FIELD_SCHEMA_CANONICAL_ID) {
      return NextResponse.json({ error: "The canonical field schema cannot be deleted." }, { status: 400 });
    }

    if (existing.issueTypes.length > 0) {
      return NextResponse.json({ error: "Field schemas linked to issue types cannot be deleted." }, { status: 400 });
    }

    if (existing.objectDefs.length > 0) {
      return NextResponse.json({ error: "Field schemas linked to reference objects cannot be deleted." }, { status: 400 });
    }

    await prisma.fieldSchema.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logApiError("DELETE", "/api/field-schemas/[id]", error);

    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "Admin permission is required." }, { status: 403 });
      }
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
      }
    }

    return NextResponse.json({ error: "Failed to delete the field schema." }, { status: 500 });
  }
}
