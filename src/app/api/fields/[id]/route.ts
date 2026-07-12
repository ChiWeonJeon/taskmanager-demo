import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import {
  assertFieldOptionsRemovalAllowed,
  assertSchemaDefaultOptionsRemovalAllowed,
} from "@/lib/schema-guards";
import { parseStoredValue } from "@/lib/issue-type-config";
import { WORK_ITEM_OBJECT_TYPE } from "@/lib/objects/field-value";
import {
  FieldOptionInput,
  normalizeDefaultValue,
  normalizeFieldType,
  normalizeOptions,
  normalizeReferenceObjectKey,
  parseStoredOptions,
  resolveReferenceObjectDefId,
} from "@/lib/objects/field-definition";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.field.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Field not found." }, { status: 404 });
  }

  if (existing.isSystem) {
    return NextResponse.json({ error: "System fields cannot be modified." }, { status: 400 });
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

  const nextKey = key?.trim() ?? existing.key;

  if (nextKey !== existing.key) {
    const duplicate = await prisma.field.findUnique({
      where: { key: nextKey },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json({ error: `Field key '${nextKey}' is already in use.` }, { status: 409 });
    }
  }

  try {
    const nextType = normalizeFieldType(type?.trim() ?? existing.type);
    const nextReferenceObjectKey = await normalizeReferenceObjectKey(
      prisma,
      nextType,
      referenceObjectKey !== undefined
        ? referenceObjectKey
        : existing.referenceObjectKey ?? (existing.type === "USER" ? "user" : null),
    );
    const nextReferenceObjectDefId = await resolveReferenceObjectDefId(
      prisma,
      nextType,
      nextReferenceObjectKey,
    );
    const normalizedOptions = normalizeOptions(
      nextType,
      options !== undefined ? options : parseStoredOptions(existing.options),
    );
    const nextDefaultValue = defaultValue !== undefined
      ? normalizeDefaultValue(nextType, normalizedOptions, defaultValue)
      : existing.defaultValue;

    if (options !== undefined && existing.options) {
      const previousOptions = JSON.parse(existing.options) as FieldOptionInput[];
      const nextOptionValues = new Set((normalizedOptions ?? []).map((option) => option.value));
      const removedOptionValues = previousOptions
        .map((option) => option.value)
        .filter((value) => !nextOptionValues.has(value));

      const effectiveDefault = parseStoredValue(nextDefaultValue);
      if (Array.isArray(effectiveDefault)) {
        if (effectiveDefault.some((value) => removedOptionValues.includes(String(value)))) {
          throw new Error("Cannot remove an option used by the field default value.");
        }
      } else if (effectiveDefault != null && removedOptionValues.includes(String(effectiveDefault))) {
        throw new Error("Cannot remove an option used by the field default value.");
      }

      await assertSchemaDefaultOptionsRemovalAllowed(prisma, id, removedOptionValues);
      await assertFieldOptionsRemovalAllowed(prisma, id, removedOptionValues);
    }

    const field = await prisma.field.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        key: nextKey,
        type: nextType,
        referenceObjectKey: nextReferenceObjectKey,
        referenceObjectDefId: nextReferenceObjectDefId,
        options: normalizedOptions ? JSON.stringify(normalizedOptions) : null,
        defaultValue: nextDefaultValue,
      },
    });

    return NextResponse.json(field);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update the field." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.field.findUnique({
    where: { id },
    select: { id: true, isSystem: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Field not found." }, { status: 404 });
  }

  if (existing.isSystem) {
    return NextResponse.json({ error: "System fields cannot be deleted." }, { status: 400 });
  }

  const [schemaUsageCount, valueUsageCount] = await Promise.all([
    prisma.fieldSchemaField.count({ where: { fieldId: id } }),
    prisma.fieldValue.count({ where: { objectType: WORK_ITEM_OBJECT_TYPE, fieldId: id } }),
  ]);

  if (schemaUsageCount > 0 || valueUsageCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a field that is referenced by a schema or work item." },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.workItemFieldValue.deleteMany({ where: { fieldId: id } });
    await tx.field.delete({ where: { id } });
  });
  return new NextResponse(null, { status: 204 });
}
