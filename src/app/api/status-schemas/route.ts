import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth-utils";
import { normalizeStatusTransitions, statusSchemaAdminInclude } from "@/lib/status-schema";

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rows = await prisma.statusSchema.findMany({
    include: statusSchemaAdminInclude,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(rows);
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
    statusIds,
    startStatusId,
    transitions,
  } = body as {
    name?: string;
    statusIds?: string[];
    startStatusId?: string;
    transitions?: { fromStatusId?: string; toStatusId?: string }[];
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const normalizedStatusIds = Array.from(new Set(statusIds ?? []));
  if (normalizedStatusIds.length === 0) {
    return NextResponse.json({ error: "At least one status is required." }, { status: 400 });
  }

  if (startStatusId && !normalizedStatusIds.includes(startStatusId)) {
    return NextResponse.json({ error: "startStatusId must be included in statusIds." }, { status: 400 });
  }

  const statuses = await prisma.status.findMany({
    where: { id: { in: normalizedStatusIds } },
    select: { id: true },
  });

  if (statuses.length !== normalizedStatusIds.length) {
    return NextResponse.json({ error: "One or more statuses were not found." }, { status: 400 });
  }

  const normalizedTransitions = normalizeStatusTransitions(transitions, normalizedStatusIds);

  const created = await prisma.statusSchema.create({
    data: {
      name: name.trim(),
      startStatusId: startStatusId ?? normalizedStatusIds[0],
      statuses: {
        create: normalizedStatusIds.map((statusId, index) => ({
          statusId,
          sortOrder: index,
        })),
      },
      transitions: {
        create: normalizedTransitions,
      },
    },
    include: statusSchemaAdminInclude,
  });

  return NextResponse.json(created, { status: 201 });
}
