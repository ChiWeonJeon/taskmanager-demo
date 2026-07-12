import type { Prisma } from "@/generated/prisma/client";
import { isAdminUser } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { listCyclesForProject } from "@/lib/cycle/service";
import {
  CYCLE_OBJECT_TYPE,
  deleteFieldValues,
  WORK_ITEM_OBJECT_TYPE,
} from "@/lib/objects/field-value";
import {
  type ObjectInstanceContext,
  listObjectInstances,
} from "@/lib/objects/instances";
import { objectRegistry, type ObjectDescriptor } from "@/lib/objects/registry";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface ServerObjectDescriptor extends ObjectDescriptor<never> {
  listInstances: (client: DbClient, context: ObjectInstanceContext) => Promise<{ value: string; label: string; color?: string | null }[]>;
  validateReference: (client: DbClient, id: string, context: ObjectInstanceContext) => Promise<boolean>;
  onDelete?: (client: Prisma.TransactionClient, objectId: string) => Promise<void>;
}

async function hasProjectAccess(client: DbClient, projectId: string, context: ObjectInstanceContext) {
  if (context.project?.id === projectId) return true;
  if (context.group) {
    return (await client.project.count({ where: { id: projectId, groupId: context.group.id } })) > 0;
  }
  if (isAdminUser(context.user ?? undefined)) return true;
  const userId = context.user?.id ?? "";
  if (!userId) return false;

  const project = await client.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(project);
}

export const serverObjectRegistry: Record<string, ServerObjectDescriptor> = {
  [WORK_ITEM_OBJECT_TYPE]: {
    ...objectRegistry[WORK_ITEM_OBJECT_TYPE],
    listInstances: (client, context) => listObjectInstances(client, WORK_ITEM_OBJECT_TYPE, context),
    validateReference: async (client, id, context) => {
      const where: Prisma.WorkItemWhereInput = { id, deletedAt: null };
      if (context.project) where.projectId = context.project.id;
      else if (context.group) where.project = { groupId: context.group.id };
      else if (!isAdminUser(context.user ?? undefined)) {
        const userId = context.user?.id ?? "";
        if (!userId) return false;
        where.project = {
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
          ],
        };
      }
      return (await client.workItem.count({ where })) > 0;
    },
    onDelete: (client, objectId) => deleteFieldValues(client, WORK_ITEM_OBJECT_TYPE, objectId),
  },
  user: {
    ...objectRegistry.user,
    listInstances: (client, context) => listObjectInstances(client, "user", context),
    validateReference: async (client, id, context) => {
      if (context.project?.isPersonal) return context.project.ownerId === id;
      if (context.project) {
        const [member, owned] = await Promise.all([
          client.projectMember.count({ where: { projectId: context.project.id, userId: id } }),
          client.project.count({ where: { id: context.project.id, ownerId: id } }),
        ]);
        return member > 0 || owned > 0;
      }
      if (context.group) {
        const [member, owned] = await Promise.all([
          client.projectGroupMember.count({ where: { groupId: context.group.id, userId: id } }),
          client.projectGroup.count({ where: { id: context.group.id, ownerId: id } }),
        ]);
        return member > 0 || owned > 0;
      }
      return isAdminUser(context.user ?? undefined) || context.user?.id === id;
    },
  },
  project: {
    ...objectRegistry.project,
    listInstances: (client, context) => listObjectInstances(client, "project", context),
    validateReference: hasProjectAccess,
  },
  [CYCLE_OBJECT_TYPE]: {
    ...objectRegistry[CYCLE_OBJECT_TYPE],
    listInstances: (client, context) => listObjectInstances(client, CYCLE_OBJECT_TYPE, context),
    validateReference: async (client, id, context) => {
      if (context.group && !context.project) {
        return (await client.cycle.count({
          where: {
            id,
            deletedAt: null,
            OR: [
              { scope: "GROUP", groupId: context.group.id },
              { scope: "PROJECT", project: { groupId: context.group.id } },
            ],
          },
        })) > 0;
      }
      if (!context.project) return false;
      const cycles = await listCyclesForProject(client, context.project.id);
      return cycles.some((cycle) => cycle.id === id);
    },
    onDelete: (client, objectId) => deleteFieldValues(client, CYCLE_OBJECT_TYPE, objectId),
  },
};

export function getServerObjectDescriptor(key: string) {
  return serverObjectRegistry[key] ?? null;
}
