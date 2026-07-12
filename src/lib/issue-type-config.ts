import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { resolveSchemaFieldRequired } from "@/lib/field-schema";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const ENTITY_TYPE_CATEGORIES = ["ISSUE", "CYCLE"] as const;
export type EntityTypeCategory = (typeof ENTITY_TYPE_CATEGORIES)[number];
export const ISSUE_ENTITY_CATEGORY = "ISSUE" satisfies EntityTypeCategory;
export const CYCLE_ENTITY_CATEGORY = "CYCLE" satisfies EntityTypeCategory;

export const workItemIssueTypeWhere = {
  deletedAt: null,
  category: ISSUE_ENTITY_CATEGORY,
} satisfies Prisma.IssueTypeWhereInput;

export interface ParsedFieldOption {
  value: string;
  label: string;
  color?: string | null;
}

export const issueTypeSchemaInclude = {
  fieldSchema: {
    include: {
      fields: {
        include: {
          field: true,
        },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
  statusSchema: {
    include: {
      startStatus: true,
      statuses: {
        include: {
          status: true,
        },
        orderBy: { sortOrder: "asc" as const },
      },
      transitions: {
        select: { fromStatusId: true, toStatusId: true },
      },
    },
  },
  projectLinks: {
    select: {
      projectId: true,
    },
  },
  _count: {
    select: {
      workItems: true,
      cycles: true,
    },
  },
} satisfies Prisma.IssueTypeInclude;

export type IssueTypeWithSchemas = Prisma.IssueTypeGetPayload<{
  include: typeof issueTypeSchemaInclude;
}>;

export interface ResolvedProjectUnionField {
  id: string;
  name: string;
  key: string;
  type: string;
  options: string | null;
  referenceObjectKey: string | null;
  defaultValue: string | null;
  isSystem: boolean;
  issueTypeIds: string[];
  requiredIssueTypeIds: string[];
}

export interface ResolvedProjectUnionStatus {
  id: string;
  name: string;
  key: string;
  color: string;
  category: string;
  issueTypeIds: string[];
}

export interface ResolvedProjectConfig {
  project: {
    id: string;
    key: string;
    name: string;
    isPersonal: boolean;
  };
  defaultIssueTypeId: string | null;
  enabledIssueTypes: IssueTypeWithSchemas[];
  unionFields: ResolvedProjectUnionField[];
  unionStatuses: ResolvedProjectUnionStatus[];
  perTypeAllowedStatuses: Record<string, string[]>;
  perTypeTransitions: Record<string, { fromStatusId: string; toStatusId: string }[]>;
}

export function parseFieldOptions(rawOptions: string | null) {
  if (!rawOptions) return [] as ParsedFieldOption[];

  try {
    const parsed = JSON.parse(rawOptions) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is ParsedFieldOption => (
      typeof item === "object"
      && item !== null
      && typeof (item as ParsedFieldOption).value === "string"
      && typeof (item as ParsedFieldOption).label === "string"
    ));
  } catch {
    return [];
  }
}

export function parseStoredValue(rawValue: string | null | undefined) {
  if (rawValue == null) return null;

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return rawValue;
  }
}

export function hasInputValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "number") return true;
  return typeof value === "string" && value.trim().length > 0;
}

export function isOptionFieldType(type: string) {
  return type === "SELECT" || type === "MULTI_SELECT";
}

export function pickDefaultIssueType<T extends { id: string }>(
  issueTypes: T[],
  preferredId?: string | null,
) {
  if (preferredId) {
    const preferred = issueTypes.find((issueType) => issueType.id === preferredId);
    if (preferred) return preferred;
  }

  return issueTypes[0] ?? null;
}

export async function listIssueTypesWithSchemas(client: DbClient = prisma) {
  return client.issueType.findMany({
    where: workItemIssueTypeWhere,
    include: issueTypeSchemaInclude,
    orderBy: { createdAt: "asc" },
  });
}

export async function listProjectIssueTypesWithSchemas(
  client: DbClient,
  projectId: string,
) {
  const links = await client.projectIssueType.findMany({
    where: { projectId, issueType: workItemIssueTypeWhere },
    include: {
      issueType: {
        include: issueTypeSchemaInclude,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const issueTypes = links.length > 0
    ? links.map((link) => link.issueType)
    : await listIssueTypesWithSchemas(client);

  return issueTypes.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
}

export async function listAllIssueTypeIds(client: DbClient = prisma) {
  const issueTypes = await client.issueType.findMany({
    where: workItemIssueTypeWhere,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return issueTypes.map((issueType) => issueType.id);
}

export async function syncProjectIssueTypeLinks(
  client: DbClient,
  projectId: string,
  issueTypeIds: string[],
) {
  const uniqueIssueTypeIds = Array.from(new Set(issueTypeIds));
  const existing = await client.projectIssueType.findMany({
    where: { projectId },
    select: { issueTypeId: true },
  });

  const existingIds = new Set(existing.map((entry) => entry.issueTypeId));
  const desiredIds = new Set(uniqueIssueTypeIds);

  const issueTypeIdsToDelete = existing
    .map((entry) => entry.issueTypeId)
    .filter((issueTypeId) => !desiredIds.has(issueTypeId));

  if (issueTypeIdsToDelete.length > 0) {
    await client.projectIssueType.deleteMany({
      where: {
        projectId,
        issueTypeId: { in: issueTypeIdsToDelete },
      },
    });
  }

  for (const issueTypeId of uniqueIssueTypeIds) {
    if (existingIds.has(issueTypeId)) continue;

    await client.projectIssueType.create({
      data: {
        projectId,
        issueTypeId,
      },
    });
  }
}

export async function ensureProjectHasAllIssueTypes(client: DbClient, projectId: string) {
  const issueTypeIds = await listAllIssueTypeIds(client);
  await syncProjectIssueTypeLinks(client, projectId, issueTypeIds);
  return issueTypeIds;
}

export async function resolveProjectConfig(projectIdOrKey: string, client: DbClient = prisma) {
  const project = await client.project.findFirst({
    where: {
      OR: [
        { id: projectIdOrKey },
        { key: projectIdOrKey },
      ],
    },
    select: {
      id: true,
      key: true,
      name: true,
      isPersonal: true,
      defaultIssueTypeId: true,
      enabledIssueTypes: {
        where: { issueType: workItemIssueTypeWhere },
        include: {
          issueType: {
            include: issueTypeSchemaInclude,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!project) return null;

  const enabledIssueTypes = (
    project.enabledIssueTypes.length > 0
      ? project.enabledIssueTypes.map((link) => link.issueType)
      : await listIssueTypesWithSchemas(client)
  ).sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  const defaultIssueType = pickDefaultIssueType(enabledIssueTypes, project.defaultIssueTypeId);
  const orderedIssueTypes = defaultIssueType
    ? [defaultIssueType, ...enabledIssueTypes.filter((issueType) => issueType.id !== defaultIssueType.id)]
    : enabledIssueTypes;

  const unionFields = [] as ResolvedProjectUnionField[];
  const fieldMap = new Map<string, ResolvedProjectUnionField>();
  const unionStatuses = [] as ResolvedProjectUnionStatus[];
  const statusMap = new Map<string, ResolvedProjectUnionStatus>();
  const perTypeAllowedStatuses = {} as Record<string, string[]>;
  const perTypeTransitions = {} as Record<string, { fromStatusId: string; toStatusId: string }[]>;

  for (const issueType of orderedIssueTypes) {
    const statusSchema = issueType.statusSchema;
    const allowedStatusIds = statusSchema?.statuses.map((entry) => entry.status.id) ?? [];
    perTypeAllowedStatuses[issueType.id] = allowedStatusIds;
    perTypeTransitions[issueType.id] = statusSchema?.transitions.map((transition) => ({
      fromStatusId: transition.fromStatusId,
      toStatusId: transition.toStatusId,
    })) ?? [];

    for (const fieldEntry of issueType.fieldSchema.fields) {
      const existingField = fieldMap.get(fieldEntry.fieldId);
      const fieldRequired = resolveSchemaFieldRequired(
        fieldEntry.field.key,
        fieldEntry.isRequired,
        fieldEntry.field.isRequired,
      );

      if (!existingField) {
        const nextField: ResolvedProjectUnionField = {
          id: fieldEntry.field.id,
          name: fieldEntry.field.name,
          key: fieldEntry.field.key,
          type: fieldEntry.field.type,
          options: fieldEntry.field.options,
          referenceObjectKey: fieldEntry.field.referenceObjectKey,
          defaultValue: fieldEntry.field.defaultValue,
          isSystem: fieldEntry.field.isSystem,
          issueTypeIds: [issueType.id],
          requiredIssueTypeIds: fieldRequired ? [issueType.id] : [],
        };

        fieldMap.set(nextField.id, nextField);
        unionFields.push(nextField);
      } else {
        if (!existingField.issueTypeIds.includes(issueType.id)) {
          existingField.issueTypeIds.push(issueType.id);
        }
        if (fieldRequired && !existingField.requiredIssueTypeIds.includes(issueType.id)) {
          existingField.requiredIssueTypeIds.push(issueType.id);
        }
      }
    }

    for (const statusEntry of statusSchema?.statuses ?? []) {
      const existingStatus = statusMap.get(statusEntry.statusId);

      if (!existingStatus) {
        const nextStatus: ResolvedProjectUnionStatus = {
          id: statusEntry.status.id,
          name: statusEntry.status.name,
          key: statusEntry.status.key,
          color: statusEntry.status.color,
          category: statusEntry.status.category,
          issueTypeIds: [issueType.id],
        };

        statusMap.set(nextStatus.id, nextStatus);
        unionStatuses.push(nextStatus);
      } else if (!existingStatus.issueTypeIds.includes(issueType.id)) {
        existingStatus.issueTypeIds.push(issueType.id);
      }
    }
  }

  return {
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
      isPersonal: project.isPersonal,
    },
    defaultIssueTypeId: defaultIssueType?.id ?? null,
    enabledIssueTypes,
    unionFields,
    unionStatuses,
    perTypeAllowedStatuses,
    perTypeTransitions,
  } satisfies ResolvedProjectConfig;
}


export async function getCycleIssueTypeWithSchema(
  client: DbClient = prisma,
  preferredId?: string | null,
) {
  if (preferredId) {
    const preferred = await client.issueType.findFirst({
      where: {
        id: preferredId,
        category: CYCLE_ENTITY_CATEGORY,
      },
      include: issueTypeSchemaInclude,
    });
    if (preferred) return preferred;
  }

  return client.issueType.findFirst({
    where: { category: CYCLE_ENTITY_CATEGORY, deletedAt: null },
    include: issueTypeSchemaInclude,
    orderBy: { createdAt: "asc" },
  });
}
