import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const CYCLE_ENTITY_RECORD_SOURCE = "cycle";

export function getCycleEntityRecordId(cycleId: string) {
  return `entity-record-cycle-${cycleId}`;
}

export async function resolveCycleEntityRecordId(client: DbClient, cycleIdOrEntityRecordId: string) {
  if (cycleIdOrEntityRecordId.startsWith("entity-record-cycle-")) return cycleIdOrEntityRecordId;
  const existing = await client.workItem.findFirst({
    where: {
      OR: [
        { id: cycleIdOrEntityRecordId, sourceTable: CYCLE_ENTITY_RECORD_SOURCE },
        { sourceTable: CYCLE_ENTITY_RECORD_SOURCE, sourceId: cycleIdOrEntityRecordId },
      ],
      deletedAt: null,
    },
    select: { id: true },
  });
  return existing?.id ?? getCycleEntityRecordId(cycleIdOrEntityRecordId);
}

async function resolveFallbackStatusId(client: DbClient, statusId: string | null | undefined) {
  if (statusId) return statusId;
  const status = await client.status.findFirst({
    where: { OR: [{ key: "cycle_open" }, { key: "open" }] },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  }) ?? await client.status.findFirst({ select: { id: true } });
  if (!status) throw new Error("CYCLE_ENTITY_RECORD_STATUS_MISSING");
  return status.id;
}

type CycleMirrorInput = {
  id: string;
  issueTypeId: string;
  name: string;
  statusId: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  scope: string;
  groupId: string | null;
  projectId: string | null;
  inheritByDefault: boolean;
  ownerId: string | null;
  creatorId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
};

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export async function upsertCycleEntityRecordMirror(
  client: Prisma.TransactionClient,
  cycle: CycleMirrorInput,
) {
  const entityRecordId = getCycleEntityRecordId(cycle.id);
  const statusId = await resolveFallbackStatusId(client, cycle.statusId);
  const startDate = toDate(cycle.startDate);
  const endDate = toDate(cycle.endDate);
  const createdAt = toDate(cycle.createdAt) ?? new Date();
  const updatedAt = toDate(cycle.updatedAt) ?? new Date();
  const deletedAt = toDate(cycle.deletedAt);
  const existingRecord = await client.workItem.findFirst({
    where: {
      OR: [
        { id: entityRecordId },
        { sourceTable: CYCLE_ENTITY_RECORD_SOURCE, sourceId: cycle.id },
      ],
    },
    select: { id: true },
  });
  const recordId = existingRecord?.id ?? entityRecordId;

  if (existingRecord) {
    await client.workItem.update({
      where: { id: recordId },
      data: {
        issueKey: `CYCLE-${cycle.id}`,
        title: cycle.name,
        startDate,
        dueDate: endDate,
        issueTypeId: cycle.issueTypeId,
        statusId,
        projectId: cycle.projectId,
        creatorId: cycle.creatorId,
        assigneeId: cycle.ownerId,
        sourceTable: CYCLE_ENTITY_RECORD_SOURCE,
        sourceId: cycle.id,
        deletedAt,
        updatedAt,
      },
    });
  } else {
    await client.workItem.create({
      data: {
        id: recordId,
        issueKey: `CYCLE-${cycle.id}`,
        title: cycle.name,
        description: null,
        descriptionMentions: "[]",
        startDate,
        dueDate: endDate,
        issueTypeId: cycle.issueTypeId,
        statusId,
        projectId: cycle.projectId,
        creatorId: cycle.creatorId,
        assigneeId: cycle.ownerId,
        sourceTable: CYCLE_ENTITY_RECORD_SOURCE,
        sourceId: cycle.id,
        createdAt,
        updatedAt,
        deletedAt,
      },
    });
  }

  await client.cycleRecordMeta.upsert({
    where: { entityRecordId: recordId },
    update: {
      scope: cycle.scope,
      groupId: cycle.groupId,
      projectId: cycle.projectId,
      inheritByDefault: cycle.inheritByDefault,
      ownerId: cycle.ownerId,
    },
    create: {
      entityRecordId: recordId,
      scope: cycle.scope,
      groupId: cycle.groupId,
      projectId: cycle.projectId,
      inheritByDefault: cycle.inheritByDefault,
      ownerId: cycle.ownerId,
    },
  });
}

export async function softDeleteCycleEntityRecordMirror(
  client: Prisma.TransactionClient,
  cycleId: string,
  deletedAt: Date,
) {
  await client.workItem.updateMany({
    where: {
      OR: [
        { id: getCycleEntityRecordId(cycleId) },
        { sourceTable: CYCLE_ENTITY_RECORD_SOURCE, sourceId: cycleId },
      ],
    },
    data: { deletedAt },
  });
}
