import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { ENTITY_TYPE_CATEGORIES, issueTypeSchemaInclude, pickDefaultIssueType, type EntityTypeCategory } from "@/lib/issue-type-config";
import {
  assertProjectIssueTypeRemovalAllowed,
  assertRequiredSchemaFieldsSatisfied,
  assertStatusesAllowedForIssueTypes,
} from "@/lib/schema-guards";
import { resolveSchemaFieldRequired } from "@/lib/field-schema";
import type { SchemaFieldDefinition } from "@/lib/work-item-schema";

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCategory(value: unknown): EntityTypeCategory | null {
  return typeof value === "string" && ENTITY_TYPE_CATEGORIES.includes(value as EntityTypeCategory)
    ? value as EntityTypeCategory
    : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.issueType.findUnique({
    where: { id },
    include: issueTypeSchemaInclude,
  });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Entity type not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name;
  const key = typeof body.key === "string" && body.key.trim()
    ? normalizeKey(body.key)
    : existing.key ?? normalizeKey(name);
  const nextCategory = body.category === undefined ? existing.category : parseCategory(body.category);
  const nextFieldSchemaId = typeof body.fieldSchemaId === "string" && body.fieldSchemaId
    ? body.fieldSchemaId
    : existing.fieldSchemaId;
  const nextStatusSchemaId = body.statusSchemaId === undefined
    ? existing.statusSchemaId
    : typeof body.statusSchemaId === "string" && body.statusSchemaId.trim()
      ? body.statusSchemaId.trim()
      : null;
  const rawProjectIds = (body as { projectIds?: unknown }).projectIds;
  const normalizedProjectIds = Array.isArray(rawProjectIds)
    ? Array.from(new Set(rawProjectIds.filter((item: unknown): item is string => typeof item === "string")))
    : null;

  if (!nextCategory) {
    return NextResponse.json({ error: "Entity type category is required." }, { status: 400 });
  }

  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return NextResponse.json({ error: "Entity type keys must start with a letter and use lowercase letters, numbers, and underscores." }, { status: 400 });
  }

  const duplicate = await prisma.issueType.findFirst({
    where: {
      id: { not: id },
      OR: [{ key }, { name }],
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "That entity type key or name is already in use." }, { status: 409 });
  }

  if (nextCategory !== existing.category) {
    const [entityRecordCount, cycleCount] = await Promise.all([
      prisma.workItem.count({ where: { issueTypeId: id } }),
      prisma.cycle.count({ where: { issueTypeId: id } }),
    ]);
    if (entityRecordCount > 0 || cycleCount > 0) {
      return NextResponse.json({ error: "Cannot change category while records use this entity type." }, { status: 400 });
    }
  }

  const [nextFieldSchema, nextStatusSchema] = await Promise.all([
    prisma.fieldSchema.findUnique({
      where: { id: nextFieldSchemaId },
      include: {
        fields: {
          include: { field: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    nextStatusSchemaId
      ? prisma.statusSchema.findUnique({
          where: { id: nextStatusSchemaId },
          include: {
            statuses: {
              include: { status: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        })
      : null,
  ]);

  if (!nextFieldSchema || (nextStatusSchemaId && !nextStatusSchema)) {
    return NextResponse.json({ error: "Field schema or status schema not found." }, { status: 400 });
  }

  const nextFields = nextFieldSchema.fields.map((entry) => ({
    id: entry.field.id,
    name: entry.field.name,
    key: entry.field.key,
    type: entry.field.type,
    options: entry.field.options,
    referenceObjectKey: entry.field.referenceObjectKey,
    defaultValue: entry.field.defaultValue,
    isSystem: entry.field.isSystem,
    isRequired: resolveSchemaFieldRequired(entry.field.key, entry.isRequired, entry.field.isRequired),
  })) satisfies SchemaFieldDefinition[];

  try {
    await assertRequiredSchemaFieldsSatisfied(prisma, [id], nextFields);
    if (nextStatusSchema) {
      await assertStatusesAllowedForIssueTypes(
        prisma,
        [id],
        nextStatusSchema.statuses.map((entry) => entry.statusId),
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to validate the entity type." },
      { status: 400 },
    );
  }

  if (normalizedProjectIds) {
    const projects = await prisma.project.findMany({
      where: { id: { in: normalizedProjectIds } },
      include: {
        enabledIssueTypes: {
          select: { issueTypeId: true },
        },
      },
    });
    if (projects.length !== normalizedProjectIds.length) {
      return NextResponse.json({ error: "One or more projects were not found." }, { status: 400 });
    }

    const existingProjectIds = new Set(existing.projectLinks.map((link) => link.projectId));
    const nextProjectIds = new Set(normalizedProjectIds);
    const removedProjectIds = Array.from(existingProjectIds).filter((projectId) => !nextProjectIds.has(projectId));

    try {
      for (const projectId of removedProjectIds) {
        await assertProjectIssueTypeRemovalAllowed(prisma, projectId, [id]);
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to validate project links." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const entityType = await tx.issueType.update({
      where: { id },
      data: {
        key,
        name,
        category: nextCategory,
        icon: typeof body.icon === "string" ? body.icon.trim() || null : existing.icon,
        color: typeof body.color === "string" ? body.color.trim() || null : existing.color,
        fieldSchemaId: nextFieldSchemaId,
        statusSchemaId: nextStatusSchemaId,
      },
      include: issueTypeSchemaInclude,
    });

    if (normalizedProjectIds) {
      const existingProjectIds = new Set(existing.projectLinks.map((link) => link.projectId));
      const nextProjectIds = new Set(normalizedProjectIds);
      const removedProjectIds = Array.from(existingProjectIds).filter((projectId) => !nextProjectIds.has(projectId));
      const addedProjectIds = normalizedProjectIds.filter((projectId) => !existingProjectIds.has(projectId));

      if (removedProjectIds.length > 0) {
        await tx.projectIssueType.deleteMany({
          where: { issueTypeId: id, projectId: { in: removedProjectIds } },
        });
      }
      for (const projectId of addedProjectIds) {
        await tx.projectIssueType.create({ data: { projectId, issueTypeId: id } });
      }

      for (const projectId of removedProjectIds) {
        const project = await tx.project.findUnique({
          where: { id: projectId },
          include: {
            enabledIssueTypes: {
              include: { issueType: true },
              orderBy: { createdAt: "asc" },
            },
          },
        });
        if (!project || project.defaultIssueTypeId !== id) continue;

        const nextDefaultIssueType = pickDefaultIssueType(
          project.enabledIssueTypes
            .filter((link) => link.issueTypeId !== id)
            .map((link) => link.issueType),
        );
        await tx.project.update({
          where: { id: projectId },
          data: { defaultIssueTypeId: nextDefaultIssueType?.id ?? null },
        });
      }
    }

    return entityType;
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
  const [entityRecordCount, cycleCount, projectLinkCount, defaultProjectCount] = await Promise.all([
    prisma.workItem.count({ where: { issueTypeId: id } }),
    prisma.cycle.count({ where: { issueTypeId: id } }),
    prisma.projectIssueType.count({ where: { issueTypeId: id } }),
    prisma.project.count({ where: { defaultIssueTypeId: id } }),
  ]);

  if (entityRecordCount > 0 || cycleCount > 0 || projectLinkCount > 0 || defaultProjectCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete an entity type that is still in use." },
      { status: 400 },
    );
  }

  await prisma.issueType.update({ where: { id }, data: { deletedAt: new Date() } });
  return new NextResponse(null, { status: 204 });
}
