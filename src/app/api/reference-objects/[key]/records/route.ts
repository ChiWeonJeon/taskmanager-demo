import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  buildObjectRecordFieldValueRecords,
  getObjectRecordSchemaFieldIds,
  objectDefRecordFieldSchemaInclude,
  replaceObjectRecordFieldValues,
} from "@/lib/objects/record-field-values";

type Ctx = { params: Promise<{ key: string }> };

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { key } = await params;
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const objectDef = await prisma.objectDef.findFirst({
    where: { key, deletedAt: null },
    select: { id: true, color: true },
  });
  if (!objectDef) {
    return NextResponse.json({ error: "Reference object not found." }, { status: 404 });
  }

  const records = await prisma.objectRecord.findMany({
    where: {
      objectDefId: objectDef.id,
      deletedAt: null,
      ...(q ? { OR: [{ title: { contains: q } }, { key: { contains: q } }] } : {}),
    },
    include: {
      fieldValues: {
        include: { field: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    take: Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 50), 1), 200),
  });

  return NextResponse.json({
    records: records.map((record) => ({
      id: record.id,
      key: record.key,
      value: record.id,
      title: record.title,
      label: record.title,
      color: objectDef.color,
      parentId: record.parentId,
      sortOrder: record.sortOrder,
      fieldValues: record.fieldValues,
    })),
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { key } = await params;
  const objectDef = await prisma.objectDef.findFirst({
    where: { key, deletedAt: null },
    include: objectDefRecordFieldSchemaInclude,
  });
  if (!objectDef) {
    return NextResponse.json({ error: "Reference object not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : typeof body.label === "string" ? body.label.trim() : "";
  const recordKey = normalizeKey(typeof body.key === "string" ? body.key : title);
  if (!title || !recordKey) {
    return NextResponse.json({ error: "Title and key are required." }, { status: 400 });
  }

  let fieldValueRecords: { fieldId: string; value: string }[];
  try {
    fieldValueRecords = buildObjectRecordFieldValueRecords(objectDef, body.fieldValues, { title });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid field values." }, { status: 400 });
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.objectRecord.create({
      data: {
        objectDefId: objectDef.id,
        key: recordKey,
        title,
        parentId: typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null,
        sortOrder: Number.isInteger(body.sortOrder) ? body.sortOrder : 0,
      },
    });
    await replaceObjectRecordFieldValues(tx, created.id, getObjectRecordSchemaFieldIds(objectDef), fieldValueRecords);
    return tx.objectRecord.findUnique({
      where: { id: created.id },
      include: { fieldValues: { include: { field: true } } },
    });
  });

  return NextResponse.json(record, { status: 201 });
}
