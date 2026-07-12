import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { logApiError } from "@/lib/api-logger";
import { isAdminUser } from "@/lib/admin-access";
import {
  serializeWorkItemSummaries,
  workItemSummarySelect,
} from "@/lib/work-item-query";
import { getCycleEntityRecordId } from "@/lib/cycle/entity-record";
import { canReadCycle } from "@/lib/cycle/permissions";
import { listCyclesForGroup, listCyclesForProject } from "@/lib/cycle/service";
import { getGroupAccess, hasGroupAccess, resolveGroupByIdOrSlug } from "@/lib/group-permissions";
import { getProjectAccess } from "@/lib/project-permissions";
export { POST } from "@/app/api/work-items/route";

function canonicalizeRecord<T extends { issueKey?: string; issueTypeId?: string }>(record: T) {
  return {
    ...record,
    recordKey: record.issueKey,
    entityTypeId: record.issueTypeId,
  };
}

async function listAccessibleCycleRecords(user: NonNullable<Awaited<ReturnType<typeof requireAuth>>["user"]>) {
  const userId = user.id ?? "";
  const projectRefs = isAdminUser(user)
    ? await prisma.project.findMany({ select: { id: true } })
    : [
        ...(await prisma.project.findMany({ where: { ownerId: userId }, select: { id: true } })),
        ...(await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }))
          .map((row) => ({ id: row.projectId })),
      ];

  type CycleRecord = Awaited<ReturnType<typeof listCyclesForProject>>[number];
  const cyclesById = new Map<string, CycleRecord>();

  for (const projectId of Array.from(new Set(projectRefs.map((project) => project.id)))) {
    const access = await getProjectAccess(projectId, user);
    if (!canReadCycle(access) || !access.project) continue;
    const cycles = await listCyclesForProject(prisma, access.project.id);
    for (const cycle of cycles) if (!cyclesById.has(cycle.id)) cyclesById.set(cycle.id, cycle);
  }

  const groupRefs = isAdminUser(user)
    ? await prisma.projectGroup.findMany({ select: { id: true } })
    : [
        ...(await prisma.projectGroup.findMany({ where: { ownerId: userId }, select: { id: true } })),
        ...(await prisma.projectGroupMember.findMany({ where: { userId }, select: { groupId: true } }))
          .map((row) => ({ id: row.groupId })),
      ];

  for (const groupId of Array.from(new Set(groupRefs.map((group) => group.id)))) {
    const access = await getGroupAccess(groupId, user);
    if (!hasGroupAccess(access) || !access.group) continue;
    const cycles = await listCyclesForGroup(prisma, access.group.id);
    for (const cycle of cycles) if (!cyclesById.has(cycle.id)) cyclesById.set(cycle.id, cycle);
  }

  return Array.from(cyclesById.values());
}

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const projectId = searchParams.get("projectId");
  const groupId = searchParams.get("groupId");
  const fieldsParam = searchParams.get("fields");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 200);

  const where: Prisma.WorkItemWhereInput = { deletedAt: null };
  if (projectId) where.projectId = projectId;
  if (type) {
    where.issueType = {
      OR: [
        { key: type },
        { category: type.toUpperCase() },
      ],
    };
  }

  try {
    if (type === "cycle") {
      const group = groupId ? await resolveGroupByIdOrSlug(groupId) : null;
      const cycles = projectId
        ? await listCyclesForProject(prisma, projectId)
        : group
          ? await listCyclesForGroup(prisma, group.id)
          : await listAccessibleCycleRecords(session.user);
      return NextResponse.json(cycles.slice(0, limit).map((cycle) => ({
        id: getCycleEntityRecordId(cycle.id),
        recordKey: `CYCLE-${cycle.id}`,
        title: cycle.name,
        entityTypeId: cycle.issueTypeId,
        sourceId: cycle.id,
      })));
    }

    if (fieldsParam) {
      const requestedFields = fieldsParam.split(",").map((field) => field.trim()).filter(Boolean);
      const select: Prisma.WorkItemSelect = { id: true };
      for (const field of requestedFields) {
        if (field === "recordKey") select.issueKey = true;
        else if (field === "entityTypeId") select.issueTypeId = true;
        else if (field === "sourceId") select.sourceId = true;
        else if (field in workItemSummarySelect) {
          (select as Record<string, boolean>)[field] = true;
        }
      }
      const records = await prisma.workItem.findMany({
        where,
        select,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return NextResponse.json(records.map(canonicalizeRecord));
    }

    const records = await prisma.workItem.findMany({
      where,
      select: workItemSummarySelect,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const serialized = await serializeWorkItemSummaries(prisma, records);
    return NextResponse.json(serialized.map(canonicalizeRecord));
  } catch (error) {
    logApiError("GET", "/api/entity-records", error, { type, projectId, userId: session.user?.id });
    return NextResponse.json(
      { error: "Failed to load entity records.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
