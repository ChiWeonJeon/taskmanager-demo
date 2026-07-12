import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ISSUE_ENTITY_CATEGORY } from "@/lib/issue-type-config";
import { WORK_ITEM_OBJECT_TYPE, withFieldValues } from "@/lib/objects/field-value";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const WORK_ITEM_RECORD_SOURCE = "work_item";

export const workItemRecordScopeWhere = {
  issueType: { category: ISSUE_ENTITY_CATEGORY },
  OR: [{ sourceTable: null }, { sourceTable: WORK_ITEM_RECORD_SOURCE }],
} satisfies Prisma.WorkItemWhereInput;

export function scopedWorkItemWhere(where: Prisma.WorkItemWhereInput = {}) {
  return {
    AND: [workItemRecordScopeWhere, where],
  } satisfies Prisma.WorkItemWhereInput;
}

export const workItemSummarySelect = {
  id: true,
  issueKey: true,
  title: true,
  description: true,
  startDate: true,
  dueDate: true,
  statusId: true,
  issueTypeId: true,
  projectId: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  status: true,
  issueType: true,
  project: true,
  parent: { select: { id: true, issueKey: true, title: true, projectId: true } },
  creator: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
  assignee: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.WorkItemSelect;

export const workItemDetailInclude = {
  status: true,
  issueType: true,
  project: true,
  parent: { select: { id: true, issueKey: true, title: true, projectId: true } },
  creator: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
  assignee: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
  comments: {
    include: { author: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  },
  histories: {
    include: { actor: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  },
} satisfies Prisma.WorkItemInclude;

type WorkItemSummaryPayload = Prisma.WorkItemGetPayload<{ select: typeof workItemSummarySelect }>;

export async function attachWorkItemFieldValues<T extends { id: string }>(
  client: DbClient,
  items: T[],
) {
  return withFieldValues(client, WORK_ITEM_OBJECT_TYPE, items);
}

export async function serializeWorkItemSummaries(client: DbClient, items: WorkItemSummaryPayload[]) {
  const itemsWithFieldValues = await attachWorkItemFieldValues(client, items);
  return itemsWithFieldValues.map((item) => ({
    ...item,
    commentCount: item._count.comments,
    comments: [],
    histories: [],
  }));
}

export async function attachWorkItemFieldValuesToDetail<T extends { id: string }>(
  client: DbClient,
  item: T,
) {
  return (await attachWorkItemFieldValues(client, [item]))[0];
}
