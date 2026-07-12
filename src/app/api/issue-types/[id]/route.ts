import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { issueTypeSchemaInclude, pickDefaultIssueType } from "@/lib/issue-type-config";
import { assertProjectIssueTypeRemovalAllowed, assertRequiredSchemaFieldsSatisfied, assertStatusesAllowedForIssueTypes } from "@/lib/schema-guards";
import { resolveSchemaFieldRequired } from "@/lib/field-schema";
import type { SchemaFieldDefinition } from "@/lib/work-item-schema";

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

  if (!existing) {
    return NextResponse.json({ error: "Issue type not found." }, { status: 404 });
  }

  const body = await request.json();
  const {
    name,
    icon,
    color,
    fieldSchemaId,
    statusSchemaId,
    projectIds,
  } = body as {
    name?: string;
    icon?: string | null;
    color?: string | null;
    fieldSchemaId?: string;
    statusSchemaId?: string;
    projectIds?: string[];
  };

  const nextFieldSchemaId = fieldSchemaId ?? existing.fieldSchemaId;
  const nextStatusSchemaId = statusSchemaId ?? existing.statusSchemaId;

  if (!nextStatusSchemaId) {
    return NextResponse.json({ error: "Status schema is required for work item issue types." }, { status: 400 });
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
    prisma.statusSchema.findUnique({
      where: { id: nextStatusSchemaId },
      include: {
        statuses: {
          include: { status: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
  ]);

  if (!nextFieldSchema || !nextStatusSchema) {
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
    await assertStatusesAllowedForIssueTypes(
      prisma,
      [id],
      nextStatusSchema.statuses.map((entry) => entry.statusId),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to validate the issue type." },
      { status: 400 },
    );
  }

  const normalizedProjectIds = projectIds ? Array.from(new Set(projectIds)) : null;
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

        const project = projects.find((candidate) => candidate.id === projectId)
          ?? await prisma.project.findUnique({
            where: { id: projectId },
            include: {
              enabledIssueTypes: {
                select: { issueTypeId: true },
              },
            },
          });

        if (!project) continue;

        const remainingCount = project.enabledIssueTypes.filter((link) => link.issueTypeId !== id).length;
        if (remainingCount === 0) {
          throw new Error("A project must keep at least one enabled issue type.");
        }
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to validate project links." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const issueType = await tx.issueType.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        icon: icon === undefined ? existing.icon : icon?.trim() || null,
        color: color === undefined ? existing.color : color?.trim() || null,
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
          where: {
            issueTypeId: id,
            projectId: { in: removedProjectIds },
          },
        });
      }

      for (const projectId of addedProjectIds) {
        await tx.projectIssueType.create({
          data: {
            projectId,
            issueTypeId: id,
          },
        });
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
          data: {
            defaultIssueTypeId: nextDefaultIssueType?.id ?? null,
          },
        });
      }
    }

    return issueType;
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
  const [workItemCount, projectLinkCount, defaultProjectCount] = await Promise.all([
    prisma.workItem.count({ where: { issueTypeId: id } }),
    prisma.projectIssueType.count({ where: { issueTypeId: id } }),
    prisma.project.count({ where: { defaultIssueTypeId: id } }),
  ]);

  if (workItemCount > 0 || projectLinkCount > 0 || defaultProjectCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete an issue type that is still in use." },
      { status: 400 },
    );
  }

  await prisma.issueType.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
