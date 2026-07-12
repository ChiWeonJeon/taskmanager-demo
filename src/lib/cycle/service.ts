import type { Prisma } from "@/generated/prisma/client";
import { attachCycleFieldValues, type CycleFieldValue } from "@/lib/cycle/field-values";
import { prisma } from "@/lib/db";
import { toDateInputValue } from "@/lib/date";
import { getCycleIssueTypeWithSchema, issueTypeSchemaInclude } from "@/lib/issue-type-config";
import { CYCLE_OBJECT_TYPE } from "@/lib/objects/field-value";

type DbClient = Prisma.TransactionClient | typeof prisma;

const USER_SELECT = { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } as const;

export const CYCLE_INCLUDE = {
  issueType: { include: issueTypeSchemaInclude },
  status: true,
  owner: { select: USER_SELECT },
  creator: { select: USER_SELECT },
  updatedBy: { select: USER_SELECT },
  project: { select: { id: true, key: true, name: true } },
  group: { select: { id: true, slug: true, name: true } },
  comments: {
    include: { author: { select: USER_SELECT } },
    orderBy: { createdAt: "desc" as const },
    take: 20,
  },
  histories: {
    include: { actor: { select: USER_SELECT } },
    orderBy: { createdAt: "desc" as const },
    take: 20,
  },
  watchers: {
    include: { user: { select: USER_SELECT }, addedBy: { select: USER_SELECT } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.CycleInclude;

export type CycleWithRelations = Prisma.CycleGetPayload<{ include: typeof CYCLE_INCLUDE }>;
type CycleWithFieldValues = CycleWithRelations & { fieldValues?: CycleFieldValue[] };

export interface CycleInput {
  name?: unknown;
  statusId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  ownerId?: unknown;
  issueTypeId?: unknown;
  inheritByDefault?: unknown;
}

export function parseCycleDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("INVALID_DATE");
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_DATE");
  return date;
}

export async function resolveCycleTypeDefaults(client: DbClient, preferredIssueTypeId?: string | null) {
  const issueType = await getCycleIssueTypeWithSchema(client, preferredIssueTypeId);
  if (!issueType) throw new Error("CYCLE_ISSUE_TYPE_MISSING");
  if (!issueType.statusSchema) throw new Error("CYCLE_STATUS_SCHEMA_MISSING");
  const statusId = issueType.statusSchema.startStatusId ?? issueType.statusSchema.statuses[0]?.statusId ?? null;
  return { issueType: { ...issueType, statusSchema: issueType.statusSchema }, statusId };
}

export function serializeCycle(cycle: CycleWithFieldValues, inherited = false) {
  return {
    id: cycle.id,
    objectType: CYCLE_OBJECT_TYPE,
    issueTypeId: cycle.issueTypeId,
    issueType: cycle.issueType,
    scope: cycle.scope,
    groupId: cycle.groupId,
    projectId: cycle.projectId,
    name: cycle.name,
    statusId: cycle.statusId,
    status: cycle.status,
    startDate: cycle.startDate ? toDateInputValue(cycle.startDate) : null,
    endDate: cycle.endDate ? toDateInputValue(cycle.endDate) : null,
    inheritByDefault: cycle.inheritByDefault,
    inherited,
    ownerId: cycle.ownerId,
    owner: cycle.owner,
    creator: cycle.creator,
    updatedBy: cycle.updatedBy,
    project: cycle.project,
    group: cycle.group,
    comments: cycle.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      mentions: comment.mentions,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
    })),
    histories: cycle.histories.map((history) => ({
      id: history.id,
      field: history.field,
      before: history.before,
      after: history.after,
      createdAt: history.createdAt.toISOString(),
      actor: history.actor,
    })),
    watchers: cycle.watchers.map((watcher) => ({
      id: watcher.id,
      source: watcher.source,
      createdAt: watcher.createdAt.toISOString(),
      user: watcher.user,
      addedBy: watcher.addedBy,
    })),
    fieldValues: cycle.fieldValues ?? [],
    createdAt: cycle.createdAt.toISOString(),
    updatedAt: cycle.updatedAt.toISOString(),
    deletedAt: cycle.deletedAt?.toISOString() ?? null,
  };
}

function inheritedGroupCycleWhere(projectId: string, groupId: string): Prisma.CycleWhereInput {
  return {
    scope: "GROUP",
    groupId,
    deletedAt: null,
    OR: [
      { inheritance: { some: { projectId, enabled: true } } },
      { inheritByDefault: true, inheritance: { none: { projectId, enabled: false } } },
    ],
  };
}

export async function listCyclesForProject(client: DbClient, projectId: string) {
  const project = await client.project.findUnique({ where: { id: projectId }, select: { groupId: true } });
  const where: Prisma.CycleWhereInput = {
    OR: [
      { scope: "PROJECT", projectId, deletedAt: null },
      ...(project?.groupId ? [inheritedGroupCycleWhere(projectId, project.groupId)] : []),
    ],
  };

  const rows = await client.cycle.findMany({
    where,
    include: CYCLE_INCLUDE,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  const cycles = await attachCycleFieldValues(client, rows);
  return cycles.map((cycle) => serializeCycle(cycle, cycle.scope === "GROUP"));
}

export async function findCycleForProject(client: DbClient, projectId: string, cycleId: string) {
  const project = await client.project.findUnique({ where: { id: projectId }, select: { groupId: true } });
  const cycle = await client.cycle.findFirst({
    where: {
      id: cycleId,
      deletedAt: null,
      OR: [
        { scope: "PROJECT", projectId },
        ...(project?.groupId ? [inheritedGroupCycleWhere(projectId, project.groupId)] : []),
      ],
    },
    include: CYCLE_INCLUDE,
  });
  if (!cycle) return null;
  const [cycleWithFieldValues] = await attachCycleFieldValues(client, [cycle]);
  return serializeCycle(cycleWithFieldValues, cycle.scope === "GROUP");
}

export async function listCyclesForGroup(client: DbClient, groupId: string) {
  const rows = await client.cycle.findMany({
    where: { scope: "GROUP", groupId, deletedAt: null },
    include: CYCLE_INCLUDE,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  const cycles = await attachCycleFieldValues(client, rows);
  return cycles.map((cycle) => serializeCycle(cycle));
}

export async function getCycleProjectInheritance(client: DbClient, cycleId: string, groupId: string) {
  const projects = await client.project.findMany({
    where: { groupId },
    select: { id: true, key: true, name: true },
    orderBy: { sortOrderInGroup: "asc" },
  });
  const overrides = await client.cycleProjectInheritance.findMany({
    where: { cycleId, projectId: { in: projects.map((project) => project.id) } },
  });
  const byProjectId = new Map(overrides.map((entry) => [entry.projectId, entry.enabled]));
  const cycle = await client.cycle.findUnique({ where: { id: cycleId }, select: { inheritByDefault: true } });
  return projects.map((project) => ({
    project,
    enabled: byProjectId.get(project.id) ?? Boolean(cycle?.inheritByDefault),
  }));
}
