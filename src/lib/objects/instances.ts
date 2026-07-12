import type { Prisma } from "@/generated/prisma/client";
import { isAdminUser } from "@/lib/admin-access";
import { prisma } from "@/lib/db";
import { listCyclesForProject } from "@/lib/cycle/service";
import { CYCLE_OBJECT_TYPE, WORK_ITEM_OBJECT_TYPE } from "@/lib/objects/field-value";
import { scopedWorkItemWhere } from "@/lib/work-item-query";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface ObjectInstanceOption {
  value: string;
  label: string;
  color?: string | null;
}

export interface ObjectInstanceContext {
  user?: {
    id?: string | null;
    role?: string | null;
    email?: string | null;
  } | null;
  project?: {
    id: string;
    key: string;
    name: string;
    isPersonal: boolean;
    ownerId: string | null;
  } | null;
  group?: {
    id: string;
    slug: string;
    name: string;
    ownerId: string;
  } | null;
  q?: string;
  limit?: number;
}

function containsQuery(q: string, fields: string[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field.toLowerCase().includes(needle));
}

async function listAccessibleProjectIds(client: DbClient, user: ObjectInstanceContext["user"]) {
  const userId = user?.id ?? "";
  if (isAdminUser(user ?? undefined)) {
    const projects = await client.project.findMany({ select: { id: true } });
    return projects.map((project) => project.id);
  }
  if (!userId) return [];

  const [memberships, ownedProjects] = await Promise.all([
    client.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
    client.project.findMany({ where: { ownerId: userId }, select: { id: true } }),
  ]);

  return Array.from(new Set([
    ...memberships.map((membership) => membership.projectId),
    ...ownedProjects.map((project) => project.id),
  ]));
}

async function listContextProjectIds(client: DbClient, context: ObjectInstanceContext) {
  if (context.project) return [context.project.id];
  if (context.group) {
    const projects = await client.project.findMany({
      where: { groupId: context.group.id },
      select: { id: true },
    });
    return projects.map((project) => project.id);
  }
  return listAccessibleProjectIds(client, context.user);
}

export async function listObjectInstances(
  client: DbClient,
  objectTypeKey: string,
  context: ObjectInstanceContext,
): Promise<ObjectInstanceOption[]> {
  const q = context.q?.trim() ?? "";
  const requestedLimit = context.limit ?? 20;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50)
    : 20;

  if (objectTypeKey === "user") {
    if (context.project?.isPersonal) {
      const owner = context.project.ownerId
        ? await client.user.findUnique({
            where: { id: context.project.ownerId },
            select: { id: true, name: true, email: true },
          })
        : null;
      return owner && containsQuery(q, [owner.name, owner.email])
        ? [{ value: owner.id, label: `${owner.name} (${owner.email})` }]
        : [];
    }

    if (context.project) {
      const members = await client.projectMember.findMany({
        where: {
          projectId: context.project.id,
          ...(q
            ? {
                OR: [
                  { user: { name: { contains: q } } },
                  { user: { email: { contains: q } } },
                ],
              }
            : {}),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      return members.map((member) => ({
        value: member.user.id,
        label: `${member.user.name} (${member.user.email})`,
      }));
    }

    if (context.group) {
      const members = await client.projectGroupMember.findMany({
        where: {
          groupId: context.group.id,
          ...(q
            ? {
                OR: [
                  { user: { name: { contains: q } } },
                  { user: { email: { contains: q } } },
                ],
              }
            : {}),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
        take: limit,
        orderBy: { createdAt: "asc" },
      });
      const options = members.map((member) => ({
        value: member.user.id,
        label: `${member.user.name} (${member.user.email})`,
      }));
      if (!options.some((option) => option.value === context.group?.ownerId)) {
        const owner = await client.user.findUnique({
          where: { id: context.group.ownerId },
          select: { id: true, name: true, email: true },
        });
        if (owner && containsQuery(q, [owner.name, owner.email])) {
          options.unshift({ value: owner.id, label: `${owner.name} (${owner.email})` });
        }
      }
      return options.slice(0, limit);
    }

    const currentUserId = context.user?.id ?? "";
    const isAdmin = isAdminUser(context.user ?? undefined);
    if (!currentUserId && !isAdmin) return [];
    const users = await client.user.findMany({
      where: {
        ...(isAdmin ? {} : { id: currentUserId }),
        ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
      },
      select: { id: true, name: true, email: true },
      take: limit,
      orderBy: { name: "asc" },
    });
    return users.map((user) => ({ value: user.id, label: `${user.name} (${user.email})` }));
  }

  if (objectTypeKey === "project") {
    const projectIds = await listContextProjectIds(client, context);
    if (projectIds.length === 0) return [];

    const projects = await client.project.findMany({
      where: {
        id: { in: projectIds },
        ...(q ? { OR: [{ name: { contains: q } }, { key: { contains: q } }] } : {}),
      },
      select: { id: true, key: true, name: true },
      take: limit,
      orderBy: { name: "asc" },
    });
    return projects.map((project) => ({ value: project.id, label: `${project.key} ${project.name}` }));
  }

  if (objectTypeKey === WORK_ITEM_OBJECT_TYPE) {
    const projectIds = await listContextProjectIds(client, context);
    if (projectIds.length === 0) return [];

    const workItems = await client.workItem.findMany({
      where: scopedWorkItemWhere({
        projectId: { in: projectIds },
        deletedAt: null,
        ...(q ? { OR: [{ title: { contains: q } }, { issueKey: { contains: q } }] } : {}),
      }),
      select: { id: true, issueKey: true, title: true, status: { select: { color: true } } },
      take: limit,
      orderBy: { updatedAt: "desc" },
    });
    return workItems.map((workItem) => ({
      value: workItem.id,
      label: `[${workItem.issueKey}] ${workItem.title}`,
      color: workItem.status.color,
    }));
  }

  if (objectTypeKey === CYCLE_OBJECT_TYPE) {
    if (context.group && !context.project) {
      const cycles = await client.cycle.findMany({
        where: {
          deletedAt: null,
          AND: [
            {
              OR: [
                { scope: "GROUP", groupId: context.group.id },
                { scope: "PROJECT", project: { groupId: context.group.id } },
              ],
            },
            ...(q ? [{ OR: [{ name: { contains: q } }, { status: { name: { contains: q } } }] }] : []),
          ],
        },
        select: { id: true, name: true, status: { select: { name: true, color: true } } },
        take: limit,
        orderBy: { updatedAt: "desc" },
      });
      return cycles.map((cycle) => ({
        value: cycle.id,
        label: cycle.name,
        color: cycle.status?.color ?? null,
      }));
    }
    if (!context.project) return [];
    const cycles = await listCyclesForProject(client, context.project.id);
    return cycles
      .filter((cycle) => containsQuery(q, [cycle.name, cycle.status?.name ?? ""]))
      .slice(0, limit)
      .map((cycle) => ({ value: cycle.id, label: cycle.name, color: cycle.status?.color ?? null }));
  }

  return [];
}
