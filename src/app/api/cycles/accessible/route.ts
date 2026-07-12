import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";
import { isAdminUser } from "@/lib/admin-access";
import { getGroupAccess, hasGroupAccess } from "@/lib/group-permissions";
import { getProjectAccess } from "@/lib/project-permissions";
import { canReadCycle } from "@/lib/cycle/permissions";
import { listCyclesForGroup, listCyclesForProject } from "@/lib/cycle/service";

export async function GET() {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const userId = session.user?.id ?? "";
  const projectRefs = isAdminUser(session.user)
    ? await prisma.project.findMany({ select: { id: true } })
    : [
        ...(await prisma.project.findMany({ where: { ownerId: userId }, select: { id: true } })),
        ...(await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }))
          .map((row) => ({ id: row.projectId })),
      ];

  type AccessibleCycle = Awaited<ReturnType<typeof listCyclesForProject>>[number] & {
    contextProject?: { id: string; key: string; name: string };
  };
  const cyclesById = new Map<string, AccessibleCycle>();
  for (const projectId of Array.from(new Set(projectRefs.map((project) => project.id)))) {
    const access = await getProjectAccess(projectId, session.user);
    if (!canReadCycle(access) || !access.project) continue;
    const cycles = await listCyclesForProject(prisma, access.project.id);
    for (const cycle of cycles) {
      if (!cyclesById.has(cycle.id)) {
        cyclesById.set(cycle.id, {
          ...cycle,
          contextProject: {
            id: access.project.id,
            key: access.project.key,
            name: access.project.name,
          },
        });
      }
    }
  }

  const groupRefs = isAdminUser(session.user)
    ? await prisma.projectGroup.findMany({ select: { id: true } })
    : [
        ...(await prisma.projectGroup.findMany({ where: { ownerId: userId }, select: { id: true } })),
        ...(await prisma.projectGroupMember.findMany({ where: { userId }, select: { groupId: true } }))
          .map((row) => ({ id: row.groupId })),
      ];
  for (const groupId of Array.from(new Set(groupRefs.map((group) => group.id)))) {
    const access = await getGroupAccess(groupId, session.user);
    if (!hasGroupAccess(access) || !access.group) continue;
    const cycles = await listCyclesForGroup(prisma, access.group.id);
    for (const cycle of cycles) {
      if (!cyclesById.has(cycle.id)) cyclesById.set(cycle.id, cycle);
    }
  }

  return NextResponse.json({ cycles: Array.from(cyclesById.values()) });
}
