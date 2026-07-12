import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  buildObjectRecordFieldValueRecords,
  getObjectRecordSchemaFieldIds,
  objectDefRecordFieldSchemaInclude,
  replaceObjectRecordFieldValues,
} from "@/lib/objects/record-field-values";

type Ctx = { params: Promise<{ key: string; recordId: string }> };

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { key, recordId } = await params;
  const existing = await prisma.objectRecord.findFirst({
    where: { id: recordId, objectDef: { key, deletedAt: null }, deletedAt: null },
    include: {
      objectDef: {
        include: objectDefRecordFieldSchemaInclude,
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Reference object record not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim()
    : typeof body.label === "string" && body.label.trim()
      ? body.label.trim()
      : existing.title;
  const recordKey = typeof body.key === "string" && body.key.trim() ? normalizeKey(body.key) : existing.key;
  const shouldPatchFieldValues = body.fieldValues !== undefined;
  let fieldValueRecords: { fieldId: string; value: string }[] = [];
  if (shouldPatchFieldValues) {
    try {
      fieldValueRecords = buildObjectRecordFieldValueRecords(existing.objectDef, body.fieldValues, { title });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid field values." }, { status: 400 });
    }
  }

  const record = await prisma.$transaction(async (tx) => {
    const updated = await tx.objectRecord.update({
      where: { id: recordId },
      data: {
        title,
        key: recordKey,
        parentId: typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : existing.parentId,
        sortOrder: Number.isInteger(body.sortOrder) ? body.sortOrder : existing.sortOrder,
      },
    });
    if (shouldPatchFieldValues) {
      await replaceObjectRecordFieldValues(tx, updated.id, getObjectRecordSchemaFieldIds(existing.objectDef), fieldValueRecords);
    }
    return tx.objectRecord.findUnique({
      where: { id: updated.id },
      include: { fieldValues: { include: { field: true } } },
    });
  });

  return NextResponse.json(record);
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { key, recordId } = await params;
  const existing = await prisma.objectRecord.findFirst({
    where: { id: recordId, objectDef: { key, deletedAt: null }, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Reference object record not found." }, { status: 404 });
  }

  await prisma.objectRecord.update({ where: { id: recordId }, data: { deletedAt: new Date() } });
  return new NextResponse(null, { status: 204 });
}
