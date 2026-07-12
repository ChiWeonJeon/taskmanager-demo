import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { assertStatusesAllowedForIssueTypes } from "@/lib/schema-guards";
import { normalizeStatusTransitions, statusSchemaAdminInclude } from "@/lib/status-schema";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.statusSchema.findUnique({
    where: { id },
    include: {
      statuses: {
        include: { status: true },
        orderBy: { sortOrder: "asc" },
      },
      transitions: {
        select: { fromStatusId: true, toStatusId: true },
      },
      issueTypes: {
        select: { id: true },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Status schema not found." }, { status: 404 });
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

  const normalizedStatusIds = Array.from(new Set(
    statusIds ?? existing.statuses.map((status) => status.statusId),
  ));

  if (normalizedStatusIds.length === 0) {
    return NextResponse.json({ error: "At least one status is required." }, { status: 400 });
  }

  const nextStartStatusId = startStatusId ?? existing.startStatusId ?? normalizedStatusIds[0];
  if (!normalizedStatusIds.includes(nextStartStatusId)) {
    return NextResponse.json({ error: "startStatusId must be included in statusIds." }, { status: 400 });
  }

  const statuses = await prisma.status.findMany({
    where: { id: { in: normalizedStatusIds } },
    select: { id: true },
  });

  if (statuses.length !== normalizedStatusIds.length) {
    return NextResponse.json({ error: "One or more statuses were not found." }, { status: 400 });
  }

  try {
    await assertStatusesAllowedForIssueTypes(
      prisma,
      existing.issueTypes.map((issueType) => issueType.id),
      normalizedStatusIds,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to validate the status schema." },
      { status: 400 },
    );
  }

  const transitionsSource = transitions ?? existing.transitions;
  const normalizedTransitions = normalizeStatusTransitions(transitionsSource, normalizedStatusIds);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.statusSchema.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        startStatusId: nextStartStatusId,
      },
    });

    await tx.statusSchemaStatus.deleteMany({
      where: { statusSchemaId: id },
    });

    for (const [index, statusId] of normalizedStatusIds.entries()) {
      await tx.statusSchemaStatus.create({
        data: {
          statusSchemaId: id,
          statusId,
          sortOrder: index,
        },
      });
    }

    await tx.statusTransition.deleteMany({
      where: { statusSchemaId: id },
    });

    if (normalizedTransitions.length > 0) {
      await tx.statusTransition.createMany({
        data: normalizedTransitions.map((transition) => ({
          statusSchemaId: id,
          fromStatusId: transition.fromStatusId,
          toStatusId: transition.toStatusId,
        })),
      });
    }

    return tx.statusSchema.findUnique({
      where: { id },
      include: statusSchemaAdminInclude,
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const usageCount = await prisma.issueType.count({
    where: { statusSchemaId: id },
  });

  if (usageCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a status schema that is used by an issue type." },
      { status: 400 },
    );
  }

  await prisma.statusSchema.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
